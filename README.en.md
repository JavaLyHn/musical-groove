# Musical Groove · 声音星球

[中文](README.md) · **English**

![Musical Groove](assets/preview.jpg)

A fullscreen macOS music visualizer. Whatever your system is playing, a curved dome of
audio‑reactive "block" pillars rises and falls to the sound, around a glowing reactor core,
with a live now‑playing card and synced lyrics at the top. Built with Three.js (WebGL) + Electron.

---

## Download

Latest → **[Releases](https://github.com/JavaLyHn/musical-groove/releases/latest)** (macOS · Apple Silicon / arm64)

**First launch** (the app is unsigned, so macOS will block it once — this is expected):
1. Open the dmg and drag **Musical Groove** into Applications.
2. System Settings → Privacy & Security → find Musical Groove → click **Open Anyway** (older macOS: right‑click the app → **Open**).
3. Allow the **Screen Recording** permission on first run (used only to read system audio for the reaction — nothing is recorded or uploaded) → **⌘Q to quit and reopen** once for it to take effect.

## Use

- Opens fullscreen; reacts as soon as music plays.
- Now‑playing card (top): click to expand for the big cover, scrub the progress bar, prev · play/pause · next.
- Quit: **⌘Q** (or the menu‑bar tray ♪ → Quit).
- Switch to other apps: **⌘‑Tab** (they overlay the animation; switch back for fullscreen again).
- Tweak parameters: click the **LyHN** signature (top‑left) to open the console; closing without saving reverts your edits.

## Develop

```bash
npm install
npm run dev        # browser preview at http://127.0.0.1:5870  (?demo drives it with synthetic audio)
npm test           # unit tests (Vitest)
npm run typecheck  # tsc --noEmit (plain JS + // @ts-check)
```

## Build the macOS app

```bash
npm run dist:mac   # native module + Vite bundle + electron-builder → release/*.dmg
```

Output: `release/Musical Groove-<version>-arm64.dmg` (unsigned / ad‑hoc).

Publish a new release (after `gh auth login`):

```bash
gh release create v<version> "release/Musical Groove-<version>-arm64.dmg" \
  --target main --title "Musical Groove <version>" --notes-file <notes.md>
```

## Audio

- **Packaged (Electron):** captures system output via macOS **ScreenCaptureKit** loopback — needs Screen Recording permission, **no BlackHole required**.
- **Browser (dev):** `?demo` uses a synthetic spectrum; real audio runs through a Web Audio `AnalyserNode` (works with a loopback device like BlackHole to grab system sound).

Both sources implement the same interface (`getSpectrum() → Float32Array(64)` / `update(dt)`), so switching doesn't change the visuals.

## Quality

`CONFIG.quality` in `src/config.js` = `'low' | 'mid' | 'high'`, or override at runtime with `?q=high`.

## Stack

Three.js (WebGL; custom GLSL injected into `MeshStandardMaterial` — pillar height and color are computed per frequency band in the vertex/fragment shaders) · Electron · Vite · Vitest.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

---

© 2026 **LyHN** · Musical Groove — All rights reserved. See [LICENSE](LICENSE).
