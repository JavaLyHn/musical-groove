// @ts-check
// The shape of this literal IS the CONFIG type: TypeScript infers it and checks
// every reader (cameraRig, quality, …). Rename or drop a field here and the
// `// @ts-check` files that still reference the old name light up red.
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
    // AUDIO is the primary HEIGHT driver. The centre stands tall because the
    // bass band (mapped to the centre) is loud, not because of a frozen bump —
    // and brightness then FOLLOWS height (see brightSpan/brightPow below), so a
    // column shoots up and whitens together instead of lights flashing on flat ground.
    centerPeak: 1.5,         // small STATIC centre bias (was 11) — audio now makes the centre tall
    falloff: 26.0,           // shaping of that small static centre bias
    baseHeight: 2.0,         // low floor; quiet/edge columns sit here
    reactive: 19.0,          // BIG height gain -> tallest columns reach ~8-10x base on peaks
    ampPow: 1.8,             // height ∝ amp^1.8 -> loud bands spike disproportionately (thin tall towers)
    bandScatter: 0.28,       // per-column FFT-band scatter -> granular, neighbours move independently
    jitter: 1.2,             // a little STATIC per-column height for texture (was 3.5)
    idleAmp: 1.0,            // gentle breathing so it's never dead in silence
    idleSpeed: 0.55,
    stiffness: 90.0,         // legacy spring (superseded by attack/decay)
    damping: 14.0,
    attack: 0.5,             // fast rise (surge up)
    decay: 0.92,             // slow fall per 1/60s (melt down)
    brightSpan: 0.62,        // a column is fully white-hot at height = baseHeight + reactive*brightSpan
    brightPow: 1.8,          // emissive curve exponent
    brightFloor: 0.15,       // dark-blue floor: below this (after pow) a column stays dark, not lit ->
                             //   dark field + hot core contrast holds even at the loudest moment
    radialDim: 0.30,         // mild edge dimming for depth (height now carries most of the brightness)
    activeRmin: 0.6,         // quietest active radius (never collapses to a point); grows to 1.0 with level
    activeSoft: 0.25,        // soft falloff width at the active-radius edge
    idleFloorR: 0.3,         // idle floor reaches a bit past the active radius so edges keep faint life
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

  // beat-triggered ripple: a height shockwave AND a brightness ring expanding
  // from the core outward, sweeping the whole field in ~0.6-0.7s.
  wave: { speed: 85.0, width: 10.0, amp: 12.0, decay: 1.0, bright: 0.5 },

  // floating embers: additive white sparks that burst from the core on strong
  // beats and slowly drift up + fade — the "alive, has energy" top layer.
  sparks: {
    count: 420, burst: 44, life: 2.6, size: 2.0,
    rise: 6.0, spread: 11.0, spawnR: 38, spawnYmin: 5, spawnYmax: 17,
    threshold: 0.5, edge: 0.08,
  },

  // auto-gain: rolling-peak normalization of the audio input so the picture is
  // anchored to the same look regardless of how loud/quiet the track is.
  agc: { tau: 2.5, floor: 0.32 },   // tau = peak decay time (s); floor caps the max gain at 1/floor

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
  post: { bloomStrength: 0.10, bloomRadius: 0.5, bloomThreshold: 0.90, vignette: 1.2, aberration: 0.003, grain: 0.028, bloomSpike: 0.06 },

  quality: 'high',           // 'low' | 'mid' | 'high' (quality.js applies presets; override live with ?q=)
  fpsCap: 30,                // preset overrides this
  maxPixelRatio: 1.25,       // preset overrides this
};
