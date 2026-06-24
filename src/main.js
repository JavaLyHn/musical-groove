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
import { createSparks } from './scene/sparks.js';
import { createAtmosphere } from './scene/atmosphere.js';
import { createCameraRig } from './scene/cameraRig.js';
import { createSimulatedAudioSource } from './audioSource.js';
import { createAudioShaper } from './util/audioShaper.js';
import { createBeatDetector } from './util/beatDetector.js';
import { createWebAudioSource, pickLoopbackDeviceId } from './webAudioSource.js';
import { createAudioControls } from './ui.js';
import { createComposer } from './scene/postfx.js';
import { createNowPlaying } from './nowPlaying.js';

const canvas = document.getElementById('app');
const renderer = createRenderer(canvas);
const camera = createCamera();
const scene = createScene();

// `audio` starts simulated and is swapped to the real source once connected.
let audio = createSimulatedAudioSource();
// The shaper turns whatever source is live into a per-band-normalized drive (so
// every ring dances on its own band) + an overall amplitude level.
const shaper = createAudioShaper(CONFIG.audioBins, CONFIG.bands);
// Spectral-flux beat detection (adaptive threshold), fed the raw spectrum.
const beatDetector = createBeatDetector();
// Broadband onset (positive spectral flux of the shaped bands) — the energy that
// drives the independent ripple + meteor triggers (their own sensitivity + cooldown).
const prevSpec = new Float32Array(CONFIG.bands);
const field = createPillarField();
scene.add(field.mesh);

// System "Now Playing": a top-line overlay (cover + title — artist) fed by the dev
// server's bridge over SSE, and the cover's dominant colour tints the field's palette.
const nowPlaying = createNowPlaying({ onColor: (rgb) => field.setCoverColor(rgb) });

const core = createCore();
scene.add(core.group);

const stars = createStarfield();
scene.add(stars.points);

const sparks = createSparks();
scene.add(sparks.points);

const atmosphere = createAtmosphere();
scene.add(atmosphere.sprite);

const rig = createCameraRig(camera, scene);
const { composer, setSize, update: updateFx } = createComposer(renderer, scene, camera);

// ?gui — real-time control panel (lil-gui). Dynamically imported so it (and lil-gui) are
// code-split out of the wallpaper bundle and only loaded when you actually open it.
if (new URLSearchParams(location.search).has('gui')) {
  import('./gui.js').then(({ createGui }) => createGui({ rig, renderer })).catch(() => {});
}

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
  const raw = audio.getSpectrum();
  const beat = beatDetector.process(raw, dt);
  const { spectrum, levels, level, warmth, brightness, sharpness } = shaper.process(raw, dt);
  let flux = 0;
  for (let i = 0; i < spectrum.length; i++) { const d = spectrum[i] - prevSpec[i]; if (d > 0) flux += d; prevSpec[i] = spectrum[i]; }
  const onset = flux / spectrum.length;
  field.update(spectrum, levels, level, beat, { warmth, brightness, sharpness }, dt, onset);
  core.update(levels.bass, dt);
  stars.update(dt);
  sparks.update(onset, dt);
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
