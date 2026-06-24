import { CONFIG } from './config.js';
import { clamp } from './util/math.js';

// Procedural stand-in for a real FFT. Synthesizes a believable spectrum with
// a steady beat. Swap this for a Web Audio AnalyserNode source later; the
// returned shape (getSpectrum/getLevels/update) is the stable contract.
export function createSimulatedAudioSource(bands = CONFIG.bands) {
  const spectrum = new Float32Array(bands);
  const bpm = 120;
  let t = 0;

  function recompute() {
    const beatPhase = (t * (bpm / 60)) % 1;          // 0..1 each beat
    const beat = Math.pow(1 - beatPhase, 4);          // sharp attack, decay
    for (let i = 0; i < bands; i++) {
      const f = i / (bands - 1);                      // 0 (bass) .. 1 (treble)
      const tilt = Math.exp(-f * 1.7);                // bass-heavy
      const wobble = 0.5 + 0.5 * Math.sin(t * (1.3 + f * 5.0) + i * 0.6);
      const bassHit = beat * (1 - f) * 0.8;           // beat lives in the lows
      spectrum[i] = clamp(tilt * (0.35 * wobble + 0.25) + bassHit, 0, 1);
    }
  }

  function band(lo, hi) {
    let sum = 0;
    for (let i = lo; i < hi; i++) sum += spectrum[i];
    return clamp(sum / (hi - lo), 0, 1);
  }

  recompute();
  return {
    update(dt) { t += dt; recompute(); },
    getSpectrum() { return spectrum; },
    getLevels() {
      const third = Math.floor(bands / 3);
      return { bass: band(0, third), mid: band(third, 2 * third), treble: band(2 * third, bands) };
    },
  };
}
