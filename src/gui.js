// @ts-check
// Real-time control panel (lil-gui), opened by clicking the LyHN signature. Every reactive
// event follows the reference's clean (sensitivity + cooldown) pair. These sliders write
// straight to CONFIG / the camera state / the renderer — all read live each frame — so the
// look can be dialled in the browser instead of round-tripping screen recordings.
import GUI from 'lil-gui';
import { CONFIG } from './config.js';

// Transparent, glassy theme matching the cool/tech palette; panel sits under the signature.
function injectTheme() {
  if (document.getElementById('lyhn-gui-theme')) return;
  const s = document.createElement('style');
  s.id = 'lyhn-gui-theme';
  s.textContent = `
    .lil-gui.lyhn-gui.root{
      position:fixed; top:56px; left:16px; right:auto; z-index:11;
      --background-color:rgba(11,19,48,0.38);
      --title-background-color:rgba(11,19,48,0.0);
      --title-text-color:#bfeaf2;
      --text-color:#cfd7f6;
      --widget-color:rgba(95,208,224,0.14);
      --hover-color:rgba(95,208,224,0.26);
      --focus-color:rgba(130,205,235,0.36);
      --number-color:#bcaff4;
      --string-color:#7fe0ee;
      --font-size:11px; --input-font-size:11px; --width:266px;
      -webkit-backdrop-filter:blur(16px); backdrop-filter:blur(16px);
      border:1px solid rgba(130,165,235,0.22); border-radius:12px;
      box-shadow:0 10px 44px rgba(0,0,0,.40);
    }
    .lil-gui.lyhn-gui .title{
      font-family:'Snell Roundhand','Zapfino','Apple Chancery',cursive;
      font-size:20px; letter-spacing:.4px; font-weight:600;
      border-bottom:1px solid rgba(130,165,235,0.16);
    }
    .lil-gui.lyhn-gui .children, .lil-gui.lyhn-gui .controller{ background:transparent; }`;
  document.head.appendChild(s);
}

/** @param {{ rig: { state: any }, renderer: any }} refs */
export function createGui({ rig, renderer }) {
  injectTheme();
  const gui = new GUI({ title: 'LyHN' });
  gui.domElement.classList.add('lyhn-gui');

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

  return gui;
}
