# Musical Groove · Music Reactor Wallpaper

A WebGL music visualizer (Three.js) for use as a macOS wallpaper. A curved dome
of segmented "block" pillars bounces to audio, with a glowing central reactor core.

## Develop
```bash
npm install
npm run dev      # http://127.0.0.1:5173
npm test         # unit tests (Vitest)
```

## Build
```bash
npm run build    # -> dist/
npm run preview  # serve the build locally
```

## Quality
Set `CONFIG.quality` in `src/config.js` to `'low' | 'mid' | 'high'`.

## Audio
Two interchangeable sources implement the same interface
(`getSpectrum() → Float32Array(64)` / `getLevels()` / `update(dt)`):
- `src/audioSource.js` — **simulated** spectrum (the default on load).
- `src/webAudioSource.js` — **real** audio via a Web Audio `AnalyserNode`.

Click **▶ 连接系统声音** (bottom of the page) to switch to real audio. To capture
the music actually playing on macOS (not the mic), set up a BlackHole loopback —
see **[docs/connect-audio.md](docs/connect-audio.md)**. The page auto-detects a
BlackHole/Loopback device when present.

## Wallpaper (macOS) — later
Point a "webpage as wallpaper" tool (e.g. Plash) at the dev server URL or a built/
served `dist/`.
