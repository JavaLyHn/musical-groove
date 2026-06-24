import { describe, it, expect } from 'vitest';
import { CONFIG } from '../src/config.js';

describe('CONFIG', () => {
  it('has 64 bands and a 40x40 grid by default', () => {
    expect(CONFIG.bands).toBe(64);
    expect(CONFIG.grid).toBe(40);
  });
  it('caps pixel ratio to a sane wallpaper value', () => {
    expect(CONFIG.maxPixelRatio).toBeGreaterThan(0);
    expect(CONFIG.maxPixelRatio).toBeLessThanOrEqual(2);
  });
  it('defines the full palette as hex strings', () => {
    for (const k of ['bg0', 'bg1', 'core', 'accent']) {
      expect(CONFIG.colors[k]).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
    expect(Array.isArray(CONFIG.colors.ramp)).toBe(true);
    for (const c of CONFIG.colors.ramp) {
      expect(c).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
  it('defines spring stiffness and damping for the field', () => {
    expect(CONFIG.field.stiffness).toBeGreaterThan(0);
    expect(CONFIG.field.damping).toBeGreaterThan(0);
  });
});
