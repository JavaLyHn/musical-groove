// @ts-check
// Tuned to run quietly always-on as a wallpaper. The big GPU costs are render
// resolution (pixelRatio², multiplied again by bloom's fullscreen passes) and
// frame rate — so those are capped hard; grid (cube count) is trimmed second.
/** @type {Record<string, { grid: number, stars: number, bloom: number, pixelRatio: number, fpsCap: number }>} */
const PRESETS = {
  low:  { grid: 64,  stars: 600,  bloom: 0.16, pixelRatio: 1,    fpsCap: 30 },
  mid:  { grid: 84,  stars: 900,  bloom: 0.16, pixelRatio: 1.25, fpsCap: 30 },
  high: { grid: 100, stars: 1200, bloom: 0.16, pixelRatio: 1.5,  fpsCap: 60 },
};

/** @param {typeof import('./config.js').CONFIG} CONFIG */
export function applyQuality(CONFIG) {
  const p = PRESETS[CONFIG.quality] || PRESETS.mid;
  CONFIG.grid = p.grid;
  CONFIG.stars.count = p.stars;
  CONFIG.post.bloomStrength = p.bloom;
  CONFIG.maxPixelRatio = p.pixelRatio;
  CONFIG.fpsCap = p.fpsCap;
}
