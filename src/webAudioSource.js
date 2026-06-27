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

/**
 * Wrap a live MediaStream (mic/device OR system loopback) as the standard audio-source interface.
 * Shared by createWebAudioSource and createSystemAudioSource to avoid duplicating the pipeline.
 * @param {AudioContext} ctx
 * @param {MediaStream} stream
 * @param {string} label
 * @returns {import('./types.js').AudioSource}
 */
function analyserSourceFromStream(ctx, stream, label) {
  const srcNode = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.5;
  srcNode.connect(analyser);
  const binCount = analyser.frequencyBinCount;
  const bytes = new Uint8Array(binCount);
  const spectrum = new Float32Array(binCount);
  const third = Math.floor(binCount / 3);
  const avg = (/** @type {number} */ lo, /** @type {number} */ hi) => {
    let s = 0;
    for (let i = lo; i < hi; i++) s += spectrum[i];
    return clamp(s / (hi - lo), 0, 1);
  };
  return {
    label,
    update() { analyser.getByteFrequencyData(bytes); for (let i = 0; i < binCount; i++) spectrum[i] = bytes[i] / 255; },
    getSpectrum() { return spectrum; },
    getLevels() { return { bass: avg(0, third), mid: avg(third, 2 * third), treble: avg(2 * third, binCount) }; },
    stop() { stream.getTracks().forEach((t) => t.stop()); ctx.close(); },
  };
}

// Real audio source: captures an input device through a Web Audio AnalyserNode
// (true FFT) and exposes the SAME interface as the simulated source
// (getSpectrum / getLevels / update) so the visual layer is unchanged.
/**
 * @param {{ deviceId?: string, bands?: number }} [opts]
 * @returns {Promise<import('./types.js').AudioSource>}
 */
export async function createWebAudioSource(opts = {}) {
  /** @type {MediaTrackConstraints} */
  const audioConstraints = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
  if (opts.deviceId) audioConstraints.deviceId = { exact: opts.deviceId };

  const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints, video: false });

  const Ctx = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
  const ctx = /** @type {AudioContext} */ (new Ctx());
  if (ctx.state === 'suspended') await ctx.resume();

  const track = stream.getAudioTracks()[0];
  return analyserSourceFromStream(ctx, stream, (track && track.label) || 'audio input');
}

// System-audio loopback (Electron getDisplayMedia → macOS ScreenCaptureKit). No BlackHole; the
// user still hears their speakers. We capture a screen source only to obtain the audio loopback,
// then immediately drop the video track.
/**
 * @param {object} [opts]
 * @returns {Promise<import('./types.js').AudioSource>}
 */
export async function createSystemAudioSource(opts = {}) {
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
  stream.getVideoTracks().forEach((t) => t.stop()); // we only want the audio
  if (!stream.getAudioTracks().length) {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error('系统未提供环回音频轨道（需在「系统设置 → 隐私与安全性 → 屏幕录制」授权后重启 app）');
  }
  const Ctx = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
  const ctx = /** @type {AudioContext} */ (new Ctx());
  if (ctx.state === 'suspended') await ctx.resume();
  const audioStream = new MediaStream(stream.getAudioTracks());
  return analyserSourceFromStream(ctx, audioStream, '系统声音 (环回)');
}
