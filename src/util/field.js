import { clamp, radialEnergy } from './math.js';

// Paraboloid dome: y = -curvature * r^2, with analytic normal (2k x, 1, 2k z).
export function buildPillarLayout(grid, spacing, curvature) {
  const c = (grid - 1) / 2;
  const maxR = Math.hypot(c * spacing, c * spacing) || 1;
  const out = [];
  for (let gx = 0; gx < grid; gx++) {
    for (let gz = 0; gz < grid; gz++) {
      const x = (gx - c) * spacing;
      const z = (gz - c) * spacing;
      const r = Math.hypot(x, z);
      const y = -curvature * r * r;
      // normal of y = -k(x^2+z^2): gradient (2k x, 1, 2k z)
      const nxRaw = 2 * curvature * x;
      const nzRaw = 2 * curvature * z;
      const len = Math.hypot(nxRaw, 1, nzRaw);
      out.push({
        x, y, z,
        nx: nxRaw / len, ny: 1 / len, nz: nzRaw / len,
        r, ringT: clamp(r / maxR, 0, 1),
      });
    }
  }
  return out;
}

export function ringBandIndex(ringT, bands) {
  return clamp(Math.round(ringT * (bands - 1)), 0, bands - 1);
}

// Idle breathing: deterministic layered sines (no RNG, test-friendly).
function idle(r, t, cfg) {
  return cfg.idleAmp * (0.5 + 0.5 * Math.sin(t * cfg.idleSpeed + r * 0.35));
}

export function pillarTargetHeight(ringT, r, spectrum, levels, t, cfg) {
  const band = ringBandIndex(ringT, spectrum.length);
  const base = cfg.baseHeight + radialEnergy(r, cfg.centerPeak, cfg.falloff);
  const reactive = spectrum[band] * cfg.reactive * (1 - 0.5 * ringT); // center reacts more
  return base + reactive + idle(r, t, cfg);
}
