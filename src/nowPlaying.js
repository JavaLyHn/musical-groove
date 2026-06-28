// @ts-check
// Top-of-screen "now playing" surface that behaves like the iOS Dynamic Island: a compact
// pill (cover + title — artist + a thin progress underline) that, on click, morphs smoothly
// into a larger card showing the big cover, full title / artist / album, and a DRAGGABLE
// progress bar that seeks real playback (via the bridge's /__seek). Track data arrives over
// SSE from the now-playing bridge; on each track change we also pull the cover's dominant
// colour for the scene palette (onColor).
import { coverColorFromImage } from './util/coverColor.js';

/** @typedef {{ title:string, artist:string, album:string, playing:boolean, duration:number|null, bundleId:string, artwork:string|null, elapsed:number, posAt:number, rate:number }} Track */

/** @param {number} s @returns {string} m:ss */
function mmss(s) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return m + ':' + (r < 10 ? '0' : '') + r;
}

/** @param {{ onColor?: (rgb: [number, number, number] | null) => void, onTrack?: (track: Track | null) => void, onSeek?: (seconds: number) => void, onCmd?: (id: number) => void }} [opts] */
export function createNowPlaying(opts = {}) {
  const onColor = opts.onColor || (() => {});
  const onTrack = opts.onTrack || (() => {});
  const onSeek = opts.onSeek || (() => {});
  const onCmd = opts.onCmd || (() => {}); // MRCommand: prev=5, toggle play/pause=2, next=4

  // Notched-Mac safe area: the Electron main process passes the top inset (menu-bar/notch height)
  // as ?safetop, used as the fallback when env(safe-area-inset-top) isn't available — so the
  // centered card sits below the camera notch instead of under it.
  const _safeTop = Number(new URLSearchParams(location.search).get('safetop')) || 0;
  if (_safeTop > 0) document.documentElement.style.setProperty('--safe-top', _safeTop + 'px');

  const style = document.createElement('style');
  style.textContent = `
    /* top offset clears the camera notch on notched Macs. env(safe-area-inset-top) resolves to 0 in
       Electron's fullscreen here (supported-but-0, so it shadows any env() fallback), so MAX it with
       --safe-top (the real menu-bar/notch height the main process passes via ?safetop) and add a
       comfortable gap below the notch. */
    .np{position:fixed;top:calc(max(env(safe-area-inset-top, 0px), var(--safe-top, 44px)) + 22px);left:50%;z-index:9;box-sizing:border-box;
      transform:translateX(-50%) translateY(-12px) translateZ(0);opacity:0;pointer-events:auto;cursor:pointer;
      -webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;
      width:248px;height:46px;padding:8px;border-radius:23px;overflow:hidden;
      display:flex;flex-direction:column;
      background:rgba(12,18,40,.46);-webkit-backdrop-filter:blur(16px) saturate(1.4);backdrop-filter:blur(16px) saturate(1.4);
      box-shadow:0 6px 28px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.06);
      border:1px solid rgba(150,175,240,.16);
      font-family:-apple-system,"PingFang SC",system-ui,sans-serif;
      /* promote to a dedicated GPU layer so the per-frame repaint + glass re-blur during the
         morph stays isolated to the card (not re-composited against the WebGL canvas behind it),
         and pre-allocate a backing store for the animated size — this is what kills the stutter. */
      will-change:width,height,border-radius,transform;contain:layout paint;
      backface-visibility:hidden;-webkit-backface-visibility:hidden;
      /* the silky morph — iOS-style ease, size + radius together */
      transition:width .52s cubic-bezier(.32,.72,0,1), height .52s cubic-bezier(.32,.72,0,1),
        border-radius .52s cubic-bezier(.32,.72,0,1), opacity .5s ease, transform .5s ease;}
    .np.show{opacity:1;transform:translateX(-50%) translateY(0) translateZ(0)}
    .np.expanded{width:380px;height:228px;border-radius:26px;padding:14px;cursor:default}

    .np-main{display:flex;align-items:center;gap:11px;flex:0 0 auto;min-height:0}
    .np.expanded .np-main{align-items:flex-start}
    .np-cover{flex:0 0 auto;width:30px;height:30px;border-radius:7px;object-fit:cover;display:none;
      -webkit-user-drag:none;-webkit-user-select:none;user-select:none;
      box-shadow:0 2px 10px rgba(0,0,0,.5);will-change:width,height;
      transition:width .52s cubic-bezier(.32,.72,0,1), height .52s cubic-bezier(.32,.72,0,1), border-radius .52s cubic-bezier(.32,.72,0,1)}
    .np.expanded .np-cover{width:100px;height:100px;border-radius:14px}
    .np-glyph{flex:0 0 auto;width:30px;height:30px;border-radius:7px;display:none;align-items:center;justify-content:center;
      color:#aeb6e6;font-size:15px;background:rgba(120,170,235,.14);will-change:width,height;
      transition:width .52s cubic-bezier(.32,.72,0,1), height .52s cubic-bezier(.32,.72,0,1)}
    .np.expanded .np-glyph{width:100px;height:100px;border-radius:14px;font-size:42px}

    .np-meta{min-width:0;flex:1 1 auto;display:flex;flex-direction:column;justify-content:center;gap:2px}
    .np.expanded .np-meta{padding-top:4px;gap:5px}
    .np-title{color:#eef1ff;font-weight:600;font-size:13px;line-height:1.25;
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .np.expanded .np-title{font-size:17px;white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
    .np-artist{color:#aab2dd;font-size:12px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .np.expanded .np-artist{font-size:13px}
    .np-album{color:#7e8bc0;font-size:11px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
      opacity:0;max-height:0;transition:opacity .3s ease}
    .np.expanded .np-album{opacity:1;max-height:18px}

    /* transport controls — prev / play-pause / next, crisp SVG icons (revealed in the card) */
    .np-controls{flex:0 0 auto;display:flex;align-items:center;justify-content:center;gap:24px;
      margin-top:12px;opacity:0;pointer-events:none;transition:opacity .32s ease}
    .np.expanded .np-controls{opacity:1;pointer-events:auto;transition-delay:.1s}
    .np-btn{display:flex;align-items:center;justify-content:center;cursor:pointer;border:none;padding:0;
      border-radius:50%;background:transparent;color:#cdd6ff;-webkit-tap-highlight-color:transparent;
      transition:transform .16s cubic-bezier(.34,1.56,.64,1), background .18s ease, color .18s ease, box-shadow .2s ease}
    .np-btn svg{display:block;pointer-events:none;fill:currentColor}
    /* prev / next — ghost circles that light up on hover */
    .np-prev,.np-next{width:38px;height:38px;background:rgba(255,255,255,.045);
      box-shadow:inset 0 0 0 1px rgba(180,200,255,.08)}
    .np-prev svg,.np-next svg{width:19px;height:19px}
    .np-prev:hover,.np-next:hover{background:rgba(150,180,255,.18);color:#fff;transform:scale(1.07)}
    .np-prev:active,.np-next:active{transform:scale(.9);background:rgba(150,180,255,.26)}
    /* play / pause — filled gradient pebble, the focal control */
    .np-play{width:48px;height:48px;color:#0a1430;
      background:linear-gradient(140deg,#6fe1ec 0%,#88a2f5 52%,#a98ef0 100%);
      box-shadow:0 6px 18px rgba(110,170,235,.5),inset 0 1px 0 rgba(255,255,255,.5)}
    .np-play svg{width:21px;height:21px}
    .np-play .np-ic-play{transform:translateX(1px)} /* optical-center the triangle */
    .np-play:hover{color:#0a1430;transform:scale(1.07);
      box-shadow:0 9px 26px rgba(120,180,240,.62),inset 0 1px 0 rgba(255,255,255,.55)}
    .np-play:active{transform:scale(.93)}
    /* toggle which glyph shows: play when paused, pause when playing */
    .np-play .np-ic-pause{display:none}
    .np-play.playing .np-ic-play{display:none}
    .np-play.playing .np-ic-pause{display:block}

    /* seek bar — hidden/clipped when collapsed, revealed in the card */
    .np-seek{flex:0 0 auto;margin-top:14px;display:flex;align-items:center;gap:9px;
      opacity:0;pointer-events:none;transition:opacity .32s ease}
    .np.expanded .np-seek{opacity:1;pointer-events:auto;transition-delay:.12s}
    .np-time{flex:0 0 auto;font-size:10px;color:#9aa6d4;font-variant-numeric:tabular-nums;min-width:30px;text-align:center}
    .np-track{position:relative;flex:1 1 auto;height:16px;display:flex;align-items:center;cursor:pointer;touch-action:none}
    .np-rail{position:absolute;left:0;right:0;height:4px;border-radius:2px;background:rgba(150,170,235,.22)}
    .np-fill{position:absolute;left:0;height:4px;border-radius:2px;width:0;
      background:linear-gradient(90deg,#5FD0E0,#9A8FE6);transition:width .2s linear}
    .np-knob{position:absolute;width:12px;height:12px;border-radius:50%;background:#eaf0ff;
      transform:translateX(-50%);left:0;box-shadow:0 1px 5px rgba(0,0,0,.5);
      opacity:0;transition:opacity .2s ease, left .2s linear}
    .np.expanded .np-track:hover .np-knob,.np-track.dragging .np-knob{opacity:1}
    .np-track.dragging .np-fill,.np-track.dragging .np-knob{transition:none}`;
  document.head.appendChild(style);

  const wrap = document.createElement('div');
  wrap.className = 'np';
  wrap.innerHTML =
    '<div class="np-main">' +
      '<img class="np-cover" alt=""/><span class="np-glyph">♪</span>' +
      '<div class="np-meta"><div class="np-title"></div><div class="np-artist"></div><div class="np-album"></div></div>' +
    '</div>' +
    '<div class="np-seek">' +
      '<span class="np-time np-cur">0:00</span>' +
      '<div class="np-track"><div class="np-rail"></div><div class="np-fill"></div><div class="np-knob"></div></div>' +
      '<span class="np-time np-dur">0:00</span>' +
    '</div>' +
    '<div class="np-controls">' +
      '<button class="np-btn np-prev" title="上一首" aria-label="上一首">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6h2v12H6zm12 0l-9 6 9 6z"/></svg>' +
      '</button>' +
      '<button class="np-btn np-play" title="播放 / 暂停" aria-label="播放 / 暂停">' +
        '<svg class="np-ic-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>' +
        '<svg class="np-ic-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>' +
      '</button>' +
      '<button class="np-btn np-next" title="下一首" aria-label="下一首">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 6h2v12h-2zM6 6l9 6-9 6z"/></svg>' +
      '</button>' +
    '</div>';
  document.body.appendChild(wrap);

  const cover = /** @type {HTMLImageElement} */ (wrap.querySelector('.np-cover'));
  const glyph = /** @type {HTMLElement} */ (wrap.querySelector('.np-glyph'));
  const titleEl = /** @type {HTMLElement} */ (wrap.querySelector('.np-title'));
  const artistEl = /** @type {HTMLElement} */ (wrap.querySelector('.np-artist'));
  const albumEl = /** @type {HTMLElement} */ (wrap.querySelector('.np-album'));
  const seekEl = /** @type {HTMLElement} */ (wrap.querySelector('.np-seek'));
  const trackEl = /** @type {HTMLElement} */ (wrap.querySelector('.np-track'));
  const fill = /** @type {HTMLElement} */ (wrap.querySelector('.np-fill'));
  const knob = /** @type {HTMLElement} */ (wrap.querySelector('.np-knob'));
  const curEl = /** @type {HTMLElement} */ (wrap.querySelector('.np-cur'));
  const durEl = /** @type {HTMLElement} */ (wrap.querySelector('.np-dur'));
  const prevBtn = /** @type {HTMLElement} */ (wrap.querySelector('.np-prev'));
  const playBtn = /** @type {HTMLElement} */ (wrap.querySelector('.np-play'));
  const nextBtn = /** @type {HTMLElement} */ (wrap.querySelector('.np-next'));

  /** @type {Track|null} */
  let cur = null;
  let lastKey = '';
  let expanded = false;
  let dragging = false;
  let dragRatio = 0;

  function livePos() {
    if (!cur) return 0;
    const base = cur.elapsed || 0;
    if (!cur.playing) return base;
    return base + (Date.now() - (cur.posAt || Date.now())) / 1000 * (cur.rate || 1);
  }

  // paint the progress bar (skipped mid-drag, where the pointer drives it instead)
  function paintProgress() {
    const dur = cur && cur.duration ? cur.duration : 0;
    const ratio = dragging ? dragRatio : (dur > 0 ? Math.min(livePos() / dur, 1) : 0);
    const pct = (ratio * 100).toFixed(2) + '%';
    fill.style.width = pct;
    knob.style.left = pct;
    curEl.textContent = mmss(dragging ? dragRatio * dur : livePos());
    durEl.textContent = mmss(dur);
  }

  /** @param {number} clientX */
  function ratioFromX(clientX) {
    const r = trackEl.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - r.left) / Math.max(1, r.width)));
  }

  trackEl.addEventListener('pointerdown', (e) => {
    if (!cur || !cur.duration) return;
    e.stopPropagation();           // don't toggle the card
    dragging = true;
    trackEl.classList.add('dragging');
    dragRatio = ratioFromX(e.clientX);
    trackEl.setPointerCapture(e.pointerId);
    paintProgress();
  });
  trackEl.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    dragRatio = ratioFromX(e.clientX);
    paintProgress();
  });
  /** @param {PointerEvent} e */
  const endDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    trackEl.classList.remove('dragging');
    const dur = cur && cur.duration ? cur.duration : 0;
    if (dur > 0) {
      const target = dragRatio * dur;
      onSeek(target);
      if (cur) { cur.elapsed = target; cur.posAt = Date.now(); } // optimistic; the bridge confirms
    }
    try { trackEl.releasePointerCapture(e.pointerId); } catch { /* */ }
    paintProgress();
  };
  trackEl.addEventListener('pointerup', endDrag);
  trackEl.addEventListener('pointercancel', endDrag);

  /** @param {boolean} v */
  function setExpanded(v) {
    expanded = v;
    wrap.classList.toggle('expanded', expanded);
  }
  // click the pill / card to expand or collapse
  wrap.addEventListener('click', () => { if (cur) setExpanded(!expanded); });
  // a click/drag on the seek bar must not bubble up and collapse the card
  trackEl.addEventListener('click', (e) => e.stopPropagation());
  // click anywhere OUTSIDE the card collapses it (so you don't have to click back inside)
  document.addEventListener('click', (e) => {
    if (expanded && !wrap.contains(/** @type {Node} */ (e.target))) setExpanded(false);
  });
  // Esc also collapses
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && expanded) setExpanded(false); });

  // transport — prev (5) / toggle play-pause (2) / next (4). Stop propagation so the click
  // doesn't also collapse the card.
  /** @param {Event} e @param {number} id */
  const cmd = (e, id) => { e.stopPropagation(); onCmd(id); };
  prevBtn.addEventListener('click', (e) => cmd(e, 5));
  nextBtn.addEventListener('click', (e) => cmd(e, 4));
  playBtn.addEventListener('click', (e) => {
    cmd(e, 2);
    if (cur) { cur.playing = !cur.playing; paintPlay(); } // optimistic; SSE confirms
  });

  // playing -> show the pause glyph (so the button pauses); paused -> show the play glyph
  function paintPlay() { playBtn.classList.toggle('playing', !!(cur && cur.playing)); }

  /** @param {string} dataUri */
  function extractColor(dataUri) {
    const im = new Image();
    im.onload = () => { onColor(coverColorFromImage(im)); };
    im.onerror = () => { onColor(null); };
    im.src = dataUri;
  }

  /** @param {Track | null} t */
  function render(t) {
    onTrack(t); // every message, so lyrics keep fresh playback timing
    cur = t;
    if (!t || !t.title) {
      wrap.classList.remove('show', 'expanded');
      expanded = false; lastKey = '';
      onColor(null);
      return;
    }
    titleEl.textContent = t.title;
    artistEl.textContent = t.artist || '';
    albumEl.textContent = t.album || '';
    if (t.artwork) {
      cover.src = t.artwork; cover.style.display = 'block'; glyph.style.display = 'none';
    } else {
      cover.removeAttribute('src'); cover.style.display = 'none'; glyph.style.display = 'flex';
    }
    seekEl.style.visibility = t.duration ? 'visible' : 'hidden';
    paintProgress();
    paintPlay();

    const key = t.title + '|' + t.artist;
    if (key !== lastKey) {
      lastKey = key;
      wrap.classList.remove('show');
      void wrap.offsetWidth;       // reflow so the entrance restarts on a real track change
      wrap.classList.add('show');
      if (t.artwork) extractColor(t.artwork); else onColor(null);
    } else {
      wrap.classList.add('show');
    }
  }

  // keep the bar moving between SSE messages; CSS .2s linear smooths the steps
  const tick = setInterval(() => { if (cur && !dragging) paintProgress(); }, 250);

  /** @type {EventSource | null} */
  let es = null;
  try {
    es = new EventSource('/__nowplaying');
    es.onmessage = (e) => { try { render(JSON.parse(e.data)); } catch { /* ignore */ } };
    es.onerror = () => { /* browser retries automatically */ };
  } catch { /* EventSource unavailable */ }

  return { wrap, render, close: () => { clearInterval(tick); es && es.close(); } };
}
