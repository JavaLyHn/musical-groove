// @ts-check
import { CONFIG } from './config.js';
import { clamp } from './util/math.js';

// Prefer a system-audio loopback input (BlackHole / Loopback / Soundflower /
// an aggregate device) when present; otherwise return undefined so we fall back
// to the default input (a microphone). Device labels are only exposed after a
// permission grant, so we briefly open and close a default stream first.
/**
 * @returns {Promise<string|undefined>} the loopback device id, or undefined to fall back to the default input.
 */
export async function pickLoopbackDeviceId() {
  try {
    const tmp = await navigator.mediaDevices.getUserMedia({ audio: true });
    tmp.getTracks().forEach((t) => t.stop());
  } catch (e) {
    return undefined;
  }
  const devices = await navigator.mediaDevices.enumerateDevices();
  const match = devices.find(
    (d) => d.kind === 'audioinput' && /blackhole|loopback|soundflower|aggregate|multi-?output/i.test(d.label),
  );
  return match ? match.deviceId : undefined;
}

// Real audio source: captures an input device through a Web Audio AnalyserNode
// (true FFT) and exposes the SAME interface as the simulated source
// (getSpectrum / getLevels / update) so the visual layer is unchanged.
/**
 * @param {{ deviceId?: string, bands?: number }} [opts]
 * @returns {Promise<import('./types.js').AudioSource>}
 */
export async function createWebAudioSource(opts = {}) {
  const bands = opts.bands || CONFIG.bands;
  /** @type {MediaTrackConstraints} */
  const audioConstraints = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
  if (opts.deviceId) audioConstraints.deviceId = { exact: opts.deviceId };

  const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints, video: false });

  const Ctx = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
  const ctx = new Ctx();
  if (ctx.state === 'suspended') await ctx.resume();
  const srcNode = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;                 // -> 256 frequency bins (the shaper mel-rebins to CONFIG.bands)
  analyser.smoothingTimeConstant = 0.82;  // temporal smoothing for fluid motion
  srcNode.connect(analyser);

  const binCount = analyser.frequencyBinCount; // 256
  const bytes = new Uint8Array(binCount);
  const spectrum = new Float32Array(binCount);
  const third = Math.floor(binCount / 3);
  const avg = (/** @type {number} */ lo, /** @type {number} */ hi) => {
    let s = 0;
    for (let i = lo; i < hi; i++) s += spectrum[i];
    return clamp(s / (hi - lo), 0, 1);
  };

  const track = stream.getAudioTracks()[0];
  return {
    label: (track && track.label) || 'audio input',
    update() {
      analyser.getByteFrequencyData(bytes);
      for (let i = 0; i < binCount; i++) spectrum[i] = bytes[i] / 255;
    },
    getSpectrum() { return spectrum; },
    getLevels() { return { bass: avg(0, third), mid: avg(third, 2 * third), treble: avg(2 * third, binCount) }; },
    stop() { stream.getTracks().forEach((t) => t.stop()); ctx.close(); },
  };
}
