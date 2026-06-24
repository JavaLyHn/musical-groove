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
    if (sameTrack(current, next)) { current = next; return; }
    current = next;
    broadcast();
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
      const close = () => { bridge?.stop(); bridge = null; };
      server.httpServer?.once('close', close);
      process.once('SIGINT', close);
      process.once('SIGTERM', close);
    },
  };
}
