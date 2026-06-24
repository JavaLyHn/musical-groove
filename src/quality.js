const PRESETS = {
  low:  { grid: 26, stars: 500,  bloom: 0.55, pixelRatio: 1 },
  mid:  { grid: 34, stars: 900,  bloom: 0.7,  pixelRatio: 1.5 },
  high: { grid: 40, stars: 1200, bloom: 0.8,  pixelRatio: 2 },
};

export function applyQuality(CONFIG) {
  const p = PRESETS[CONFIG.quality] || PRESETS.high;
  CONFIG.grid = p.grid;
  CONFIG.stars.count = p.stars;
  CONFIG.post.bloomStrength = p.bloom;
  CONFIG.maxPixelRatio = p.pixelRatio;
}
