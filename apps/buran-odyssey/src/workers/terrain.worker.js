// Builds terrain chunk geometry off the main thread. Each body's height
// provider is reconstructed here from plain data (definition + elevation
// rasters), so the worker samples exactly the surface the physics collides with.

import { SolHeightProvider, ProceduralHeightProvider, HeightMap } from '../world/heightfield.js';
import { buildChunkArrays } from '../world/chunkBuilder.js';
import { createNoise3D } from '../core/noise.js';
import { hashString } from '../core/rng.js';

const bodies = new Map();

self.onmessage = (e) => {
  const m = e.data;
  if (m.type === 'init') {
    const provider = m.desc.procedural
      ? new ProceduralHeightProvider(m.desc.procedural)
      : new SolHeightProvider({ id: m.desc.id, radius: m.desc.radius, def: m.desc.def });
    bodies.set(m.key, { provider, noise: createNoise3D(hashString(m.desc.id) ^ 0xabcdef) });
  } else if (m.type === 'raster') {
    const b = bodies.get(m.key);
    if (!b) return;
    const map = new HeightMap(m.data, m.w, m.h);
    if (m.which === 'height') b.provider.setMap(map);
    else b.provider.setOcean(map);
  } else if (m.type === 'drop') {
    bodies.delete(m.key);
  } else if (m.type === 'build') {
    const b = bodies.get(m.key);
    if (!b) {
      self.postMessage({ id: m.id, error: 'unknown body' });
      return;
    }
    const a = buildChunkArrays(m.job, b.provider, b.noise);
    self.postMessage({ id: m.id, a }, [
      a.position.buffer,
      a.normal.buffer,
      a.uv.buffer,
      a.color.buffer,
    ]);
  }
};
