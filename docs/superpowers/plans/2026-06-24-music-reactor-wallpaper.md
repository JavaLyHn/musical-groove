# 声音星球 · 音乐反应式动态壁纸 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-screen, looping WebGL music-visualizer for use as a macOS wallpaper — a curved dome grid of segmented "block" pillars that bounce to (simulated) audio, with a glowing central reactor core.

**Architecture:** A Vite + Three.js single-page app. Pure logic (audio synthesis, dome layout, height mapping, spring physics, color ramp) lives in small, unit-tested modules under `src/util/` and `src/audioSource.js`. Three.js rendering is thin glue in `src/scene/*` modules, each exposing `build()`/`update(dt, ...)`. `src/main.js` wires them together in one `requestAnimationFrame` loop. Audio is read only through the `audioSource` interface so the simulated source can later be swapped for real system audio with zero changes to visuals.

**Tech Stack:** Node 22 · Vite · Three.js (r17x, via npm) · Vitest. ES modules only.

## Global Constraints

- Node ≥ 22, ES modules only (`"type": "module"`).
- Three.js imported from `three` and `three/addons/...` (npm), never from a CDN.
- Audio is consumed ONLY via the `audioSource` interface: `getSpectrum() → Float32Array(64)`, `getLevels() → {bass, mid, treble}`, `update(dt)`. No visual module may import a concrete audio implementation.
- Spectrum band count: **64**. Grid default: **40 × 40**. Renderer `pixelRatio` capped at **2**.
- Palette (exact hex): background `#070912`→`#0d1430`; pillar low `#2a3a8c`; pillar mid `#6a4fd0`; pillar high `#d8d0ff`; core `#eef0ff`.
- No HUD/UI chrome of any kind (no player, lyrics, logo, frequency labels).
- Target ~60fps interactive; runtime must throttle when the tab/window is hidden.
- All pillar count / particle count / bloom presets come from `CONFIG.quality`; never hard-code magic numbers in render modules — read from `CONFIG`.
- Commit after every task. Commit subject in present tense; end every commit message body with:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- Push to `origin/main` after each task's commit (remote `git@github.com:JavaLyHn/musical-groove.git` already configured).

---

## File Structure

```
music-design/
  index.html                 # Vite entry: full-bleed <canvas id="app">
  package.json
  vite.config.js
  vitest.config.js
  src/
    main.js                  # wiring + rAF loop + resize + visibility throttle + fps cap
    config.js                # CONFIG object (all tunables)
    audioSource.js           # createSimulatedAudioSource() — the audio interface impl
    util/
      math.js                # clamp, lerp, smoothstep, springStep, colorRamp, radialEnergy
      field.js               # buildPillarLayout, ringBandIndex, pillarTargetHeight
    scene/
      sceneSetup.js          # createScene, createCamera, createRenderer, makeGradientTexture
      pillarField.js         # createPillarField -> { mesh, update(spectrum, levels, dt) }
      core.js                # createCore -> { group, update(bass, dt) }
      starfield.js           # createStarfield -> { points, update(dt) }
      cameraRig.js           # createCameraRig -> { update(dt) }
      postfx.js              # createComposer -> { composer, setSize }
  test/
    config.test.js
    math.test.js
    field.test.js
    audioSource.test.js
```

---

### Task 1: Project scaffold (Vite + Three + Vitest)

**Files:**
- Create: `package.json`, `vite.config.js`, `vitest.config.js`, `index.html`, `src/main.js`, `test/smoke.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: a runnable dev server and a passing test runner. `src/main.js` default export: none (side-effect entry).

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "musical-groove",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "devDependencies": {
    "vite": "^5.4.0",
    "vitest": "^2.1.0"
  },
  "dependencies": {
    "three": "^0.169.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, `three`, `vite`, `vitest` present, exit 0.

- [ ] **Step 3: Create `vite.config.js`**

```js
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 5173, host: '127.0.0.1' },
  build: { outDir: 'dist', assetsInlineLimit: 0 },
});
```

- [ ] **Step 4: Create `vitest.config.js`**

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node', include: ['test/**/*.test.js'] },
});
```

- [ ] **Step 5: Create `index.html`**

```html
<!doctype html>
<html lang="zh">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>声音星球</title>
    <style>
      html, body { margin: 0; height: 100%; overflow: hidden; background: #05060d; }
      #app { display: block; width: 100vw; height: 100vh; }
    </style>
  </head>
  <body>
    <canvas id="app"></canvas>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

- [ ] **Step 6: Create minimal `src/main.js`**

```js
// Entry point. Tasks 6+ replace the body with the full scene wiring.
const canvas = document.getElementById('app');
const ctx = canvas.getContext('webgl2');
console.log('[声音星球] boot', ctx ? 'webgl2 ok' : 'no webgl2');
```

- [ ] **Step 7: Write smoke test `test/smoke.test.js`**

```js
import { describe, it, expect } from 'vitest';

describe('toolchain', () => {
  it('runs vitest', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 8: Run the test to verify the runner works**

Run: `npm test`
Expected: PASS, 1 test passed.

- [ ] **Step 9: Run the dev server and verify it boots**

Run: `npm run dev` (then open `http://127.0.0.1:5173` in Chrome; Ctrl-C to stop)
Expected: a black page; DevTools console prints `[声音星球] boot webgl2 ok`.

- [ ] **Step 10: Commit & push**

```bash
git add package.json package-lock.json vite.config.js vitest.config.js index.html src/main.js test/smoke.test.js
git commit -m "chore: scaffold Vite + Three + Vitest project"
git push
```

---

### Task 2: CONFIG module

**Files:**
- Create: `src/config.js`, `test/config.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `export const CONFIG` — a frozen-ish object. Keys used downstream: `CONFIG.bands` (number), `CONFIG.grid` (number), `CONFIG.spacing`, `CONFIG.curvature`, `CONFIG.colors` ({bg0,bg1,low,mid,high,core}), `CONFIG.field` ({centerPeak, falloff, baseHeight, reactive, idleAmp, idleSpeed, stiffness, damping, segPitch, gapRatio, pillarWidth}), `CONFIG.core` ({radius, intensity, pulse, ringSpeed}), `CONFIG.stars` ({count, radius}), `CONFIG.camera` ({fov, height, distance, orbitSpeed, bob}), `CONFIG.post` ({bloomStrength, bloomRadius, bloomThreshold, vignette}), `CONFIG.quality` (string), `CONFIG.fpsCap` (number), `CONFIG.maxPixelRatio` (number).

- [ ] **Step 1: Write the failing test `test/config.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { CONFIG } from '../src/config.js';

describe('CONFIG', () => {
  it('has 64 bands and a 40x40 grid by default', () => {
    expect(CONFIG.bands).toBe(64);
    expect(CONFIG.grid).toBe(40);
  });
  it('caps pixel ratio at 2', () => {
    expect(CONFIG.maxPixelRatio).toBe(2);
  });
  it('defines the full palette as hex strings', () => {
    for (const k of ['bg0', 'bg1', 'low', 'mid', 'high', 'core']) {
      expect(CONFIG.colors[k]).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
  it('defines spring stiffness and damping for the field', () => {
    expect(CONFIG.field.stiffness).toBeGreaterThan(0);
    expect(CONFIG.field.damping).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- config`
Expected: FAIL — cannot resolve `../src/config.js`.

- [ ] **Step 3: Create `src/config.js`**

```js
export const CONFIG = {
  bands: 64,
  grid: 40,
  spacing: 1.0,
  curvature: 0.022,          // paraboloid dip: y = -curvature * r^2

  colors: {
    bg0: '#070912',          // center of background gradient
    bg1: '#0d1430',          // outer / horizon
    low: '#2a3a8c',          // short / low-energy pillar
    mid: '#6a4fd0',          // mid
    high: '#d8d0ff',         // tall peak
    core: '#eef0ff',         // reactor core
  },

  field: {
    centerPeak: 6.0,         // radial base-height bump at center
    falloff: 11.0,           // gaussian falloff radius for centerPeak
    baseHeight: 0.6,         // minimum pillar height
    reactive: 9.0,           // how much spectrum drives height
    idleAmp: 0.9,            // idle breathing amplitude
    idleSpeed: 0.5,
    stiffness: 90.0,         // spring toward target height
    damping: 14.0,
    segPitch: 0.55,          // world height of one block segment
    gapRatio: 0.18,          // fraction of each segment that is a dark gap
    pillarWidth: 0.7,        // footprint (relative to spacing)
  },

  core: { radius: 1.6, intensity: 2.4, pulse: 3.0, ringSpeed: 6.0 },
  stars: { count: 1200, radius: 120 },
  camera: { fov: 38, height: 6.5, distance: 34, orbitSpeed: 0.03, bob: 1.2 },
  post: { bloomStrength: 0.9, bloomRadius: 0.6, bloomThreshold: 0.55, vignette: 1.1 },

  quality: 'high',           // 'low' | 'mid' | 'high' (Task 13 applies presets)
  fpsCap: 60,
  maxPixelRatio: 2,
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- config`
Expected: PASS, all 4 tests.

- [ ] **Step 5: Commit & push**

```bash
git add src/config.js test/config.test.js
git commit -m "feat: add CONFIG with all tunable parameters"
git push
```

---

### Task 3: Math utilities (TDD)

**Files:**
- Create: `src/util/math.js`, `test/math.test.js`

**Interfaces:**
- Consumes: `three` (for `THREE.Color`).
- Produces:
  - `clamp(x, a, b) → number`
  - `lerp(a, b, t) → number`
  - `smoothstep(e0, e1, x) → number`
  - `springStep(value, vel, target, stiffness, damping, dt) → { value, vel }`
  - `colorRamp(t) → THREE.Color` (t in [0,1]: low→mid→high)
  - `radialEnergy(r, peak, falloff) → number`

- [ ] **Step 1: Write the failing test `test/math.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { clamp, lerp, smoothstep, springStep, colorRamp, radialEnergy } from '../src/util/math.js';

describe('clamp/lerp/smoothstep', () => {
  it('clamps to range', () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });
  it('lerps linearly', () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
  });
  it('smoothstep is 0 below e0 and 1 above e1', () => {
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 2)).toBe(1);
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5, 5);
  });
});

describe('springStep', () => {
  it('converges toward the target over many steps', () => {
    let s = { value: 0, vel: 0 };
    for (let i = 0; i < 600; i++) s = springStep(s.value, s.vel, 10, 90, 14, 1 / 60);
    expect(s.value).toBeCloseTo(10, 1);
    expect(Math.abs(s.vel)).toBeLessThan(0.5);
  });
  it('moves toward the target on the first step', () => {
    const s = springStep(0, 0, 10, 90, 14, 1 / 60);
    expect(s.value).toBeGreaterThan(0);
  });
});

describe('colorRamp', () => {
  it('returns the low color at 0 and high color at 1', () => {
    const lo = colorRamp(0);
    const hi = colorRamp(1);
    expect(lo.getHexString()).toBe('2a3a8c');
    expect(hi.getHexString()).toBe('d8d0ff');
  });
  it('returns a color between mid stops at 0.5', () => {
    const mid = colorRamp(0.5);
    expect(mid.getHexString()).toBe('6a4fd0');
  });
});

describe('radialEnergy', () => {
  it('peaks at r=0 and decays outward', () => {
    expect(radialEnergy(0, 6, 11)).toBeCloseTo(6, 5);
    expect(radialEnergy(11, 6, 11)).toBeLessThan(6);
    expect(radialEnergy(40, 6, 11)).toBeLessThan(0.2);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- math`
Expected: FAIL — cannot resolve `../src/util/math.js`.

- [ ] **Step 3: Implement `src/util/math.js`**

```js
import * as THREE from 'three';
import { CONFIG } from '../config.js';

export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;

export function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

// Semi-implicit Euler spring. Returns next {value, vel}.
export function springStep(value, vel, target, stiffness, damping, dt) {
  const accel = stiffness * (target - value) - damping * vel;
  const nextVel = vel + accel * dt;
  const nextValue = value + nextVel * dt;
  return { value: nextValue, vel: nextVel };
}

const _c0 = new THREE.Color(CONFIG.colors.low);
const _c1 = new THREE.Color(CONFIG.colors.mid);
const _c2 = new THREE.Color(CONFIG.colors.high);

export function colorRamp(t) {
  t = clamp(t, 0, 1);
  const out = new THREE.Color();
  if (t < 0.5) out.copy(_c0).lerp(_c1, t / 0.5);
  else out.copy(_c1).lerp(_c2, (t - 0.5) / 0.5);
  return out;
}

export function radialEnergy(r, peak, falloff) {
  return peak * Math.exp(-(r * r) / (falloff * falloff));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- math`
Expected: PASS.

> Note: `colorRamp` uses Three's default (sRGB) `Color` parsing; `getHexString()` round-trips the input hex exactly, so the assertions hold.

- [ ] **Step 5: Commit & push**

```bash
git add src/util/math.js test/math.test.js
git commit -m "feat: add math utils (spring, color ramp, radial energy)"
git push
```

---

### Task 4: Field layout & height mapping (TDD)

**Files:**
- Create: `src/util/field.js`, `test/field.test.js`

**Interfaces:**
- Consumes: `radialEnergy` from `math.js`; `CONFIG`.
- Produces:
  - `buildPillarLayout(grid, spacing, curvature) → Array<{ x, y, z, nx, ny, nz, r, ringT }>` (length `grid*grid`; `n*` is unit surface normal; `ringT` = r / maxR in [0,1]).
  - `ringBandIndex(ringT, bands) → int` in `[0, bands-1]`.
  - `pillarTargetHeight(ringT, r, spectrum, levels, t, cfg) → number` (cfg = `CONFIG.field`).

- [ ] **Step 1: Write the failing test `test/field.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { buildPillarLayout, ringBandIndex, pillarTargetHeight } from '../src/util/field.js';
import { CONFIG } from '../src/config.js';

describe('buildPillarLayout', () => {
  const layout = buildPillarLayout(40, 1.0, 0.022);
  it('produces grid*grid pillars', () => {
    expect(layout.length).toBe(1600);
  });
  it('has a center pillar at the origin pointing straight up', () => {
    const center = layout.find((p) => Math.abs(p.x) < 1e-6 && Math.abs(p.z) < 1e-6)
      || layout.reduce((a, b) => (b.r < a.r ? b : a));
    expect(center.r).toBeLessThan(1.0);
    expect(center.ny).toBeGreaterThan(0.99);
  });
  it('dips edges below center and tilts their normals outward', () => {
    const edge = layout.reduce((a, b) => (b.r > a.r ? b : a));
    expect(edge.y).toBeLessThan(0);
    expect(edge.ny).toBeLessThan(1.0);
    expect(edge.ringT).toBeCloseTo(1.0, 1);
  });
});

describe('ringBandIndex', () => {
  it('maps ringT to a band in range', () => {
    expect(ringBandIndex(0, 64)).toBe(0);
    expect(ringBandIndex(1, 64)).toBe(63);
    expect(ringBandIndex(0.5, 64)).toBeGreaterThanOrEqual(31);
    expect(ringBandIndex(0.5, 64)).toBeLessThanOrEqual(32);
  });
});

describe('pillarTargetHeight', () => {
  const spectrum = new Float32Array(64).fill(0.5);
  const levels = { bass: 0.5, mid: 0.5, treble: 0.5 };
  it('is taller at the center than at the edge for equal spectrum', () => {
    const hCenter = pillarTargetHeight(0.0, 0, spectrum, levels, 0, CONFIG.field);
    const hEdge = pillarTargetHeight(1.0, 40, spectrum, levels, 0, CONFIG.field);
    expect(hCenter).toBeGreaterThan(hEdge);
  });
  it('never drops below baseHeight', () => {
    const silent = new Float32Array(64);
    const h = pillarTargetHeight(1.0, 40, silent, { bass: 0, mid: 0, treble: 0 }, 0, CONFIG.field);
    expect(h).toBeGreaterThanOrEqual(CONFIG.field.baseHeight);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- field`
Expected: FAIL — cannot resolve `../src/util/field.js`.

- [ ] **Step 3: Implement `src/util/field.js`**

```js
import { clamp, radialEnergy } from './math.js';

// Paraboloid dome: y = -curvature * r^2, with analytic normal (2k x, 1, 2k z).
export function buildPillarLayout(grid, spacing, curvature) {
  const c = (grid - 1) / 2;
  const maxR = Math.hypot(c * spacing, c * spacing) || 1;
  const out = [];
  for (let gx = 0; gx < grid; gx++) {
    for (let gz = 0; gz < grid; gz++) {
      const x = (gx - c) * spacing;
      const z = (gz - c) * spacing;
      const r = Math.hypot(x, z);
      const y = -curvature * r * r;
      // normal of y = -k(x^2+z^2): gradient (2k x, 1, 2k z)
      const nxRaw = 2 * curvature * x;
      const nzRaw = 2 * curvature * z;
      const len = Math.hypot(nxRaw, 1, nzRaw);
      out.push({
        x, y, z,
        nx: nxRaw / len, ny: 1 / len, nz: nzRaw / len,
        r, ringT: clamp(r / maxR, 0, 1),
      });
    }
  }
  return out;
}

export function ringBandIndex(ringT, bands) {
  return clamp(Math.round(ringT * (bands - 1)), 0, bands - 1);
}

// Idle breathing: deterministic layered sines (no RNG, test-friendly).
function idle(r, t, cfg) {
  return cfg.idleAmp * (0.5 + 0.5 * Math.sin(t * cfg.idleSpeed + r * 0.35));
}

export function pillarTargetHeight(ringT, r, spectrum, levels, t, cfg) {
  const band = ringBandIndex(ringT, spectrum.length);
  const base = cfg.baseHeight + radialEnergy(r, cfg.centerPeak, cfg.falloff);
  const reactive = spectrum[band] * cfg.reactive * (1 - 0.5 * ringT); // center reacts more
  return base + reactive + idle(r, t, cfg);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- field`
Expected: PASS.

- [ ] **Step 5: Commit & push**

```bash
git add src/util/field.js test/field.test.js
git commit -m "feat: add dome layout and pillar height mapping"
git push
```

---

### Task 5: Simulated audio source (TDD)

**Files:**
- Create: `src/audioSource.js`, `test/audioSource.test.js`

**Interfaces:**
- Consumes: `CONFIG.bands`.
- Produces: `createSimulatedAudioSource(bands = CONFIG.bands) → { getSpectrum(): Float32Array, getLevels(): {bass,mid,treble}, update(dt): void }`. `getSpectrum()` returns the SAME backing array each call (callers read, don't store). All values in [0,1].

- [ ] **Step 1: Write the failing test `test/audioSource.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { createSimulatedAudioSource } from '../src/audioSource.js';

describe('createSimulatedAudioSource', () => {
  it('returns a 64-length spectrum with values in [0,1]', () => {
    const a = createSimulatedAudioSource();
    a.update(0.1);
    const s = a.getSpectrum();
    expect(s.length).toBe(64);
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- audioSource`
Expected: FAIL — cannot resolve `../src/audioSource.js`.

- [ ] **Step 3: Implement `src/audioSource.js`**

```js
import { CONFIG } from './config.js';
import { clamp } from './util/math.js';

// Procedural stand-in for a real FFT. Synthesizes a believable spectrum with
// a steady beat. Swap this for a Web Audio AnalyserNode source later; the
// returned shape (getSpectrum/getLevels/update) is the stable contract.
export function createSimulatedAudioSource(bands = CONFIG.bands) {
  const spectrum = new Float32Array(bands);
  const bpm = 120;
  let t = 0;

  function recompute() {
    const beatPhase = (t * (bpm / 60)) % 1;          // 0..1 each beat
    const beat = Math.pow(1 - beatPhase, 4);          // sharp attack, decay
    for (let i = 0; i < bands; i++) {
      const f = i / (bands - 1);                      // 0 (bass) .. 1 (treble)
      const tilt = Math.exp(-f * 1.7);                // bass-heavy
      const wobble = 0.5 + 0.5 * Math.sin(t * (1.3 + f * 5.0) + i * 0.6);
      const bassHit = beat * (1 - f) * 0.8;           // beat lives in the lows
      spectrum[i] = clamp(tilt * (0.35 * wobble + 0.25) + bassHit, 0, 1);
    }
  }

  function band(lo, hi) {
    let sum = 0;
    for (let i = lo; i < hi; i++) sum += spectrum[i];
    return clamp(sum / (hi - lo), 0, 1);
  }

  recompute();
  return {
    update(dt) { t += dt; recompute(); },
    getSpectrum() { return spectrum; },
    getLevels() {
      const third = Math.floor(bands / 3);
      return { bass: band(0, third), mid: band(third, 2 * third), treble: band(2 * third, bands) };
    },
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- audioSource`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit & push**

```bash
git add src/audioSource.js test/audioSource.test.js
git commit -m "feat: add simulated audio source behind stable interface"
git push
```

---

### Task 6: Scene, camera, renderer + background (visual)

**Files:**
- Create: `src/scene/sceneSetup.js`
- Modify: `src/main.js` (replace boot stub with real setup + empty rAF loop)

**Interfaces:**
- Consumes: `CONFIG`.
- Produces:
  - `createRenderer(canvas) → THREE.WebGLRenderer` (pixelRatio capped, sized to window).
  - `createCamera() → THREE.PerspectiveCamera` (low angle, looking at origin).
  - `createScene() → THREE.Scene` (gradient background + fog + ambient/dir light).
  - `makeGradientTexture(inner, outer) → THREE.CanvasTexture` (radial).

- [ ] **Step 1: Implement `src/scene/sceneSetup.js`**

```js
import * as THREE from 'three';
import { CONFIG } from '../config.js';

export function makeGradientTexture(inner, outer) {
  const size = 512;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size * 0.42, 0, size / 2, size * 0.42, size * 0.75);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.maxPixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  return renderer;
}

export function createCamera() {
  const cam = new THREE.PerspectiveCamera(CONFIG.camera.fov, window.innerWidth / window.innerHeight, 0.1, 500);
  cam.position.set(0, CONFIG.camera.height, CONFIG.camera.distance);
  cam.lookAt(0, 1.5, 0);
  return cam;
}

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = makeGradientTexture(CONFIG.colors.bg1, CONFIG.colors.bg0);
  scene.fog = new THREE.Fog(new THREE.Color(CONFIG.colors.bg0).getHex(), 28, 90);
  scene.add(new THREE.AmbientLight(0x3a4170, 0.6));
  const key = new THREE.DirectionalLight(0xbfd0ff, 0.35);
  key.position.set(6, 12, 8);
  scene.add(key);
  return scene;
}
```

- [ ] **Step 2: Replace `src/main.js` with real wiring + empty loop**

```js
import * as THREE from 'three';
import { createRenderer, createCamera, createScene } from './scene/sceneSetup.js';

const canvas = document.getElementById('app');
const renderer = createRenderer(canvas);
const camera = createCamera();
const scene = createScene();

const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
```

- [ ] **Step 3: Visual verify**

Run: `npm run dev`, open `http://127.0.0.1:5173` in Chrome.
Expected: full-screen deep-space radial gradient (lighter blue toward upper-center, near-black at edges). No errors in console. Resizing the window keeps it full-bleed.

- [ ] **Step 4: Commit & push**

```bash
git add src/scene/sceneSetup.js src/main.js
git commit -m "feat: scene, camera, renderer and gradient background"
git push
```

---

### Task 7: Pillar field — dome grid with segmented look (visual)

**Files:**
- Create: `src/scene/pillarField.js`
- Modify: `src/main.js` (add field to scene; static heights for now)

**Interfaces:**
- Consumes: `buildPillarLayout`, `pillarTargetHeight` (`field.js`); `colorRamp` (`math.js`); `CONFIG`.
- Produces: `createPillarField() → { mesh: THREE.InstancedMesh, update(spectrum, levels, dt): void }`. This task wires `update` to set heights directly to the target (no spring yet) so the static shape is verifiable.

- [ ] **Step 1: Implement `src/scene/pillarField.js`**

```js
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { buildPillarLayout, pillarTargetHeight } from '../util/field.js';
import { colorRamp } from '../util/math.js';

const UP = new THREE.Vector3(0, 1, 0);

export function createPillarField() {
  const f = CONFIG.field;
  const layout = buildPillarLayout(CONFIG.grid, CONFIG.spacing, CONFIG.curvature);
  const n = layout.length;

  const geo = new THREE.BoxGeometry(f.pillarWidth, 1, f.pillarWidth); // unit-tall, base at y=-0.5..0.5
  geo.translate(0, 0.5, 0); // base sits on origin; scaling Y grows upward

  const mat = new THREE.MeshStandardMaterial({
    color: 0x0a0e22, roughness: 0.55, metalness: 0.0,
    emissive: 0xffffff, emissiveIntensity: 1.0, vertexColors: false,
  });

  // Per-instance height attribute + segmented-stripe shader injection.
  const aHeight = new THREE.InstancedBufferAttribute(new Float32Array(n), 1);
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSegPitch = { value: f.segPitch };
    shader.uniforms.uGapRatio = { value: f.gapRatio };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aHeight;\nvarying float vSegY;\nvarying float vYNorm;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvYNorm = position.y;\nvSegY = position.y * aHeight;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uSegPitch;\nuniform float uGapRatio;\nvarying float vSegY;\nvarying float vYNorm;')
      .replace('#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n' +
        'float _seg = smoothstep(uGapRatio, uGapRatio + 0.10, fract(vSegY / uSegPitch));\n' +
        'float _top = smoothstep(0.78, 1.0, vYNorm);\n' +
        'totalEmissiveRadiance *= vColor;\n' +
        'totalEmissiveRadiance *= mix(0.22, 1.0, _seg);\n' +
        'totalEmissiveRadiance += vColor * _top * 1.6;');
  };

  const mesh = new THREE.InstancedMesh(geo, mat, n);
  mesh.geometry.setAttribute('aHeight', aHeight);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;

  // enable per-instance color (sets vColor in the shader)
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);

  const heights = new Float32Array(n).fill(f.baseHeight);
  const vels = new Float32Array(n);
  const _m = new THREE.Matrix4();
  const _q = new THREE.Quaternion();
  const _p = new THREE.Vector3();
  const _s = new THREE.Vector3();
  const _nrm = new THREE.Vector3();
  const _col = new THREE.Color();

  function writeInstance(i, h) {
    const L = layout[i];
    _nrm.set(L.nx, L.ny, L.nz);
    _q.setFromUnitVectors(UP, _nrm);
    _p.set(L.x, L.y, L.z);
    _s.set(1, h, 1);
    _m.compose(_p, _q, _s);
    mesh.setMatrixAt(i, _m);
    aHeight.setX(i, h);
    const hNorm = Math.min(h / (f.centerPeak + f.reactive), 1);
    _col.copy(colorRamp(hNorm));
    mesh.instanceColor.setXYZ(i, _col.r, _col.g, _col.b);
  }

  // initial static draw
  for (let i = 0; i < n; i++) writeInstance(i, heights[i]);
  mesh.instanceMatrix.needsUpdate = true;
  aHeight.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;

  function update(spectrum, levels, dt) {
    for (let i = 0; i < n; i++) {
      const L = layout[i];
      const target = pillarTargetHeight(L.ringT, L.r, spectrum, levels, performance.now() / 1000, f);
      heights[i] = target; // Task 8 replaces this with a spring step
      writeInstance(i, heights[i]);
    }
    mesh.instanceMatrix.needsUpdate = true;
    aHeight.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
  }

  return { mesh, update, _heights: heights, _vels: vels, _writeInstance: writeInstance, _layout: layout };
}
```

- [ ] **Step 2: Wire into `src/main.js`**

Add after `const scene = createScene();`:

```js
import { createPillarField } from './scene/pillarField.js';
import { createSimulatedAudioSource } from './audioSource.js';

const audio = createSimulatedAudioSource();
const field = createPillarField();
scene.add(field.mesh);
```

Replace the `frame()` body's render section with:

```js
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  audio.update(dt);
  field.update(audio.getSpectrum(), audio.getLevels(), dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
```

- [ ] **Step 3: Visual verify**

Run: `npm run dev`, open in Chrome.
Expected: a curved dome of glowing pillars — tall and bright (lavender) at center, shorter and bluer toward the edges, edges dipping below the horizon. Each pillar shows horizontal segment bands (the "block" look). Pillars jitter (no smoothing yet — expected; Task 8 fixes the harsh motion).

- [ ] **Step 4: Commit & push**

```bash
git add src/scene/pillarField.js src/main.js
git commit -m "feat: instanced dome pillar field with segmented shader"
git push
```

---

### Task 8: Spring-damped reactive motion (visual + reuse unit tests)

**Files:**
- Modify: `src/scene/pillarField.js` (replace direct-set with spring step)

**Interfaces:**
- Consumes: `springStep` (`math.js`).
- Produces: same `createPillarField` shape; `update` now eases heights toward target via `springStep` using `CONFIG.field.stiffness/damping` and `dt`.

- [ ] **Step 1: Import the spring at the top of `pillarField.js`**

Change the math import to:

```js
import { colorRamp, springStep } from '../util/math.js';
```

- [ ] **Step 2: Replace the `update` function body**

```js
  function update(spectrum, levels, dt) {
    const t = performance.now() / 1000;
    for (let i = 0; i < n; i++) {
      const L = layout[i];
      const target = pillarTargetHeight(L.ringT, L.r, spectrum, levels, t, f);
      const step = springStep(heights[i], vels[i], target, f.stiffness, f.damping, dt);
      heights[i] = Math.max(f.baseHeight, step.value);
      vels[i] = step.vel;
      writeInstance(i, heights[i]);
    }
    mesh.instanceMatrix.needsUpdate = true;
    aHeight.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
  }
```

- [ ] **Step 3: Confirm unit tests still pass**

Run: `npm test`
Expected: PASS (config, math, field, audioSource, smoke). The spring physics is already covered by `test/math.test.js`.

- [ ] **Step 4: Visual verify**

Run: `npm run dev`, open in Chrome.
Expected: pillars now rise and fall smoothly with a slight overshoot/settle on each beat — no harsh snapping. The center pulses most; outer rings follow with a softer motion.

- [ ] **Step 5: Commit & push**

```bash
git add src/scene/pillarField.js
git commit -m "feat: spring-damped pillar motion"
git push
```

---

### Task 9: Reactor core + bass pulse (visual)

**Files:**
- Create: `src/scene/core.js`
- Modify: `src/main.js`

**Interfaces:**
- Consumes: `CONFIG.core`, `CONFIG.colors.core`.
- Produces: `createCore() → { group: THREE.Group, update(bass, dt): void }`. A bright emissive sphere + a point light + an expanding ring whose scale grows with bass and resets as it fades.

- [ ] **Step 1: Implement `src/scene/core.js`**

```js
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { clamp } from '../util/math.js';

export function createCore() {
  const c = CONFIG.core;
  const group = new THREE.Group();
  const coreColor = new THREE.Color(CONFIG.colors.core);

  const sphere = new THREE.Mesh(
    new THREE.IcosahedronGeometry(c.radius, 3),
    new THREE.MeshStandardMaterial({ color: 0x000000, emissive: coreColor, emissiveIntensity: c.intensity, roughness: 0.3 }),
  );
  sphere.position.y = 1.2;
  group.add(sphere);

  const light = new THREE.PointLight(coreColor.getHex(), 2.0, 40, 2);
  light.position.copy(sphere.position);
  group.add(light);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.0, 1.15, 64),
    new THREE.MeshBasicMaterial({ color: coreColor, transparent: true, opacity: 0.0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  group.add(ring);

  let ringPhase = 0;     // 0..1 expansion progress
  let pulse = 0;         // decaying brightness boost

  function update(bass, dt) {
    // pulse envelope follows bass with fast attack / slow decay
    pulse = Math.max(pulse * (1 - 4 * dt), bass);
    sphere.material.emissiveIntensity = c.intensity + pulse * c.pulse;
    light.intensity = 2.0 + pulse * 3.0;
    const s = 1 + pulse * 0.25;
    sphere.scale.setScalar(s);

    // ring keeps expanding; brighter when a strong bass kicks it
    ringPhase += dt * (0.4 + bass * c.ringSpeed * 0.1);
    if (ringPhase > 1) ringPhase -= 1;
    const scale = 1 + ringPhase * 16;
    ring.scale.set(scale, scale, 1);
    ring.material.opacity = clamp((1 - ringPhase) * 0.5 * (0.3 + bass), 0, 1);
  }

  return { group, update };
}
```

- [ ] **Step 2: Wire into `src/main.js`**

Add near the other scene additions:

```js
import { createCore } from './scene/core.js';
const core = createCore();
scene.add(core.group);
```

In `frame()`, after `field.update(...)`:

```js
  const levels = audio.getLevels();
  core.update(levels.bass, dt);
```

(Use the already-fetched `levels` for the field too, to avoid calling `getLevels()` twice — pass it into `field.update`.)

- [ ] **Step 3: Visual verify**

Run: `npm run dev`, open in Chrome.
Expected: a bright glowing orb at the center of the dome; it flares on each simulated beat, and faint light rings expand outward across the field and fade.

- [ ] **Step 4: Commit & push**

```bash
git add src/scene/core.js src/main.js
git commit -m "feat: reactor core with bass-driven pulse and rings"
git push
```

---

### Task 10: Starfield background (visual)

**Files:**
- Create: `src/scene/starfield.js`
- Modify: `src/main.js`

**Interfaces:**
- Consumes: `CONFIG.stars`.
- Produces: `createStarfield() → { points: THREE.Points, update(dt): void }`. Slowly rotating shell of additive points.

- [ ] **Step 1: Implement `src/scene/starfield.js`**

```js
import * as THREE from 'three';
import { CONFIG } from '../config.js';

export function createStarfield() {
  const { count, radius } = CONFIG.stars;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // random point on a shell (radius .. 1.4*radius), upper hemisphere bias
    const u = Math.random(), v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const rr = radius * (1 + 0.4 * Math.random());
    positions[i * 3] = rr * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = Math.abs(rr * Math.cos(phi)) * 0.8 + 10;
    positions[i * 3 + 2] = rr * Math.sin(phi) * Math.sin(theta);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0x9fb0ff, size: 0.5, sizeAttenuation: true,
    transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  function update(dt) { points.rotation.y += dt * 0.01; }
  return { points, update };
}
```

- [ ] **Step 2: Wire into `src/main.js`**

```js
import { createStarfield } from './scene/starfield.js';
const stars = createStarfield();
scene.add(stars.points);
```

In `frame()`: `stars.update(dt);`

- [ ] **Step 3: Visual verify**

Run: `npm run dev`, open in Chrome.
Expected: faint drifting starfield behind the dome, adding depth without distracting from the pillars.

- [ ] **Step 4: Commit & push**

```bash
git add src/scene/starfield.js src/main.js
git commit -m "feat: drifting starfield backdrop"
git push
```

---

### Task 11: Camera rig — slow orbit + bob (visual)

**Files:**
- Create: `src/scene/cameraRig.js`
- Modify: `src/main.js`

**Interfaces:**
- Consumes: `CONFIG.camera`; a `THREE.PerspectiveCamera`.
- Produces: `createCameraRig(camera) → { update(dt): void }`. Drives `camera.position` on a slow circular orbit at fixed height with a gentle vertical bob, always `lookAt(0, 1.5, 0)`. Loops seamlessly (pure functions of accumulated time → no drift over long runs).

- [ ] **Step 1: Implement `src/scene/cameraRig.js`**

```js
import { CONFIG } from '../config.js';

export function createCameraRig(camera) {
  const c = CONFIG.camera;
  let t = 0;
  function update(dt) {
    t += dt;
    const a = t * c.orbitSpeed;
    camera.position.x = Math.sin(a) * c.distance;
    camera.position.z = Math.cos(a) * c.distance;
    camera.position.y = c.height + Math.sin(t * 0.15) * c.bob;
    camera.lookAt(0, 1.5, 0);
  }
  return { update };
}
```

- [ ] **Step 2: Wire into `src/main.js`**

```js
import { createCameraRig } from './scene/cameraRig.js';
const rig = createCameraRig(camera);
```

In `frame()`, before `renderer.render(...)`: `rig.update(dt);`

- [ ] **Step 3: Visual verify**

Run: `npm run dev`, open in Chrome.
Expected: the camera very slowly orbits the dome and bobs up/down; horizon and parallax read as a 3D planet surface. Motion is smooth and never jumps.

- [ ] **Step 4: Commit & push**

```bash
git add src/scene/cameraRig.js src/main.js
git commit -m "feat: slow orbiting camera rig with vertical bob"
git push
```

---

### Task 12: Post-processing — bloom + vignette (visual)

**Files:**
- Create: `src/scene/postfx.js`
- Modify: `src/main.js` (render via composer; resize composer)

**Interfaces:**
- Consumes: `CONFIG.post`; `renderer, scene, camera`.
- Produces: `createComposer(renderer, scene, camera) → { composer: EffectComposer, setSize(w, h): void }`. RenderPass → UnrealBloomPass → vignette ShaderPass → output.

- [ ] **Step 1: Implement `src/scene/postfx.js`**

```js
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { CONFIG } from '../config.js';

const VignetteShader = {
  uniforms: { tDiffuse: { value: null }, uStrength: { value: CONFIG.post.vignette } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uStrength; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = vUv - 0.5;
      float v = smoothstep(0.85, 0.35, length(d) * uStrength);
      gl_FragColor = vec4(c.rgb * mix(0.55, 1.0, v), c.a);
    }`,
};

export function createComposer(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    CONFIG.post.bloomStrength, CONFIG.post.bloomRadius, CONFIG.post.bloomThreshold,
  );
  composer.addPass(bloom);
  const vignette = new ShaderPass(VignetteShader);
  composer.addPass(vignette);

  function setSize(w, h) {
    composer.setSize(w, h);
    bloom.setSize(w, h);
  }
  setSize(window.innerWidth, window.innerHeight);
  return { composer, setSize };
}
```

- [ ] **Step 2: Wire into `src/main.js`**

```js
import { createComposer } from './scene/postfx.js';
const { composer, setSize } = createComposer(renderer, scene, camera);
```

Replace `renderer.render(scene, camera);` with `composer.render();`.
In the resize handler, after `renderer.setSize(...)`: `setSize(window.innerWidth, window.innerHeight);`

- [ ] **Step 3: Visual verify**

Run: `npm run dev`, open in Chrome.
Expected: bright pillar tops and the core now bloom/glow softly; edges darken via vignette. The whole frame reads close to the reference image's mood.

- [ ] **Step 4: Commit & push**

```bash
git add src/scene/postfx.js src/main.js
git commit -m "feat: bloom and vignette post-processing"
git push
```

---

### Task 13: Performance & wallpaper polish

**Files:**
- Create: `src/quality.js`, `README.md`
- Modify: `src/main.js` (apply quality preset, fps cap, visibility throttle), `src/config.js` (no change required, but referenced)

**Interfaces:**
- Consumes: `CONFIG`.
- Produces: `applyQuality(CONFIG) → void` — mutates `CONFIG` in place based on `CONFIG.quality` ('low'|'mid'|'high'), adjusting `grid`, `stars.count`, `post.bloomStrength`, `maxPixelRatio`. `main.js` calls it BEFORE building the scene.

- [ ] **Step 1: Implement `src/quality.js`**

```js
const PRESETS = {
  low:  { grid: 26, stars: 500,  bloom: 0.6, pixelRatio: 1 },
  mid:  { grid: 34, stars: 900,  bloom: 0.8, pixelRatio: 1.5 },
  high: { grid: 40, stars: 1200, bloom: 0.9, pixelRatio: 2 },
};

export function applyQuality(CONFIG) {
  const p = PRESETS[CONFIG.quality] || PRESETS.high;
  CONFIG.grid = p.grid;
  CONFIG.stars.count = p.stars;
  CONFIG.post.bloomStrength = p.bloom;
  CONFIG.maxPixelRatio = p.pixelRatio;
}
```

- [ ] **Step 2: Apply quality + fps cap + visibility throttle in `src/main.js`**

At the very top, before importing scene modules that read CONFIG at call-time:

```js
import { CONFIG } from './config.js';
import { applyQuality } from './quality.js';
applyQuality(CONFIG);
```

Replace the loop with an fps-capped, visibility-aware loop:

```js
let visible = true;
document.addEventListener('visibilitychange', () => { visible = !document.hidden; });

const frameInterval = 1 / CONFIG.fpsCap;
let acc = 0;
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!visible) return;                 // pause work when wallpaper not shown
  acc += dt;
  if (acc < frameInterval) return;      // fps cap
  acc = 0;

  audio.update(dt);
  const spectrum = audio.getSpectrum();
  const levels = audio.getLevels();
  field.update(spectrum, levels, dt);
  core.update(levels.bass, dt);
  stars.update(dt);
  rig.update(dt);
  composer.render();
}
requestAnimationFrame(frame);
```

> Note: `applyQuality` must run before `createPillarField()`/`createStarfield()` since those read `CONFIG.grid` / `CONFIG.stars.count` at build time. Ensure the `applyQuality(CONFIG)` call is above those `create*()` calls in the file.

- [ ] **Step 3: Write `README.md`**

````markdown
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
````

- [ ] **Step 4: Verify tests + production build**

Run: `npm test`
Expected: PASS (all suites).
Run: `npm run build`
Expected: build succeeds, `dist/` produced, exit 0.

- [ ] **Step 5: Visual verify all three quality tiers**

For each value of `CONFIG.quality` (`'low'`, `'mid'`, `'high'`): set it in `src/config.js`, run `npm run dev`, confirm the scene renders and the pillar density / bloom changes accordingly. Restore to `'high'` (or `'mid'`) when done. Background a long-running tab and confirm CPU drops (work pauses when hidden).

- [ ] **Step 6: Commit & push**

```bash
git add src/quality.js src/main.js README.md
git commit -m "feat: quality presets, fps cap, visibility throttle, README"
git push
```

---

## Self-Review Notes (resolved during planning)

- **Spec coverage:** §3 idle breathing → `field.js idle()` (Task 4) + spring (Task 8); §4 layers → bg/fog (T6), pillars (T7), core (T9), stars (T10), camera (T11), bloom/vignette (T12); §5 motion → T8 spring + T9 pulse/ring + T11 camera; §6 colors → palette in CONFIG + `colorRamp`; §7 perf → T13; §8 audio interface → T5 + consumed only via interface in T7–9; §9 InstancedMesh/throttle/pixelRatio → T7/T13. No gaps.
- **Type consistency:** `getSpectrum`/`getLevels`/`update` identical across T5, T7, T9, main; `createPillarField().update(spectrum, levels, dt)` signature stable T7→T8; `springStep` return `{value, vel}` consistent T3→T8.
- **Out of scope (per spec §12):** real system-audio capture, Plash deployment automation, settings UI, frequency-label HUD.
