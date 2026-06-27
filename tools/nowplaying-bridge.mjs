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

// Strip the decorations 汽水 adds to titles (remix/slow/(...)) so the SEARCH can find the
// song. This only affects the query — never the lyric text we display, which is shown as-is.
function cleanTitle(t) {
  return String(t || '')
    .replace(/[([【（].*?[)\]】）]/g, ' ')                                          // (...) [...] 【...】
    .replace(/\s*[-—]\s*(remix|live|slow|sped.*|dj|伴奏|cover|inst.*|acoustic|remaster.*).*$/i, ' ')
    .replace(/\s*(feat\.?|ft\.?|featuring)\s+.*$/i, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
const hasCJK = (s) => /[㐀-鿿]/.test(String(s || ''));

// NetEase: a search hit with ORIGINAL synced lyrics. We read only `lrc.lyric` (the original)
// — never `tlyric` (translation) — and never judge by artist. To stay in SYNC with what's
// actually playing, when we know the track length we PREFER the hit whose recording length
// matches (±3s) — so a cover/remix gets ITS OWN timing-correct lyrics, not the original's
// (whose tempo differs). If none matches the length, we still return the first synced hit.
async function neLyric(query, wantDur = 0) {
  const s = new URLSearchParams({ s: query, type: '1', limit: '10' });
  const sr = await fetchJSON('https://music.163.com/api/search/get?' + s, { headers: NE_HEADERS });
  let songs = ((sr && sr.result && sr.result.songs) || []).slice(0, 10);
  if (wantDur > 0) {
    songs = songs
      .map((sg, i) => ({ sg, i, near: sg.duration ? Math.abs(sg.duration / 1000 - wantDur) <= 3 : false }))
      .sort((a, b) => (a.near === b.near ? a.i - b.i : (a.near ? -1 : 1))) // length-matched first, else relevance
      .map((x) => x.sg);
  }
  for (const sg of songs.slice(0, 8)) {
    const ly = await fetchJSON(`https://music.163.com/api/song/lyric?id=${sg.id}&lv=1&kv=0&tv=0`, { headers: NE_HEADERS });
    const lrc = ly && ly.lrc && ly.lrc.lyric; // original only, as-is
    if (isSynced(lrc)) return lrc;
  }
  return null;
}

// lrclib: exact get (best timing) then a title search; return the original synced lyrics
// as-is (lrclib has no translation field, so syncedLyrics is already the original).
async function lrclibByTitle(title, artist, album, duration) {
  const params = new URLSearchParams({ artist_name: artist || '', track_name: title, album_name: album || '', duration: String(duration || 0) });
  const d = await fetchJSON('https://lrclib.net/api/get?' + params); // /get matches duration ±2s
  if (d && isSynced(d.syncedLyrics) && !d.instrumental) return d.syncedLyrics;
  let arr = await fetchJSON('https://lrclib.net/api/search?' + new URLSearchParams({ track_name: title }));
  if (!Array.isArray(arr)) return null;
  arr = arr.slice(0, 10);
  if (duration > 0) { // prefer the entry whose length matches (sync), else search relevance
    arr = arr
      .map((x, i) => ({ x, i, near: x.duration ? Math.abs(x.duration - duration) <= 3 : false }))
      .sort((a, b) => (a.near === b.near ? a.i - b.i : (a.near ? -1 : 1)))
      .map((o) => o.x);
  }
  for (const x of arr.slice(0, 8)) if (x && isSynced(x.syncedLyrics) && !x.instrumental) return x.syncedLyrics;
  return null;
}

// Show whatever synced lyrics exist, AS-IS: no translation, no 简/繁 conversion, no artist
// filtering, no remix/cover ranking. The only ordering is by script — CJK songs hit NetEase
// first (mainland = 简体, matching what the player shows); everything else hits lrclib first —
// purely so the text matches what you'd see in the player, not to alter it.
async function fetchLyrics(q) {
  const key = (q.title || '') + '|' + (q.artist || '');
  if (lyricsCache.has(key)) return lyricsCache.get(key);
  const title = q.title || '', artist = q.artist || '', ct = cleanTitle(title) || title;
  const dur = Number(q.duration) || 0; // playing track length -> used to pick timing-matched lyrics
  // raw title FIRST so a cover ("…(Cover X)") can find ITS OWN entry (matching timing);
  // cleaned title is the fallback (finds the original) only if the raw turns up nothing.
  const titles = [...new Set([title, ct].filter(Boolean))];
  let synced = null;
  const tryNE = async () => {
    for (const tt of titles) {
      if (artist) { synced = await neLyric((tt + ' ' + artist).trim(), dur); if (synced) return true; }
      synced = await neLyric(tt, dur); if (synced) return true;
    }
    return false;
  };
  const tryLrc = async () => {
    for (const tt of titles) { synced = await lrclibByTitle(tt, artist, q.album, dur); if (synced) return true; }
    return false;
  };
  if (hasCJK(title) || hasCJK(artist)) { (await tryNE()) || (await tryLrc()); }
  else { (await tryLrc()) || (await tryNE()); }
  lyricsCache.set(key, synced);
  return synced;
}

// Seek the system player to `position` SECONDS. The adapter's seek position is in
// MICROSECONDS (see its --help), so convert — otherwise it seeks to ~0 and nothing moves.
function seekTo(position) {
  const pos = Number(position);
  if (!Number.isFinite(pos) || pos < 0) return;
  const micros = Math.round(pos * 1e6);
  try {
    const p = spawn(PERL, [SCRIPT, FRAMEWORK, 'seek', String(micros)], { stdio: 'ignore' });
    p.on('error', () => {});
  } catch { /* ignore */ }
}

// Send an MRCommand to the player (kMRPlay=0, kMRPause=1, kMRTogglePlayPause=2,
// kMRNextTrack=4, kMRPreviousTrack=5). Used by the expanded card's transport buttons.
function sendCommand(id) {
  const n = parseInt(String(id), 10);
  if (!Number.isFinite(n)) return;
  try {
    const p = spawn(PERL, [SCRIPT, FRAMEWORK, 'send', String(n)], { stdio: 'ignore' });
    p.on('error', () => {});
  } catch { /* ignore */ }
}

const BRIDGE_ROUTES = ['/__nowplaying', '/__lyrics', '/__seek', '/__cmd'];

/** @param {string} pathname */
export function isBridgeRoute(pathname) {
  return BRIDGE_ROUTES.includes(pathname);
}

/**
 * Framework-agnostic bridge: owns the now-playing stream + the lyrics/seek/cmd routes.
 * `handle` returns true if it consumed the request (so a host http server can `if(!handle) next/404`).
 * @param {{ log?: (m: string) => void, autoStart?: boolean }} [opts]
 *   autoStart defaults true (real use spawns the now-playing reader); pass false in tests
 *   so no perl process is spawned.
 */
export function createNowPlayingHandler(opts = {}) {
  const log = opts.log || (() => {});
  const bridge = createNowPlayingBridge({ log });
  if (opts.autoStart !== false) bridge.start(); // no-op-ish if the adapter isn't built (logs + overlay stays empty)

  /**
   * @param {import('node:http').IncomingMessage} req
   * @param {import('node:http').ServerResponse} res
   * @returns {boolean} handled
   */
  function handle(req, res) {
    const u = new URL(req.url || '/', 'http://localhost');
    const path = u.pathname;
    if (!isBridgeRoute(path)) return false;
    if (path === '/__nowplaying') { bridge.sse(req, res); return true; }
    if (path === '/__lyrics') {
      fetchLyrics({
        title: u.searchParams.get('title') || '',
        artist: u.searchParams.get('artist') || '',
        album: u.searchParams.get('album') || '',
        duration: u.searchParams.get('duration') || '',
      }).then((synced) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ syncedLyrics: synced }));
      }).catch(() => { res.statusCode = 500; res.end('{}'); });
      return true;
    }
    if (path === '/__seek') {
      seekTo(u.searchParams.get('pos') || u.searchParams.get('position') || '');
      res.setHeader('Content-Type', 'application/json'); res.end('{"ok":true}');
      return true;
    }
    if (path === '/__cmd') {
      sendCommand(u.searchParams.get('id') || '');
      res.setHeader('Content-Type', 'application/json'); res.end('{"ok":true}');
      return true;
    }
    return false;
  }

  return { handle, close: () => bridge.stop() };
}

// Vite dev-server plugin: spawn the bridge and serve the stream at /__nowplaying,
// on whatever port Vite runs (so it follows the user's --port 5188). Dev only.
export function nowPlayingVitePlugin() {
  /** @type {ReturnType<typeof createNowPlayingHandler> | null} */
  let h = null;
  return {
    name: 'now-playing-bridge',
    apply: 'serve',
    /** @param {import('vite').ViteDevServer} server */
    configureServer(server) {
      h = createNowPlayingHandler({ log: (m) => server.config.logger.info('[now-playing] ' + m) });
      server.config.logger.info('[now-playing] bridge routes mounted (/__nowplaying, /__lyrics, /__seek, /__cmd)');
      server.middlewares.use((req, res, next) => { if (!h || !h.handle(req, res)) next(); });
      const close = () => { h?.close(); h = null; };
      server.httpServer?.once('close', close);
      process.once('SIGINT', close);
      process.once('SIGTERM', close);
    },
  };
}
