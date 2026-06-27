// Localhost HTTP server for the packaged app: serves the built dist/ AND the
// now-playing bridge routes, so the renderer's same-origin fetch('/__*') keeps working.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, normalize, extname } from 'node:path';
import { createNowPlayingHandler } from '../tools/nowplaying-bridge.mjs';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
};

/** @param {{ distDir: string, log?: (m:string)=>void, bridge?: { handle:(req,res)=>boolean, close:()=>void } }} opts */
export async function createAppServer({ distDir, log = () => {}, bridge } = {}) {
  const handler = bridge || createNowPlayingHandler({ log }); // real handler unless a fake is injected (tests)

  async function serveStatic(req, res) {
    const u = new URL(req.url || '/', 'http://localhost');
    let rel = decodeURIComponent(u.pathname);
    if (rel === '/' || rel === '') rel = '/index.html';
    // contain to distDir (no path traversal)
    const full = normalize(join(distDir, rel));
    const tryFiles = full.startsWith(distDir) ? [full] : [];
    tryFiles.push(join(distDir, 'index.html')); // SPA / unknown-path fallback
    for (const f of tryFiles) {
      try {
        const s = await stat(f);
        if (!s.isFile()) continue;
        const body = await readFile(f);
        res.writeHead(200, { 'Content-Type': MIME[extname(f).toLowerCase()] || 'application/octet-stream' });
        res.end(body);
        return;
      } catch { /* try next */ }
    }
    res.writeHead(404); res.end('not found');
  }

  const server = http.createServer((req, res) => {
    if (handler.handle(req, res)) return; // /__* consumed
    serveStatic(req, res).catch(() => { res.writeHead(500); res.end('error'); });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = /** @type {import('node:net').AddressInfo} */ (server.address());
  const port = addr.port;
  const url = `http://127.0.0.1:${port}`;
  log(`app server on ${url} (dist: ${distDir})`);

  return {
    url, port,
    close: () => new Promise((resolve) => { handler.close(); server.close(() => resolve()); }),
  };
}
