const PRESETS = {
  low:  { grid: 48, stars: 700,  bloom: 0.4,  pixelRatio: 1 },
  mid:  { grid: 64, stars: 1000, bloom: 0.45, pixelRatio: 1.5 },
  high: { grid: 80, stars: 1400, bloom: 0.16, pixelRatio: 2 },
};

export function applyQuality(CONFIG) {
  const p = PRESETS[CONFIG.quality] || PRESETS.high;
  CONFIG.grid = p.grid;
  CONFIG.stars.count = p.stars;
  CONFIG.post.bloomStrength = p.bloom;
  CONFIG.maxPixelRatio = p.pixelRatio;
}
