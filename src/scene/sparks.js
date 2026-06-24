import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createTrigger } from '../util/trigger.js';

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
  // Launch a meteor: a streak of points sharing ONE velocity (so it moves rigidly),
  // started high near the rim and arcing across + down. The tail is staggered "older"
  // (dimmer) and the head skips the ember pop-in so it reads bright immediately.
  function spawnMeteor() {
    const ang = Math.random() * Math.PI * 2;
    const startR = cfg.spawnR * (1.6 + Math.random() * 0.8);
    const sx = Math.cos(ang) * startR;
    const sz = Math.sin(ang) * startR;
    const sy = cfg.spawnYmax * (1.6 + Math.random() * 1.2);
    const len = Math.hypot(sx, sz) + 1e-3;
    const speed = cfg.meteorSpeed * (0.8 + 0.5 * Math.random());
    const vx = (-sx / len) * speed;        // travel toward (and past) the centre
    const vz = (-sz / len) * speed;
    const vy = -cfg.meteorSpeed * 0.35;     // arc downward
    for (let k = 0; k < cfg.meteorTrail; k++) {
      const i = cursor;
      cursor = (cursor + 1) % N;
      const back = k / cfg.meteorTrail;      // 0 = head, ~1 = tail
      positions[i * 3] = sx - vx * back * 0.05;     // tail trails behind the head along -v
      positions[i * 3 + 1] = sy - vy * back * 0.05;
      positions[i * 3 + 2] = sz - vz * back * 0.05;
      vel[i * 3] = vx;
      vel[i * 3 + 1] = vy;
      vel[i * 3 + 2] = vz;
      age[i] = (0.16 + back * 0.45) * cfg.life; // skip the pop-in; tail starts dimmer
      life[i] = cfg.life;
    }
  }

  const meteorTrigger = createTrigger(CONFIG.meteor);
  function update(onset, dt) {
    // rare, ceremonial meteors only: the big-onset trigger carries a long cooldown,
    // so it's the occasional shooting star — not a constant spark cloud.
    if (meteorTrigger.fire(onset) > 0) spawnMeteor();

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
