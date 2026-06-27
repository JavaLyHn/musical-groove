// @ts-check
// Single source of truth for the console's controls. KEEP IN SYNC with presets.js targets():
// every control's `key` must equal a presets stableKey (test/consoleSchema.test.js guards it).
// DOM-FREE on purpose (pure data + get/set closures) so node tests can import it; widgets.js /
// index.js own all the DOM. get/set write the LIVE objects so the render loop picks values up
// each frame (drag = instant). `r` is { rig:{state}, renderer }.
import { CONFIG } from '../config.js';

/**
 * @typedef {object} Control
 * @property {string} key
 * @property {'dial'|'slider'|'toggle'|'color'} kind
 * @property {string} label
 * @property {string} [hint]
 * @property {number} [min]
 * @property {number} [max]
 * @property {number} [step]
 * @property {any} [def]
 * @property {string} [lo]
 * @property {string} [hi]
 * @property {(r:any)=>any} get
 * @property {(r:any,v:any)=>void} set
 */
/** @typedef {{ id:string, title:string, en:string, collapsed?:boolean, controls:Control[] }} Group */
/** @typedef {{ id:string, title:string, en:string, hot?:boolean, groups:Group[] }} Section */

const C = CONFIG;

/** @type {Section[]} */
export const SECTIONS = [
  {
    id: 'performance', title: '演出', en: 'PERFORMANCE · 跟着音乐实时拧', hot: true,
    groups: [
      {
        id: 'beat', title: '节拍', en: 'BEAT', controls: [
          { key: 'camera.beatKick', kind: 'dial', label: '相机冲击', hint: '每拍相机猛冲+震动的强度', min: 0, max: 2, def: 1.0,
            get: () => C.camera.beatKick, set: (r, v) => { C.camera.beatKick = v; } },
          { key: 'field.kickSurge', kind: 'dial', label: '鼓点抬升', hint: '重拍瞬间全场柱子一起抬升的高度', min: 0, max: 12, def: 4.0,
            get: () => C.field.kickSurge, set: (r, v) => { C.field.kickSurge = v; } },
          { key: 'field.coreHeat', kind: 'dial', label: '热核强度', hint: '低频把中心烧成白热核的强度', min: 0, max: 2, def: 0.7,
            get: () => C.field.coreHeat, set: (r, v) => { C.field.coreHeat = v; } },
          { key: 'field.kickFlash', kind: 'slider', label: '鼓点闪光 (全场)', hint: '重拍时全场亮一下的强度', min: 0, max: 1.5, def: 0.5,
            get: () => C.field.kickFlash, set: (r, v) => { C.field.kickFlash = v; } },
          { key: 'post.bloomSpike', kind: 'slider', label: 'Bloom 爆闪', hint: 'Bloom 在重拍瞬间的爆闪量', min: 0, max: 0.5, def: 0.16,
            get: () => C.post.bloomSpike, set: (r, v) => { C.post.bloomSpike = v; } },
          { key: 'motion.accentHeight', kind: 'slider', label: '重音柱高度', hint: '重音时少数柱子 punch 到多高', min: 0, max: 20, def: 12,
            get: () => C.motion.accentHeight, set: (r, v) => { C.motion.accentHeight = v; } },
        ],
      },
      {
        id: 'motion', title: '运动', en: 'MOTION', controls: [
          { key: 'field.reactive', kind: 'slider', label: '整体起伏', hint: 'audio 起伏对柱高的总增益', min: 5, max: 40, step: 1, def: 23,
            get: () => C.field.reactive, set: (r, v) => { C.field.reactive = v; } },
          { key: 'motion.waveAmp', kind: 'slider', label: '行波幅度', hint: '常驻行波(风)的幅度', min: 0, max: 6, def: 2.6,
            get: () => C.motion.waveAmp, set: (r, v) => { C.motion.waveAmp = v; } },
          { key: 'motion.radialDelay', kind: 'slider', label: '径向延迟 (波速)', hint: '一拍从中心扫到边缘的延迟(越大越慢)', min: 0, max: 70, step: 1, def: 36, lo: '0 慢扫', hi: '70 即时',
            get: () => C.motion.radialDelay, set: (r, v) => { C.motion.radialDelay = v; } },
          { key: 'motion.levelFloor', kind: 'slider', label: '共模地板', hint: '整体响度对柱高影响的下限(越高越平均)', min: 0, max: 1, def: 0.65,
            get: () => C.motion.levelFloor, set: (r, v) => { C.motion.levelFloor = v; } },
          { key: 'field.segmented', kind: 'toggle', label: '分段柱体', hint: '关=流畅整条', def: true,
            get: () => C.field.segmented, set: (r, v) => { C.field.segmented = v; } },
        ],
      },
      {
        id: 'react', title: '反应', en: 'RIPPLE / METEOR', controls: [
          { key: 'ripple.sensitivity', kind: 'slider', label: '涟漪 灵敏度', hint: '越小越容易触发涟漪', min: 0, max: 0.5, def: 0.1, lo: '0 灵敏', hi: '0.5 迟钝',
            get: () => C.ripple.sensitivity, set: (r, v) => { C.ripple.sensitivity = v; } },
          { key: 'ripple.cooldown', kind: 'slider', label: '涟漪 冷却帧', hint: '两次涟漪最短间隔(帧);0=每拍', min: 0, max: 30, step: 1, def: 0, lo: '0 每拍', hi: '30 稀疏',
            get: () => C.ripple.cooldown, set: (r, v) => { C.ripple.cooldown = v; } },
          { key: 'meteor.sensitivity', kind: 'slider', label: '流星 灵敏度', hint: '越小越容易触发流星', min: 0, max: 0.6, def: 0.2,
            get: () => C.meteor.sensitivity, set: (r, v) => { C.meteor.sensitivity = v; } },
          { key: 'meteor.cooldown', kind: 'slider', label: '流星 冷却帧', hint: '越大流星越稀少', min: 0, max: 600, step: 10, def: 200, lo: '0', hi: '600 稀少',
            get: () => C.meteor.cooldown, set: (r, v) => { C.meteor.cooldown = v; } },
        ],
      },
    ],
  },
  {
    id: 'setup', title: '设置', en: 'SETUP · 基本设一次',
    groups: [
      {
        id: 'camera', title: '相机', en: 'CAMERA', controls: [
          { key: 'camera.pitchDeg', kind: 'slider', label: '仰角 °', hint: '相机俯角', min: 0, max: 85, step: 1, def: 25,
            get: (r) => r.rig.state.pitchDeg, set: (r, v) => { r.rig.state.pitchDeg = v; } },
          { key: 'camera.distance', kind: 'slider', label: '距离', hint: '相机到核心的距离', min: 40, max: 400, step: 5, def: 190,
            get: (r) => r.rig.state.distance, set: (r, v) => { r.rig.state.distance = v; } },
          { key: 'camera.fov', kind: 'slider', label: '视角 fov', hint: '小=长焦压缩', min: 10, max: 90, step: 1, def: 35,
            get: (r) => r.rig.state.fov, set: (r, v) => { r.rig.state.fov = v; } },
          { key: 'camera.orbitSpeed', kind: 'slider', label: '自转速度', hint: '缓慢自转 (rad/s)', min: 0, max: 1, def: 0.2,
            get: (r) => r.rig.state.orbitSpeed, set: (r, v) => { r.rig.state.orbitSpeed = v; } },
        ],
      },
      {
        id: 'post', title: '后期', en: 'POST', controls: [
          { key: 'renderer.exposure', kind: 'slider', label: '曝光 exposure', hint: '整体曝光', min: 0.2, max: 2, def: 0.8,
            get: (r) => r.renderer.toneMappingExposure, set: (r, v) => { r.renderer.toneMappingExposure = v; } },
          { key: 'post.bloomThreshold', kind: 'slider', label: 'Bloom 阈值', hint: '高于此亮度才发光(高=只有最亮柱顶溢光)', min: 0, max: 1, def: 0.85,
            get: () => C.post.bloomThreshold, set: (r, v) => { C.post.bloomThreshold = v; } },
          { key: 'post.accentColor', kind: 'color', label: '强调色', hint: '整个 UI 强调色 + 泛光washed色', def: '#5FD0E0',
            get: () => C.post.accentColor, set: (r, v) => { C.post.accentColor = v; } },
          { key: 'post.accentIntensity', kind: 'slider', label: '强调强度', hint: '强调色washed到泛光上的强度', min: 0, max: 1, def: 0,
            get: () => C.post.accentIntensity, set: (r, v) => { C.post.accentIntensity = v; } },
          { key: 'field.topTint', kind: 'slider', label: '柱顶青调', hint: '最亮柱顶染向青蓝的程度', min: 0, max: 1, def: 0.6,
            get: () => C.field.topTint, set: (r, v) => { C.field.topTint = v; } },
          { key: 'fog.farMult', kind: 'slider', label: '雾深度', hint: '越小远处越早隐入暗处', min: 1.1, max: 2.5, def: 1.45,
            get: () => C.fog.farMult, set: (r, v) => { C.fog.farMult = v; } },
        ],
      },
      {
        id: 'lyrics', title: '歌词', en: 'LYRICS', collapsed: true, controls: [
          { key: 'lyrics.show', kind: 'toggle', label: '显示歌词', def: true,
            get: () => C.lyrics.show, set: (r, v) => { C.lyrics.show = v; } },
          { key: 'lyrics.fontSize', kind: 'slider', label: '字号 px', min: 18, max: 64, step: 1, def: 36,
            get: () => C.lyrics.fontSize, set: (r, v) => { C.lyrics.fontSize = v; } },
          { key: 'lyrics.bottom', kind: 'slider', label: '高度 (距底 %)', min: 4, max: 45, step: 1, def: 15,
            get: () => C.lyrics.bottom, set: (r, v) => { C.lyrics.bottom = v; } },
          { key: 'lyrics.offset', kind: 'slider', label: '提前量 s', hint: '歌词提前出现以抵消播放延迟', min: -0.5, max: 2.5, def: 0.7,
            get: () => C.lyrics.offset, set: (r, v) => { C.lyrics.offset = v; } },
          { key: 'lyrics.glow', kind: 'slider', label: '辉光', hint: '0=无', min: 0, max: 2, def: 1.0,
            get: () => C.lyrics.glow, set: (r, v) => { C.lyrics.glow = v; } },
          { key: 'lyrics.pulse', kind: 'slider', label: '律动', hint: '随乐缩放', min: 0, max: 2.5, def: 1.0,
            get: () => C.lyrics.pulse, set: (r, v) => { C.lyrics.pulse = v; } },
          { key: 'lyrics.showNext', kind: 'toggle', label: '显示下一句', def: true,
            get: () => C.lyrics.showNext, set: (r, v) => { C.lyrics.showNext = v; } },
        ],
      },
      {
        id: 'idle', title: '待机', en: 'IDLE', collapsed: true, controls: [
          { key: 'motion.idleDebounce', kind: 'slider', label: '防抖 s', hint: '静音多久后淡入待机', min: 0, max: 5, def: 1.0,
            get: () => C.motion.idleDebounce, set: (r, v) => { C.motion.idleDebounce = v; } },
          { key: 'motion.idleTransition', kind: 'slider', label: '过渡 s', min: 0.1, max: 5, def: 2.0,
            get: () => C.motion.idleTransition, set: (r, v) => { C.motion.idleTransition = v; } },
          { key: 'motion.idleSilence', kind: 'slider', label: '静音阈值', min: 0, max: 0.2, def: 0.045,
            get: () => C.motion.idleSilence, set: (r, v) => { C.motion.idleSilence = v; } },
          { key: 'motion.idleHeight', kind: 'slider', label: '待机柱林高度', min: 0, max: 18, def: 11,
            get: () => C.motion.idleHeight, set: (r, v) => { C.motion.idleHeight = v; } },
          { key: 'motion.idleRippleEvery', kind: 'slider', label: '待机涟漪间隔 s', min: 0.8, max: 8, def: 2.6,
            get: () => C.motion.idleRippleEvery, set: (r, v) => { C.motion.idleRippleEvery = v; } },
          { key: 'motion.idleRippleStrength', kind: 'slider', label: '待机涟漪强度', min: 0, max: 2, def: 1.0,
            get: () => C.motion.idleRippleStrength, set: (r, v) => { C.motion.idleRippleStrength = v; } },
          { key: 'wave.idleSpeed', kind: 'slider', label: '待机涟漪速度', hint: '小=慢', min: 30, max: 400, step: 5, def: 130,
            get: () => C.wave.idleSpeed, set: (r, v) => { C.wave.idleSpeed = v; } },
          { key: 'field.idleEmissive', kind: 'slider', label: '待机亮度', hint: '待机暗场发光地板(越高越亮)', min: 0, max: 1, def: 0.7,
            get: () => C.field.idleEmissive, set: (r, v) => { C.field.idleEmissive = v; } },
          { key: 'field.idleNoiseScale', kind: 'slider', label: '待机丘陵密度', hint: '越小丘陵越大块', min: 0.3, max: 2.0, def: 0.7,
            get: () => C.field.idleNoiseScale, set: (r, v) => { C.field.idleNoiseScale = v; } },
          { key: 'field.idleNoiseSpeed', kind: 'slider', label: '待机地形速度', hint: '丘陵漂移快慢', min: 0, max: 2, def: 0.6,
            get: () => C.field.idleNoiseSpeed, set: (r, v) => { C.field.idleNoiseSpeed = v; } },
          { key: 'core.idleBreath', kind: 'slider', label: '暗核呼吸', hint: '待机中心缓慢明灭强度(0=关)', min: 0, max: 3, def: 1.0,
            get: () => C.core.idleBreath, set: (r, v) => { C.core.idleBreath = v; } },
        ],
      },
    ],
  },
];

/** Flattened control list (37). @returns {Control[]} */
export function allControls() {
  /** @type {Control[]} */
  const out = [];
  for (const s of SECTIONS) for (const g of s.groups) for (const c of g.controls) out.push(c);
  return out;
}
