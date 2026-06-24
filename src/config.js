// @ts-check
// The shape of this literal IS the CONFIG type: TypeScript infers it and checks
// every reader (cameraRig, quality, …). Rename or drop a field here and the
// `// @ts-check` files that still reference the old name light up red.
export const CONFIG = {
  bands: 64,                 // VISUAL bands (mel-rebinned target)
  audioBins: 256,            // raw FFT bins the source produces (fftSize 512) -> finer band separation
  grid: 40,                  // base; the quality preset raises this at runtime
  spacing: 1.0,

  // Large, gently-curved sphere cap: a vast field that fills the frame and bends
  // only at a distant horizon.
  sphereRadius: 1150,
  capAngle: 0.18,            // wider cap: field radius (~206) now exceeds the camera's horizontal
                            // distance, so the near rim falls behind the camera -> foreground filled.
                            // Also widens the world spacing so the cubes have clear gaps again.

  colors: {
    bg0: '#0B1330',          // deep navy void (outer gradient + fog) — not pure black
    bg1: '#1B2A57',          // navy center-of-gradient glow
    ramp: ['#0E1538', '#27387E', '#4E6BC0', '#9A8FE6', '#E8ECFF'], // COOL: near-black → deep-blue → cyan-blue → lavender → white-hot
    rampWarm: ['#1A1024', '#7E2E3A', '#C0744E', '#E6A88F', '#FFEEE6'], // WARM: dark → maroon → terracotta → peach → warm-white (timbre blend)
    core: '#9AA6F2',         // cool lavender-blue reactor pulse (not white)
    accent: '#5FD0E0',       // cold-teal atmosphere accent
    deep: '#060A1C',         // cool deep-space color the far cubes recede into (darker + bluer than bg)
  },

  field: {
    // CORRECT structure: the idle floor always covers the WHOLE dome; the overall
    // `level` (volume) scales the audio AMPLITUDE on top; and the per-band shaped
    // spectrum (see `shaper`) decides which rings rise — so each ring dances on its
    // own band. Volume controls height, NOT the lit area.
    centerPeak: 1.5,         // small STATIC core mound so the centre is always anchored
    falloff: 26.0,           // shaping of that small static core mound
    baseHeight: 2.0,         // low floor; quiet/edge columns sit here
    reactive: 19.0,          // height gain on the (already-normalized) audio drive
    ampPow: 1.8,             // drive^1.8 -> transients spike into thin tall towers
    bandScatter: 0.28,       // per-column band scatter -> granular, neighbours move independently
    jitter: 1.2,             // a little STATIC per-column height for texture
    radialBias: 0.4,         // gentle centre emphasis (w = 1 - radialBias*ringT); NOT a volume gate
    idleAmp: 1.5,            // idle floor amplitude — covers the whole dome, never zero
    idleSpeed: 0.55,
    stiffness: 90.0,         // legacy spring (superseded by attack/decay)
    damping: 14.0,
    attack: 0.5,             // fast rise (surge up)
    decay: 0.92,             // slow fall per 1/60s (melt down)
    heightScale: 1.8,        // master multiplier on the GPU audio elevation (per-band motifs)
    whiteElev: 13.0,         // elevation for full white-hot (high -> field sinks dark, only tall peaks burn)
    coreBoost: 1.6,          // emissive radial weight: centre x1.6, edge x1.0 -> a hot core floats out
    emissiveGain: 0.6,       // overall emissive exposure cut (dark field; ripples bypass it)
    brightSpan: 0.62,        // (legacy CPU path) a column is fully white-hot at baseHeight + reactive*brightSpan
    brightPow: 1.8,          // emissive curve exponent
    brightFloor: 0.2,        // dark-blue floor: below this (normalized elevation) a column stays dark ->
                             //   dark field + hot core contrast holds even at the loudest moment
    radialDim: 0.30,         // mild edge dimming for depth (height now carries most of the brightness)
    segPitch: 1.2,           // taller segment blocks (matches taller columns)
    gapRatio: 0.14,          // dark gap fraction per segment
    pillarWidth: 1.95,       // narrower than the pitch -> clear gaps between cubes
    capThickness: 0.55,      // peak-hold cap thickness
    capSink: 0.985,          // cap sink per 1/60s (slow descent)
    capThreshold: 1.6,       // only cap pillars risen this far above base (restrained)
  },

  // MOTION over time + space. The hero is the RADIAL PHASE DELAY: each ring reads the
  // band history delayed by its radius, so a beat sweeps from the centre outward as a
  // visible wave instead of the whole field punching at once. Plus per-band envelopes
  // (each band its own attack/decay) and a killed common mode (loudness barely scales
  // height) so low freq pumps slowly at the centre while highs jitter on the rim.
  motion: {
    radialDelay: 36,    // delay span centre->rim, in history rows (~0.6s at 60fps)
    levelFloor: 0.65,   // common-mode kill: loudness only scales height 0.65..1; per-band drive decides WHAT moves
    bandAtkSlow: 0.16,  // low-band attack: slow rise (big swell)
    bandAtkFast: 0.55,  // high-band attack: snappy rise (sharp hits)
    bandDecSlow: 0.95,  // low-band decay per 60fps: slow melt
    bandDecFast: 0.85,  // high-band decay per 60fps: fast fall (sparkle)
    // persistent TRAVELING WAVE: a directional sweep always flowing over the field
    // (wind), even between beats. Direction rotates slowly; amplitude swells with mids.
    waveAmp: 2.0,       // height of the wind undulation
    waveFreq: 0.03,     // spatial frequency across the field (~2 crests over the diameter)
    waveSpeed: 1.2,     // how fast the crests travel
    waveRot: 0.04,      // how fast the wind direction rotates (rad/s — full turn ~2.6min)
    // sparse hard ACCENTS: on each transient a few random columns punch to max + flash,
    // then fall in a few frames — sparks on a calm base (the other half of the energy).
    accentHeight: 9.0,  // how tall an accent punches
    accentDecay: 7.0,   // accent fall-off (e^-age*decay): ~0.15s flash
    accentThresh: 0.93, // sparsity: columns with hash >= this spike (~7% per transient)
    // IDLE standby wave: don't hard-cut a floor — fade an autonomous soft wave IN only
    // after sustained silence (debounce), and OUT when music returns (transition). This
    // keeps standby from fighting the music and cures the quiet-section collapse/flicker.
    idleSilence: 0.045, // overall level below this counts as "silent"
    idleDebounce: 1.0,  // seconds of silence before the standby wave fades in
    idleTransition: 1.0,// seconds to fade the standby wave in / out
  },

  // RIPPLES are a first-class reaction now: an independent (sensitivity, cooldown) pair
  // fed the audio onset. cooldown 0 = fire on every strong-enough beat, so rings overlap
  // into interference (the radial phase delay was its prototype). Low threshold = lively.
  ripple: { sensitivity: 0.1, cooldown: 0 },
  // METEORS: rare, ceremonial streaks — only the biggest transients, with a long cooldown
  // (frames), so they read as the occasional shooting star, not a constant spark cloud.
  meteor: { sensitivity: 0.2, cooldown: 200 },

  // depth fog -> from mid-field outward the far cubes sink into the cool
  // deep-space color while the foreground/core stay bright. The camera rig
  // re-derives near/far from the camera distance so the depth look holds while
  // tuning; these are the static fallback.
  fog: { near: 175, far: 330 },

  // beat ripple in the GPU shader (field world coords; the cap spans ~±132):
  // a ring expanding from the core, sweeping the field in ~0.6-0.7s. width = the
  // gaussian falloff scale of the ring; decay = exp(-age*decay) brightness fade.
  wave: { speed: 320.0, width: 30.0, decay: 1.2 },

  // floating embers: additive white sparks that burst from the core on strong
  // beats and slowly drift up + fade — the "alive, has energy" top layer.
  // RARE meteors (not a constant spark cloud): each fires on a big onset (CONFIG.meteor)
  // as a directional streak of `meteorTrail` points sharing a velocity, the tail staggered
  // older so it fades behind the head. `count` is just the recycled point-pool size.
  sparks: {
    count: 420, life: 2.4, size: 2.2,
    rise: 6.0, spread: 11.0, spawnR: 38, spawnYmin: 5, spawnYmax: 17,
    meteorTrail: 16, meteorSpeed: 72,
  },

  // spectral-flux beat detection (adaptive threshold). Fed the RAW spectrum.
  // kick = low band -> radial ring + ember burst; hat = high band -> light sprinkle.
  beat: {
    // sensitivity maps to the adaptive threshold: thresh = mean + (5 - 4*sensitivity)*std.
    // ~0.7 => mean + ~2*std, so a steady kick keeps firing instead of adapting away.
    kick: { bandStart: 0,  bandEnd: 6,   sensitivity: 0.72, cooldown: 0.22, strength: 0.34, maxStrength: 1.3, historyLen: 43 },
    hat:  { bandStart: 60, bandEnd: 110, sensitivity: 0.66, cooldown: 0.16, strength: 0.40, maxStrength: 1.0, historyLen: 43 },
  },

  // audio shaper: mel re-bin + PER-BAND normalization (each band ÷ its own rolling
  // mean) so every ring dances on its own band, + an overall `level` for amplitude.
  shaper: {
    bandEps: 0.04,           // per-band noise floor: lower -> weak high bands lift the outer rings more
    bandGain: 0.55,          // per-band drive scale: a steady band reads ~0.55, transients -> 1
    meanTau: 1.5,            // per-band rolling-mean time constant (s)
    peakTau: 2.5,            // overall-level rolling-peak decay (s): within-song dynamics + cross-song anchor
    peakFloor: 0.04,         // min overall peak -> caps how much a near-silent track is amplified
  },

  core: { radius: 1.2, intensity: 0.2, pulse: 0.8, ringSpeed: 6.0 }, // dim + cool
  stars: { count: 1400, radius: 220 },
  // STATIC camera (no orbit/bob) — LOW oblique 3/4 view across the field so the
  // columns stand up, fill the frame, and their up/down motion is visible.
  // STATIC telephoto camera, expressed the intuitive way: a narrow FOV (long-lens
  // compression) looking DOWN at pitchDeg, from `distance` away, aimed straight
  // at the core (targetY). Higher pitch drops the core off the horizon into the
  // frame; lower FOV + bigger distance tightens perspective and enlarges the core.
  // Live-tune with ?tune (W/S pitch, Q/E fov, A/D distance, R/F targetY).
  // Aligned with the reference: low oblique view (pitch 25), azimuth 120, slow auto-spin
  // (orbitSpeed ~0.2 rad/s). distance/fov stay tuned for OUR world scale (~10x the
  // reference — its 85 would bury the camera inside our field); dial them live with ?gui.
  camera: { fov: 35, pitchDeg: 25, distance: 190, targetY: 7, azimuthDeg: 120, orbitSpeed: 0.2, bob: 0 },
  post: {
    bloomStrength: 0.13, bloomRadius: 0.55, bloomThreshold: 0.80,
    vignette: 1.2, aberration: 0.003, grain: 0.028, bloomSpike: 0.06,
    // single adjustable ACCENT colour washed over the bloom (the cool/tech glow). Set
    // accentIntensity 0 to disable; swap accentColor to shift the whole mood blue<->warm.
    accentColor: '#5FD0E0', accentIntensity: 0.0,
  },

  quality: 'high',           // 'low' | 'mid' | 'high' (quality.js applies presets; override live with ?q=)
  fpsCap: 30,                // preset overrides this
  maxPixelRatio: 1.25,       // preset overrides this
};
