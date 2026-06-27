import { describe, it, expect } from 'vitest';
import { isBridgeRoute, createNowPlayingHandler } from '../tools/nowplaying-bridge.mjs';

describe('isBridgeRoute', () => {
  it('matches the four bridge routes', () => {
    for (const p of ['/__nowplaying', '/__lyrics', '/__seek', '/__cmd']) {
      expect(isBridgeRoute(p)).toBe(true);
    }
  });
  it('rejects everything else', () => {
    for (const p of ['/', '/index.html', '/assets/x.js', '/__other']) {
      expect(isBridgeRoute(p)).toBe(false);
    }
  });
});

describe('createNowPlayingHandler', () => {
  // autoStart:false -> the bridge never spawns perl, and we only assert the
  // side-effect-FREE contract (false for non-bridge). We deliberately do NOT
  // exercise /__cmd or /__seek here: on a real Mac they would toggle playback
  // / seek the player. Delegation of bridge routes is covered in Task 2 via an
  // injected fake bridge.
  it('does not consume non-bridge requests (returns false, writes nothing)', () => {
    const h = createNowPlayingHandler({ autoStart: false });
    let touched = false;
    const res = { writeHead() { touched = true; }, setHeader() { touched = true; }, write() { touched = true; }, end() { touched = true; } };
    const handled = h.handle({ url: '/index.html', on() {} }, res);
    expect(handled).toBe(false);
    expect(touched).toBe(false);
    h.close();
  });
});
