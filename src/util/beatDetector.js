import { CONFIG } from '../config.js';

// Spectral-flux onset detection with an adaptive threshold (ported in spirit from
// sonic-topography's AudioEngine). For a band range it measures the positive
// spectral flux (how much energy just RoSE), smooths it, and fires when the flux
// peaks above mean + k·stdDev of its own recent history — so it adapts to the
// track's dynamics and fires on real beats, not on a fixed level. Time-based
// cooldown keeps it framerate-independent. Feed it the RAW (pre-shaped) spectrum.
function createFluxTrigger(cfg) {
  const histLen = cfg.historyLen || 43;
  const hist = new Float32Array(histLen);
  let hi = 0;
  let smoothed = 0;
  let prevSmoothed = 0;
  let cooldown = 0;
  /** @type {Float32Array|null} */
  let prev = null;

  return function process(spec, dt) {
    if (!prev || prev.length !== spec.length) {
      prev = new Float32Array(spec.length);
      prev.set(spec);
      return 0; // prime on the first frame so the cold-start flux isn't a false beat
    }
    let flux = 0;
    const end = Math.min(cfg.bandEnd, spec.length - 1);
    for (let i = cfg.bandStart; i <= end; i++) {
      const d = spec[i] - prev[i];
      if (d > 0) flux += d;
    }
    for (let i = 0; i < spec.length; i++) prev[i] = spec[i];

    smoothed += (flux - smoothed) * 0.4;
    hist[hi] = smoothed;
    hi = (hi + 1) % histLen;

    let avg = 0;
    for (let i = 0; i < histLen; i++) avg += hist[i];
    avg /= histLen;
    let varr = 0;
    for (let i = 0; i < histLen; i++) { const x = hist[i] - avg; varr += x * x; }
    const std = Math.sqrt(varr / histLen);

    const threshMult = Math.max(0.1, 5.0 - cfg.sensitivity * 4.0);
    const adaptive = Math.max(0.02, avg + std * threshMult);
    const isPeak = prevSmoothed > adaptive && prevSmoothed >= smoothed;

    let strength = 0;
    if (cooldown > 0) {
      cooldown -= dt;
    } else if (isPeak && prevSmoothed - smoothed > 1e-4) {
      strength = Math.min(prevSmoothed * 3.0 * cfg.strength, cfg.maxStrength);
      cooldown = cfg.cooldown;
    }
    prevSmoothed = smoothed;
    return strength;
  };
}

// Two independent triggers: a low-band "kick" (downbeat -> radial ring + ember
// burst) and a high-band "hat" (hi-hat/snare -> light sprinkle).
export function createBeatDetector() {
  const c = CONFIG.beat;
  const kick = createFluxTrigger(c.kick);
  const hat = createFluxTrigger(c.hat);
  return {
    process(spec, dt) {
      return { kick: kick(spec, dt), hat: hat(spec, dt) };
    },
  };
}
