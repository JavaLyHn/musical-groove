// @ts-check
// Live control panel (lil-gui), opened by clicking the LyHN signature. Every reactive
// event follows the reference's clean (sensitivity + cooldown) pair; sliders write
// straight to CONFIG / camera state / renderer, all read live each frame — tune in the
// browser instead of round-tripping recordings. Themed into a transparent glass panel
// that matches the scene, pinned directly under the signature, with a Reset-to-defaults.
import GUI from 'lil-gui';
import { CONFIG } from './config.js';
import { snapshot, applySnapshot, getPresets, setPresets, getLast, setLast } from './presets.js';

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
    .lil-gui.lyhn-gui .lyhn-presets{ flex:0 0 auto; display:flex; flex-direction:column; gap:7px;
      padding:10px; border-bottom:1px solid rgba(150,175,240,0.16); background:rgba(95,208,224,0.045); }
    .lil-gui.lyhn-gui .lyhn-presets .save{ width:100%; height:30px; cursor:pointer;
      font:700 11px/1 inherit; letter-spacing:.06em; color:#0a1226; border:none; border-radius:8px;
      background:linear-gradient(120deg,#5FD0E0,#9A8FE6); transition:filter .2s ease, transform .1s ease; }
    .lil-gui.lyhn-gui .lyhn-presets .save:hover{ filter:brightness(1.1); }
    .lil-gui.lyhn-gui .lyhn-presets .save:active{ transform:scale(0.99); }
    .lil-gui.lyhn-gui .lyhn-presets .plist{ display:flex; flex-direction:column; gap:4px; max-height:160px; overflow-y:auto; }
    .lil-gui.lyhn-gui .lyhn-presets .plist::-webkit-scrollbar{ width:5px; }
    .lil-gui.lyhn-gui .lyhn-presets .plist::-webkit-scrollbar-thumb{ background:rgba(120,170,235,0.30); border-radius:3px; }
    .lil-gui.lyhn-gui .lyhn-presets .prow{ display:flex; gap:5px; align-items:stretch; }
    .lil-gui.lyhn-gui .lyhn-presets .pload{ flex:1 1 auto; min-width:0; height:26px; padding:0 10px; cursor:pointer;
      text-align:left; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      font:500 11px/1 inherit; color:#d6e0fb; border-radius:6px;
      background:rgba(120,170,235,0.10); border:1px solid rgba(150,175,240,0.18); transition:background .15s ease; }
    .lil-gui.lyhn-gui .lyhn-presets .pload:hover{ background:rgba(95,208,224,0.20); }
    .lil-gui.lyhn-gui .lyhn-presets .prow.active .pload{ background:rgba(95,208,224,0.22); border-color:rgba(95,208,224,0.5); color:#eaf6ff; }
    .lil-gui.lyhn-gui .lyhn-presets .prow.active .pload::before{ content:'✓ '; color:#86e6f4; }
    .lil-gui.lyhn-gui .lyhn-presets .pedit,
    .lil-gui.lyhn-gui .lyhn-presets .pdel{ flex:0 0 auto; width:26px; height:26px; cursor:pointer;
      font:600 12px/1 inherit; border-radius:6px; transition:background .15s ease; }
    .lil-gui.lyhn-gui .lyhn-presets .pedit{ color:#bfeaf2; background:rgba(95,208,224,0.10); border:1px solid rgba(95,208,224,0.28); }
    .lil-gui.lyhn-gui .lyhn-presets .pedit:hover{ background:rgba(95,208,224,0.24); }
    .lil-gui.lyhn-gui .lyhn-presets .pdel{ color:#e79ab0; background:rgba(224,95,128,0.10); border:1px solid rgba(224,95,128,0.28); font-size:14px; }
    .lil-gui.lyhn-gui .lyhn-presets .pdel:hover{ background:rgba(224,95,128,0.24); color:#ffd0dc; }
    .lil-gui.lyhn-gui .lyhn-presets .prename{ flex:1 1 auto; min-width:0; height:26px; box-sizing:border-box; outline:none;
      font:600 11px/1 inherit; color:#eaf0ff !important; padding:0 9px; border-radius:6px;
      background:rgba(120,170,235,0.20) !important; border:1px solid rgba(95,208,224,0.55) !important; }
    .lil-gui.lyhn-gui .lyhn-presets .pconfirm{ flex:1 1 auto; min-width:0; display:flex; align-items:center; padding:0 4px;
      font-size:10.5px; color:#f2b8c6; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .lil-gui.lyhn-gui .lyhn-presets .pc-yes, .lil-gui.lyhn-gui .lyhn-presets .pcancel{ width:auto; padding:0 11px; font-size:11px; }
    .lil-gui.lyhn-gui .lyhn-presets .empty{ font-size:10.5px; color:#8290bd; text-align:center; padding:5px 0; }
    .lil-gui.lyhn-gui .lyhn-presets .msg{ min-height:13px; font-size:10.5px; letter-spacing:.04em; color:#86e6f4; text-align:center; }`;
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

  const fb = gui.addFolder('震动 Beat');
  fb.add(CONFIG.camera, 'beatKick', 0, 2, 0.05).name('节拍冲击 (相机)');
  fb.add(CONFIG.post, 'bloomSpike', 0, 0.5, 0.01).name('节拍闪光');
  fb.add(CONFIG.motion, 'accentHeight', 0, 20, 0.5).name('重音柱高度');
  fb.add(CONFIG.field, 'reactive', 5, 40, 1).name('整体起伏');

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

  setupPresets(gui, { rig, renderer });
  return gui;
}

// VERSION PRESETS bar (pinned under the title). One-click "save as new version" — no bare
// name box sitting there. Each saved version is a row: click it to load, ✎ to rename inline,
// × to delete, ✓ marks the active one. Storage + (de)serialization live in presets.js
// (lil-gui-free) so the last version also auto-applies at page load — see main.js.
/** @param {import('lil-gui').GUI} gui @param {{ rig:{state:any}, renderer:any }} refs */
function setupPresets(gui, refs) {
  let presets = getPresets();
  let active = getLast(); // the currently-applied version (highlighted); already applied at load

  const bar = document.createElement('div');
  bar.className = 'lyhn-presets';
  bar.innerHTML =
    '<button class="save">＋ 保存当前为新版本</button>' +
    '<div class="plist"></div>' +
    '<div class="msg"></div>';
  const saveBtn = /** @type {HTMLButtonElement} */ (bar.querySelector('.save'));
  const list = /** @type {HTMLDivElement} */ (bar.querySelector('.plist'));
  const msgEl = /** @type {HTMLDivElement} */ (bar.querySelector('.msg'));

  let msgTimer = 0;
  /** @param {string} t */
  const flash = (t) => { msgEl.textContent = t; clearTimeout(msgTimer); msgTimer = setTimeout(() => { msgEl.textContent = ''; }, 2400); };

  // push restored CONFIG / camera / renderer values into the panel's sliders
  const refreshDisplays = () => { for (const c of gui.controllersRecursive()) c.updateDisplay(); };

  /** @param {string} n */
  function makeRow(n) {
    const row = document.createElement('div');
    row.className = 'prow' + (n === active ? ' active' : '');
    const load = document.createElement('button');
    load.className = 'pload'; load.textContent = n; load.title = '载入「' + n + '」';
    load.addEventListener('click', () => doLoad(n));
    const edit = document.createElement('button');
    edit.className = 'pedit'; edit.textContent = '✎'; edit.title = '重命名';
    edit.addEventListener('click', (ev) => { ev.stopPropagation(); beginRename(row, n); });
    const del = document.createElement('button');
    del.className = 'pdel'; del.textContent = '×'; del.title = '删除「' + n + '」';
    del.addEventListener('click', (ev) => { ev.stopPropagation(); askDelete(row, n); });
    row.append(load, edit, del);
    return row;
  }

  // delete needs a confirm: the row swaps to "删除「name」? [删除] [取消]" so a stray click
  // can't wipe a saved version.
  /** @param {HTMLDivElement} row @param {string} n */
  function askDelete(row, n) {
    row.replaceChildren();
    const q = document.createElement('span');
    q.className = 'pconfirm'; q.textContent = '删除「' + n + '」?';
    const yes = document.createElement('button');
    yes.className = 'pdel pc-yes'; yes.textContent = '删除'; yes.title = '确认删除';
    yes.addEventListener('click', (ev) => { ev.stopPropagation(); doDelete(n); });
    const no = document.createElement('button');
    no.className = 'pedit pcancel'; no.textContent = '取消'; no.title = '取消';
    no.addEventListener('click', (ev) => { ev.stopPropagation(); renderList(); });
    row.append(q, yes, no);
  }

  function renderList() {
    list.innerHTML = '';
    const names = Object.keys(presets);
    if (!names.length) {
      const e = document.createElement('div');
      e.className = 'empty'; e.textContent = '还没有保存的版本';
      list.appendChild(e);
      return;
    }
    for (const n of names) list.appendChild(makeRow(n));
  }

  function doSave() {
    let i = 1; while (presets['版本 ' + i]) i++;
    const name = '版本 ' + i;
    presets[name] = snapshot(refs);
    setPresets(presets);
    active = name; setLast(name);
    renderList();
    flash('✓ 已保存「' + name + '」 — 点 ✎ 可改名');
  }

  /** Inline-rename a row: swap the name button for an input. @param {HTMLDivElement} row @param {string} oldName */
  function beginRename(row, oldName) {
    const inp = document.createElement('input');
    inp.className = 'prename'; inp.type = 'text'; inp.maxLength = 24; inp.value = oldName;
    row.replaceChildren(inp);
    inp.focus(); inp.select();
    let done = false;
    const commit = () => {
      if (done) return; done = true;
      const nn = inp.value.trim();
      if (nn && nn === oldName) { /* unchanged */ }
      else if (nn && presets[nn]) flash('已存在同名版本');
      else if (nn) {
        /** @type {Record<string, any>} */
        const rebuilt = {}; // keep order, swap the key
        for (const k of Object.keys(presets)) rebuilt[k === oldName ? nn : k] = presets[k];
        presets = rebuilt; setPresets(presets);
        if (active === oldName) { active = nn; setLast(nn); }
        flash('已重命名为「' + nn + '」');
      }
      renderList();
    };
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      else if (e.key === 'Escape') { done = true; renderList(); }
    });
    inp.addEventListener('blur', commit);
  }

  /** @param {string} n */
  function doLoad(n) {
    if (!presets[n]) return;
    applySnapshot(refs, presets[n]);
    refreshDisplays();
    active = n; setLast(n);
    renderList();
    flash('已载入「' + n + '」');
  }

  /** @param {string} n */
  function doDelete(n) {
    if (!presets[n]) return;
    delete presets[n]; setPresets(presets);
    if (active === n) { active = null; setLast(null); }
    renderList();
    flash('已删除「' + n + '」');
  }

  saveBtn.addEventListener('click', doSave);

  renderList();
  // pin the bar directly under the title, above the scrolling folder list
  const title = gui.domElement.querySelector(':scope > .title');
  if (title) title.insertAdjacentElement('afterend', bar); else gui.domElement.appendChild(bar);
}
