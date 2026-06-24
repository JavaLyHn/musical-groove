import { describe, it, expect } from 'vitest';
import { dominantColor } from '../src/util/coverColor.js';

/** Build a flat RGBA buffer of `n` identical opaque pixels. */
function fill(rgb, n) {
  const a = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) { a[i * 4] = rgb[0]; a[i * 4 + 1] = rgb[1]; a[i * 4 + 2] = rgb[2]; a[i * 4 + 3] = 255; }
  return a;
}

describe('dominantColor', () => {
  it('returns a normalized hue for a saturated cover (brightest channel ~1)', () => {
    const c = dominantColor(fill([200, 30, 30], 64));
    expect(c).not.toBeNull();
    expect(Math.max(c[0], c[1], c[2])).toBeCloseTo(1, 5);
    expect(c[0]).toBeGreaterThan(c[1]); // red dominant
    expect(c[0]).toBeGreaterThan(c[2]);
  });

  it('returns null for grey artwork (no usable hue -> no tint)', () => {
    expect(dominantColor(fill([128, 128, 128], 64))).toBeNull();
  });

  it('returns null when fully transparent', () => {
    expect(dominantColor(new Uint8ClampedArray(64 * 4))).toBeNull();
  });

  it('ignores near-black/near-white and locks onto a saturated accent', () => {
    const a = new Uint8ClampedArray(100 * 4);
    for (let i = 0; i < 100; i++) {
      const v = i < 10 ? [20, 120, 220] : (i % 2 ? [5, 5, 5] : [250, 250, 250]); // blue accent amid black/white
      a[i * 4] = v[0]; a[i * 4 + 1] = v[1]; a[i * 4 + 2] = v[2]; a[i * 4 + 3] = 255;
    }
    const c = dominantColor(a);
    expect(c).not.toBeNull();
    expect(c[2]).toBeGreaterThan(c[0]); // blue dominant
  });
});
