import { describe, it, expect } from 'vitest';
import { createAGC } from '../src/util/agc.js';

const lv = (b, m, t) => ({ bass: b, mid: m, treble: t });

describe('createAGC', () => {
  it('normalizes a loud spectrum so its max approaches 1', () => {
    const agc = createAGC({ tau: 2.5, floor: 0.3 });
    const loud = new Float32Array([0.8, 0.9, 0.7, 0.6]);
    let r;
    for (let i = 0; i < 5; i++) r = agc.process(loud, lv(0.9, 0.7, 0.6), 1 / 60);
    expect(Math.max(...r.spectrum)).toBeCloseTo(1, 1);
  });

  it('caps gain at 1/floor so a quiet signal is not over-amplified', () => {
    const agc = createAGC({ tau: 0.001, floor: 0.25 }); // fast decay -> peak settles to floor
    const quiet = new Float32Array([0.05, 0.05, 0.05, 0.05]);
    let r;
    for (let i = 0; i < 50; i++) r = agc.process(quiet, lv(0.05, 0.05, 0.05), 1 / 60);
    expect(r.gain).toBeLessThanOrEqual(1 / 0.25 + 1e-6);
    expect(Math.max(...r.spectrum)).toBeLessThanOrEqual(0.2 + 1e-6);
  });

  it('clamps normalized spectrum and levels to <= 1', () => {
    const agc = createAGC({ tau: 2.5, floor: 0.3 });
    const r = agc.process(new Float32Array([2.0]), lv(2, 0, 0), 1 / 60);
    expect(r.spectrum[0]).toBeLessThanOrEqual(1);
    expect(r.levels.bass).toBeLessThanOrEqual(1);
  });
});
