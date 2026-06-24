import { describe, it, expect } from 'vitest';
import { createSimulatedAudioSource } from '../src/audioSource.js';
import { CONFIG } from '../src/config.js';

describe('createSimulatedAudioSource', () => {
  it('returns an audioBins-length spectrum with values in [0,1]', () => {
    const a = createSimulatedAudioSource();
    a.update(0.1);
    const s = a.getSpectrum();
    expect(s.length).toBe(CONFIG.audioBins);
    for (const v of s) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
  it('returns levels in [0,1]', () => {
    const a = createSimulatedAudioSource();
    a.update(0.25);
    const { bass, mid, treble } = a.getLevels();
    for (const v of [bass, mid, treble]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
  it('evolves over time (spectrum changes after update)', () => {
    const a = createSimulatedAudioSource();
    a.update(0.1);
    const first = Array.from(a.getSpectrum());
    a.update(0.4);
    const second = Array.from(a.getSpectrum());
    expect(second).not.toEqual(first);
  });
  it('is deterministic for the same elapsed time', () => {
    const a = createSimulatedAudioSource();
    const b = createSimulatedAudioSource();
    a.update(0.3); b.update(0.3);
    expect(Array.from(a.getSpectrum())).toEqual(Array.from(b.getSpectrum()));
  });
});
