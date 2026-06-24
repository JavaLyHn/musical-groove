// @ts-check
// A minimal top-of-screen line — small cover thumbnail + "title — artist" — that
// fades in when the track changes. The track data arrives over Server-Sent Events
// from the dev server's now-playing bridge (see tools/nowplaying-bridge.mjs), which
// reads macOS "Now Playing". On each track change we also pull the cover's dominant
// colour and hand it to `onColor` so the scene's palette can follow the album art.
import { coverColorFromImage } from './util/coverColor.js';

/** @typedef {{ title: string, artist: string, album: string, playing: boolean, duration: number|null, bundleId: string, artwork: string|null, elapsed: number, posAt: number, rate: number }} Track */

/** @param {{ onColor?: (rgb: [number, number, number] | null) => void, onTrack?: (track: Track | null) => void }} [opts] */
export function createNowPlaying(opts = {}) {
  const onColor = opts.onColor || (() => {});
  const onTrack = opts.onTrack || (() => {});

  const style = document.createElement('style');
  style.textContent = `
    .now-playing{position:fixed;top:18px;left:50%;z-index:9;
      transform:translateX(-50%) translateY(-10px);opacity:0;
      display:flex;align-items:center;gap:10px;pointer-events:none;
      padding:6px 15px 6px 6px;border-radius:999px;
      background:rgba(12,18,40,.34);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);
      box-shadow:0 2px 18px rgba(0,0,0,.25);
      font-family:-apple-system,"PingFang SC",system-ui,sans-serif;
      transition:opacity .6s ease, transform .6s ease}
    .now-playing.show{opacity:1;transform:translateX(-50%) translateY(0)}
    .now-playing .cover{width:26px;height:26px;border-radius:6px;object-fit:cover;display:none;
      box-shadow:0 1px 6px rgba(0,0,0,.45)}
    .now-playing .glyph{font-size:13px;color:#aeb6e6;display:none;padding:0 2px}
    .now-playing .meta{font-size:13px;letter-spacing:.02em;white-space:nowrap;
      max-width:46vw;overflow:hidden;text-overflow:ellipsis}
    .now-playing .meta b{color:#eef1ff;font-weight:600}
    .now-playing .meta span{color:#aab2dd;margin-left:7px}`;
  document.head.appendChild(style);

  const wrap = document.createElement('div');
  wrap.className = 'now-playing';
  const cover = document.createElement('img');
  cover.className = 'cover';
  cover.alt = '';
  const glyph = document.createElement('span');
  glyph.className = 'glyph';
  glyph.textContent = '♪';
  const meta = document.createElement('div');
  meta.className = 'meta';
  const titleEl = document.createElement('b');
  const artistEl = document.createElement('span');
  meta.append(titleEl, artistEl);
  wrap.append(cover, glyph, meta);
  document.body.appendChild(wrap);

  let lastKey = '';

  /** @param {string} dataUri */
  function extractColor(dataUri) {
    const im = new Image();
    im.onload = () => { onColor(coverColorFromImage(im)); };
    im.onerror = () => { onColor(null); };
    im.src = dataUri;
  }

  /** @param {Track | null} track */
  function render(track) {
    onTrack(track); // every message, so lyrics keep fresh playback timing
    if (!track || !track.title) {
      wrap.classList.remove('show');
      lastKey = '';
      onColor(null);
      return;
    }
    titleEl.textContent = track.title;
    artistEl.textContent = track.artist ? '— ' + track.artist : '';
    if (track.artwork) {
      cover.src = track.artwork;
      cover.style.display = 'block';
      glyph.style.display = 'none';
    } else {
      cover.removeAttribute('src');
      cover.style.display = 'none';
      glyph.style.display = 'inline';
    }

    const key = track.title + '|' + track.artist;
    if (key !== lastKey) {
      lastKey = key;
      // re-trigger the entrance fade on a genuine track change
      wrap.classList.remove('show');
      void wrap.offsetWidth; // reflow so the transition restarts
      wrap.classList.add('show');
      if (track.artwork) extractColor(track.artwork); else onColor(null);
    } else {
      wrap.classList.add('show');
    }
  }

  // EventSource auto-reconnects; if the bridge isn't running (e.g. a production
  // build with no dev server) it just keeps retrying quietly and nothing shows.
  /** @type {EventSource | null} */
  let es = null;
  try {
    es = new EventSource('/__nowplaying');
    es.onmessage = (e) => { try { render(JSON.parse(e.data)); } catch { /* ignore */ } };
    es.onerror = () => { /* browser retries automatically */ };
  } catch { /* EventSource unavailable */ }

  return { wrap, render, close: () => es && es.close() };
}
