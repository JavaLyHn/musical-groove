import { CONFIG } from '../config.js';
import { clamp } from './math.js';

// Auto-gain control. Divides the incoming spectrum + levels by a rolling peak
// so the energy fed to the visuals stays in a comfortable 0..1 band no matter
// how loud or quiet the track is. The peak attacks INSTANTLY to new highs and
// decays SLOWLY (tau seconds) toward a floor:
//   - a loud track can't push the field past full -> no white-out
//   - within-song quiet keeps the (still-high) peak -> stays calm, not amplified
//   - a persistently quiet track is gently brought up, with gain capped at 1/floor
// This anchors the picture to the same look regardless of the source loudness.
export function createAGC(opts = {}) {
  const tau = opts.tau ?? CONFIG.agc.tau;
  const floor = opts.floor ?? CONFIG.agc.floor;
  let peak = floor;
  /** @type {Float32Array|null} */
  let out = null;
  return {
    process(spectrum, levels, dt) {
      if (!out || out.length !== spectrum.length) out = new Float32Array(spectrum.length);
      let fmax = 0;
      for (let i = 0; i < spectrum.length; i++) if (spectrum[i] > fmax) fmax = spectrum[i];
      const k = Math.exp(-Math.max(dt, 0) / tau);          // slow decay factor
      peak = Math.max(fmax, peak * k, floor);              // instant attack, slow decay, floored
      const g = 1 / peak;
      for (let i = 0; i < spectrum.length; i++) out[i] = clamp(spectrum[i] * g, 0, 1);
      return {
        spectrum: out,
        levels: {
          bass: clamp(levels.bass * g, 0, 1),
          mid: clamp(levels.mid * g, 0, 1),
          treble: clamp(levels.treble * g, 0, 1),
        },
        gain: g,
        peak,
      };
    },
  };
}
