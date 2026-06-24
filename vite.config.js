import { defineConfig } from 'vite';
import { nowPlayingVitePlugin } from './tools/nowplaying-bridge.mjs';

export default defineConfig({
  base: './',
  server: { port: 5173, host: '127.0.0.1' },
  build: { outDir: 'dist', assetsInlineLimit: 0 },
  // Reads macOS "Now Playing" and serves it at /__nowplaying (dev only).
  plugins: [nowPlayingVitePlugin()],
});
