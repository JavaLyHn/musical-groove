// @ts-check
import { describe, it, expect } from 'vitest';
import { clampStep, valueToFrac, fracToValue, makeFmt, wheelStep } from '../src/console/widgets.js';

describe('widget math helpers', () => {
  it('clampStep clamps to range', () => {
    expect(clampStep(-5, 0, 10)).toBe(0);
    expect(clampStep(15, 0, 10)).toBe(10);
    expect(clampStep(4, 0, 10)).toBe(4);
  });
  it('clampStep snaps to step and stays in range', () => {
    expect(clampStep(2.6, 0, 10, 1)).toBe(3);
    expect(clampStep(7, 0, 10, 5)).toBe(5);
    expect(clampStep(9.9, 0, 10, 5)).toBe(10);
  });
  it('valueToFrac / fracToValue are inverse', () => {
    expect(valueToFrac(5, 0, 10)).toBeCloseTo(0.5);
    expect(fracToValue(0.5, 0, 10)).toBeCloseTo(5);
    expect(valueToFrac(0, 0, 0)).toBe(0); // degenerate range
    expect(fracToValue(2, 0, 10)).toBe(10); // frac clamped
    expect(fracToValue(-1, 0, 10)).toBe(0);
  });
  it('makeFmt picks precision by max/step', () => {
    expect(makeFmt(2)(0.8)).toBe('0.80');     // <=2 -> 2 decimals
    expect(makeFmt(12)(4)).toBe('4.0');        // <=12 -> 1 decimal
    expect(makeFmt(40)(23.4)).toBe('23');      // big -> integer
    expect(makeFmt(70, 1)(36.2)).toBe('36');   // step -> snapped integer string
    expect(makeFmt(600, 10)(205)).toBe('210'); // step 10 snap
  });
  it('wheelStep is coarser with Shift', () => {
    expect(wheelStep(0, 60, false)).toBeCloseTo(1);   // (60-0)/60
    expect(wheelStep(0, 60, true)).toBeCloseTo(3);    // (60-0)/20
  });
});
