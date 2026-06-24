import { clamp, radialEnergy } from './math.js';

// Spherical cap via a FIBONACCI (golden-angle) distribution: N points spiral out
// from the apex, with no rows or columns — so there is no longitude grout line to
// view edge-on (the old square grid left a vertical seam through the centre). The
// cap spans polar angle [0, capAngle]; ringT = sqrt(t) gives roughly uniform areal
// density. `grid` only sets the count (N = grid*grid) for parity with the presets.
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
export function buildPillarLayout(grid, spacing, sphereRadius, capAngle) {
  const n = grid * grid;
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const ringT = Math.sqrt(t);            // 0 at apex -> 1 at rim, uniform areal density
    const phi = ringT * capAngle;          // polar angle from the cap apex
    const az = i * GOLDEN_ANGLE;
    const sinP = Math.sin(phi);
    const cosP = Math.cos(phi);
    const x = sphereRadius * sinP * Math.cos(az);
    const z = sphereRadius * sinP * Math.sin(az);
    out.push({
      x,
      y: sphereRadius * (cosP - 1),         // apex y=0, edges dip below
      z,
      nx: sinP * Math.cos(az),
      ny: cosP,
      nz: sinP * Math.sin(az),
      r: Math.hypot(x, z),
      ringT,
      phase: Math.random() * Math.PI * 2,   // per-column idle phase
      bias: Math.random(),                   // per-column height/reactivity bias
      bandJitter: Math.random() - 0.5,       // per-column FFT-band offset (granularity)
    });
  }
  return out;
}

export function ringBandIndex(ringT, bands) {
  return clamp(Math.round(ringT * (bands - 1)), 0, bands - 1);
}

// `phase`, `bias`, `bandJitter` are per-column (from the layout). They make
// adjacent columns differ -> a jagged "thousands of independent cubes" skyline.
// `spectrum` is the SHAPED (mel + per-band-normalized) drive, `level` is the
// overall amplitude (0..1).
//
// The structure that fixes white-out + collapse + dead edges at once:
//  - idle floor: ALWAYS present across the WHOLE dome, so the field never
//    collapses to a point and always covers the dome (volume != lit area).
//  - audio on top: `level` scales the AMPLITUDE (loud = generally taller), while
//    the per-band drive decides WHICH rings rise — each ring on its own band, so
//    the outer rings live and a loud moment spreads across the field instead of
//    blowing the centre into one white blob.
export function pillarTargetHeight(ringT, r, spectrum, levels, t, cfg, phase = 0, bias = 0, bandJitter = 0, level = 0) {
  // Per-column band scatter: neighbours read different (perceptual) bands and move
  // independently; the radial trend (centre = low freq, edge = high freq) holds.
  const band = ringBandIndex(ringT + cfg.bandScatter * bandJitter, spectrum.length);
  const drive = spectrum[band];                 // per-band normalized: every ring comparable
  const w = 1 - cfg.radialBias * ringT;         // gentle centre emphasis (NOT a volume gate)

  // Audio amplitude = overall volume × this ring's drive (power curve -> thin spikes).
  const audioH = level * Math.pow(drive, cfg.ampPow) * cfg.reactive * (0.5 + 0.5 * bias) * w;

  // Idle floor: per-column shimmer + a slow radial swell, present across the WHOLE
  // dome at all times (full coverage, never zero), plus a touch of static texture.
  const idleH =
    cfg.idleAmp * (0.5 + 0.5 * Math.sin(t * cfg.idleSpeed + phase)) +
    cfg.idleAmp * 0.6 * (0.5 + 0.5 * Math.sin(t * 0.3 + r * 0.12)) +
    bias * cfg.jitter;

  // small static core mound so the centre is always anchored
  const coreBias = radialEnergy(r, cfg.centerPeak, cfg.falloff);

  return cfg.baseHeight + idleH + coreBias + audioH;
}
