import * as THREE from 'three';
import { CONFIG } from '../config.js';

export function makeGradientTexture(inner, outer) {
  const size = 512;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size * 0.42, 0, size / 2, size * 0.42, size * 0.75);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.maxPixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  return renderer;
}

export function createCamera() {
  const cam = new THREE.PerspectiveCamera(CONFIG.camera.fov, window.innerWidth / window.innerHeight, 0.1, 500);
  cam.position.set(0, CONFIG.camera.height, CONFIG.camera.distance);
  cam.lookAt(0, 1.5, 0);
  return cam;
}

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = makeGradientTexture(CONFIG.colors.bg1, CONFIG.colors.bg0);
  scene.fog = new THREE.Fog(new THREE.Color(CONFIG.colors.bg0).getHex(), 28, 90);
  scene.add(new THREE.AmbientLight(0x3a4170, 0.6));
  const key = new THREE.DirectionalLight(0xbfd0ff, 0.35);
  key.position.set(6, 12, 8);
  scene.add(key);
  return scene;
}
