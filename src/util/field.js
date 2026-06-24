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

// Idle breathing per column (phase varies per column -> neighbours bounce out of
// sync, reading as independent cubes rather than a breathing shell).
function idle(phase, t, cfg) {
  return cfg.idleAmp * (0.5 + 0.5 * Math.sin(t * cfg.idleSpeed + phase));
}

// `phase` and `bias` are per-column (from the layout). bias varies the
// reactivity (and adds a touch of static height), so adjacent columns differ ->
// a jagged "thousands of independent cubes" skyline instead of a smooth shell.
//
// AUDIO is the dominant term: `spectrum[band] * reactive` is large, so columns
// visibly surge and fall with the music; the static centre bias and jitter are
// small. Everything is weighted toward the centre (w) so energy concentrates there.
export function pillarTargetHeight(ringT, r, spectrum, levels, t, cfg, phase = 0, bias = 0, bandJitter = 0) {
  // Per-column band scatter: neighbours read different FFT bins and move
  // independently (granular) — no single disk pulsing — while the radial trend
  // (centre = bass, edge = treble) is preserved.
  const band = ringBandIndex(ringT + cfg.bandScatter * bandJitter, spectrum.length);
  const a = spectrum[band];                    // this column's band amplitude (0..1)
  const w = 1 - 0.85 * ringT;                  // radial weight: centre moves most, edges least
  const drive =
    Math.pow(a, cfg.ampPow) * cfg.reactive * (0.5 + 0.5 * bias) + // power curve -> loud bands spike into thin tall towers
    radialEnergy(r, cfg.centerPeak, cfg.falloff) + // small static centre bias
    bias * cfg.jitter +                        // per-column static texture (independent cubes)
    idle(phase, t, cfg);                       // gentle breathing so it's never dead
  return cfg.baseHeight + drive * w;
}
