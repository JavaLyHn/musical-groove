import { clamp, radialEnergy } from './math.js';

// Spherical cap: the square grid is wrapped onto a sphere of `sphereRadius`,
// apex at the origin (sphere centre at y = -sphereRadius). The cap spans polar
// angle [0, capAngle] from the apex, so edges curve down and away -> a curved
// planetary horizon. The outward sphere normal is already unit length.
export function buildPillarLayout(grid, spacing, sphereRadius, capAngle) {
  // Force an ODD grid so one column lands exactly at the centre (px=pz=0). With
  // an even grid the centre falls between cells, leaving a continuous gap along
  // the x=0 plane that runs straight away from the camera -> a black seam that
  // splits the bright core in two. An odd grid puts a solid ridge of columns
  // down the centre instead, so there is no seam to view edge-on.
  if (grid % 2 === 0) grid += 1;
  const c = (grid - 1) / 2;
  const maxR = Math.hypot(c * spacing, c * spacing) || 1;
  const out = [];
  for (let gx = 0; gx < grid; gx++) {
    for (let gz = 0; gz < grid; gz++) {
      const px = (gx - c) * spacing;
      const pz = (gz - c) * spacing;
      const r = Math.hypot(px, pz);
      const ringT = clamp(r / maxR, 0, 1);
      const phi = ringT * capAngle;        // polar angle from the cap apex
      const az = Math.atan2(pz, px);
      const sinP = Math.sin(phi);
      out.push({
        x: sphereRadius * sinP * Math.cos(az),
        y: sphereRadius * (Math.cos(phi) - 1), // apex y=0, edges dip below
        z: sphereRadius * sinP * Math.sin(az),
        nx: sinP * Math.cos(az),
        ny: Math.cos(phi),
        nz: sinP * Math.sin(az),
        r, ringT,
        phase: Math.random() * Math.PI * 2,   // per-column idle phase
        bias: Math.random(),                   // per-column height/reactivity bias
        bandJitter: Math.random() - 0.5,       // per-column FFT-band offset (granularity)
      });
    }
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
