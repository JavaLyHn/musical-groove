import * as THREE from 'three';
import { CONFIG } from '../config.js';

// Soft cool atmospheric glow behind the field (a billboarded radial-gradient
// sprite sitting past the horizon) — adds depth and a rim glow so the
// background reads as deep navy atmosphere instead of pure black.
function haloTexture(hex) {
  const size = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0.0, hex + 'd0');
  g.addColorStop(0.4, hex + '50');
  g.addColorStop(1.0, hex + '00');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createAtmosphere() {
  const mat = new THREE.SpriteMaterial({
    map: haloTexture('#3f63c8'),       // cool blue atmosphere
    color: 0xffffff,
    transparent: true,
    opacity: 0.62,                     // a touch stronger horizon glow for depth
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(460, 250, 1);
  sprite.position.set(0, 14, -110);    // past the far horizon, behind the field
  return { sprite };
}
