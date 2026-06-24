import * as THREE from 'three';
import { CONFIG } from './config.js';
import { applyQuality } from './quality.js';
// Live quality override for finding a machine's sweet spot: ?q=low|mid|high
const _q = new URLSearchParams(location.search).get('q');
if (_q === 'low' || _q === 'mid' || _q === 'high') CONFIG.quality = _q;
applyQuality(CONFIG);

import { createRenderer, createCamera, createScene } from './scene/sceneSetup.js';
import { createPillarField } from './scene/pillarField.js';
import { createCore } from './scene/core.js';
import { createStarfield } from './scene/starfield.js';
import { createAtmosphere } from './scene/atmosphere.js';
import { createCameraRig } from './scene/cameraRig.js';
import { createSimulatedAudioSource } from './audioSource.js';
import { createWebAudioSource, pickLoopbackDeviceId } from './webAudioSource.js';
import { createAudioControls } from './ui.js';
import { createComposer } from './scene/postfx.js';

const canvas = document.getElementById('app');
const renderer = createRenderer(canvas);
const camera = createCamera();
const scene = createScene();

// `audio` starts simulated and is swapped to the real source once connected.
let audio = createSimulatedAudioSource();
const field = createPillarField();
scene.add(field.mesh);
scene.add(field.capMesh);

const core = createCore();
scene.add(core.group);

const stars = createStarfield();
scene.add(stars.points);

const atmosphere = createAtmosphere();
scene.add(atmosphere.sprite);

const rig = createCameraRig(camera, scene);
const { composer, setSize, update: updateFx } = createComposer(renderer, scene, camera);

// Swap the simulated source for real system audio (prefers a BlackHole-style
// loopback device; falls back to the default input). Same interface -> no
// visual changes. Returns a status label for the UI.
async function connectRealAudio() {
  const deviceId = await pickLoopbackDeviceId();
  const web = await createWebAudioSource({ deviceId });
  web.update(0);
  audio = web;
  console.log('[声音星球] audio connected:', web.label, '| loopback device:', !!deviceId);
  return deviceId ? '● ' + web.label : '● ' + web.label + '（建议用 BlackHole 取系统声音）';
}
const controls = createAudioControls({ onConnect: connectRealAudio });
// After the first permission grant, auto-connect on every load (no click needed) —
// so as a wallpaper it just senses the music. (?autoaudio forces it, for testing.)
(async () => {
  if (new URLSearchParams(location.search).has('autoaudio')) { controls.connect(); return; }
  try {
    const st = await navigator.permissions.query({ name: 'microphone' });
    if (st.state === 'granted') controls.connect();
  } catch (e) { /* permissions API unavailable -> keep the manual button */ }
})();

const clock = new THREE.Clock();

let visible = true;
document.addEventListener('visibilitychange', () => { visible = !document.hidden; });

const frameInterval = 1 / CONFIG.fpsCap;
let acc = 0;
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!visible) return;                 // pause work when wallpaper not shown
  acc += dt;
  if (acc < frameInterval) return;      // fps cap
  acc = 0;

  audio.update(dt);
  const spectrum = audio.getSpectrum();
  const levels = audio.getLevels();
  field.update(spectrum, levels, dt);
  core.update(levels.bass, dt);
  stars.update(dt);
  rig.update(dt);
  updateFx(dt, levels.bass);
  composer.render();
}
requestAnimationFrame(frame);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  setSize(window.innerWidth, window.innerHeight);
});
