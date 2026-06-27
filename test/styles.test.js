// @ts-check
import { describe, it, expect } from 'vitest';
import { STYLES, styleSnapshot } from '../src/styles.js';
import { presetKeys } from '../src/presets.js';

describe('default styles', () => {
  const validKeys = new Set(presetKeys());

  it('has 4 styles, each with id/name/overrides and a unique id', () => {
    expect(STYLES.length).toBe(4);
    const ids = [];
    for (const s of STYLES) {
      expect(typeof s.id).toBe('string');
      expect(s.id.length).toBeGreaterThan(0);
      expect(s.name.length).toBeGreaterThan(0);
      expect(s.overrides && typeof s.overrides === 'object').toBe(true);
      ids.push(s.id);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every override key is a valid preset stableKey', () => {
    for (const s of STYLES) {
      for (const k of Object.keys(s.overrides)) {
        expect(validKeys.has(k), `${s.id}: bad key ${k}`).toBe(true);
      }
    }
  });

  it('styleSnapshot returns a full snapshot — exactly the preset keys', () => {
    const want = presetKeys().slice().sort();
    for (const s of STYLES) {
      expect(Object.keys(styleSnapshot(s)).sort()).toEqual(want);
    }
  });

  it('the default snapshot has no undefined values (every control has a def)', () => {
    const snap = styleSnapshot({ id: '_', name: '_', overrides: {} });
    for (const [k, v] of Object.entries(snap)) {
      expect(v, `default for ${k} is undefined`).not.toBe(undefined);
    }
  });
});
