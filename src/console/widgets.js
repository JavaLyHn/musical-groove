// @ts-check
// Control factories for the console. Pure numeric helpers (tested in node) +
// DOM factories (browser-only; verified by build + eyeball). Each factory binds a
// schema Control to live DOM and writes through control.set(r,v) so the render loop
// reflects changes each frame. Factories return { el, sync, ... }: sync() re-reads
// control.get(r) into the widget (used after preset load / reset).
/** @typedef {import('./schema.js').Control} Control */

// ---- pure helpers (unit-tested) ----
/** @param {number} v @param {number} min @param {number} max @param {number} [step] */
export function clampStep(v, min, max, step) {
  v = Math.max(min, Math.min(max, v));
  if (step) v = Math.round(v / step) * step;
  return Math.max(min, Math.min(max, v));
}
/** @param {number} v @param {number} min @param {number} max */
export function valueToFrac(v, min, max) { return max === min ? 0 : (v - min) / (max - min); }
/** @param {number} f @param {number} min @param {number} max */
export function fracToValue(f, min, max) { return min + (max - min) * Math.max(0, Math.min(1, f)); }
/** @param {number} max @param {number} [step] @returns {(v:number)=>string} */
export function makeFmt(max, step) {
  return (v) => step
    ? String(Math.round(v / step) * step)
    : (max <= 2 ? v.toFixed(2) : (max <= 12 ? v.toFixed(1) : String(Math.round(v))));
}
/** @param {number} min @param {number} max @param {boolean} coarse */
export function wheelStep(min, max, coarse) { return (max - min) / (coarse ? 20 : 60); }

// ---- small DOM helper ----
/** @param {string} tag @param {string} [cls] @param {string} [html] */
function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}

// ---- SLIDER ----
/** @param {Control} c @param {any} r */
export function makeSlider(c, r) {
  const min = c.min ?? 0, max = c.max ?? 1, step = c.step ?? 0, fmt = makeFmt(max, step);
  const wrap = el('div', 'ctl');
  if (c.hint) wrap.title = c.hint;
  const head = el('div', 'head');
  const name = el('span', 'name'); name.textContent = c.label;
  const num = el('span', 'num');
  head.append(name, num);
  const track = el('div', 'track');
  const rail = el('div', 'rail'), fill = el('div', 'fill'), defTick = el('div', 'def'), thumb = el('div', 'thumb');
  track.append(rail, fill, defTick, thumb);
  const ends = el('div', 'ends');
  const lo = el('span'); lo.textContent = c.lo ?? String(min);
  const hi = el('span'); hi.textContent = c.hi ?? String(max);
  ends.append(lo, hi);
  wrap.append(head, track, ends);

  defTick.style.left = valueToFrac(c.def ?? min, min, max) * 100 + '%';

  /** @param {number} v @param {boolean} [write] */
  function render(v, write) {
    v = clampStep(v, min, max, step);
    const f = valueToFrac(v, min, max) * 100;
    fill.style.width = f + '%';
    thumb.style.left = f + '%';
    num.textContent = fmt(v);
    if (write) c.set(r, v);
  }
  const fromX = (/** @type {number} */ x) => {
    const b = track.getBoundingClientRect();
    return fracToValue((x - b.left) / b.width, min, max);
  };
  let drag = false;
  track.addEventListener('pointerdown', (e) => { drag = true; track.classList.add('drag'); track.setPointerCapture(e.pointerId); render(fromX(e.clientX), true); });
  track.addEventListener('pointermove', (e) => { if (drag) render(fromX(e.clientX), true); });
  track.addEventListener('pointerup', () => { drag = false; track.classList.remove('drag'); });
  track.addEventListener('dblclick', () => render(c.def ?? min, true));
  track.addEventListener('wheel', (e) => {
    e.preventDefault();
    const cur = /** @type {number} */ (c.get(r));
    render(cur + (e.deltaY < 0 ? 1 : -1) * wheelStep(min, max, e.shiftKey), true);
    track.classList.add('drag'); clearTimeout(/** @type {any} */ (track)._wt);
    /** @type {any} */ (track)._wt = setTimeout(() => track.classList.remove('drag'), 260);
  }, { passive: false });
  num.addEventListener('click', () => {
    const cur = String(c.get(r));
    const s = prompt('输入精确值', cur);
    if (s !== null && s.trim() !== '' && !isNaN(+s)) render(+s, true);
  });

  return { el: wrap, sync: () => render(/** @type {number} */ (c.get(r)), false) };
}

// ---- TOGGLE ----
/** @param {Control} c @param {any} r */
export function makeToggle(c, r) {
  const row = el('div', 'row');
  if (c.hint) row.title = c.hint;
  const name = el('span', 'name'); name.textContent = c.label;
  const sw = el('div', 'sw', '<i></i>');
  row.append(name, sw);
  const render = (/** @type {boolean} */ on, /** @type {boolean} */ write) => {
    sw.classList.toggle('on', !!on);
    if (write) c.set(r, !!on);
  };
  sw.addEventListener('click', () => render(!sw.classList.contains('on'), true));
  return { el: row, sync: () => render(!!c.get(r), false) };
}

// ---- DIAL (270° arc, value below) ----
/** @param {Control} c @param {any} r @param {()=>string} getAccent */
export function makeDial(c, r, getAccent) {
  const min = c.min ?? 0, max = c.max ?? 1, fmt = makeFmt(max, c.step);
  const knob = el('div', 'knob');
  const dial = el('div', 'dial');
  if (c.hint) dial.title = c.hint;
  const lbl = el('div', 'lbl'); lbl.textContent = c.label;
  const kv = el('div', 'kv');
  knob.append(dial, lbl, kv);

  let dragging = false;
  function paint(/** @type {boolean} */ active) {
    const v = clampStep(/** @type {number} */ (c.get(r)), min, max, c.step);
    const frac = valueToFrac(v, min, max), a0 = -225, a1 = 45, ang = a0 + (a1 - a0) * frac, R = 22, cx = 27, cy = 27;
    const arc = (/** @type {number} */ f, /** @type {number} */ t, /** @type {string} */ col) => {
      const fr = f * Math.PI / 180, tr = t * Math.PI / 180;
      const x1 = cx + R * Math.cos(fr), y1 = cy + R * Math.sin(fr), x2 = cx + R * Math.cos(tr), y2 = cy + R * Math.sin(tr);
      const lg = (t - f) > 180 ? 1 : 0;
      return `<path d="M${x1.toFixed(2)} ${y1.toFixed(2)} A${R} ${R} 0 ${lg} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}" stroke="${col}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
    };
    const px = cx + (R - 1) * Math.cos(ang * Math.PI / 180), py = cy + (R - 1) * Math.sin(ang * Math.PI / 180);
    const col = active ? 'url(#mg-g)' : getAccent();
    dial.innerHTML = `<svg width="54" height="54" viewBox="0 0 54 54">
      <defs><linearGradient id="mg-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5FD0E0"/><stop offset="1" stop-color="#9A8FE6"/></linearGradient></defs>
      <circle cx="27" cy="27" r="25" fill="rgba(10,16,40,.55)" stroke="rgba(150,175,240,.16)"/>
      ${arc(a0, a1, 'rgba(150,170,235,.16)')}${arc(a0, ang, col)}
      <line x1="27" y1="27" x2="${px.toFixed(2)}" y2="${py.toFixed(2)}" stroke="#eaf6ff" stroke-width="2.2" stroke-linecap="round"/>
      <circle cx="27" cy="27" r="2.6" fill="#eaf6ff"/></svg>`;
    kv.textContent = fmt(v);
  }
  const commit = (/** @type {number} */ v) => { c.set(r, clampStep(v, min, max, c.step)); paint(true); };

  let sy = 0, sv = 0;
  dial.addEventListener('pointerdown', (e) => { dragging = true; sy = e.clientY; sv = /** @type {number} */ (c.get(r)); dial.setPointerCapture(e.pointerId); paint(true); });
  dial.addEventListener('pointermove', (e) => { if (dragging) commit(sv + (sy - e.clientY) / 130 * (max - min)); });
  dial.addEventListener('pointerup', () => { dragging = false; paint(false); });
  dial.addEventListener('dblclick', () => { c.set(r, c.def ?? min); paint(false); });
  dial.addEventListener('wheel', (e) => {
    e.preventDefault();
    commit(/** @type {number} */ (c.get(r)) + (e.deltaY < 0 ? 1 : -1) * wheelStep(min, max, e.shiftKey));
    clearTimeout(/** @type {any} */ (dial)._wt);
    /** @type {any} */ (dial)._wt = setTimeout(() => paint(false), 260);
  }, { passive: false });

  return { el: knob, sync: () => paint(false), repaint: () => paint(dragging) };
}

// ---- COLOR (swatch + hex; drives the shared accent) ----
/** @param {Control} c @param {any} r @param {(hex:string)=>void} applyAccent */
export function makeColor(c, r, applyAccent) {
  const row = el('div', 'row');
  if (c.hint) row.title = c.hint;
  const name = el('span', 'name'); name.textContent = c.label;
  const box = el('div', 'colorbox');
  const input = /** @type {HTMLInputElement} */ (el('input', 'swatch'));
  input.type = 'color';
  const hex = el('span', 'num'); hex.style.cursor = 'default';
  box.append(input, hex);
  row.append(name, box);
  input.addEventListener('input', () => applyAccent(input.value));
  const reflect = (/** @type {string} */ h) => { input.value = h; hex.textContent = h; };
  return { el: row, sync: () => reflect(String(c.get(r))), reflect };
}
