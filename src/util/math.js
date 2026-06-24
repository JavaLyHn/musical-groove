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

// height LUT (idle/low -> white-hot) interpolated across CONFIG.colors.ramp
const _ramp = CONFIG.colors.ramp.map((hex) => new THREE.Color(hex));

export function colorRamp(t) {
  t = clamp(t, 0, 1);
  const n = _ramp.length - 1;
  const f = t * n;
  const i = Math.min(Math.floor(f), n - 1);
  return new THREE.Color().copy(_ramp[i]).lerp(_ramp[i + 1], f - i);
}

export function radialEnergy(r, peak, falloff) {
  return peak * Math.exp(-(r * r) / (falloff * falloff));
}
