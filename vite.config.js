import { defineConfig } from 'vite';
import { nowPlayingVitePlugin } from './tools/nowplaying-bridge.mjs';

export default defineConfig({
  base: './',
  // Distinctive dev port (NOT the default 5173, which collides with other Vite projects).
  // strictPort:false → if 5870 is somehow taken, Vite auto-jumps to the next free port, so this
  // dev server never blocks or squats on another project's port. (The packaged Electron app uses
  // its own server on an OS-assigned free port — see electron/server.js — so it never conflicts.)
  server: { port: 5870, host: '127.0.0.1', strictPort: false },
  build: { outDir: 'dist', assetsInlineLimit: 0 },
  // Reads macOS "Now Playing" and serves it at /__nowplaying (dev only).
  plugins: [nowPlayingVitePlugin()],
});
