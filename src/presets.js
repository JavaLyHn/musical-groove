// @ts-check
// Version presets: snapshot the tunable parameters under a name in localStorage and recall
// them. Crucially this module is lil-gui-FREE, so main.js can apply the last-used version at
// page load — BEFORE/without opening the (lazily-loaded) control panel — and the wallpaper
// reopens with your saved look. (Previously the restore lived inside the panel, so a saved
// version only re-applied when you opened it, which made "save" look like it did nothing.)
import { CONFIG } from './config.js';

const PRESETS_KEY = 'lyhn-presets';   // { [name]: snapshot }
const LAST_KEY = 'lyhn-preset-last';  // name of the version to auto-apply on load

/** @typedef {{ rig: { state: any }, renderer: any }} Refs */

// The exact set of user-tunable parameters a version captures: [stableKey, object, property].
// KEEP IN SYNC with src/console/schema.js (allControls); test/consoleSchema.test.js enforces it.
/** @param {Refs} refs @returns {[string, any, string][]} */
function targets(refs) {
  const C = CONFIG, st = refs.rig.state, rn = refs.renderer;
  return [
    ['field.segmented', C.field, 'segmented'],
    ['lyrics.show', C.lyrics, 'show'],
    ['lyrics.offset', C.lyrics, 'offset'],
    ['lyrics.fontSize', C.lyrics, 'fontSize'],
    ['lyrics.bottom', C.lyrics, 'bottom'],
    ['lyrics.glow', C.lyrics, 'glow'],
    ['lyrics.pulse', C.lyrics, 'pulse'],
    ['lyrics.showNext', C.lyrics, 'showNext'],
    ['ripple.sensitivity', C.ripple, 'sensitivity'],
    ['ripple.cooldown', C.ripple, 'cooldown'],
    ['meteor.sensitivity', C.meteor, 'sensitivity'],
    ['meteor.cooldown', C.meteor, 'cooldown'],
    ['motion.idleDebounce', C.motion, 'idleDebounce'],
    ['motion.idleTransition', C.motion, 'idleTransition'],
    ['motion.idleSilence', C.motion, 'idleSilence'],
    ['motion.idleHeight', C.motion, 'idleHeight'],
    ['motion.idleRippleEvery', C.motion, 'idleRippleEvery'],
    ['motion.idleRippleStrength', C.motion, 'idleRippleStrength'],
    ['motion.idleMeteor', C.motion, 'idleMeteor'],
    ['motion.idleMeteorEvery', C.motion, 'idleMeteorEvery'],
    ['motion.idleMeteorDensity', C.motion, 'idleMeteorDensity'],
    ['motion.radialDelay', C.motion, 'radialDelay'],
    ['motion.levelFloor', C.motion, 'levelFloor'],
    ['motion.waveAmp', C.motion, 'waveAmp'],
    ['motion.accentHeight', C.motion, 'accentHeight'],
    ['field.reactive', C.field, 'reactive'],
    ['wave.idleSpeed', C.wave, 'idleSpeed'],
    ['camera.beatKick', C.camera, 'beatKick'],
    ['post.bloomSpike', C.post, 'bloomSpike'],
    ['field.coreHeat', C.field, 'coreHeat'],
    ['field.kickSurge', C.field, 'kickSurge'],
    ['field.kickFlash', C.field, 'kickFlash'],
    ['camera.pitchDeg', st, 'pitchDeg'],
    ['camera.distance', st, 'distance'],
    ['camera.fov', st, 'fov'],
    ['camera.orbitSpeed', st, 'orbitSpeed'],
    ['post.accentColor', C.post, 'accentColor'],
    ['post.accentIntensity', C.post, 'accentIntensity'],
    ['post.bloomThreshold', C.post, 'bloomThreshold'],
    ['field.idleEmissive', C.field, 'idleEmissive'],
    ['field.idleNoiseScale', C.field, 'idleNoiseScale'],
    ['field.idleNoiseSpeed', C.field, 'idleNoiseSpeed'],
    ['field.topTint', C.field, 'topTint'],
    ['core.idleBreath', C.core, 'idleBreath'],
    ['fog.farMult', C.fog, 'farMult'],
    ['renderer.exposure', rn, 'toneMappingExposure'],
  ];
}

/** Capture the current values. @param {Refs} refs @returns {Record<string, any>} */
export function snapshot(refs) {
  /** @type {Record<string, any>} */
  const out = {};
  for (const [key, obj, prop] of targets(refs)) out[key] = obj[prop];
  return out;
}

/** Write a snapshot back onto the live objects. @param {Refs} refs @param {Record<string, any>} data */
export function applySnapshot(refs, data) {
  if (!data || typeof data !== 'object') return;
  for (const [key, obj, prop] of targets(refs)) {
    if (key in data && data[key] !== undefined) obj[prop] = data[key];
  }
}

/** @returns {Record<string, any>} */
export function getPresets() {
  try { return JSON.parse(localStorage.getItem(PRESETS_KEY) || '{}') || {}; } catch { return {}; }
}
/** @param {Record<string, any>} p */
export function setPresets(p) { try { localStorage.setItem(PRESETS_KEY, JSON.stringify(p)); } catch { /* storage off */ } }
/** @returns {string|null} */
export function getLast() { try { return localStorage.getItem(LAST_KEY); } catch { return null; } }
/** @param {string|null} n */
export function setLast(n) { try { n ? localStorage.setItem(LAST_KEY, n) : localStorage.removeItem(LAST_KEY); } catch { /* */ } }

/** Apply the last-used version at startup (no panel needed). @param {Refs} refs @returns {string|null} the applied name */
export function applyLast(refs) {
  const last = getLast();
  if (!last) return null;
  const presets = getPresets();
  if (!presets[last]) return null;
  applySnapshot(refs, presets[last]);
  return last;
}

// Unsaved-changes tracking: the last "saved/applied" snapshot, as a stable JSON string. The
// console's exit guard compares the live snapshot against this to decide whether to prompt.
/** @type {string | null} */
let _baseline = null;

/** Mark the current live state as the clean baseline (after load / save / apply). @param {Refs} refs */
export function markClean(refs) { _baseline = JSON.stringify(snapshot(refs)); }

/** Whether the live state has drifted from the baseline. No baseline yet => clean.
 *  @param {Refs} refs @returns {boolean} */
export function isDirty(refs) {
  if (_baseline === null) return false;
  return JSON.stringify(snapshot(refs)) !== _baseline;
}

/** The stableKeys a snapshot captures — for the console schema consistency test.
 *  Uses empty refs because `targets()` only stores the object refs, not their values.
 *  @returns {string[]} */
export function presetKeys() {
  return targets(/** @type {any} */ ({ rig: { state: {} }, renderer: {} })).map(([k]) => k);
}
