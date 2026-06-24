// @ts-check
import { CONFIG } from '../config.js';

// Static telephoto camera. Position is derived from an intuitive set of knobs:
//   pitchDeg  – how far the camera looks DOWN from horizontal (0 = grazing)
//   fov       – vertical field of view (narrow = long-lens compression)
//   distance  – metres from the camera to the look target
//   targetY   – height of the look target (pin this on the core, not the horizon)
// The look target is always (0, targetY, 0): the core. Fog near/far track the
// distance so the depth look holds while tuning.
/**
 * @param {any} camera  a THREE.PerspectiveCamera (three ships no type defs)
 * @param {any} [scene] a THREE.Scene; its fog near/far are re-derived from distance
 */
export function createCameraRig(camera, scene) {
  const c = CONFIG.camera;
  const s = {
    pitchDeg: c.pitchDeg ?? 30,
    fov: c.fov ?? 35,
    distance: c.distance ?? 190,
    targetY: c.targetY ?? 7,
    azimuthDeg: c.azimuthDeg ?? 0,
    orbitSpeed: c.orbitSpeed ?? 0, // rad/s of slow auto-spin (0 = static)
  };

  function apply() {
    const pitch = (s.pitchDeg * Math.PI) / 180;
    const az = (s.azimuthDeg * Math.PI) / 180; // off-axis a few degrees so the centre grout line isn't viewed edge-on
    const horiz = s.distance * Math.cos(pitch);
    camera.fov = s.fov;
    camera.updateProjectionMatrix();
    camera.position.set(horiz * Math.sin(az), s.targetY + s.distance * Math.sin(pitch), horiz * Math.cos(az));
    camera.lookAt(0, s.targetY, 0);
    if (scene && scene.fog) {
      scene.fog.near = s.distance * 0.92; // just in front of the core stays sharp
      scene.fog.far = s.distance * 1.75;  // the back edge of the field recedes to deep space
    }
  }
  apply();

  // ?tune: live keyboard tuning + on-screen readout, so the camera can be dialled
  // in directly in the browser without round-tripping screenshots.
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('tune')) {
    const hud = document.createElement('div');
    hud.style.cssText =
      'position:fixed;left:12px;top:12px;z-index:9;font:12px/1.5 monospace;color:#9ad0e0;' +
      'background:#0a0f24cc;padding:8px 11px;border-radius:6px;white-space:pre;pointer-events:none';
    document.body.appendChild(hud);
    const draw = () => {
      hud.textContent =
        `pitchDeg ${s.pitchDeg.toFixed(0)}   fov ${s.fov.toFixed(0)}   ` +
        `distance ${s.distance.toFixed(0)}   targetY ${s.targetY.toFixed(1)}\n` +
        `W/S pitch  Q/E fov  A/D distance  R/F targetY  (values logged to console)`;
    };
    draw();
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (k === 'w') s.pitchDeg += 1;
      else if (k === 's') s.pitchDeg -= 1;
      else if (k === 'q') s.fov -= 1;
      else if (k === 'e') s.fov += 1;
      else if (k === 'a') s.distance -= 5;
      else if (k === 'd') s.distance += 5;
      else if (k === 'r') s.targetY += 0.5;
      else if (k === 'f') s.targetY -= 0.5;
      else return;
      s.pitchDeg = Math.max(0, Math.min(85, s.pitchDeg));
      s.fov = Math.max(10, Math.min(90, s.fov));
      s.distance = Math.max(30, s.distance);
      apply();
      draw();
      console.log(`[camera] fov: ${s.fov}, pitchDeg: ${s.pitchDeg}, distance: ${s.distance}, targetY: ${s.targetY}`);
    });
  }

  // Slow auto-spin: advance the azimuth by orbitSpeed (rad/s) and re-apply. apply() also
  // runs every frame so live edits to `state` (from the ?gui panel) take effect at once.
  /** @param {number} dt */
  function update(dt) {
    if (s.orbitSpeed) s.azimuthDeg += s.orbitSpeed * dt * (180 / Math.PI);
    apply();
  }
  return { update, apply, state: s };
}
