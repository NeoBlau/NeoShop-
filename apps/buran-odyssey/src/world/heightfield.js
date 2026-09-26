// Height providers. Solar System bodies combine a real global elevation model
// (MOLA for Mars, LOLA for the Moon, MLA for Mercury, Magellan for Venus,
// ETOPO-derived for Earth, New Horizons for Pluto) with analytic landmarks,
// crater populations and spectral noise below the map resolution.

import { createNoise3D } from '../core/noise.js';
import { hashString } from '../core/rng.js';
import {
  createCraterField,
  createProceduralSurface,
  marsFeatures,
  spectralNoise,
} from './planetGen.js';

export class HeightMap {
  constructor(data, width, height) {
    this.data = data;
    this.w = width;
    this.h = height;
  }

  static fromImage(img, maxWidth = 4096, blur = 1) {
    const w = Math.min(maxWidth, img.width);
    const h = Math.round((w * img.height) / img.width);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    const px = ctx.getImageData(0, 0, w, h).data;
    let data = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      data[i] = (0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2]) / 255;
    }
    // Separable box blur removes the 8-bit quantisation terraces.
    for (let pass = 0; pass < blur; pass++) {
      const tmp = new Float32Array(w * h);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const l = data[y * w + ((x - 1 + w) % w)],
            c = data[y * w + x],
            r = data[y * w + ((x + 1) % w)];
          tmp[y * w + x] = (l + 2 * c + r) / 4;
        }
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const u = tmp[Math.max(0, y - 1) * w + x],
            c = tmp[y * w + x],
            d = tmp[Math.min(h - 1, y + 1) * w + x];
          data[y * w + x] = (u + 2 * c + d) / 4;
        }
    }
    return new HeightMap(data, w, h);
  }

  _px(x, y) {
    x = ((x % this.w) + this.w) % this.w;
    y = y < 0 ? 0 : y >= this.h ? this.h - 1 : y;
    return this.data[y * this.w + x];
  }

  // Bicubic (Catmull-Rom) sample at a unit direction; row 0 is the north edge,
  // column 0 is longitude −180°.
  sampleDir(x, y, z) {
    const lon = Math.atan2(y, x);
    const lat = Math.asin(z < -1 ? -1 : z > 1 ? 1 : z);
    const fx = (lon / (2 * Math.PI) + 0.5) * this.w - 0.5;
    const fy = (0.5 - lat / Math.PI) * this.h - 0.5;
    const ix = Math.floor(fx),
      iy = Math.floor(fy);
    const tx = fx - ix,
      ty = fy - iy;
    const rows = [0, 0, 0, 0];
    for (let j = -1; j <= 2; j++) {
      rows[j + 1] = cubic(
        this._px(ix - 1, iy + j),
        this._px(ix, iy + j),
        this._px(ix + 1, iy + j),
        this._px(ix + 2, iy + j),
        tx,
      );
    }
    return cubic(rows[0], rows[1], rows[2], rows[3], ty);
  }
}

function cubic(p0, p1, p2, p3, t) {
  return (
    p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)))
  );
}

export class SolHeightProvider {
  constructor(body) {
    this.body = body;
    this.cfg = body.def.terrain;
    this.R = body.radius;
    this.seed = hashString(body.id);
    this.noise = createNoise3D(this.seed);
    this.craters =
      this.cfg.craters > 0 ? createCraterField(this.seed, this.cfg.craters, this.R) : null;
    this.map = null;
    this.ocean = null;
    this.version = 0;
    this.mode = body.def.textures?.map ? 'texture' : 'procedural';
    this.startWavelength = 60e3;
    this.minHeight = this.cfg.min ?? -8000;
    this.maxHeight = this.cfg.max ?? 8000;
    // Runways and pads are graded flat (e.g. Yubileyny, 4.5 km × 84 m).
    // Catalogued landing sites were chosen (historically) for being smooth:
    // short-wavelength roughness is removed inside a few kilometres of them.
    this.flats = (body.def.sites || []).map((st) => {
      const la = (st.lat * Math.PI) / 180,
        lo = (st.lon * Math.PI) / 180;
      const r = st.runway ? st.runway.length * 0.8 : 2500;
      return {
        x: Math.cos(la) * Math.cos(lo),
        y: Math.cos(la) * Math.sin(lo),
        z: Math.sin(la),
        r,
        level: !!st.runway,
        h: null,
        v: -1,
      };
    });
    if (this.cfg.procedural) {
      this.surface = createProceduralSurface({
        type: this.cfg.procedural,
        seed: this.seed,
        radius: this.R,
        craters: this.cfg.craters,
        detail: this.cfg.detail,
      });
    }
  }

  setMap(map) {
    this.map = map;
    this.startWavelength = Math.max(4e3, ((2 * Math.PI * this.R) / map.w) * 3);
    this.version++;
  }

  setOcean(map) {
    this.ocean = map;
    this.version++;
  }

  height(x, y, z, minWavelength = 4) {
    if (this.surface) return this.surface.height(x, y, z, minWavelength);
    const c = this.cfg;
    let h = 0;
    let amp = 1;
    if (this.map) h = c.min + (c.max - c.min) * this.map.sampleDir(x, y, z);
    if (this.cfg.features === 'mars') h = marsFeatures(x, y, z, this.R, h, this.noise);
    let oceanMask = 0;
    if (this.ocean) {
      const m = this.ocean.sampleDir(x, y, z);
      oceanMask = m < 0.35 ? 0 : m > 0.65 ? 1 : (m - 0.35) / 0.3;
      h = Math.max(h, 15);
      amp = 0.25 + h / 1800;
    }
    h +=
      amp *
      spectralNoise(
        this.noise,
        x,
        y,
        z,
        this.R,
        c.detail ?? 100,
        this.startWavelength,
        minWavelength,
        c.roughness ?? 0.4,
      );
    if (this.craters) h += this.craters(x, y, z, minWavelength);
    if (this.ocean) h = h * (1 - oceanMask);
    for (const f of this.flats) {
      const d = Math.hypot(x - f.x, y - f.y, z - f.z) * this.R;
      if (d < f.r * 2) {
        // Runways are graded level; other sites keep their large-scale slope
        // but lose sub-kilometre roughness.
        const saved = this.flats;
        this.flats = [];
        let smooth;
        if (f.level) {
          if (f.v !== this.version) {
            f.h = this.height(f.x, f.y, f.z, 3000);
            f.v = this.version;
          }
          smooth = f.h;
        } else smooth = this.height(x, y, z, Math.max(minWavelength, 3000));
        this.flats = saved;
        const k = d < f.r ? 1 : 1 - (d - f.r) / f.r;
        h = h + (smooth - h) * k * k * (3 - 2 * k);
      }
    }
    return h;
  }

  isOcean(x, y, z) {
    return this.ocean ? this.ocean.sampleDir(x, y, z) > 0.5 : false;
  }

  color(x, y, z, h, out) {
    return this.surface ? this.surface.color(x, y, z, h, out) : null;
  }
}

// Exoplanet provider: everything comes from the generator.
export class ProceduralHeightProvider {
  constructor(params) {
    this.surface = createProceduralSurface(params);
    this.R = params.radius;
    this.mode = 'procedural';
    this.version = 1;
    this.minHeight = -(params.reliefAmp + 4000);
    this.maxHeight = params.reliefAmp + params.mountainAmp + 3000;
    this.sea = params.seaLevel ?? null;
  }

  height(x, y, z, minWavelength = 4) {
    return this.surface.height(x, y, z, minWavelength);
  }

  isOcean(x, y, z) {
    return this.sea !== null && this.surface.height(x, y, z, 2000) <= this.sea + 1;
  }

  color(x, y, z, h, out) {
    return this.surface.color(x, y, z, h, out);
  }
}
