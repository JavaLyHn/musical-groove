import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { clamp } from '../util/math.js';

export function createCore() {
  const c = CONFIG.core;
  const group = new THREE.Group();
  const coreColor = new THREE.Color(CONFIG.colors.core);

  const sphere = new THREE.Mesh(
    new THREE.IcosahedronGeometry(c.radius, 3),
    new THREE.MeshStandardMaterial({ color: 0x000000, emissive: coreColor, emissiveIntensity: c.intensity, roughness: 0.3 }),
  );
  sphere.position.y = 1.2;
  group.add(sphere);

  const light = new THREE.PointLight(coreColor.getHex(), 2.0, 40, 2);
  light.position.copy(sphere.position);
  group.add(light);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.0, 1.15, 64),
    new THREE.MeshBasicMaterial({ color: coreColor, transparent: true, opacity: 0.0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  group.add(ring);

  let ringPhase = 0;     // 0..1 expansion progress
  let pulse = 0;         // decaying brightness boost

  function update(bass, dt) {
    // pulse envelope follows bass with fast attack / slow decay
    pulse = Math.max(pulse * (1 - 4 * dt), bass);
    sphere.material.emissiveIntensity = c.intensity + pulse * c.pulse;
    light.intensity = 2.0 + pulse * 3.0;
    const s = 1 + pulse * 0.25;
    sphere.scale.setScalar(s);

    // ring keeps expanding; brighter when a strong bass kicks it
    ringPhase += dt * (0.4 + bass * c.ringSpeed * 0.1);
    if (ringPhase > 1) ringPhase -= 1;
    const scale = 1 + ringPhase * 16;
    ring.scale.set(scale, scale, 1);
    ring.material.opacity = clamp((1 - ringPhase) * 0.5 * (0.3 + bass), 0, 1);
  }

  return { group, update };
}
