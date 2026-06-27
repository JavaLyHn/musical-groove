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
  const mo = CONFIG.motes;
  const N = cfg.count;
  const M = Math.min(mo.count, N); // the first M points are persistent ambient motes; meteors use [M, N)
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

  // ambient MOTES: seed the first M points as a slow cool dust. They never die — they drift
  // up + sway, twinkle, and respawn low once they pass the ceiling. Sparse, dim, restrained.
  const moPhase = new Float32Array(M);
  /** @param {number} i @param {boolean} low  start near the floor (respawn) vs anywhere (initial scatter) */
  function seedMote(i, low) {
    const ang = Math.random() * Math.PI * 2;
    const rad = Math.sqrt(Math.random()) * mo.spawnR;     // sqrt -> uniform over the disc
    positions[i * 3] = Math.cos(ang) * rad;
    positions[i * 3 + 1] = low ? mo.yMin + Math.random() * 4 : mo.yMin + Math.random() * (mo.yMax - mo.yMin);
    positions[i * 3 + 2] = Math.sin(ang) * rad;
    vel[i * 3] = (Math.random() - 0.5) * mo.sway;
    vel[i * 3 + 1] = mo.rise * (0.6 + 0.6 * Math.random());
    vel[i * 3 + 2] = (Math.random() - 0.5) * mo.sway;
    moPhase[i] = Math.random() * 6.283;
  }
  for (let i = 0; i < M; i++) seedMote(i, false);
  let moClock = 0;

  let cursor = M; // meteor write cursor, confined to [M, N)
  const trailPos = new Float32Array(N);   // per meteor-point: 0 = head .. 1 = tail (white->cyan + fade)
  const headBright = new Float32Array(N); // per-meteor brightness scale (so they aren't all equal)
  let idleMeteorT = 0; // standby self-meteor timer (seconds since the last idle meteor)
  // Launch a meteor: a streak of points sharing ONE velocity (so it moves rigidly),
  // started high near the rim and arcing across + down. The tail is staggered "older"
  // (dimmer) and the head skips the ember pop-in so it reads bright immediately. Every
  // meteor randomizes its length, speed, fall angle, brightness, and AIM POINT (a random
  // spot near — not dead — centre) so no two look or travel the same (cures the monotony).
  function spawnMeteor(gentle = false) {
    const sMul = gentle ? 0.8 : 1.0;   // gentler standby meteors: slower
    const bMul = gentle ? 0.55 : 1.0;  // gentler standby meteors: dimmer
    const ang = Math.random() * Math.PI * 2;
    const startR = cfg.spawnR * (1.6 + Math.random() * 0.8);
    const sx = Math.cos(ang) * startR;
    const sz = Math.sin(ang) * startR;
    const sy = cfg.spawnYmax * (1.6 + Math.random() * 1.2);
    // aim at a RANDOM point near the centre (not dead centre) -> some cross diagonally,
    // some graze the edge, instead of all converging on the middle.
    const tx = (Math.random() - 0.5) * 80;
    const tz = (Math.random() - 0.5) * 80;
    const dx = tx - sx, dz = tz - sz;
    const len = Math.hypot(dx, dz) + 1e-3;
    const speed = cfg.meteorSpeed * (0.7 + Math.random() * 0.9) * sMul;   // wider speed spread
    const vx = (dx / len) * speed;
    const vz = (dz / len) * speed;
    const vy = -cfg.meteorSpeed * (0.12 + Math.random() * 0.4) * sMul;    // fall angle: some steep, some shallow
    const trail = Math.max(4, Math.round(cfg.meteorTrail * (0.6 + Math.random() * 0.9))); // ~10..22 points
    const bright = (0.7 + Math.random() * 0.7) * bMul;            // per-meteor brightness
    const mLife = cfg.life * (0.85 + Math.random() * 0.4);        // per-meteor lifespan (kept uniform across its trail)
    for (let k = 0; k < trail; k++) {
      const i = cursor;
      cursor = cursor + 1 >= N ? M : cursor + 1; // wrap within the meteor region [M, N)
      const back = k / trail;                // 0 = head, ~1 = tail
      positions[i * 3] = sx - vx * back * 0.05;     // tail trails behind the head along -v
      positions[i * 3 + 1] = sy - vy * back * 0.05;
      positions[i * 3 + 2] = sz - vz * back * 0.05;
      vel[i * 3] = vx;
      vel[i * 3 + 1] = vy;
      vel[i * 3 + 2] = vz;
      age[i] = (0.16 + back * 0.45) * cfg.life; // skip the pop-in; tail starts dimmer
      life[i] = mLife;
      trailPos[i] = back;
      headBright[i] = bright;
    }
  }

  const meteorTrigger = createTrigger(CONFIG.meteor);
  function update(onset, dt, idleMix = 0) {
    // ambient motes: slow drifting cool dust, gently twinkling — "energy in the space".
    moClock += dt;
    for (let i = 0; i < M; i++) {
      positions[i * 3] += vel[i * 3] * dt;
      positions[i * 3 + 1] += vel[i * 3 + 1] * dt;
      positions[i * 3 + 2] += vel[i * 3 + 2] * dt;
      if (positions[i * 3 + 1] > mo.yMax) seedMote(i, true); // rose past the ceiling -> respawn low
      const tw = 0.45 + 0.55 * Math.sin(moClock * 0.9 + moPhase[i]); // slow breathe
      const b = mo.brightness * tw;
      colors[i * 3] = b * 0.78; colors[i * 3 + 1] = b * 0.9; colors[i * 3 + 2] = b * 1.0; // cool white
    }

    // rare, ceremonial meteors only: the big-onset trigger carries a long cooldown,
    // so it's the occasional shooting star — not a constant spark cloud. Sometimes a
    // single fire fans out into a small 2-3 shower so the rhythm isn't a metronomic
    // "one... one... one".
    if (meteorTrigger.fire(onset) > 0) {
      spawnMeteor();
      if (Math.random() < cfg.meteorBurstChance) {
        const extra = 1 + Math.floor(Math.random() * cfg.meteorBurstMax);
        for (let e = 0; e < extra; e++) spawnMeteor();
      }
    }

    // standby self-meteors: no audio onset in silence, so drop a gentle single meteor on a
    // timer. idleMix-gated (0 = full music) so music mode never self-spawns one (待机红线).
    if (CONFIG.motion.idleMeteor && idleMix > 0.35) {
      idleMeteorT += dt;
      if (idleMeteorT >= CONFIG.motion.idleMeteorEvery) {
        idleMeteorT = 0;
        spawnMeteor(true);
      }
    } else {
      idleMeteorT = 0; // back to music (or sub-threshold): full interval after re-entering idle
    }

    for (let i = M; i < N; i++) {
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
      // pop in fast, fade out slow (ember), scaled by this meteor's own brightness
      const a = Math.min(1, tn * 6) * (1 - tn) * (1 - tn) * headBright[i];
      // colour gradient ALONG the trail: white-hot head -> cyan tail
      const bk = trailPos[i];                      // 0 = head .. 1 = tail
      colors[i * 3] = a * (0.85 - 0.48 * bk);      // R: 0.85 (head) -> 0.37 (cyan tail)
      colors[i * 3 + 1] = a * (0.92 - 0.07 * bk);  // G: 0.92 -> 0.85
      colors[i * 3 + 2] = a * 1.0;                 // B stays high (cool)
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  }

  return { points, update };
}
