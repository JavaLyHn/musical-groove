# 声音星球 · Music Reactor Wallpaper

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
The current build uses a **simulated** audio source (`src/audioSource.js`). It is
read only through `getSpectrum()` / `getLevels()` / `update(dt)`. To drive it from
real system audio later, implement that same interface with a Web Audio
`AnalyserNode` — no visual code changes required.

## Wallpaper (macOS) — later
Point a "webpage as wallpaper" tool (e.g. Plash) at the dev server URL or a built/
served `dist/`. System-audio capture (e.g. BlackHole) is a future step.
