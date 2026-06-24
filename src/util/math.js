import * as THREE from 'three';
import { CONFIG } from '../config.js';

export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;

export function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

// Semi-implicit Euler spring. Returns next {value, vel}.
export function springStep(value, vel, target, stiffness, damping, dt) {
  const accel = stiffness * (target - value) - damping * vel;
  const nextVel = vel + accel * dt;
  const nextValue = value + nextVel * dt;
  return { value: nextValue, vel: nextVel };
}

const _c0 = new THREE.Color(CONFIG.colors.low);
const _c1 = new THREE.Color(CONFIG.colors.mid);
const _c2 = new THREE.Color(CONFIG.colors.high);

export function colorRamp(t) {
  t = clamp(t, 0, 1);
  const out = new THREE.Color();
  if (t < 0.5) out.copy(_c0).lerp(_c1, t / 0.5);
  else out.copy(_c1).lerp(_c2, (t - 0.5) / 0.5);
  return out;
}

export function radialEnergy(r, peak, falloff) {
  return peak * Math.exp(-(r * r) / (falloff * falloff));
}
