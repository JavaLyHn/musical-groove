// @ts-check
// Live control panel (lil-gui), opened by clicking the LyHN signature. Every reactive
// event follows the reference's clean (sensitivity + cooldown) pair; sliders write
// straight to CONFIG / camera state / renderer, all read live each frame — tune in the
// browser instead of round-tripping recordings. Themed into a transparent glass panel
// that matches the scene, pinned directly under the signature, with a Reset-to-defaults.
import GUI from 'lil-gui';
import { CONFIG } from './config.js';

// Transparent glass theme + position. !important is needed to beat lil-gui's own opaque
// defaults; autoPlace:false (below) means we own the placement entirely.
function injectTheme() {
  if (document.getElementById('lyhn-gui-theme')) return;
  const s = document.createElement('style');
  s.id = 'lyhn-gui-theme';
  s.textContent = `
    .lil-gui.lyhn-gui{
      --title-background-color:rgba(0,0,0,0);
      --title-text-color:#e3e9ff;
      --text-color:#d2dbf6;
      --widget-color:rgba(120,170,235,0.12);
      --hover-color:rgba(95,208,224,0.22);
      --focus-color:rgba(95,208,224,0.40);
      --number-color:#c4b7ff;
      --string-color:#86e6f4;
      --font-size:11px; --input-font-size:11px;
      --widget-height:24px; --padding:8px; --spacing:5px; --width:272px; --scrollbar-width:4px;
    }
    .lil-gui.lyhn-gui{
      position:fixed !important; top:60px !important; left:18px !important; right:auto !important; z-index:11;
      max-height:calc(100vh - 78px) !important;
      display:flex; flex-direction:column; /* NOT !important: lil-gui's hide() sets inline display:none, which must win */
      background:rgba(12,18,42,0.20) !important;
      -webkit-backdrop-filter:blur(9px) saturate(1.4); backdrop-filter:blur(9px) saturate(1.4);
      border:1px solid rgba(150,175,240,0.20); border-radius:14px;
      box-shadow:0 14px 50px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.06);
      overflow:hidden; /* clip to the rounded corners; the inner list scrolls */
    }
    /* pinned title + reset, scrollable middle so the panel never gets cut off */
    .lil-gui.lyhn-gui.root > .title{ flex:0 0 auto; }
    .lil-gui.lyhn-gui.root > .children{ flex:1 1 auto; overflow-y:auto; overflow-x:hidden; }
    .lil-gui.lyhn-gui .lyhn-reset{ flex:0 0 auto; }
    .lil-gui.lyhn-gui.root > .children::-webkit-scrollbar{ width:6px; }
    .lil-gui.lyhn-gui.root > .children::-webkit-scrollbar-thumb{ background:rgba(120,170,235,0.32); border-radius:3px; }
    .lil-gui.lyhn-gui.root > .children::-webkit-scrollbar-track{ background:transparent; }
    .lil-gui.lyhn-gui .children,
    .lil-gui.lyhn-gui .lil-gui{ background:transparent !important; }
    /* root title — clean CJK-capable face with the same cool→lavender gradient fill */
    .lil-gui.lyhn-gui.root > .title{
      font-family:-apple-system,'PingFang SC','Hiragino Sans GB',system-ui,sans-serif;
      font-size:15px; font-weight:600; letter-spacing:.28em; padding:11px 14px 9px;
      background:linear-gradient(115deg,#5FD0E0,#9A8FE6 58%,#E8ECFF) !important;
      -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent;
      border-bottom:1px solid rgba(150,175,240,0.16);
    }
    /* folder titles — small uppercase labels */
    .lil-gui.lyhn-gui .lil-gui > .title{
      font-size:10.5px; letter-spacing:.12em; text-transform:uppercase; font-weight:600;
      color:#9bb0ec !important; background:rgba(95,208,224,0.05) !important; padding:6px 12px;
    }
    .lil-gui.lyhn-gui .controller{ border:none !important; }
    .lil-gui.lyhn-gui .controller .name{ color:#c4cdf0; }
    .lil-gui.lyhn-gui input,
    .lil-gui.lyhn-gui .slider{ background:rgba(120,170,235,0.10) !important; border-radius:6px !important; color:#eaf0ff; }
    .lil-gui.lyhn-gui .slider .fill{ background:linear-gradient(90deg,#5FD0E0,#9A8FE6) !important; }
    /* custom reset button (footer) */
    .lil-gui.lyhn-gui .lyhn-reset{
      display:block; width:calc(100% - 16px); margin:9px 8px 10px; padding:7px 0;
      font:600 11px/1 inherit; letter-spacing:.1em; color:#bfeaf2; cursor:pointer;
      background:rgba(95,208,224,0.12); border:1px solid rgba(95,208,224,0.30);
      border-radius:8px; transition:background .2s ease, transform .1s ease;
    }
    .lil-gui.lyhn-gui .lyhn-reset:hover{ background:rgba(95,208,224,0.24); }
    .lil-gui.lyhn-gui .lyhn-reset:active{ transform:scale(0.98); }
    /* version presets — pinned under the title so the saved-version controls never scroll away */
    .lil-gui.lyhn-gui .lyhn-presets{ flex:0 0 auto; display:flex; flex-direction:column; gap:6px;
      padding:9px 10px; border-bottom:1px solid rgba(150,175,240,0.16); background:rgba(95,208,224,0.04); }
    .lil-gui.lyhn-gui .lyhn-presets .row{ display:flex; gap:6px; align-items:center; }
    .lil-gui.lyhn-gui .lyhn-presets select,
    .lil-gui.lyhn-gui .lyhn-presets input{ flex:1 1 auto; min-width:0; height:25px; box-sizing:border-box;
      font:600 11px/1 inherit; color:#eaf0ff; padding:0 8px; border-radius:6px;
      background:rgba(120,170,235,0.12); border:1px solid rgba(150,175,240,0.22); outline:none; }
    .lil-gui.lyhn-gui .lyhn-presets input::placeholder{ color:#7e8bc0; }
    .lil-gui.lyhn-gui .lyhn-presets select option{ color:#10162e; }
    .lil-gui.lyhn-gui .lyhn-presets button{ flex:0 0 auto; height:25px; padding:0 11px; cursor:pointer;
      font:600 11px/1 inherit; letter-spacing:.06em; color:#bfeaf2; border-radius:6px;
      background:rgba(95,208,224,0.12); border:1px solid rgba(95,208,224,0.30); transition:background .2s ease; }
    .lil-gui.lyhn-gui .lyhn-presets button:hover{ background:rgba(95,208,224,0.24); }
    .lil-gui.lyhn-gui .lyhn-presets button.danger{ color:#f2c0cf; background:rgba(224,95,128,0.10); border-color:rgba(224,95,128,0.32); }
    .lil-gui.lyhn-gui .lyhn-presets button.danger:hover{ background:rgba(224,95,128,0.22); }
    .lil-gui.lyhn-gui .lyhn-presets .msg{ min-height:12px; font-size:10px; letter-spacing:.04em; color:#86e6f4; }`;
  document.head.appendChild(s);
}

/** @param {{ rig: { state: any }, renderer: any }} refs */
export function createGui({ rig, renderer }) {
  injectTheme();
  const gui = new GUI({ title: '参数面板', autoPlace: false }); // we place it ourselves
  gui.domElement.classList.add('lyhn-gui');
  document.body.appendChild(gui.domElement);

  const fl = gui.addFolder('外观 Look');
  fl.add(CONFIG.field, 'segmented').name('分段柱体 (关=流畅整条)');

  const fly = gui.addFolder('歌词 Lyrics');
  fly.add(CONFIG.lyrics, 'offset', -0.5, 2.5, 0.05).name('提前量 (s, 大=更早)');
  fly.add(CONFIG.lyrics, 'fontSize', 18, 64, 1).name('字号 (px)');
  fly.add(CONFIG.lyrics, 'bottom', 4, 45, 1).name('高度 (距底 %)');
  fly.add(CONFIG.lyrics, 'glow', 0, 2, 0.05).name('辉光 (0=无)');
  fly.add(CONFIG.lyrics, 'pulse', 0, 2.5, 0.05).name('律动 (随乐缩放)');
  fly.add(CONFIG.lyrics, 'showNext').name('显示下一句');

  const fr = gui.addFolder('涟漪 Ripple');
  fr.add(CONFIG.ripple, 'sensitivity', 0, 0.5, 0.005).name('灵敏度 (低=易触发)');
  fr.add(CONFIG.ripple, 'cooldown', 0, 30, 1).name('冷却帧 (0=每拍)');

  const fm = gui.addFolder('流星 Meteor');
  fm.add(CONFIG.meteor, 'sensitivity', 0, 0.6, 0.01).name('灵敏度');
  fm.add(CONFIG.meteor, 'cooldown', 0, 600, 10).name('冷却帧 (大=稀少)');

  const fi = gui.addFolder('空闲待机 Idle');
  fi.add(CONFIG.motion, 'idleDebounce', 0, 5, 0.1).name('防抖 (s)');
  fi.add(CONFIG.motion, 'idleTransition', 0.1, 5, 0.1).name('过渡 (s)');
  fi.add(CONFIG.motion, 'idleSilence', 0, 0.2, 0.005).name('静音阈值');
  fi.add(CONFIG.motion, 'idleHeight', 0, 18, 0.5).name('待机柱林高度');
  fi.add(CONFIG.motion, 'idleRippleEvery', 0.8, 8, 0.1).name('待机涟漪间隔 (s)');
  fi.add(CONFIG.motion, 'idleRippleStrength', 0, 2, 0.05).name('待机涟漪强度');
  fi.add(CONFIG.wave, 'idleSpeed', 30, 400, 5).name('待机涟漪速度 (小=慢)');

  const fmo = gui.addFolder('运动 Motion');
  fmo.add(CONFIG.motion, 'radialDelay', 0, 70, 1).name('径向延迟 (波速)');
  fmo.add(CONFIG.motion, 'levelFloor', 0, 1, 0.05).name('共模地板');
  fmo.add(CONFIG.motion, 'waveAmp', 0, 6, 0.1).name('行波幅度');

  const fc = gui.addFolder('相机 Camera');
  fc.add(rig.state, 'pitchDeg', 0, 85, 1).name('仰角');
  fc.add(rig.state, 'distance', 40, 400, 5).name('距离');
  fc.add(rig.state, 'fov', 10, 90, 1).name('视角 fov');
  fc.add(rig.state, 'orbitSpeed', 0, 1, 0.01).name('自转速度');

  const fp = gui.addFolder('后期 Post');
  fp.addColor(CONFIG.post, 'accentColor').name('强调色');
  fp.add(CONFIG.post, 'accentIntensity', 0, 1, 0.02).name('强调色强度');
  fp.add(CONFIG.post, 'bloomThreshold', 0, 1, 0.01).name('Bloom 阈值');
  fp.add(renderer, 'toneMappingExposure', 0.2, 2, 0.05).name('曝光 exposure');

  // Reset everything to the values captured when the panel was built (= the config
  // defaults), via lil-gui's recursive reset.
  const resetBtn = document.createElement('button');
  resetBtn.className = 'lyhn-reset';
  resetBtn.textContent = '↺ 重置默认';
  resetBtn.addEventListener('click', () => gui.reset());
  gui.domElement.appendChild(resetBtn);

  setupPresets(gui);
  return gui;
}

// VERSION PRESETS: save the whole panel state under a name and recall it later. A preset
// is just `gui.save()` (every controller's value, by folder), stored in localStorage — so
// it survives reloads and the wallpaper keeps your tuned look. The preset bar is custom
// HTML (not a GUI folder) so it's excluded from the snapshot automatically.
const PRESETS_KEY = 'lyhn-presets';      // { [name]: gui.save() }
const LAST_KEY = 'lyhn-preset-last';     // name of the version to auto-restore on launch

/** @param {import('lil-gui').GUI} gui */
function setupPresets(gui) {
  /** @type {Record<string, any>} */
  let presets = {};
  try { presets = JSON.parse(localStorage.getItem(PRESETS_KEY) || '{}') || {}; } catch { presets = {}; }
  const persist = () => { try { localStorage.setItem(PRESETS_KEY, JSON.stringify(presets)); } catch { /* storage off */ } };
  /** @param {string|null} n */
  const remember = (n) => { try { n ? localStorage.setItem(LAST_KEY, n) : localStorage.removeItem(LAST_KEY); } catch { /* */ } };

  const bar = document.createElement('div');
  bar.className = 'lyhn-presets';
  bar.innerHTML =
    '<div class="row"><select class="sel" title="切换已保存的版本"></select></div>' +
    '<div class="row"><input class="name" type="text" placeholder="版本名称（留空=覆盖所选）" maxlength="24"/>' +
    '<button class="save">保存</button><button class="del danger" title="删除所选版本">删除</button></div>' +
    '<div class="msg"></div>';
  const sel = /** @type {HTMLSelectElement} */ (bar.querySelector('.sel'));
  const nameInput = /** @type {HTMLInputElement} */ (bar.querySelector('.name'));
  const saveBtn = /** @type {HTMLButtonElement} */ (bar.querySelector('.save'));
  const delBtn = /** @type {HTMLButtonElement} */ (bar.querySelector('.del'));
  const msgEl = /** @type {HTMLDivElement} */ (bar.querySelector('.msg'));

  let msgTimer = 0;
  /** @param {string} t */
  const flash = (t) => { msgEl.textContent = t; clearTimeout(msgTimer); msgTimer = setTimeout(() => { msgEl.textContent = ''; }, 2000); };

  function refreshSelect() {
    const names = Object.keys(presets);
    const keep = sel.value;
    sel.innerHTML = '';
    const ph = document.createElement('option');
    ph.value = ''; ph.textContent = names.length ? '— 选择版本 —' : '— 暂无保存的版本 —';
    sel.appendChild(ph);
    for (const n of names) {
      const o = document.createElement('option');
      o.value = n; o.textContent = n; sel.appendChild(o);
    }
    if (keep && presets[keep]) sel.value = keep;
  }

  function doSave() {
    let name = nameInput.value.trim();
    if (!name) name = sel.value;                 // empty name -> overwrite the selected version
    if (!name) { let i = 1; while (presets['版本 ' + i]) i++; name = '版本 ' + i; } // else auto-number
    presets[name] = gui.save();                  // snapshot every controller value
    persist(); refreshSelect();
    sel.value = name; nameInput.value = ''; remember(name);
    flash('已保存「' + name + '」');
  }

  function doDelete() {
    const n = sel.value;
    if (!n) { flash('请先选择一个版本'); return; }
    delete presets[n]; persist(); refreshSelect();
    if (localStorage.getItem(LAST_KEY) === n) remember(null);
    flash('已删除「' + n + '」');
  }

  /** @param {string} n */
  function doLoad(n) {
    if (!n || !presets[n]) return;
    try { gui.load(presets[n]); } catch { /* malformed preset */ }
    remember(n);
    flash('已载入「' + n + '」');
  }

  saveBtn.addEventListener('click', doSave);
  delBtn.addEventListener('click', doDelete);
  sel.addEventListener('change', () => doLoad(sel.value));
  nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSave(); });

  refreshSelect();
  // pin the bar directly under the title, above the scrolling folder list
  const title = gui.domElement.querySelector(':scope > .title');
  if (title) title.insertAdjacentElement('afterend', bar); else gui.domElement.appendChild(bar);

  // auto-restore the last-used version so the wallpaper reopens with your saved look
  const last = localStorage.getItem(LAST_KEY);
  if (last && presets[last]) { sel.value = last; try { gui.load(presets[last]); } catch { /* */ } }
}
