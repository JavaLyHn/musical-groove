import { CONFIG } from '../config.js';
import { clamp } from './math.js';

// Reshape a linear FFT magnitude spectrum so EVERY ring dances on its own band,
// not just the bass-heavy centre. Two transforms + an overall amplitude:
//
//  1) mel / log re-bin: musical energy clusters in the lowest few linear bins;
//     spread it across `outBands` log-spaced perceptual bands so the whole field
//     gets content.
//  2) per-band normalization: divide each band by its OWN slow rolling mean (with
//     an absolute noise floor `bandEps`). A weak high band then pushes its ring as
//     hard as loud bass pushes the centre — but a near-silent band still reads ~0,
//     so it's signal-following, not noise-amplifying.
//  3) overall `level` (0..1): the smoothed loudness normalized by a slow rolling
//     peak — this is what scales the whole field's AMPLITUDE (loud = generally
//     taller/brighter, quiet = shorter/dimmer), while (1)+(2) decide the SHAPE.
//
// So: the field always covers the dome (idle floor elsewhere), `level` controls
// how high it heaves, and the per-band spectrum decides which rings rise.
export function createAudioShaper(rawBands, outBands = rawBands, opts = {}) {
  const c = CONFIG.shaper;
  const eps = opts.eps ?? c.bandEps;
  const gain = opts.gain ?? c.bandGain;
  const meanTau = opts.meanTau ?? c.meanTau;
  const peakTau = opts.peakTau ?? c.peakTau;
  const peakFloor = opts.peakFloor ?? c.peakFloor;

  // Log-spaced bin ranges: output band o aggregates raw bins [edge[o], edge[o+1]).
  const edges = new Int32Array(outBands + 1);
  const minBin = 1; // skip DC
  const maxBin = rawBands;
  for (let o = 0; o <= outBands; o++) {
    const p = o / outBands;
    edges[o] = Math.min(maxBin, Math.max(minBin, Math.round(minBin * Math.pow(maxBin / minBin, p))));
  }

  const mean = new Float32Array(outBands).fill(eps);
  const out = new Float32Array(outBands);
  let gLevel = 0;
  let gPeak = peakFloor;

  return {
    process(raw, dt) {
      const km = 1 - Math.exp(-Math.max(dt, 0) / meanTau);
      let sum = 0;
      for (let o = 0; o < outBands; o++) {
        const lo = edges[o];
        const hi = Math.max(edges[o + 1], lo + 1);
        let m = 0;
        for (let i = lo; i < hi; i++) m += raw[i];
        m /= hi - lo;                              // mel band magnitude
        mean[o] += (m - mean[o]) * km;             // slow rolling mean
        out[o] = clamp((m / (mean[o] + eps)) * gain, 0, 1); // ~gain steady, >1 transient, ~0 in silence
        sum += m;
      }
      // overall amplitude: smoothed loudness / slow rolling peak (within-song
      // dynamics + cross-song anchoring; floored so a quiet track isn't over-amplified)
      const rawLevel = sum / outBands;
      gLevel += (rawLevel - gLevel) * (1 - Math.exp(-Math.max(dt, 0) / 0.12));
      gPeak = Math.max(gLevel, gPeak * Math.exp(-Math.max(dt, 0) / peakTau), peakFloor);
      const level = clamp(gLevel / gPeak, 0, 1);

      const third = Math.floor(outBands / 3);
      const avg = (a, b) => { let s = 0; for (let i = a; i < b; i++) s += out[i]; return clamp(s / (b - a), 0, 1); };
      return {
        spectrum: out,
        level,
        levels: { bass: avg(0, third), mid: avg(third, 2 * third), treble: avg(2 * third, outBands) },
      };
    },
  };
}
