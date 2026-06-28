// @ts-check
import { describe, it, expect } from 'vitest';
import { markClean, isDirty, revertToBaseline } from '../src/presets.js';
import { CONFIG } from '../src/config.js';

const mkRefs = () => ({
  rig: { state: { pitchDeg: 0, distance: 0, fov: 0, orbitSpeed: 0 } },
  renderer: { toneMappingExposure: 0 },
});

describe('presets dirty tracking (markClean / isDirty)', () => {
  it('treats an unset baseline as clean', () => {
    expect(isDirty(mkRefs())).toBe(false); // _baseline === null at fresh import
  });

  it('clean after markClean, dirty after a change, clean after re-mark', () => {
    const refs = mkRefs();
    markClean(refs);
    expect(isDirty(refs)).toBe(false);

    const orig = CONFIG.field.coreHeat;
    CONFIG.field.coreHeat = orig + 1;
    try {
      expect(isDirty(refs)).toBe(true);
      markClean(refs);
      expect(isDirty(refs)).toBe(false);
    } finally {
      CONFIG.field.coreHeat = orig; // restore the live CONFIG field we touched
    }
  });

  it('revertToBaseline rolls an unsaved change back to the clean value', () => {
    const refs = mkRefs();
    const orig = CONFIG.field.coreHeat;
    try {
      markClean(refs);                 // baseline captures orig
      CONFIG.field.coreHeat = orig + 5; // unsaved edit
      expect(isDirty(refs)).toBe(true);
      revertToBaseline(refs);           // discard
      expect(CONFIG.field.coreHeat).toBe(orig);
      expect(isDirty(refs)).toBe(false);
    } finally {
      CONFIG.field.coreHeat = orig;
    }
  });
});
