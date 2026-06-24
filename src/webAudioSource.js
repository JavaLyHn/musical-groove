import { CONFIG } from './config.js';
import { clamp } from './util/math.js';

// Prefer a system-audio loopback input (BlackHole / Loopback / Soundflower /
// an aggregate device) when present; otherwise return undefined so we fall back
// to the default input (a microphone). Device labels are only exposed after a
// permission grant, so we briefly open and close a default stream first.
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
export async function createWebAudioSource(opts = {}) {
  const bands = opts.bands || CONFIG.bands;
  const audioConstraints = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
  if (opts.deviceId) audioConstraints.deviceId = { exact: opts.deviceId };

  const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints, video: false });

  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  if (ctx.state === 'suspended') await ctx.resume();
  const srcNode = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 128;                 // -> 64 frequency bins (matches CONFIG.bands)
  analyser.smoothingTimeConstant = 0.82;  // temporal smoothing for fluid motion
  srcNode.connect(analyser);

  const binCount = analyser.frequencyBinCount; // 64
  const bytes = new Uint8Array(binCount);
  const spectrum = new Float32Array(bands);
  const third = Math.floor(bands / 3);
  const avg = (lo, hi) => {
    let s = 0;
    for (let i = lo; i < hi; i++) s += spectrum[i];
    return clamp(s / (hi - lo), 0, 1);
  };

  const track = stream.getAudioTracks()[0];
  return {
    label: (track && track.label) || 'audio input',
    update() {
      analyser.getByteFrequencyData(bytes);
      const m = Math.min(binCount, bands);
      for (let i = 0; i < bands; i++) spectrum[i] = i < m ? bytes[i] / 255 : 0;
    },
    getSpectrum() { return spectrum; },
    getLevels() { return { bass: avg(0, third), mid: avg(third, 2 * third), treble: avg(2 * third, bands) }; },
    stop() { stream.getTracks().forEach((t) => t.stop()); ctx.close(); },
  };
}
