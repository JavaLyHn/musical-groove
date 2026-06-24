// @ts-check
// Real-time control panel (lil-gui), shown only with ?gui. Every reactive event follows
// the reference's clean (sensitivity + cooldown) pair. These sliders write straight to
// CONFIG / the camera state / the renderer — all read live each frame — so the look can
// be dialled in the browser instead of round-tripping screen recordings.
import GUI from 'lil-gui';
import { CONFIG } from './config.js';

/** @param {{ rig: { state: any }, renderer: any }} refs */
export function createGui({ rig, renderer }) {
  const gui = new GUI({ title: '声音星球 · 实时调参' });

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
