export const CONFIG = {
  bands: 64,
  grid: 40,                  // base; the quality preset raises this at runtime
  spacing: 1.0,

  // The grid wraps onto a LARGE, gently-curved sphere cap, so the field spreads
  // flat across the frame and bends only at a distant horizon (not a small ball).
  sphereRadius: 260,
  capAngle: 0.34,            // ~19.5° cap -> wide flat-ish field, gentle horizon

  colors: {
    bg0: '#060A1C',          // deep void (outer gradient + fog)
    bg1: '#0e1838',          // faint center-of-gradient glow
    ramp: ['#2A3C90', '#3F52B0', '#6E78C8', '#C3BEF2', '#F4F6FF'], // height LUT (glowing blue -> white-hot)
    core: '#F4F6FF',         // reactor core white-hot
    accent: '#5FD0E0',       // cold-teal atmosphere / drop accent (sparse)
  },

  field: {
    centerPeak: 2.5,         // only slightly raised -> a flat field, not a mound
    falloff: 18.0,           // gentle center rise
    baseHeight: 1.2,         // minimum pillar height
    reactive: 5.5,           // spectrum relief over a low-profile field
    idleAmp: 0.8,            // idle breathing amplitude
    idleSpeed: 0.5,
    stiffness: 90.0,         // legacy spring (superseded by attack/decay)
    damping: 14.0,
    attack: 0.5,             // fast rise: lerp factor when target is above current
    decay: 0.90,             // slow fall per 1/60s: melts back toward baseHeight
    segPitch: 0.85,          // world height of one block segment
    gapRatio: 0.16,          // fraction of each segment that is a dark gap
    pillarWidth: 1.55,       // footprint width (scaled for the wide field)
  },

  // atmospheric haze (depth): scaled to the large scene
  fog: { near: 80, far: 300 },

  // beat-triggered radial shockwave rippling outward across the field
  wave: { speed: 34.0, width: 8.0, amp: 5.5, decay: 1.4 },

  core: { radius: 1.3, intensity: 0.3, pulse: 0.8, ringSpeed: 6.0 }, // dimmed so the wave reads
  stars: { count: 1400, radius: 200 },
  // STATIC camera (no orbit/bob) — elevated, looking down across the field to the horizon
  camera: { fov: 56, height: 15, distance: 95, orbitSpeed: 0, bob: 0, lookAtY: 9.0 },
  post: { bloomStrength: 0.28, bloomRadius: 0.45, bloomThreshold: 0.9, vignette: 1.2 },

  quality: 'high',           // 'low' | 'mid' | 'high' (quality.js applies presets)
  fpsCap: 60,
  maxPixelRatio: 2,
};
