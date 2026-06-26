// Reads the macOS system "Now Playing" track (title / artist / album / artwork)
// and pushes it to the page over Server-Sent Events. No browser API can read this
// directly, so a tiny local helper bridges it in.
//
// The direct MediaRemote C API is entitlement-gated since macOS 15.4 (returns nil).
// We use ungive/mediaremote-adapter (BSD-3): /usr/bin/perl carries the bundle id
// `com.apple.perl5`, which still has access, and loads a small framework that reads
// the info. Build it once with `scripts/setup-nowplaying.sh` (needs cmake).
//
// `get`    -> one-shot full metadata (we use it to seed the current track on start)
// `stream` -> pushes a full snapshot (`--no-diff`) on every change until SIGTERM
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const PERL = '/usr/bin/perl';
const SCRIPT = process.env.NOWPLAYING_SCRIPT || resolve(REPO, 'vendor/mediaremote-adapter/bin/mediaremote-adapter.pl');
const FRAMEWORK = process.env.NOWPLAYING_FRAMEWORK || resolve(REPO, 'vendor/mediaremote-adapter/build/MediaRemoteAdapter.framework');

// The adapter ignores empty now-playing on startup, then fills in via stream. Don't
// let that empty baseline clobber the `get` seed; only honour "stopped" after this.
const EMPTY_GRACE_MS = 2500;

/**
 * Normalize a raw adapter payload into the compact shape the page consumes.
 * Returns null for "nothing playing" (empty payload or no title).
 * @param {any} p
 */
export function normalizeTrack(p) {
  if (!p || typeof p !== 'object' || !p.title) return null;
  const artwork = p.artworkData && p.artworkMimeType
    ? `data:${p.artworkMimeType};base64,${p.artworkData}`
    : null;
  return {
    title: String(p.title || ''),
    artist: String(p.artist || ''),
    album: String(p.album || ''),
    playing: !!p.playing,
    duration: typeof p.duration === 'number' ? p.duration : null,
    bundleId: String(p.bundleIdentifier || ''),
    artwork,
    // playback position so the page can sync lyrics: elapsed seconds AT epoch posAt,
    // advancing at `rate` while playing -> live pos = elapsed + (now - posAt)/1000 * rate.
    elapsed: typeof p.elapsedTime === 'number' ? p.elapsedTime : 0,
    posAt: p.timestamp ? Date.parse(p.timestamp) : Date.now(),
    rate: typeof p.playbackRate === 'number' ? p.playbackRate : 1,
  };
}

/** True when two normalized tracks are visually identical (skip redundant pushes). */
function sameTrack(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.title === b.title && a.artist === b.artist && a.playing === b.playing && a.artwork === b.artwork;
}

// True when the playback position jumped (a user scrub), as opposed to drifting forward
// on its own. Compares the incoming elapsed against where `prev` would have advanced to by
// the new timestamp. Without this, a seek leaves title/artist/playing/artwork unchanged so
// sameTrack() suppresses the push and the page's lyrics never follow the scrub.
function seeked(prev, next) {
  if (!prev || !next) return false;
  const dt = (next.posAt - prev.posAt) / 1000;
  const expected = prev.elapsed + (prev.playing ? dt * (prev.rate || 1) : 0);
  return Math.abs((next.elapsed || 0) - expected) > 1.0;
}

/** @param {{ log?: (m: string) => void }} [opts] */
export function createNowPlayingBridge(opts = {}) {
  const log = opts.log || (() => {});
  /** @type {ReturnType<typeof normalizeTrack>} */
  let current = null;
  /** @type {Set<import('node:http').ServerResponse>} */
  const subscribers = new Set();
  /** @type {import('node:child_process').ChildProcess | null} */
  let child = null;
  let stopped = false;
  let startedAt = 0;
  /** @type {NodeJS.Timeout | null} */
  let restartTimer = null;

  function broadcast() {
    const frame = `data: ${JSON.stringify(current)}\n\n`;
    for (const res of subscribers) { try { res.write(frame); } catch { /* dropped */ } }
  }

  /** @param {ReturnType<typeof normalizeTrack>} next @param {boolean} fromStreamBaseline */
  function setCurrent(next, fromStreamBaseline = false) {
    // Ignore the stream's empty baseline right after start (the `get` seed wins).
    if (next === null && fromStreamBaseline && Date.now() - startedAt < EMPTY_GRACE_MS) return;
    // Push on a visual change OR a position jump (scrub) — so lyrics resync to the new spot.
    const changed = !sameTrack(current, next) || seeked(current, next);
    current = next;
    if (changed) broadcast();
  }

  function seed() {
    const p = spawn(PERL, [SCRIPT, FRAMEWORK, 'get'], { stdio: ['ignore', 'pipe', 'ignore'] });
    let buf = '';
    p.stdout.on('data', (d) => { buf += d; });
    p.on('close', () => { try { setCurrent(normalizeTrack(JSON.parse(buf))); } catch { /* no track */ } });
    p.on('error', (e) => log('seed failed: ' + e.message));
  }

  function startStream() {
    if (stopped) return;
    child = spawn(PERL, [SCRIPT, FRAMEWORK, 'stream', '--no-diff', '--debounce=250'], { stdio: ['ignore', 'pipe', 'ignore'] });
    const rl = createInterface({ input: /** @type {NodeJS.ReadableStream} */ (child.stdout) });
    rl.on('line', (line) => {
      const s = line.trim();
      if (!s) return;
      try {
        const msg = JSON.parse(s);
        if (msg && msg.type === 'data') setCurrent(normalizeTrack(msg.payload), true);
      } catch { /* ignore non-JSON chatter */ }
    });
    child.on('error', (e) => log('stream error: ' + e.message));
    child.on('close', () => {
      child = null;
      if (!stopped) restartTimer = setTimeout(startStream, 1500); // respawn if it dies
    });
  }

  function start() {
    if (!existsSync(SCRIPT) || !existsSync(FRAMEWORK)) {
      log('adapter not built — run scripts/setup-nowplaying.sh (overlay stays hidden)');
      return false;
    }
    startedAt = Date.now();
    seed();
    startStream();
    return true;
  }

  function stop() {
    stopped = true;
    if (restartTimer) clearTimeout(restartTimer);
    if (child) { try { child.kill('SIGTERM'); } catch { /* already gone */ } child = null; }
    for (const res of subscribers) { try { res.end(); } catch { /* dropped */ } }
    subscribers.clear();
  }

  /**
   * Server-Sent-Events handler: sends the current track immediately, then on change.
   * @param {import('node:http').IncomingMessage} req
   * @param {import('node:http').ServerResponse} res
   */
  function sse(req, res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 2000\n\n');
    res.write(`data: ${JSON.stringify(current)}\n\n`);
    subscribers.add(res);
    const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch { /* dropped */ } }, 25000);
    req.on('close', () => { clearInterval(ping); subscribers.delete(res); });
  }

  return { start, stop, sse };
}

// --- lyrics proxy: lrclib (good Western coverage) then NetEase (good Chinese coverage).
// Done server-side so it bypasses CORS (NetEase blocks browser fetches). Cached per song.
const NE_HEADERS = { Referer: 'https://music.163.com', 'User-Agent': 'Mozilla/5.0' };
const lyricsCache = new Map(); // "title|artist" -> syncedLyrics string | null

async function fetchJSON(url, opts = {}) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), opts.timeout || 6000);
  try {
    const r = await fetch(url, { headers: opts.headers, signal: ctrl.signal });
    return r.ok ? await r.json() : null;
  } catch { return null; } finally { clearTimeout(to); }
}

const isSynced = (lrc) => typeof lrc === 'string' && /\[\d+:\d/.test(lrc);

// 汽水 reports many remix/slowed/decorated titles; strip the decorations so they match
// the original song on lrclib/NetEase (which is where the lyrics live).
function cleanTitle(t) {
  return String(t || '')
    .replace(/[([【（].*?[)\]】）]/g, ' ')                                          // (...) [...] 【...】
    .replace(/\s*[-—]\s*(remix|live|slow|sped.*|dj|伴奏|cover|inst.*|acoustic|remaster.*).*$/i, ' ')
    .replace(/\s*(feat\.?|ft\.?|featuring)\s+.*$/i, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
const norm = (s) => String(s || '').toLowerCase().replace(/[^0-9a-z一-鿿]/g, '');
function artistMatch(a1, a2) {
  const n2 = norm(a2);
  const toks = String(a1 || '').toLowerCase().match(/[0-9a-z]+|[一-鿿]+/g) || [];
  for (const t of toks) if (t.length >= 2 && n2.includes(t)) return true;
  const n1 = norm(a1);
  return !!n1 && (n2.includes(n1) || n1.includes(n2));
}
// Accept a search hit only if its name matches the cleaned title AND the artist matches
// (when we have one) — otherwise a same-named unrelated song would hand back WRONG lyrics.
function titleMatch(name, arts, ct, artist) {
  const nn = norm(name), nc = norm(ct);
  if (!nn || !nc) return false;
  if (!(nn === nc || nn.includes(nc) || nc.includes(nn))) return false;
  return artist ? artistMatch(artist, arts) : nn === nc;
}

// markers of a NON-original upload (remix / cover / version / live) — used to deprioritize
// the re-upload spam that pollutes NetEase search results.
const VERSION_RX = /(remix|cover|live|inst|acoustic|\bdj\b|sped|slow|mashup|版|翻唱|伴奏|原唱|纯音乐|现场)/i;

// NetEase: search, then among the hits that match the title (+artist when given), RANK them
// and return the best one's synced lyrics. NetEase's open search is full of re-uploads, so
// we prefer the original: exact title, a single (real) artist, no remix/cover/版 marker —
// rather than blindly trusting the first hit.
async function neLyric(query, ct, artist) {
  const s = new URLSearchParams({ s: query, type: '1', limit: '10' });
  const sr = await fetchJSON('https://music.163.com/api/search/get?' + s, { headers: NE_HEADERS });
  const songs = (sr && sr.result && sr.result.songs) || [];
  const nc = norm(ct), na = norm(artist), rawArtist = String(artist || '').trim();
  /** @type {{id:number, score:number}[]} */
  const cands = [];
  for (const sg of songs.slice(0, 10)) {
    const artsArr = (sg.artists || []).map((a) => a.name);
    if (!titleMatch(sg.name, artsArr.join(','), ct, artist)) continue;
    let score = 0;
    if (norm(sg.name) === nc) score += 4;                                            // exact title (no suffix)
    if (artsArr.length === 1) score += 2;                                            // not a 2-artist re-upload
    if (rawArtist && artsArr.some((a) => String(a).trim() === rawArtist)) score += 3; // real artist, exactly
    else if (na && norm(artsArr.join(',')) === na) score += 2;
    if (VERSION_RX.test(sg.name)) score -= 4;                                        // remix/cover/版/live
    cands.push({ id: sg.id, score });
  }
  cands.sort((a, b) => b.score - a.score);
  for (const c of cands.slice(0, 6)) {
    const ly = await fetchJSON(`https://music.163.com/api/song/lyric?id=${c.id}&lv=1&kv=1&tv=-1`, { headers: NE_HEADERS });
    const lrc = ly && ly.lrc && ly.lrc.lyric;
    if (isSynced(lrc)) return lrc;
  }
  return null;
}

// NetEase, trying a few query forms (cleaned+artist, cleaned alone, raw+artist).
async function neLyrics(title, ct, artist) {
  for (const query of [...new Set([(ct + ' ' + artist).trim(), ct, (title + ' ' + artist).trim()].filter(Boolean))]) {
    const r = await neLyric(query, ct, artist);
    if (r) return r;
  }
  return null;
}

// lrclib, trying the full title then the cleaned title.
async function lrclibLyric(title, ct, album, artist, duration) {
  for (const tt of [...new Set([title, ct].filter(Boolean))]) {
    const params = new URLSearchParams({ artist_name: artist, track_name: tt, album_name: album || '', duration: String(duration || 0) });
    const d = await fetchJSON('https://lrclib.net/api/get?' + params);
    if (d && isSynced(d.syncedLyrics) && !d.instrumental) return d.syncedLyrics;
  }
  return null;
}

// --- TITLE-ONLY fallbacks (last resort, only after strict title+artist fails). 汽水 often
// tags songs with a compilation/uploader name (e.g. 金典名曲, 群星, DJ, 抖音热歌) instead of
// the real artist, which makes the strict artist match reject everything. Here we match by
// the cleaned TITLE alone — but require an EXACT title match (no fuzzy includes) so we still
// don't grab an unrelated same-ish song (the earlier 无限猎犬→爱无限 class of bug).
async function neLyricLoose(ct) {
  return neLyric(ct, ct, ''); // empty artist -> titleMatch falls back to an exact name === ct
}
async function lrclibSearch(ct) {
  const arr = await fetchJSON('https://lrclib.net/api/search?' + new URLSearchParams({ track_name: ct }));
  if (!Array.isArray(arr)) return null;
  const nc = norm(ct);
  for (const d of arr.slice(0, 8)) {
    if (d && isSynced(d.syncedLyrics) && !d.instrumental && norm(d.trackName) === nc) return d.syncedLyrics;
  }
  return null;
}

const hasCJK = (s) => /[㐀-鿿]/.test(String(s || ''));

async function fetchLyrics(q) {
  const key = (q.title || '') + '|' + (q.artist || '');
  if (lyricsCache.has(key)) return lyricsCache.get(key);
  const title = q.title || '', artist = q.artist || '', ct = cleanTitle(title) || title;
  // Source order by script: for Chinese songs NetEase (mainland, 简体) is authoritative and
  // matches what 汽水 shows, whereas lrclib's community LRCs are frequently 繁体 — which is
  // the "把简体变繁体" bug. So CJK -> NetEase first; Western -> lrclib first. The other source
  // is always the fallback, so coverage is the union of both, just prioritized correctly.
  const cjk = hasCJK(title) || hasCJK(artist);
  let synced = null;
  if (cjk) {
    synced = await neLyrics(title, ct, artist);
    if (!synced) synced = await lrclibLyric(title, ct, q.album, artist, q.duration);
  } else {
    synced = await lrclibLyric(title, ct, q.album, artist, q.duration);
    if (!synced && title) synced = await neLyrics(title, ct, artist);
  }
  // last resort: match by title alone (handles junk/compilation artist tags). Only reached
  // when the strict pass found nothing, so it can't override a confident title+artist match.
  if (!synced && ct) {
    if (cjk) {
      synced = await neLyricLoose(ct);
      if (!synced) synced = await lrclibSearch(ct);
    } else {
      synced = await lrclibSearch(ct);
      if (!synced) synced = await neLyricLoose(ct);
    }
  }
  lyricsCache.set(key, synced);
  return synced;
}

// Vite dev-server plugin: spawn the bridge and serve the stream at /__nowplaying,
// on whatever port Vite runs (so it follows the user's --port 5188). Dev only.
export function nowPlayingVitePlugin() {
  /** @type {ReturnType<typeof createNowPlayingBridge> | null} */
  let bridge = null;
  return {
    name: 'now-playing-bridge',
    apply: 'serve',
    /** @param {import('vite').ViteDevServer} server */
    configureServer(server) {
      bridge = createNowPlayingBridge({ log: (m) => server.config.logger.info('[now-playing] ' + m) });
      const ok = bridge.start();
      server.config.logger.info('[now-playing] ' + (ok ? 'reading system Now Playing → /__nowplaying' : 'disabled'));
      server.middlewares.use('/__nowplaying', (req, res) => bridge?.sse(req, res));
      // server-side lyrics proxy (lrclib + NetEase) so the page can fetch same-origin
      server.middlewares.use('/__lyrics', async (req, res) => {
        try {
          const u = new URL(req.originalUrl || req.url || '/', 'http://localhost');
          const synced = await fetchLyrics({
            title: u.searchParams.get('title') || '',
            artist: u.searchParams.get('artist') || '',
            album: u.searchParams.get('album') || '',
            duration: u.searchParams.get('duration') || '',
          });
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ syncedLyrics: synced }));
        } catch { res.statusCode = 500; res.end('{}'); }
      });
      const close = () => { bridge?.stop(); bridge = null; };
      server.httpServer?.once('close', close);
      process.once('SIGINT', close);
      process.once('SIGTERM', close);
    },
  };
}
