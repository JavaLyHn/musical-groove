export const CONFIG = {
  bands: 64,
  grid: 40,
  spacing: 1.0,

  // grid wraps onto a sphere cap -> curved planetary horizon (replaces paraboloid)
  sphereRadius: 60,          // radius of the planet the grid sits on
  capAngle: 0.62,            // max polar angle (rad) of the cap from its apex (~35°)

  colors: {
    bg0: '#060A1C',          // deep void (outer gradient + fog)
    bg1: '#0e1838',          // faint center-of-gradient glow
    // height LUT (idle/low -> white-hot), interpolated by colorRamp()
    ramp: ['#1E2C70', '#34489E', '#6E78C8', '#C3BEF2', '#F4F6FF'],
    core: '#F4F6FF',         // reactor core white-hot
    accent: '#5FD0E0',       // cold-teal atmosphere / drop accent (sparse)
  },

  field: {
    centerPeak: 8.0,         // radial base-height bump at center
    falloff: 20.0,           // gaussian falloff radius for centerPeak
    baseHeight: 1.0,         // minimum pillar height
    reactive: 7.0,           // how much spectrum drives height
    idleAmp: 0.9,            // idle breathing amplitude
    idleSpeed: 0.5,
    stiffness: 90.0,         // legacy spring (superseded by attack/decay in Wave 1.2)
    damping: 14.0,
    attack: 0.5,             // fast rise: lerp factor when target is above current
    decay: 0.90,             // slow fall per 1/60s: melts back toward baseHeight
    segPitch: 0.55,          // world height of one block segment
    gapRatio: 0.18,          // fraction of each segment that is a dark gap
    pillarWidth: 0.7,        // footprint (relative to spacing)
  },

  // beat-triggered radial shockwave rippling outward across the field
  wave: { speed: 26.0, width: 7.0, amp: 3.2, decay: 1.6 },

  core: { radius: 1.0, intensity: 1.6, pulse: 2.4, ringSpeed: 6.0 },
  stars: { count: 1200, radius: 120 },
  camera: { fov: 52, height: 5.5, distance: 48, orbitSpeed: 0.025, bob: 1.0, lookAtY: 7.5 },
  post: { bloomStrength: 0.6, bloomRadius: 0.5, bloomThreshold: 0.72, vignette: 1.15 },

  quality: 'high',           // 'low' | 'mid' | 'high' (Task 13 applies presets)
  fpsCap: 60,
  maxPixelRatio: 2,
};
