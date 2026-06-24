import { describe, it, expect } from 'vitest';
import { createBeatDetector } from '../src/util/beatDetector.js';

describe('createBeatDetector', () => {
  it('does not fire on a steady spectrum', () => {
    const bd = createBeatDetector();
    const steady = new Float32Array(64).fill(0.5);
    let kicks = 0;
    for (let i = 0; i < 180; i++) if (bd.process(steady, 1 / 60).kick > 0) kicks++;
    expect(kicks).toBe(0);
  });

  it('fires on periodic bass onsets and respects the cooldown', () => {
    const bd = createBeatDetector();
    const lo = new Float32Array(64).fill(0.05);
    const hi = new Float32Array(64).fill(0.05);
    for (let i = 0; i < 4; i++) hi[i] = 0.9; // strong bass spike
    let kicks = 0;
    for (let f = 0; f < 300; f++) {
      const spec = f % 30 === 0 ? hi : lo; // a 1-frame spike every 0.5s
      if (bd.process(spec, 1 / 60).kick > 0) kicks++;
    }
    // ~10 spikes over 5s; expect several detected, far fewer than every frame
    expect(kicks).toBeGreaterThan(3);
    expect(kicks).toBeLessThan(30);
  });
});
