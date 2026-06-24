import * as THREE from 'three';
import { CONFIG } from '../config.js';

// The core is now JUST a soft central fill light that breathes with the bass. The old
// visible solid sphere ("the blue circle") and its expanding ring were removed — the
// field's own centre glow (coreBoost) plus the ripple-ring system carry the centre, so a
// static solid disc just sat there cluttering the standby state.
export function createCore() {
  const group = new THREE.Group();
  const coreColor = new THREE.Color(CONFIG.colors.core);

  const light = new THREE.PointLight(coreColor.getHex(), 0.8, 40, 2);
  light.position.set(0, 4.0, 0);
  group.add(light);

  let pulse = 0; // decaying brightness boost from the bass
  function update(bass, dt) {
    pulse = Math.max(pulse * (1 - 4 * dt), bass);
    light.intensity = 0.8 + pulse * 2.0;
  }

  return { group, update };
}
