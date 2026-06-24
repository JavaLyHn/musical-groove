export const CONFIG = {
  bands: 64,
  grid: 40,
  spacing: 1.0,
  curvature: 0.022,          // paraboloid dip: y = -curvature * r^2

  colors: {
    bg0: '#070912',          // center of background gradient
    bg1: '#0d1430',          // outer / horizon
    low: '#2a3a8c',          // short / low-energy pillar
    mid: '#6a4fd0',          // mid
    high: '#d8d0ff',         // tall peak
    core: '#eef0ff',         // reactor core
  },

  field: {
    centerPeak: 6.0,         // radial base-height bump at center
    falloff: 11.0,           // gaussian falloff radius for centerPeak
    baseHeight: 0.6,         // minimum pillar height
    reactive: 9.0,           // how much spectrum drives height
    idleAmp: 0.9,            // idle breathing amplitude
    idleSpeed: 0.5,
    stiffness: 90.0,         // spring toward target height
    damping: 14.0,
    segPitch: 0.55,          // world height of one block segment
    gapRatio: 0.18,          // fraction of each segment that is a dark gap
    pillarWidth: 0.7,        // footprint (relative to spacing)
  },

  core: { radius: 1.6, intensity: 2.4, pulse: 3.0, ringSpeed: 6.0 },
  stars: { count: 1200, radius: 120 },
  camera: { fov: 38, height: 6.5, distance: 34, orbitSpeed: 0.03, bob: 1.2 },
  post: { bloomStrength: 0.9, bloomRadius: 0.6, bloomThreshold: 0.55, vignette: 1.1 },

  quality: 'high',           // 'low' | 'mid' | 'high' (Task 13 applies presets)
  fpsCap: 60,
  maxPixelRatio: 2,
};
