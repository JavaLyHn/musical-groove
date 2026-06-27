// @ts-check
// Built-in "style" presets: one-click factory looks. A style is a FULL-snapshot mood — its
// `overrides` only list the keys that differ from the cool default; styleSnapshot() merges them
// over a default snapshot DERIVED from the schema's `def` values (single source of truth, no
// drift), so applying a style sets all 45 params to a definite value ("整套都改"). Applying is
// done by the console via presets.applySnapshot(); it intentionally does NOT mark the state
// clean, so the unsaved-changes exit prompt nudges the user to save the look as their version.
import { allControls } from './console/schema.js';

// The cool-default full snapshot, keyed by preset stableKey. Every schema control carries a def,
// so this has a defined value for all 45 keys.
const DEFAULTS = Object.fromEntries(allControls().map((c) => [c.key, c.def]));

/** @typedef {{ id:string, name:string, hint?:string, overrides:Record<string,any> }} Style */

/** Factory style presets. @type {Style[]} */
export const STYLES = [
  { id: 'amber', name: '暖夜·琥珀', hint: '暖调强调色 + 稍高曝光/热核,温暖夜', overrides: {
    'post.accentColor': '#F0A862', 'post.accentIntensity': 0.35,
    'renderer.exposure': 0.95, 'post.bloomThreshold': 0.80,
    'field.coreHeat': 1.1, 'field.topTint': 0.15,
    'core.idleBreath': 1.3, 'field.idleEmissive': 0.78,
  } },
  { id: 'lavender', name: '薰衣草·梦幻', hint: '薰衣草紫 + 软泛光,梦幻柔和', overrides: {
    'post.accentColor': '#9A8FE6', 'post.accentIntensity': 0.30,
    'renderer.exposure': 0.85, 'post.bloomThreshold': 0.78, 'post.bloomSpike': 0.13,
    'field.coreHeat': 0.6, 'field.topTint': 0.5,
    'motion.waveAmp': 3.2, 'field.kickFlash': 0.35,
    'core.idleBreath': 1.5, 'field.idleEmissive': 0.82,
  } },
  { id: 'minimal', name: '极简·克制', hint: '低泛光/低爆闪/起伏温和,安静克制', overrides: {
    'post.accentIntensity': 0, 'renderer.exposure': 0.70,
    'post.bloomThreshold': 0.93, 'post.bloomSpike': 0.05,
    'field.coreHeat': 0.5, 'field.kickSurge': 2.0, 'field.kickFlash': 0.2,
    'field.reactive': 16, 'motion.waveAmp': 1.6, 'camera.beatKick': 0.4,
    'meteor.cooldown': 360, 'motion.idleMeteorEvery': 14,
    'core.idleBreath': 0.7, 'field.idleEmissive': 0.6,
  } },
  { id: 'live', name: '激烈·演出', hint: '高 Bloom 爆闪 + 强鼓点 + 相机冲击,现场感', overrides: {
    'post.accentColor': '#5FD0E0', 'post.accentIntensity': 0.25,
    'renderer.exposure': 1.0, 'post.bloomThreshold': 0.70, 'post.bloomSpike': 0.32,
    'field.coreHeat': 1.2, 'field.kickSurge': 8, 'field.kickFlash': 1.0, 'field.topTint': 0.7,
    'field.reactive': 30, 'motion.waveAmp': 3.5, 'camera.beatKick': 1.6, 'motion.accentHeight': 16,
    'ripple.cooldown': 0, 'meteor.sensitivity': 0.14, 'meteor.cooldown': 90,
  } },
];

/** A style's complete 45-key snapshot (defaults ⊕ overrides) for presets.applySnapshot.
 *  @param {Style} style @returns {Record<string,any>} */
export function styleSnapshot(style) { return { ...DEFAULTS, ...style.overrides }; }
