import { describe, it, expect } from 'vitest';
import { clamp, lerp, smoothstep, springStep, colorRamp, radialEnergy } from '../src/util/math.js';

describe('clamp/lerp/smoothstep', () => {
  it('clamps to range', () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });
  it('lerps linearly', () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
  });
  it('smoothstep is 0 below e0 and 1 above e1', () => {
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 2)).toBe(1);
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5, 5);
  });
});

describe('springStep', () => {
  it('converges toward the target over many steps', () => {
    let s = { value: 0, vel: 0 };
    for (let i = 0; i < 600; i++) s = springStep(s.value, s.vel, 10, 90, 14, 1 / 60);
    expect(s.value).toBeCloseTo(10, 1);
    expect(Math.abs(s.vel)).toBeLessThan(0.5);
  });
  it('moves toward the target on the first step', () => {
    const s = springStep(0, 0, 10, 90, 14, 1 / 60);
    expect(s.value).toBeGreaterThan(0);
  });
});

describe('colorRamp', () => {
  it('returns the low color at 0 and high color at 1', () => {
    const lo = colorRamp(0);
    const hi = colorRamp(1);
    expect(lo.getHexString()).toBe('2a3a8c');
    expect(hi.getHexString()).toBe('d8d0ff');
  });
  it('returns a color between mid stops at 0.5', () => {
    const mid = colorRamp(0.5);
    expect(mid.getHexString()).toBe('6a4fd0');
  });
});

describe('radialEnergy', () => {
  it('peaks at r=0 and decays outward', () => {
    expect(radialEnergy(0, 6, 11)).toBeCloseTo(6, 5);
    expect(radialEnergy(11, 6, 11)).toBeLessThan(6);
    expect(radialEnergy(40, 6, 11)).toBeLessThan(0.2);
  });
});
