import { describe, it, expect } from 'vitest';
import { createTrigger } from '../src/util/trigger.js';

describe('createTrigger', () => {
  it('fires when energy >= sensitivity, returning the strength', () => {
    const t = createTrigger({ sensitivity: 0.1, cooldown: 0 });
    expect(t.fire(0.05)).toBe(0);
    expect(t.fire(0.2)).toBe(0.2);
  });

  it('cooldown 0 fires on every frame above threshold (overlap/interference)', () => {
    const t = createTrigger({ sensitivity: 0.1, cooldown: 0 });
    expect(t.fire(0.3)).toBe(0.3);
    expect(t.fire(0.3)).toBe(0.3);
    expect(t.fire(0.3)).toBe(0.3);
  });

  it('cooldown N blocks for N frames between fires', () => {
    const t = createTrigger({ sensitivity: 0.1, cooldown: 3 });
    expect(t.fire(0.5)).toBe(0.5); // frame 1: fire, cd=3
    expect(t.fire(0.5)).toBe(0);   // frame 2: cd 3->2
    expect(t.fire(0.5)).toBe(0);   // frame 3: cd 2->1
    expect(t.fire(0.5)).toBe(0.5); // frame 4: cd 1->0 -> fire
  });

  it('reads its knobs live from the config object (so a GUI can tweak them)', () => {
    const cfg = { sensitivity: 0.5, cooldown: 0 };
    const t = createTrigger(cfg);
    expect(t.fire(0.3)).toBe(0);
    cfg.sensitivity = 0.2;
    expect(t.fire(0.3)).toBe(0.3);
  });
});
