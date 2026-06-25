// @ts-check
// Synced, audio-reactive lyrics. The system Now-Playing data carries no lyrics, so when
// the track changes we fetch an LRC from lrclib.net (free, CORS-open) by title/artist/
// duration, parse the [mm:ss.xx] timings, and surface the current line at the lower third
// — large and glowing, BREATHING with the music (scale + glow pulse on level/onset), the
// next line faint beneath. No synced lyrics found (or instrumental) -> nothing shows.

import { CONFIG } from './config.js';

/** @typedef {{ title:string, artist:string, album:string, duration:number|null, playing:boolean, elapsed:number, posAt:number, rate:number }} Track */

/** Parse LRC text into time-sorted lines, dropping blank (instrumental-gap) lines.
 * @param {string} text @returns {{ t:number, text:string }[]} */
function parseLRC(text) {
  /** @type {{ t:number, text:string }[]} */
  const out = [];
  const re = /\[(\d+):(\d+(?:\.\d+)?)\]/g;
  for (const raw of String(text).split('\n')) {
    re.lastIndex = 0;
    /** @type {number[]} */
    const times = [];
    let m;
    while ((m = re.exec(raw))) times.push(parseInt(m[1], 10) * 60 + parseFloat(m[2]));
    if (!times.length) continue;
    const body = raw.replace(re, '').trim();
    if (!body) continue;
    for (const t of times) out.push({ t, text: body });
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}

export function createLyrics() {
  const style = document.createElement('style');
  style.textContent = `
    .lyhn-lyrics{position:fixed;left:50%;bottom:15%;transform:translateX(-50%);z-index:8;
      width:min(82vw,920px);text-align:center;pointer-events:none;
      font-family:-apple-system,"PingFang SC","Hiragino Sans GB",system-ui,sans-serif;}
    .lyhn-lyrics .cur{font-size:36px;font-weight:700;letter-spacing:.03em;line-height:1.3;
      opacity:0;transform:translateY(9px);
      transition:opacity .26s ease, transform .26s cubic-bezier(.2,.8,.2,1);will-change:transform,opacity;}
    .lyhn-lyrics .cur.show{opacity:1;transform:translateY(0);}
    .lyhn-lyrics .cur .txt{display:inline-block;will-change:transform;color:#d6e3ff;
      text-shadow:0 0 17px rgba(95,208,224,.5), 0 0 36px rgba(120,150,240,.28), 0 2px 10px rgba(6,10,28,.55);}
    .lyhn-lyrics .nxt{font-size:17px;font-weight:500;margin-top:14px;letter-spacing:.02em;
      color:#93a6df;opacity:0;transition:opacity .4s ease;}
    .lyhn-lyrics .nxt.show{opacity:.46;}`;
  document.head.appendChild(style);

  const wrap = document.createElement('div');
  wrap.className = 'lyhn-lyrics';
  const cur = document.createElement('div');
  cur.className = 'cur';
  const txt = document.createElement('span');
  txt.className = 'txt';
  cur.appendChild(txt);
  const nxt = document.createElement('div');
  nxt.className = 'nxt';
  wrap.append(cur, nxt);
  document.body.appendChild(wrap);

  /** @type {Track|null} */
  let track = null;
  /** @type {{t:number,text:string}[]} */
  let lines = [];
  let lineIdx = -1;
  let fetchId = 0;
  let curKey = '';
  let lastPos = 0; // last sane playback position, so a pause that mis-reports elapsed≈0
                   // freezes the lyric here instead of snapping back to the first line.
  let sFont = -1, sBottom = -1, sGlow = -1; // last-applied style cache (avoid per-frame writes)

  // Apply the live-tunable look (?gui 歌词 folder). Cached so each property only writes to
  // the DOM when it actually changes — no per-frame layout thrash.
  function applyStyle() {
    const L = CONFIG.lyrics;
    if (L.fontSize !== sFont) { sFont = L.fontSize; cur.style.fontSize = sFont + 'px'; }
    if (L.bottom !== sBottom) { sBottom = L.bottom; wrap.style.bottom = sBottom + '%'; }
    if (L.glow !== sGlow) {
      const g = sGlow = L.glow; // scale the halo; g=0 -> no glow, 1 -> the original look
      txt.style.textShadow =
        `0 0 ${(17 * g).toFixed(1)}px rgba(95,208,224,${(0.5 * g).toFixed(3)}),` +
        `0 0 ${(36 * g).toFixed(1)}px rgba(120,150,240,${(0.28 * g).toFixed(3)}),` +
        `0 2px 10px rgba(6,10,28,.55)`;
    }
    // next line visibility responds live to the toggle
    if (L.showNext === false) nxt.classList.remove('show');
    else if (lineIdx >= 0 && nxt.textContent) nxt.classList.add('show');
  }

  function hide() {
    lines = []; lineIdx = -1;
    cur.classList.remove('show'); nxt.classList.remove('show');
  }

  /** @param {Track|null} t */
  function setTrack(t) {
    if (!t || !t.title) { track = null; curKey = ''; lastPos = 0; hide(); return; }
    track = t; // keep the freshest playback timing every message
    const key = t.title + '|' + t.artist;
    if (key === curKey) return; // same song -> just a timing refresh
    curKey = key;
    lastPos = 0; // new song starts from the top
    hide();
    const id = ++fetchId;
    // same-origin proxy (bridge does lrclib + NetEase server-side, no CORS); it returns
    // already-filtered synced LRC or null.
    const url = '/__lyrics?' + new URLSearchParams({
      title: t.title || '',
      artist: t.artist || '',
      album: t.album || '',
      duration: String(Math.round(t.duration || 0)),
    });
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (id !== fetchId) return; // a newer track superseded this fetch
        lines = (d && d.syncedLyrics) ? parseLRC(d.syncedLyrics) : [];
        lineIdx = -1;
      })
      .catch(() => { if (id === fetchId) { lines = []; lineIdx = -1; } });
  }

  function position() {
    if (!track) return 0;
    if (track.playing) {
      lastPos = (track.elapsed || 0) + (Date.now() - (track.posAt || Date.now())) / 1000 * (track.rate || 1);
      return lastPos;
    }
    // Paused: trust the reported elapsed only when it's a real position (a genuine pause
    // spot or a scrub). Some players report elapsed≈0 on pause — ignore that and hold
    // where we were, so the line doesn't jump back to the top on every pause.
    const e = track.elapsed || 0;
    if (e > 0.5 || lastPos < 1) lastPos = e;
    return lastPos;
  }

  /** @param {number} level @param {number} onset @param {number} _dt */
  function update(level, onset, _dt) {
    applyStyle();
    if (!lines.length) {
      if (lineIdx !== -1) { lineIdx = -1; cur.classList.remove('show'); nxt.classList.remove('show'); }
      return;
    }
    const pos = position() + CONFIG.lyrics.offset; // lead to cancel the fixed playback/fade lag
    let i = lineIdx;
    if (i < 0 || lines[i].t > pos) i = -1;                 // jumped back -> resync
    while (i + 1 < lines.length && lines[i + 1].t <= pos) i++;
    if (i !== lineIdx) {
      lineIdx = i;
      const line = i >= 0 ? lines[i].text : '';
      txt.textContent = line;
      nxt.textContent = (i + 1 < lines.length) ? lines[i + 1].text : '';
      cur.classList.remove('show'); void cur.offsetWidth; // re-trigger entrance
      cur.classList.toggle('show', !!line);
      nxt.classList.toggle('show', !!line && !!nxt.textContent && CONFIG.lyrics.showNext !== false);
    }
    // 动感 via a GPU-composited scale ONLY (no per-frame filter/shadow -> no re-raster,
    // no jank): a gentle breathe with the level + a kick on each onset. Glow is static CSS.
    if (lineIdx >= 0) {
      const lv = Math.min(level, 1);
      const s = 1 + (lv * 0.045 + Math.min(onset * 1.6, 0.07)) * CONFIG.lyrics.pulse;
      txt.style.transform = `scale(${s.toFixed(3)})`;
    }
  }

  return { setTrack, update };
}
