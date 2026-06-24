export const CONFIG = {
  bands: 64,
  grid: 40,                  // base; the quality preset raises this at runtime
  spacing: 1.0,

  // Very large sphere + small cap angle -> a FLAT field that bends only gently
  // at a distant horizon (no dome / bulge).
  sphereRadius: 420,
  capAngle: 0.215,

  colors: {
    bg0: '#0B1330',          // deep navy void (outer gradient + fog) — not pure black
    bg1: '#1B2A57',          // navy center-of-gradient glow
    // height LUT: glowing blue -> VIVID LAVENDER (never pure white), so the beat
    // pulse stays palette-consistent and cool instead of blowing out white.
    ramp: ['#2A3C90', '#46509E', '#6E78C8', '#8E8AE0', '#A99CF5'],
    core: '#9AA6F2',         // cool lavender-blue reactor pulse (not white)
    accent: '#5FD0E0',       // cold-teal atmosphere / drop accent (sparse)
  },

  field: {
    centerPeak: 2.5,         // low central bump -> flat overall (center brightens via beats)
    falloff: 18.0,
    baseHeight: 2.5,         // taller pillars (clearly visible relief)
    reactive: 8.0,           // taller spectrum relief
    idleAmp: 1.0,            // idle breathing amplitude
    idleSpeed: 0.5,
    stiffness: 90.0,         // legacy spring (superseded by attack/decay)
    damping: 14.0,
    attack: 0.5,             // fast rise
    decay: 0.90,             // slow fall per 1/60s
    segPitch: 1.0,           // world height of one block segment
    gapRatio: 0.14,          // dark gap fraction per segment
    pillarWidth: 2.0,        // wide -> pillars nearly touch (no gaps/seams)
    capThickness: 0.5,       // peak-hold cap thickness (thin bright lip)
    capSink: 0.985,          // cap sink per 1/60s (slow descent)
    capThreshold: 1.4,       // only cap pillars risen this far above base (restrained)
  },

  // atmospheric haze (depth): scaled to the large scene
  fog: { near: 90, far: 360 },

  // beat-triggered radial shockwave rippling outward across the field
  wave: { speed: 34.0, width: 8.0, amp: 7.0, decay: 1.4 },

  core: { radius: 1.0, intensity: 0.2, pulse: 0.7, ringSpeed: 6.0 }, // dim + cool, won't blow white
  stars: { count: 1400, radius: 200 },
  // STATIC camera (no orbit/bob) — elevated, looking DOWN onto the field (俯瞰 + near→far stretch)
  camera: { fov: 60, height: 78, distance: 72, orbitSpeed: 0, bob: 0, lookAtY: 0 },
  post: { bloomStrength: 0.16, bloomRadius: 0.5, bloomThreshold: 0.78, vignette: 1.2, aberration: 0.01, grain: 0.028, bloomSpike: 0.06 },

  quality: 'high',           // 'low' | 'mid' | 'high' (quality.js applies presets)
  fpsCap: 60,
  maxPixelRatio: 2,
};
