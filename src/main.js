import * as THREE from 'three';
import { CONFIG } from './config.js';
import { applyQuality } from './quality.js';
applyQuality(CONFIG);

import { createRenderer, createCamera, createScene } from './scene/sceneSetup.js';
import { createPillarField } from './scene/pillarField.js';
import { createCore } from './scene/core.js';
import { createStarfield } from './scene/starfield.js';
import { createCameraRig } from './scene/cameraRig.js';
import { createSimulatedAudioSource } from './audioSource.js';
import { createComposer } from './scene/postfx.js';

const canvas = document.getElementById('app');
const renderer = createRenderer(canvas);
const camera = createCamera();
const scene = createScene();

const audio = createSimulatedAudioSource();
const field = createPillarField();
scene.add(field.mesh);

const core = createCore();
scene.add(core.group);

const stars = createStarfield();
scene.add(stars.points);

const rig = createCameraRig(camera);
const { composer, setSize, update: updateFx } = createComposer(renderer, scene, camera);

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
  updateFx(dt);
  composer.render();
}
requestAnimationFrame(frame);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  setSize(window.innerWidth, window.innerHeight);
});
