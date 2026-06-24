import { CONFIG } from '../config.js';

export function createCameraRig(camera) {
  const c = CONFIG.camera;
  let t = 0;
  function update(dt) {
    t += dt;
    const a = t * c.orbitSpeed;
    camera.position.x = Math.sin(a) * c.distance;
    camera.position.z = Math.cos(a) * c.distance;
    camera.position.y = c.height + Math.sin(t * 0.15) * c.bob;
    camera.lookAt(0, c.lookAtY ?? 1.5, 0);
  }
  return { update };
}
