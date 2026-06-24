import { describe, it, expect } from 'vitest';
import { createAudioShaper } from '../src/util/audioShaper.js';

// Build a 64-bin linear spectrum: strong low bins, weak high bins.
function spec(low, high) {
  const s = new Float32Array(64);
  for (let i = 0; i < 64; i++) s[i] = i < 8 ? low : high;
  return s;
}

describe('createAudioShaper', () => {
  it('per-band normalization equalizes a bass-heavy spectrum across rings', () => {
    const sh = createAudioShaper(64, 64);
    const s = spec(0.6, 0.25); // low bins 0.6, high bins 0.25 -> raw ratio 2.4
    let r;
    for (let i = 0; i < 200; i++) r = sh.process(s, 1 / 60); // let the per-band means settle
    const lowOut = r.spectrum[2];
    const highOut = r.spectrum[60];
    // both should be lifted to a comparable magnitude (ratio far below the raw 2.4)
    expect(lowOut).toBeGreaterThan(0.1);
    expect(highOut).toBeGreaterThan(0.1);
    expect(lowOut / highOut).toBeLessThan(1.5);
  });

  it('reads ~0 in silence (noise floor, not noise-amplifying)', () => {
    const sh = createAudioShaper(64, 64);
    const zero = new Float32Array(64);
    let r;
    for (let i = 0; i < 50; i++) r = sh.process(zero, 1 / 60);
    expect(Math.max(...r.spectrum)).toBeLessThan(0.05);
    expect(r.level).toBeLessThan(0.05);
  });

  it('level tracks loudness and stays within 0..1', () => {
    const sh = createAudioShaper(64, 64);
    let r;
    for (let i = 0; i < 60; i++) r = sh.process(spec(0.9, 0.5), 1 / 60);
    expect(r.level).toBeGreaterThan(0.5);
    expect(r.level).toBeLessThanOrEqual(1);
    for (const v of r.spectrum) expect(v).toBeLessThanOrEqual(1);
  });
});
