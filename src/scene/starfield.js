import * as THREE from 'three';
import { CONFIG } from '../config.js';

export function createStarfield() {
  const { count, radius } = CONFIG.stars;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // random point on a shell (radius .. 1.4*radius), upper hemisphere bias
    const u = Math.random(), v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const rr = radius * (1 + 0.4 * Math.random());
    positions[i * 3] = rr * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = Math.abs(rr * Math.cos(phi)) * 0.8 + 10;
    positions[i * 3 + 2] = rr * Math.sin(phi) * Math.sin(theta);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0x9fb0ff, size: 1.6, sizeAttenuation: false,
    transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  function update(dt) { points.rotation.y += dt * 0.01; }
  return { points, update };
}
