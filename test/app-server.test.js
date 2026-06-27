import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAppServer } from '../electron/server.js';

let srv; let dir;
// Inject a FAKE bridge so the test never spawns perl / hits the network.
const fakeBridge = {
  handle(req, res) {
    if ((req.url || '').startsWith('/__ping')) {
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"fake":true}'); return true;
    }
    return false;
  },
  close() {},
};
beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'sp-dist-'));
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>sp</title>hello');
  writeFileSync(join(dir, 'app.js'), 'console.log(1)');
  srv = await createAppServer({ distDir: dir, bridge: fakeBridge });
});
afterAll(async () => { await srv.close(); });

describe('createAppServer', () => {
  it('serves index.html at /', async () => {
    const r = await fetch(srv.url + '/');
    expect(r.status).toBe(200);
    expect(await r.text()).toContain('hello');
  });
  it('serves a static asset with a js content-type', async () => {
    const r = await fetch(srv.url + '/app.js');
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toContain('javascript');
  });
  it('falls back to index.html for unknown paths', async () => {
    const r = await fetch(srv.url + '/does-not-exist');
    expect(r.status).toBe(200);
    expect(await r.text()).toContain('hello');
  });
  it('delegates bridge routes to the injected handler', async () => {
    const r = await fetch(srv.url + '/__ping');
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ fake: true });
  });
  it('does not serve files outside distDir (path traversal contained)', async () => {
    const r = await fetch(srv.url + '/../../../../etc/passwd');
    expect(r.status).toBe(200);                 // contained -> index fallback, not the real file
    expect(await r.text()).toContain('hello');
  });
});
