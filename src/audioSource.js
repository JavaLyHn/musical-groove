// @ts-check
import { CONFIG } from './config.js';
import { clamp } from './util/math.js';

// Procedural stand-in for a real FFT. Synthesizes a believable spectrum with
// a steady beat. Swap this for a Web Audio AnalyserNode source later; the
// returned shape (getSpectrum/getLevels/update) is the stable contract.
/**
 * @param {number} [bands]
 * @returns {import('./types.js').AudioSource}
 */
export function createSimulatedAudioSource(bands = CONFIG.audioBins) {
  const spectrum = new Float32Array(bands);
  const bpm = 120;
  let t = 0;

  function recompute() {
    const beatPhase = (t * (bpm / 60)) % 1;          // 0..1 each beat
    const beat = Math.pow(1 - beatPhase, 4);          // sharp attack, decay
    for (let i = 0; i < bands; i++) {
      const f = i / (bands - 1);                      // 0 (bass) .. 1 (treble)
      const tilt = Math.exp(-f * 0.9);                // gently bass-leaning (flatter)
      const wobble = 0.5 + 0.5 * Math.sin(t * (1.3 + f * 5.0) + i * 0.6);
      const bassHit = beat * (1 - f * 0.7) * 0.5;     // beat spread across more bands (wider radius)
      spectrum[i] = clamp(tilt * (0.35 * wobble + 0.25) + bassHit, 0, 1);
    }
  }

  function band(/** @type {number} */ lo, /** @type {number} */ hi) {
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

// A truly SILENT source: an all-zero spectrum. This is the default before any real audio
// connects, so "no audio connected" rests in the standby (待机) state — `level` stays below
// idleSilence, idleMix holds at 1 — instead of the synthetic source faking a constant dance.
/**
 * @param {number} [bands]
 * @returns {import('./types.js').AudioSource}
 */
export function createSilentAudioSource(bands = CONFIG.audioBins) {
  const spectrum = new Float32Array(bands); // all zeros, never mutated
  return {
    update() {},
    getSpectrum() { return spectrum; },
    getLevels() { return { bass: 0, mid: 0, treble: 0 }; },
  };
}
