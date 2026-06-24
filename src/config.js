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
    ramp: ['#0E1538', '#27387E', '#4E6BC0', '#9A8FE6', '#E8ECFF'], // near-black → deep-blue → cyan-blue → lavender → white-hot
    core: '#9AA6F2',         // cool lavender-blue reactor pulse (not white)
    accent: '#5FD0E0',       // cold-teal atmosphere accent
    deep: '#060A1C',         // cool deep-space color the far cubes recede into (darker + bluer than bg)
  },

  field: {
    centerPeak: 11.0,        // tall central spike -> a cluster of soaring towers, not a lit dome
    falloff: 26.0,           // tighter -> the tall cluster stays a cluster (inner radius), edges short
    baseHeight: 2.2,         // low floor so edges stay short and the center stands out
    reactive: 12.0,          // spectrum relief (eased so the center spreads, not spikes)
    jitter: 3.5,             // per-column random static height -> jagged independent-cube skyline
    idleAmp: 1.4,            // idle breathing so columns always visibly move
    idleSpeed: 0.55,
    stiffness: 90.0,         // legacy spring (superseded by attack/decay)
    damping: 14.0,
    attack: 0.5,             // fast rise
    decay: 0.90,             // slow fall per 1/60s
    segPitch: 1.2,           // taller segment blocks (matches taller columns)
    gapRatio: 0.14,          // dark gap fraction per segment
    pillarWidth: 1.95,       // narrower than the pitch -> clear gaps between cubes
    capThickness: 0.55,      // peak-hold cap thickness
    capSink: 0.985,          // cap sink per 1/60s (slow descent)
    capThreshold: 1.6,       // only cap pillars risen this far above base (restrained)
  },

  // depth fog -> from mid-field outward the far cubes sink into the cool
  // deep-space color while the foreground/core stay bright. The camera rig
  // re-derives near/far from the camera distance so the depth look holds while
  // tuning; these are the static fallback.
  fog: { near: 175, far: 330 },

  // beat-triggered radial shockwave rippling outward across the field
  wave: { speed: 40.0, width: 9.0, amp: 12.0, decay: 1.4 },

  core: { radius: 1.2, intensity: 0.2, pulse: 0.8, ringSpeed: 6.0 }, // dim + cool
  stars: { count: 1400, radius: 220 },
  // STATIC camera (no orbit/bob) — LOW oblique 3/4 view across the field so the
  // columns stand up, fill the frame, and their up/down motion is visible.
  // STATIC telephoto camera, expressed the intuitive way: a narrow FOV (long-lens
  // compression) looking DOWN at pitchDeg, from `distance` away, aimed straight
  // at the core (targetY). Higher pitch drops the core off the horizon into the
  // frame; lower FOV + bigger distance tightens perspective and enlarges the core.
  // Live-tune with ?tune (W/S pitch, Q/E fov, A/D distance, R/F targetY).
  camera: { fov: 35, pitchDeg: 30, distance: 190, targetY: 7, orbitSpeed: 0, bob: 0 },
  post: { bloomStrength: 0.10, bloomRadius: 0.5, bloomThreshold: 0.86, vignette: 1.2, aberration: 0.003, grain: 0.028, bloomSpike: 0.06 },

  quality: 'mid',            // 'low' | 'mid' | 'high' (quality.js applies presets; override live with ?q=)
  fpsCap: 30,                // preset overrides this
  maxPixelRatio: 1.25,       // preset overrides this
};
