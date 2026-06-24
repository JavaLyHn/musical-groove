import { describe, it, expect } from 'vitest';
import { normalizeTrack } from '../tools/nowplaying-bridge.mjs';

describe('normalizeTrack', () => {
  it('returns null for an empty payload / no track', () => {
    expect(normalizeTrack({})).toBeNull();
    expect(normalizeTrack(null)).toBeNull();
    expect(normalizeTrack({ artist: 'no title' })).toBeNull();
  });

  it('shapes a track and builds an artwork data URI', () => {
    const t = normalizeTrack({
      title: 'TRUST IN ME', artist: 'B.A.R.E', album: 'X',
      playing: true, duration: 213.7, bundleIdentifier: 'com.soda.music',
      artworkData: 'AAAA', artworkMimeType: 'image/jpeg',
    });
    expect(t).toMatchObject({
      title: 'TRUST IN ME', artist: 'B.A.R.E', playing: true,
      duration: 213.7, bundleId: 'com.soda.music',
    });
    expect(t.artwork).toBe('data:image/jpeg;base64,AAAA');
  });

  it('leaves artwork null when the bytes are absent', () => {
    const t = normalizeTrack({ title: 'X', artworkMimeType: 'image/jpeg' });
    expect(t.artwork).toBeNull();
  });
});
