// @ts-check
import { describe, it, expect } from 'vitest';
import { allControls, SECTIONS } from '../src/console/schema.js';
import { presetKeys } from '../src/presets.js';

describe('console schema ↔ presets targets', () => {
  it('exposes exactly the preset stableKeys (no drift)', () => {
    const schemaKeys = allControls().map((c) => c.key).sort();
    const pKeys = presetKeys().slice().sort();
    expect(schemaKeys).toEqual(pKeys);
  });

  it('has 46 controls grouped under PERFORMANCE + SETUP', () => {
    expect(allControls().length).toBe(46);
    expect(SECTIONS.map((s) => s.id)).toEqual(['performance', 'setup']);
  });

  it('each control has a unique key, a label, a valid kind, and get/set fns', () => {
    const seen = new Set();
    for (const c of allControls()) {
      expect(typeof c.key).toBe('string');
      expect(seen.has(c.key)).toBe(false);
      seen.add(c.key);
      expect(c.label.length).toBeGreaterThan(0);
      expect(['dial', 'slider', 'toggle', 'color']).toContain(c.kind);
      expect(typeof c.get).toBe('function');
      expect(typeof c.set).toBe('function');
    }
  });

  it('numeric controls round-trip through set/get (and restore)', () => {
    const refs = {
      rig: { state: { pitchDeg: 0, distance: 0, fov: 0, orbitSpeed: 0 } },
      renderer: { toneMappingExposure: 0 },
    };
    for (const c of allControls()) {
      if (c.kind !== 'slider' && c.kind !== 'dial') continue;
      const orig = c.get(refs);
      const v = c.min ?? 0;
      c.set(refs, v);
      expect(c.get(refs)).toBe(v);
      c.set(refs, orig); // leave CONFIG as we found it
    }
  });
});
