export const CONFIG = {
  bands: 64,
  grid: 40,                  // base; the quality preset raises this at runtime
  spacing: 1.0,

  // Large, gently-curved sphere cap: a vast field that fills the frame and bends
  // only at a distant horizon.
  sphereRadius: 1150,
  capAngle: 0.115,

  colors: {
    bg0: '#0B1330',          // deep navy void (outer gradient + fog) — not pure black
    bg1: '#1B2A57',          // navy center-of-gradient glow
    ramp: ['#2A3C90', '#3F52B0', '#6E78C8', '#8E8AE0', '#A99CF5'], // cool blue -> vivid lavender
    core: '#9AA6F2',         // cool lavender-blue reactor pulse (not white)
    accent: '#5FD0E0',       // cold-teal atmosphere accent
    deep: '#06080F',         // deep-space color the far cubes fog into (darker than bg)
  },

  field: {
    centerPeak: 2.5,         // small central rise -> no sharp peak
    falloff: 52.0,           // WIDE falloff -> a broad bright center, not a sharp spike
    baseHeight: 4.0,         // tall base so columns read as tall columns
    reactive: 12.0,          // spectrum relief (eased so the center spreads, not spikes)
    idleAmp: 1.4,            // idle breathing so columns always visibly move
    idleSpeed: 0.55,
    stiffness: 90.0,         // legacy spring (superseded by attack/decay)
    damping: 14.0,
    attack: 0.5,             // fast rise
    decay: 0.90,             // slow fall per 1/60s
    segPitch: 1.2,           // taller segment blocks (matches taller columns)
    gapRatio: 0.14,          // dark gap fraction per segment
    pillarWidth: 2.3,        // matches the denser grid (distinct, small gaps)
    capThickness: 0.55,      // peak-hold cap thickness
    capSink: 0.985,          // cap sink per 1/60s (slow descent)
    capThreshold: 1.6,       // only cap pillars risen this far above base (restrained)
  },

  // depth fog -> far cubes sink into the cool deep-space color while the
  // foreground/core stay bright. Volume, not a flat painting.
  fog: { near: 60, far: 160 },

  // beat-triggered radial shockwave rippling outward across the field
  wave: { speed: 40.0, width: 9.0, amp: 12.0, decay: 1.4 },

  core: { radius: 1.2, intensity: 0.2, pulse: 0.8, ringSpeed: 6.0 }, // dim + cool
  stars: { count: 1400, radius: 220 },
  // STATIC camera (no orbit/bob) — LOW oblique 3/4 view across the field so the
  // columns stand up, fill the frame, and their up/down motion is visible.
  camera: { fov: 64, height: 40, distance: 78, orbitSpeed: 0, bob: 0, lookAtY: 2.0 },
  post: { bloomStrength: 0.16, bloomRadius: 0.5, bloomThreshold: 0.78, vignette: 1.2, aberration: 0.01, grain: 0.028, bloomSpike: 0.06 },

  quality: 'high',           // 'low' | 'mid' | 'high' (quality.js applies presets)
  fpsCap: 60,
  maxPixelRatio: 2,
};
