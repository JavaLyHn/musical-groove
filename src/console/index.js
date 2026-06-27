// @ts-check
// The console overlay: assembles header / presets / PERFORMANCE / SETUP / footer from SECTIONS,
// binds each control via widgets.js, and owns the shared accent colour + lifecycle (show/hide/
// toggle, ESC + 完成 to close → onClose, 演出模式, collapse). Mounted once, toggled with .open.
// The decorative meter rAF only runs while open (it must not burn GPU as a wallpaper). LEVEL/BPM
// are decorative chrome — not wired to audio (spec §9). Lazily imported by main.js on first open.
import './console.css';
import { CONFIG } from '../config.js';
import { isDirty } from '../presets.js';
import { SECTIONS } from './schema.js';
import { makeSlider, makeToggle, makeDial, makeColor } from './widgets.js';
import { createPresetsBar } from './presetsBar.js';

const ACCENTS = ['#5FD0E0', '#9A8FE6', '#7CF1B0', '#F2A6C2'];

/** @param {{ rig:{state:any}, renderer:any, onClose:()=>void }} opts */
export function createConsole({ rig, renderer, onClose }) {
  const refs = { rig, renderer };
  const root = document.createElement('div');
  root.className = 'mg-console';
  const wrap = document.createElement('div'); wrap.className = 'wrap';
  root.appendChild(wrap);

  /** @type {{sync:()=>void}[]} */ const syncs = [];
  /** @type {{repaint:()=>void}[]} */ const dials = [];
  /** @type {{reflect:(h:string)=>void}|null} */ let colorWidget = null;
  /** @type {HTMLElement[]} */ const dots = [];
  const getAccent = () => CONFIG.post.accentColor || '#5FD0E0';

  /** Set the shared accent: CONFIG (bloom wash) + UI vars + dial arcs + swatch + active dot.
   * @param {string} hex */
  function applyAccent(hex) {
    CONFIG.post.accentColor = hex;
    root.style.setProperty('--accent', hex);
    root.style.setProperty('--accent-soft', hex + '28');
    for (const d of dials) d.repaint(); // dial reads the now-updated CONFIG accent via getAccent()
    if (colorWidget) colorWidget.reflect(hex);
    for (const dt of dots) dt.classList.toggle('on', (dt.dataset.a || '').toLowerCase() === hex.toLowerCase());
  }

  // ---- header ----
  const top = document.createElement('div'); top.className = 'top';
  top.innerHTML =
    '<div class="brand"><div class="orb"></div>' +
    '<div><h1>MUSICAL GROOVE 控制台</h1><div class="sub">MUSICAL&nbsp;GROOVE&nbsp;·&nbsp;CONTROL&nbsp;CONSOLE</div></div>' +
    '<span class="sig" title="© LyHN — 版权所有"><span class="c">©</span>LyHN</span></div>' +
    '<div class="spacer"></div>' +
    '<div class="meter"></div>' +
    '<div class="stat">LEVEL <b class="lv">—</b><br>SYS <b style="color:#7CF1B0">● LIVE</b></div>';
  const perfBtn = document.createElement('button');
  perfBtn.className = 'hbtn'; perfBtn.textContent = '演出模式'; perfBtn.title = '只保留演出大控件,收起设置区';
  const doneBtn = document.createElement('button');
  doneBtn.className = 'done'; doneBtn.textContent = '完成 ✓';
  top.append(perfBtn, doneBtn);
  wrap.appendChild(top);

  // decorative meter bars
  const meterEl = /** @type {HTMLElement} */ (top.querySelector('.meter'));
  const lvEl = /** @type {HTMLElement} */ (top.querySelector('.lv'));
  /** @type {HTMLElement[]} */ const bars = [];
  for (let i = 0; i < 22; i++) { const b = document.createElement('i'); meterEl.appendChild(b); bars.push(b); }
  let mt = 0; /** @type {number} */ let raf = 0;
  function animate() {
    mt += 0.05;
    bars.forEach((b, i) => { const h = 6 + (Math.sin(mt * 1.7 + i * 0.5) * 0.5 + 0.5) * 15; b.style.height = h.toFixed(1) + 'px'; b.style.opacity = (0.5 + 0.5 * Math.sin(mt + i)).toFixed(2); });
    lvEl.textContent = (0.4 + 0.4 * (Math.sin(mt) * 0.5 + 0.5)).toFixed(2);
    raf = requestAnimationFrame(animate);
  }

  // ---- presets strip + accent dots ----
  const presetsBar = createPresetsBar({ refs, onChange: refreshAll });
  const accentPick = document.createElement('span');
  accentPick.className = 'accentpick';
  accentPick.innerHTML = '<span class="lab">强调色</span>';
  for (const a of ACCENTS) {
    const dt = document.createElement('span');
    dt.className = 'sw-dot'; dt.style.background = a; dt.dataset.a = a;
    dt.addEventListener('click', () => applyAccent(a));
    dots.push(dt); accentPick.appendChild(dt);
  }
  presetsBar.el.appendChild(accentPick);
  wrap.appendChild(presetsBar.el);

  // ---- sections ----
  for (const sec of SECTIONS) {
    const lab = document.createElement('div');
    lab.className = 'seclabel' + (sec.id === 'setup' ? ' setup-l' : '');
    lab.innerHTML = `<h3>${sec.title}</h3><span class="en">${sec.en}</span><span class="ln"></span>`;
    wrap.appendChild(lab);
    const grid = document.createElement('div');
    grid.className = 'grid ' + (sec.id === 'performance' ? 'perf' : 'setup');
    wrap.appendChild(grid);

    for (const g of sec.groups) {
      const panel = document.createElement('div');
      panel.className = 'panel ' + (sec.hot ? 'hot' : 'dim') + (g.collapsed ? ' collapsed' : '');
      const head = document.createElement('div'); head.className = 'phead';
      head.innerHTML = `<span class="dot"></span><h2>${g.title}</h2><span class="en">${g.en}</span><span class="caret">▾</span>`;
      if (!sec.hot) head.addEventListener('click', () => panel.classList.toggle('collapsed'));
      const body = document.createElement('div'); body.className = 'pbody';
      panel.append(head, body);

      // dials (BEAT) go into a .knobs row first; everything else flows in the body
      const dialControls = g.controls.filter((c) => c.kind === 'dial');
      if (dialControls.length) {
        const knobs = document.createElement('div'); knobs.className = 'knobs';
        for (const c of dialControls) { const w = makeDial(c, refs, getAccent); dials.push(/** @type {any} */ (w)); syncs.push(w); knobs.appendChild(w.el); }
        body.appendChild(knobs);
      }
      for (const c of g.controls) {
        if (c.kind === 'dial') continue;
        let w;
        if (c.kind === 'slider') w = makeSlider(c, refs);
        else if (c.kind === 'toggle') w = makeToggle(c, refs);
        else { w = makeColor(c, refs, applyAccent); colorWidget = /** @type {any} */ (w); }
        syncs.push(w); body.appendChild(w.el);
      }
      grid.appendChild(panel);
    }
  }

  // ---- footer ----
  const foot = document.createElement('div'); foot.className = 'foot';
  const resetBtn = document.createElement('button');
  resetBtn.className = 'reset'; resetBtn.textContent = '↺ 重置默认';
  resetBtn.addEventListener('click', resetAll);
  foot.appendChild(resetBtn);
  const copy = document.createElement('div'); copy.className = 'copyright';
  copy.innerHTML = '© 2026 <b>LyHN</b> · Musical Groove — 版权所有 · All rights reserved';
  wrap.append(foot, copy);

  // ---- unsaved-changes exit prompt: shown when closing the console with dirty params ----
  const promptEl = document.createElement('div'); promptEl.className = 'savemodal hidden';
  const card = document.createElement('div'); card.className = 'card';
  const h4 = document.createElement('h4'); h4.textContent = '有未保存的修改';
  const ptxt = document.createElement('p'); ptxt.textContent = '关闭前是否保存当前参数?';
  const acts = document.createElement('div'); acts.className = 'acts';
  const saveExit = document.createElement('button'); saveExit.className = 'pm-save'; saveExit.textContent = '保存并退出';
  const discardExit = document.createElement('button'); discardExit.className = 'pm-discard'; discardExit.textContent = '不保存退出';
  const cancelClose = document.createElement('button'); cancelClose.className = 'pm-cancel'; cancelClose.textContent = '取消';
  acts.append(saveExit, discardExit, cancelClose);
  card.append(h4, ptxt, acts); promptEl.appendChild(card); root.appendChild(promptEl);

  const closePrompt = () => promptEl.classList.add('hidden');
  const openPrompt = () => promptEl.classList.remove('hidden');
  const isPromptOpen = () => !promptEl.classList.contains('hidden');
  /** Close the console, but if params are dirty, ask to save first. */
  function requestClose() { if (isDirty(refs)) openPrompt(); else { hide(); onClose(); } }

  saveExit.addEventListener('click', () => { presetsBar.saveCurrent(); closePrompt(); hide(); onClose(); });
  discardExit.addEventListener('click', () => { closePrompt(); hide(); onClose(); });
  cancelClose.addEventListener('click', closePrompt);
  promptEl.addEventListener('click', (e) => { if (e.target === promptEl) closePrompt(); }); // click backdrop = cancel

  function refreshAll() { for (const s of syncs) s.sync(); applyAccent(getAccent()); }
  function resetAll() {
    for (const sec of SECTIONS) for (const g of sec.groups) for (const c of g.controls) {
      if (c.def !== undefined) c.set(refs, c.def);
    }
    refreshAll();
  }

  perfBtn.addEventListener('click', () => { root.classList.toggle('perfmode'); perfBtn.classList.toggle('on'); });
  doneBtn.addEventListener('click', requestClose);
  /** @param {KeyboardEvent} e */
  const onKey = (e) => {
    if (e.key !== 'Escape') return;
    if (isPromptOpen()) closePrompt();  // ESC inside the prompt = 取消(留在面板)
    else requestClose();
  };

  function show() { root.classList.add('open'); document.addEventListener('keydown', onKey); refreshAll(); if (!raf) animate(); }
  function hide() { root.classList.remove('open'); document.removeEventListener('keydown', onKey); cancelAnimationFrame(raf); raf = 0; closePrompt(); }
  function toggle() { if (root.classList.contains('open')) hide(); else show(); }

  document.body.appendChild(root);
  applyAccent(getAccent()); // initial dot/swatch/var state
  return { el: root, show, hide, toggle };
}
