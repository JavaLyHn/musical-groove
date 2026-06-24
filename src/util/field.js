import { clamp, radialEnergy } from './math.js';

// Spherical cap: the square grid is wrapped onto a sphere of `sphereRadius`,
// apex at the origin (sphere centre at y = -sphereRadius). The cap spans polar
// angle [0, capAngle] from the apex, so edges curve down and away -> a curved
// planetary horizon. The outward sphere normal is already unit length.
export function buildPillarLayout(grid, spacing, sphereRadius, capAngle) {
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

// `phase` and `bias` are per-column (from the layout). bias adds a fixed random
// height and varies the reactivity, so adjacent columns differ -> a jagged
// "thousands of independent cubes" skyline instead of a smooth radial shell.
export function pillarTargetHeight(ringT, r, spectrum, levels, t, cfg, phase = 0, bias = 0) {
  const band = ringBandIndex(ringT, spectrum.length);
  const base = cfg.baseHeight + radialEnergy(r, cfg.centerPeak, cfg.falloff) + bias * cfg.jitter;
  const reactive = spectrum[band] * cfg.reactive * (0.4 + 0.6 * bias) * (1 - 0.2 * ringT);
  return base + reactive + idle(phase, t, cfg);
}
