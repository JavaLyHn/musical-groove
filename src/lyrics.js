// @ts-check
// Synced, audio-reactive lyrics. The system Now-Playing data carries no lyrics, so when
// the track changes we fetch an LRC from lrclib.net (free, CORS-open) by title/artist/
// duration, parse the [mm:ss.xx] timings, and surface the current line at the lower third
// — large and glowing, BREATHING with the music (scale + glow pulse on level/onset), the
// next line faint beneath. No synced lyrics found (or instrumental) -> nothing shows.

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
    .lyhn-lyrics .cur{font-size:34px;font-weight:700;letter-spacing:.02em;line-height:1.3;
      opacity:0;transform:translateY(16px);
      transition:opacity .5s ease, transform .5s cubic-bezier(.2,.8,.2,1);will-change:transform,opacity;}
    .lyhn-lyrics .cur.show{opacity:1;transform:translateY(0);}
    .lyhn-lyrics .cur .txt{display:inline-block;color:#eef2ff;will-change:transform;}
    .lyhn-lyrics .nxt{font-size:17px;font-weight:500;margin-top:12px;color:#9fb0e6;
      opacity:0;transition:opacity .5s ease;}
    .lyhn-lyrics .nxt.show{opacity:.5;}`;
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

  function hide() {
    lines = []; lineIdx = -1;
    cur.classList.remove('show'); nxt.classList.remove('show');
  }

  /** @param {Track|null} t */
  function setTrack(t) {
    if (!t || !t.title) { track = null; curKey = ''; hide(); return; }
    track = t; // keep the freshest playback timing every message
    const key = t.title + '|' + t.artist;
    if (key === curKey) return; // same song -> just a timing refresh
    curKey = key;
    hide();
    const id = ++fetchId;
    const url = 'https://lrclib.net/api/get?' + new URLSearchParams({
      artist_name: t.artist || '',
      track_name: t.title || '',
      album_name: t.album || '',
      duration: String(Math.round(t.duration || 0)),
    });
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (id !== fetchId) return; // a newer track superseded this fetch
        lines = (d && d.syncedLyrics && !d.instrumental) ? parseLRC(d.syncedLyrics) : [];
        lineIdx = -1;
      })
      .catch(() => { if (id === fetchId) { lines = []; lineIdx = -1; } });
  }

  function position() {
    if (!track) return 0;
    const base = track.elapsed || 0;
    if (!track.playing) return base;
    return base + (Date.now() - (track.posAt || Date.now())) / 1000 * (track.rate || 1);
  }

  /** @param {number} level @param {number} onset @param {number} _dt */
  function update(level, onset, _dt) {
    if (!lines.length) {
      if (lineIdx !== -1) { lineIdx = -1; cur.classList.remove('show'); nxt.classList.remove('show'); }
      return;
    }
    const pos = position();
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
      nxt.classList.toggle('show', !!line && !!nxt.textContent);
    }
    // 动感: the live line breathes + glows with the music (instant, no transition lag)
    if (lineIdx >= 0) {
      const lv = Math.min(level, 1);
      const s = 1 + lv * 0.05 + Math.min(onset * 1.4, 0.07);
      const glow = 12 + lv * 26 + Math.min(onset * 55, 22);
      txt.style.transform = `scale(${s.toFixed(3)})`;
      txt.style.textShadow = `0 0 ${glow.toFixed(0)}px rgba(95,208,224,${(0.28 + lv * 0.5).toFixed(2)})`;
    }
  }

  return { setTrack, update };
}
