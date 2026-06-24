// @ts-check
// Pick a representative, VIVID colour from album artwork to tint the scene with.
// A plain average washes out to grey, so we weight each pixel by its saturation and
// drop near-black / near-white pixels (they carry no usable hue). The result is
// scaled so its brightest channel is ~1 — i.e. a pure HUE tint that recolours the
// field without darkening it. Returns null when there's no usable hue (transparent /
// pure black-or-white / essentially grey artwork) so the caller leaves the scene as-is.

/**
 * @param {Uint8ClampedArray | number[]} rgba  flat RGBA bytes (0..255)
 * @param {number} [step]  sample every `step`-th pixel (1 = all)
 * @returns {[number, number, number] | null}  rgb in 0..1, max channel ~1
 */
export function dominantColor(rgba, step = 1) {
  let r = 0, g = 0, b = 0, wsum = 0;
  const stride = 4 * Math.max(1, step | 0);
  for (let i = 0; i + 3 < rgba.length; i += stride) {
    const R = rgba[i] / 255, G = rgba[i + 1] / 255, B = rgba[i + 2] / 255, A = rgba[i + 3] / 255;
    if (A < 0.5) continue;
    const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
    const lum = 0.299 * R + 0.587 * G + 0.114 * B;
    if (lum < 0.06 || lum > 0.96) continue;       // skip near-black / near-white
    const sat = mx <= 0 ? 0 : (mx - mn) / mx;       // HSV saturation
    const w = sat * sat + 0.02;                     // vivid pixels dominate the average
    r += R * w; g += G * w; b += B * w; wsum += w;
  }
  if (wsum <= 0) return null;
  r /= wsum; g /= wsum; b /= wsum;
  const mx = Math.max(r, g, b);
  if (mx <= 0.001) return null;
  const rr = r / mx, gg = g / mx, bb = b / mx;      // normalize to a hue tint
  const chroma = 1 - Math.min(rr, gg, bb);          // 0 = grey, 1 = fully saturated
  if (chroma < 0.12) return null;                   // grey art -> no tint
  return [rr, gg, bb];
}

/**
 * Browser-only: extract the dominant colour from a loaded <img> by drawing it small
 * and sampling. Returns null if the canvas is tainted or the art is grey.
 * @param {HTMLImageElement} img  must be fully loaded
 * @param {number} [size]
 * @returns {[number, number, number] | null}
 */
export function coverColorFromImage(img, size = 24) {
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, size, size);
  try {
    const { data } = ctx.getImageData(0, 0, size, size);
    return dominantColor(data, 1);
  } catch {
    return null; // tainted canvas (shouldn't happen for same-origin data: URIs)
  }
}
