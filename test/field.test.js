import { describe, it, expect } from 'vitest';
import { buildPillarLayout, ringBandIndex, pillarTargetHeight } from '../src/util/field.js';
import { CONFIG } from '../src/config.js';

describe('buildPillarLayout', () => {
  const layout = buildPillarLayout(40, 1.0, 60, 0.62);
  it('produces grid*grid pillars (Fibonacci distribution)', () => {
    expect(layout.length).toBe(40 * 40);
  });
  it('has its innermost pillar near the apex pointing straight up', () => {
    const center = layout.reduce((a, b) => (b.ringT < a.ringT ? b : a));
    expect(center.ringT).toBeLessThan(0.05);
    expect(center.ny).toBeGreaterThan(0.99);
  });
  it('dips edges below center and tilts their normals outward', () => {
    const edge = layout.reduce((a, b) => (b.r > a.r ? b : a));
    expect(edge.y).toBeLessThan(0);
    expect(edge.ny).toBeLessThan(1.0);
    expect(edge.ringT).toBeCloseTo(1.0, 1);
  });
});

describe('ringBandIndex', () => {
  it('maps ringT to a band in range', () => {
    expect(ringBandIndex(0, 64)).toBe(0);
    expect(ringBandIndex(1, 64)).toBe(63);
    expect(ringBandIndex(0.5, 64)).toBeGreaterThanOrEqual(31);
    expect(ringBandIndex(0.5, 64)).toBeLessThanOrEqual(32);
  });
});

describe('pillarTargetHeight', () => {
  const spectrum = new Float32Array(64).fill(0.5);
  const levels = { bass: 0.5, mid: 0.5, treble: 0.5 };
  it('is taller at the center than at the edge for equal spectrum', () => {
    const hCenter = pillarTargetHeight(0.0, 0, spectrum, levels, 0, CONFIG.field);
    const hEdge = pillarTargetHeight(1.0, 40, spectrum, levels, 0, CONFIG.field);
    expect(hCenter).toBeGreaterThan(hEdge);
  });
  it('never drops below baseHeight', () => {
    const silent = new Float32Array(64);
    const h = pillarTargetHeight(1.0, 40, silent, { bass: 0, mid: 0, treble: 0 }, 0, CONFIG.field);
    expect(h).toBeGreaterThanOrEqual(CONFIG.field.baseHeight);
  });
});
