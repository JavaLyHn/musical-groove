import * as THREE from 'three';
import { createRenderer, createCamera, createScene } from './scene/sceneSetup.js';

const canvas = document.getElementById('app');
const renderer = createRenderer(canvas);
const camera = createCamera();
const scene = createScene();

const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
