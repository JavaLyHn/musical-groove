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
    .lil-gui.lyhn-gui .lyhn-reset:active{ transform:scale(0.98); }`;
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

  return gui;
}
