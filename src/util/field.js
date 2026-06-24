import { clamp, lerp, smoothstep, radialEnergy } from './math.js';

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
// `level` is the AGC-normalized overall loudness (0..1).
//
// Two-sided range control:
//  - AUDIO drives height through a power curve (thin tall spikes), but it is
//    bounded by the AGC upstream so the loudest moment can't run away.
//  - height = max(idleFloor, audio): a gentle, ever-present idle floor means the
//    dome never collapses to nothing in silence.
//  - the active radius grows with `level` but never below activeRmin, so a quiet
//    passage shrinks the field gently instead of crushing it to a point.
export function pillarTargetHeight(ringT, r, spectrum, levels, t, cfg, phase = 0, bias = 0, bandJitter = 0, level = 0) {
  // Per-column band scatter: neighbours read different FFT bins and move
  // independently (granular) — no single disk pulsing — while the radial trend
  // (centre = bass, edge = treble) is preserved.
  const band = ringBandIndex(ringT + cfg.bandScatter * bandJitter, spectrum.length);
  const a = spectrum[band];

  // Active radius: grows with loudness, floored at activeRmin (no collapse to a point).
  const activeR = lerp(cfg.activeRmin, 1.0, level);
  const radial = 1 - smoothstep(activeR, activeR + cfg.activeSoft, ringT); // 1 inside, soft to 0 beyond

  // Audio-driven height (power curve -> loud bands spike into thin tall towers).
  const audioH =
    (Math.pow(a, cfg.ampPow) * cfg.reactive * (0.5 + 0.5 * bias) +
      radialEnergy(r, cfg.centerPeak, cfg.falloff)) * radial;

  // Ever-present idle floor: per-column shimmer + a slow radial swell + a little
  // per-column static height, so the dome breathes and glows faintly in silence.
  const idleH =
    (cfg.idleAmp * (0.5 + 0.5 * Math.sin(t * cfg.idleSpeed + phase)) +
      cfg.idleAmp * 0.6 * (0.5 + 0.5 * Math.sin(t * 0.3 + r * 0.12)) +
      bias * cfg.jitter) * Math.max(radial, cfg.idleFloorR);

  // height = max(idle floor, audio): audio lifts above the floor, never below it.
  return cfg.baseHeight + Math.max(idleH, audioH);
}
