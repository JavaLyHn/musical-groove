// @ts-check
import { describe, it, expect } from 'vitest';
import { allControls } from '../src/console/schema.js';
import { snapshot } from '../src/presets.js';

// The schema-keys==presets-keys test proves the SET of controls matches, but not that each
// control's get/set targets the right field. presets.js `targets()` is the canonical
// [key -> (object, property)] map — the same fields the old working panel drove and the render
// loop reads each frame. So: if a control's set(refs, X) makes presets.snapshot()[key] === X,
// the console control writes exactly the field the engine reads. This guards label<->effect.
describe('console controls write the exact field presets reads (label ↔ effect)', () => {
  const mkRefs = () => ({
    rig: { state: { pitchDeg: 0, distance: 0, fov: 0, orbitSpeed: 0 } },
    renderer: { toneMappingExposure: 0 },
  });

  for (const c of allControls()) {
    it(`${c.key}  →  「${c.label}」`, () => {
      const refs = mkRefs();
      const cur = c.get(refs);
      const sentinel =
        typeof cur === 'boolean' ? !cur
          : typeof cur === 'string' ? '#abcdef'
            : Number(cur) + 7.25;
      c.set(refs, sentinel);
      // presets.snapshot() reads via targets(); seeing our sentinel under c.key proves
      // schema.set and presets.targets point at the SAME object.property.
      expect(snapshot(refs)[c.key]).toBe(sentinel);
      // and the control's own get() reflects the same write
      expect(c.get(refs)).toBe(sentinel);
      c.set(refs, cur); // restore the live CONFIG field we touched
    });
  }
});
