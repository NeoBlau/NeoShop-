// Paints equirectangular colour maps for procedural worlds, gas giants and
// cloud decks. Runs the exact same generator functions as the terrain.

import { createGiantSurface, createProceduralSurface } from '../world/planetGen.js';
import { createNoise3D, warped, fbm } from '../core/noise.js';

self.onmessage = (e) => {
  const { id, kind, params, width, height } = e.data;
  const data = new Uint8ClampedArray(width * height * 4);
  const out = [0, 0, 0];
  let surf = null;
  let clouds = null;
  if (kind === 'surface') surf = createProceduralSurface(params);
  else if (kind === 'giant') surf = createGiantSurface(params);
  else if (kind === 'clouds') clouds = createNoise3D(params.seed);
  // Height is sampled at roughly the texel size.
  const wl = ((2 * Math.PI * (params.radius || 1e6)) / width) * 1.5;
  for (let j = 0; j < height; j++) {
    const lat = ((j + 0.5) / height - 0.5) * Math.PI;
    const cl = Math.cos(lat),
      sl = Math.sin(lat);
    for (let i = 0; i < width; i++) {
      const lon = ((i + 0.5) / width - 0.5) * 2 * Math.PI;
      const x = cl * Math.cos(lon),
        y = cl * Math.sin(lon),
        z = sl;
      const k = (j * width + i) * 4;
      if (clouds) {
        // Venus-like super-rotating sulphuric acid deck: chevrons + streaks.
        const s = warped(clouds, x * 2.2, y * 2.2, z * 6, 5, 1.4);
        const streak = fbm(clouds, x * 3, y * 3, z * 22, 4);
        const v = 0.78 + 0.16 * s + 0.08 * streak;
        const c = params.color;
        data[k] = 255 * Math.min(1, c[0] * v);
        data[k + 1] = 255 * Math.min(1, c[1] * v);
        data[k + 2] = 255 * Math.min(1, c[2] * v);
        data[k + 3] = 255 * Math.min(1, params.opacity * (0.85 + 0.15 * s));
        continue;
      }
      const h = surf.height(x, y, z, wl);
      surf.color(x, y, z, h, out);
      data[k] = out[0] * 255;
      data[k + 1] = out[1] * 255;
      data[k + 2] = out[2] * 255;
      data[k + 3] = 255;
    }
  }
  self.postMessage({ id, buffer: data.buffer, width, height }, [data.buffer]);
};
