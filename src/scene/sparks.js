import * as THREE from 'three';
import { CONFIG } from '../config.js';

// A soft round sprite so each point reads as a glowing ember, not a square.
function makeSparkTexture() {
  const s = 64;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(220,235,255,0.7)');
  g.addColorStop(1.0, 'rgba(180,210,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Floating embers: a recycled pool of additive points that burst from the core
// on strong beats and drift up while fading. Additive blending means "fade" is
// just darkening the per-point colour toward black (an unseen point = black).
export function createSparks() {
  const cfg = CONFIG.sparks;
  const N = cfg.count;
  const positions = new Float32Array(N * 3);
  const colors = new Float32Array(N * 3);           // additive -> 0,0,0 = invisible
  const vel = new Float32Array(N * 3);
  const age = new Float32Array(N).fill(Infinity);   // age >= life => dead
  const life = new Float32Array(N).fill(1);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size: cfg.size,
    map: makeSparkTexture(),
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;

  let cursor = 0;
  function spawn(count) {
    for (let j = 0; j < count; j++) {
      const i = cursor;
      cursor = (cursor + 1) % N;
      const ang = Math.random() * Math.PI * 2;
      const rad = Math.random() * cfg.spawnR;
      const x = Math.cos(ang) * rad;
      const z = Math.sin(ang) * rad;
      const y = cfg.spawnYmin + Math.random() * (cfg.spawnYmax - cfg.spawnYmin);
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      // gentle outward + buoyant up, with jitter
      const out = 0.4 + Math.random() * 0.6;
      const inv = 1 / (rad + 1e-3);
      vel[i * 3] = x * inv * cfg.spread * out + (Math.random() - 0.5) * cfg.spread * 0.4;
      vel[i * 3 + 1] = cfg.rise * (0.6 + Math.random() * 0.8);
      vel[i * 3 + 2] = z * inv * cfg.spread * out + (Math.random() - 0.5) * cfg.spread * 0.4;
      age[i] = 0;
      life[i] = cfg.life * (0.7 + Math.random() * 0.6);
    }
  }

  function update(beat, dt) {
    // ember burst on the downbeat (kick), scaled by strength; a light sprinkle on hats
    if (beat.kick > 0) spawn(Math.round(cfg.burst * (0.6 + 0.6 * Math.min(beat.kick, 1))));
    if (beat.hat > 0) spawn(cfg.burstHat);

    for (let i = 0; i < N; i++) {
      if (age[i] >= life[i]) {                     // dead -> invisible
        colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = 0;
        continue;
      }
      age[i] += dt;
      const tn = age[i] / life[i];                 // 0..1
      const drag = 1 - 0.5 * dt;                   // ease to a float
      vel[i * 3] *= drag;
      vel[i * 3 + 1] = vel[i * 3 + 1] * drag + cfg.rise * 0.15 * dt; // keep a little lift
      vel[i * 3 + 2] *= drag;
      positions[i * 3] += vel[i * 3] * dt;
      positions[i * 3 + 1] += vel[i * 3 + 1] * dt;
      positions[i * 3 + 2] += vel[i * 3 + 2] * dt;
      // pop in fast, fade out slow (ember)
      const a = Math.min(1, tn * 6) * (1 - tn) * (1 - tn);
      colors[i * 3] = a * 0.85;                    // cool white
      colors[i * 3 + 1] = a * 0.92;
      colors[i * 3 + 2] = a * 1.0;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  }

  return { points, update };
}
