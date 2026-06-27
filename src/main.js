/*!
 * Musical Groove — © 2026 LyHN (github.com/JavaLyHn). All rights reserved.
 * Proprietary. The "LyHN" signature (signature.js) and the in-canvas watermark (postfx.js)
 * are the author's attribution marks and must not be removed or disabled. See LICENSE.
 */
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { applyLast } from './presets.js';
import { applyQuality } from './quality.js';
// Live quality override for finding a machine's sweet spot: ?q=low|mid|high
const _q = new URLSearchParams(location.search).get('q');
if (_q === 'low' || _q === 'mid' || _q === 'high') CONFIG.quality = _q;
applyQuality(CONFIG);

import { createRenderer, createCamera, createScene } from './scene/sceneSetup.js';
import { createPillarField } from './scene/pillarField.js';
import { createCore } from './scene/core.js';
import { createStarfield } from './scene/starfield.js';
import { createSparks } from './scene/sparks.js';
import { createAtmosphere } from './scene/atmosphere.js';
import { createCameraRig } from './scene/cameraRig.js';
import { createSimulatedAudioSource } from './audioSource.js';
import { createAudioShaper } from './util/audioShaper.js';
import { createBeatDetector } from './util/beatDetector.js';
import { createWebAudioSource, createSystemAudioSource, pickLoopbackDeviceId } from './webAudioSource.js';
import { createAudioControls } from './ui.js';
import { createComposer } from './scene/postfx.js';
import { createNowPlaying } from './nowPlaying.js';
import { createSignature } from './signature.js';
import { createLyrics } from './lyrics.js';
import { initElectronMode } from './electronMode.js';

const canvas = document.getElementById('app');
const renderer = createRenderer(canvas);
const camera = createCamera();
const scene = createScene();

// `audio` starts simulated and is swapped to the real source once connected.
let audio = createSimulatedAudioSource();
// The shaper turns whatever source is live into a per-band-normalized drive (so
// every ring dances on its own band) + an overall amplitude level.
const shaper = createAudioShaper(CONFIG.audioBins, CONFIG.bands);
// Spectral-flux beat detection (adaptive threshold), fed the raw spectrum.
const beatDetector = createBeatDetector();
// Broadband onset (positive spectral flux of the shaped bands) — the energy that
// drives the independent ripple + meteor triggers (their own sensitivity + cooldown).
const prevSpec = new Float32Array(CONFIG.bands);
const field = createPillarField();
scene.add(field.mesh);

// System "Now Playing": a top-line overlay (cover + title — artist) fed by the dev
// server's bridge over SSE; the cover's dominant colour tints the field's palette, and
// each track change drives the synced lyrics (fetched from lrclib by title/artist).
const lyrics = createLyrics();
const nowPlaying = createNowPlaying({
  onColor: (rgb) => field.setCoverColor(rgb),
  onTrack: (t) => lyrics.setTrack(t),
  onSeek: (sec) => { fetch('/__seek?pos=' + sec.toFixed(2)).catch(() => {}); },
  onCmd: (id) => { fetch('/__cmd?id=' + id).catch(() => {}); },
});

const core = createCore();
scene.add(core.group);

const stars = createStarfield();
scene.add(stars.points);

const sparks = createSparks();
scene.add(sparks.points);

const atmosphere = createAtmosphere();
scene.add(atmosphere.sprite);

const rig = createCameraRig(camera, scene);
const { composer, setSize, update: updateFx } = createComposer(renderer, scene, camera);

// Apply the last-saved version at load (no panel needed), so the wallpaper reopens with the
// look you saved. Values land in CONFIG / rig.state / renderer, which the loop reads live.
if (applyLast({ rig, renderer })) rig.apply();

// LyHN signature (top-left): click it to toggle the live console. The console module is
// dynamically imported on first open, so it's code-split out of the wallpaper bundle.
let _panel = null;
let _panelOpen = false;
const _sig = createSignature({
  onToggle: async () => {
    if (!_panel) {
      const { createConsole } = await import('./console/index.js');
      _panel = createConsole({
        rig, renderer,
        onClose: () => { _panelOpen = false; _sig.setActive(false); },
      });
      _panel.show();
      _panelOpen = true;
      return;
    }
    _panelOpen = !_panelOpen;
    if (_panelOpen) _panel.show(); else _panel.hide();
  },
});
if (new URLSearchParams(location.search).has('gui')) _sig.click(); // auto-open with ?gui
initElectronMode({
  openPanel: () => { if (!_panelOpen) _sig.click(); },
  closePanel: () => { if (_panelOpen) _sig.click(); },
});

// Swap the simulated source for real system audio. In Electron, use the
// ScreenCaptureKit loopback (no BlackHole; speakers keep working). In a plain
// browser, fall back to getUserMedia with a BlackHole-style loopback device.
// Same interface -> no visual changes. Returns a status label for the UI.
async function connectRealAudio() {
  const inElectron = !!(window.__wallpaper__ && window.__wallpaper__.isElectron);
  if (inElectron) {
    const sys = await createSystemAudioSource();
    sys.update(0);
    audio = sys;
    console.log('[Musical Groove] audio connected:', sys.label);
    return '● ' + sys.label;
  }
  const deviceId = await pickLoopbackDeviceId();
  const web = await createWebAudioSource({ deviceId });
  web.update(0);
  audio = web;
  console.log('[Musical Groove] audio connected:', web.label, '| loopback device:', !!deviceId);
  return deviceId ? '● ' + web.label : '● ' + web.label + '（建议用 BlackHole 取系统声音）';
}
const controls = createAudioControls({ onConnect: connectRealAudio });
// After the first permission grant, auto-connect on every load (no click needed) —
// so as a wallpaper it just senses the music. (?autoaudio forces it, for testing.)
(async () => {
  if (new URLSearchParams(location.search).has('autoaudio')) { controls.connect(); return; }
  try {
    const st = await navigator.permissions.query({ name: 'microphone' });
    if (st.state === 'granted') controls.connect();
  } catch (e) { /* permissions API unavailable -> keep the manual button */ }
})();

const clock = new THREE.Clock();

let visible = true;
document.addEventListener('visibilitychange', () => { visible = !document.hidden; });

const frameInterval = 1 / CONFIG.fpsCap;
let acc = 0;
let kickPunch = 0; // collective kick-punch envelope (instant attack, ~150ms decay) shared by field + bloom
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!visible) return;                 // pause work when wallpaper not shown
  acc += dt;
  if (acc < frameInterval) return;      // fps cap
  acc = 0;

  audio.update(dt);
  const raw = audio.getSpectrum();
  const beat = beatDetector.process(raw, dt);
  const { spectrum, levels, level, warmth, brightness, sharpness } = shaper.process(raw, dt);
  let flux = 0;
  for (let i = 0; i < spectrum.length; i++) { const d = spectrum[i] - prevSpec[i]; if (d > 0) flux += d; prevSpec[i] = spectrum[i]; }
  const onset = flux / spectrum.length;
  // collective kick PUNCH: instant attack on a detected kick, fast (~150ms) decay. Shared so the
  // field (height surge + flash), bloom, and camera all land the drum on the SAME instant.
  kickPunch *= Math.pow(0.85, dt * 60);
  if (kickPunch < 0.002) kickPunch = 0;
  if (beat.kick > 0) kickPunch = Math.max(kickPunch, Math.min(1, 0.45 + beat.kick * 0.55));
  field.update(spectrum, levels, level, beat, { warmth, brightness, sharpness }, dt, onset, kickPunch);
  core.update(levels.bass, dt, field.getIdleMix());
  stars.update(dt);
  sparks.update(onset, dt);
  lyrics.update(level, onset, dt);
  if (beat.kick) rig.kick(beat.kick); // beat-driven camera punch (震动感)
  rig.update(dt, field.getIdleMix());
  updateFx(dt, levels.bass, kickPunch);
  composer.render();
}
requestAnimationFrame(frame);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  setSize(window.innerWidth, window.innerHeight);
});
