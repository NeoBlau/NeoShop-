// Surface generators: relief and colour as pure functions of a direction on the
// unit sphere. The same functions feed the terrain meshes, the collision
// queries of the landing gear and the equirectangular textures painted in the
// worker, so what you see from orbit is exactly what you touch down on.
//
// No THREE import: this module also runs inside a Web Worker.

import { createNoise3D, fbm, ridged, warped } from '../core/noise.js';
import { hash3 } from '../core/rng.js';

const CRATER_LEVELS = [120e3, 40e3, 13e3, 4.2e3, 1.4e3, 450, 150, 50, 16];

// Crater population with a D^-2 cumulative size-frequency distribution:
// one candidate per lattice cell whose size scales with the crater diameter.
// Depth/diameter ≈ 0.2 for fresh simple craters, shallower for large complex
// ones; rims ≈ 0.04·D; hash-driven degradation mimics crater ageing.
export function createCraterField(seed, density, radius) {
  const probability = Math.min(0.85, 0.32 * density);
  return function craters(x, y, z, minWavelength) {
    let h = 0;
    const px = x * radius,
      py = y * radius,
      pz = z * radius;
    for (let L = 0; L < CRATER_LEVELS.length; L++) {
      const D = CRATER_LEVELS[L];
      if (D < minWavelength * 1.2) break;
      if (D > radius * 0.25) continue;
      const cell = D * 3.2;
      const fx = px / cell,
        fy = py / cell,
        fz = pz / cell;
      const bx = Math.floor(fx - 0.5),
        by = Math.floor(fy - 0.5),
        bz = Math.floor(fz - 0.5);
      for (let i = 0; i < 2; i++)
        for (let j = 0; j < 2; j++)
          for (let k = 0; k < 2; k++) {
            const cx = bx + i,
              cy = by + j,
              cz = bz + k;
            const s = seed + L * 7919;
            if (hash3(cx, cy, cz, s) > probability) continue;
            let ox = (cx + hash3(cx, cy, cz, s + 1)) * cell;
            let oy = (cy + hash3(cx, cy, cz, s + 2)) * cell;
            let oz = (cz + hash3(cx, cy, cz, s + 3)) * cell;
            const ol = Math.hypot(ox, oy, oz);
            if (ol < 1) continue;
            ox = (ox / ol) * radius;
            oy = (oy / ol) * radius;
            oz = (oz / ol) * radius;
            const d = Math.hypot(px - ox, py - oy, pz - oz);
            const diam = D * (0.55 + 0.9 * hash3(cx, cy, cz, s + 4));
            const r = diam / 2;
            if (d > r * 2.0) continue;
            // Small craters are mostly old and infilled by regolith gardening.
            const age = (0.35 + 0.65 * hash3(cx, cy, cz, s + 5)) * (D < 500 ? 0.45 : 1);
            const depthRatio = diam > 15e3 ? 0.2 * Math.pow(15e3 / diam, 0.45) : 0.2;
            const depth = depthRatio * diam * age;
            const rim = 0.04 * diam * age;
            const xr = d / r;
            if (xr < 1) {
              // Flat floor for complex craters, bowl for simple ones.
              const bowl = diam > 15e3 ? Math.min(1, Math.pow(xr, 4) * 1.4) : xr * xr;
              h += rim - depth + depth * bowl;
              if (diam > 20e3 && xr < 0.18) h += depth * 0.35 * (1 - xr / 0.18); // central peak
            } else {
              const t = xr - 1;
              h += rim * Math.exp(-3.2 * t * t) * (1 - t);
            }
          }
    }
    return h;
  };
}

// Relief noise with a power-law spectrum (amplitude ∝ λ^0.7): `detail` is the
// amplitude at λ = 1 km. Octaves shorter than minWavelength are skipped, the
// last one faded, so every LOD level samples the same continuous surface.
export function spectralNoise(
  noise,
  x,
  y,
  z,
  radius,
  detail,
  startWavelength,
  minWavelength,
  ridgedMix = 0.4,
) {
  let h = 0;
  let lambda = startWavelength;
  let o = 0;
  while (lambda > minWavelength * 0.5 && o < 18) {
    // Steeper spectrum below 1 km: rough at hill scale, walkable at wheel scale.
    const amp = detail * Math.pow(lambda / 1000, lambda >= 1000 ? 0.7 : 1.25);
    const f = radius / lambda;
    const fade =
      lambda > minWavelength ? 1 : (lambda - minWavelength * 0.5) / (minWavelength * 0.5);
    const n = noise(x * f + o * 17.1, y * f - o * 9.7, z * f + o * 3.3);
    const r = 1 - Math.abs(n);
    h += amp * fade * ((1 - ridgedMix) * n + ridgedMix * (r * r * 2 - 0.7));
    lambda *= 0.5;
    o++;
  }
  return h;
}

const DEGR = Math.PI / 180;

function toXYZ(latDeg, lonDeg) {
  const la = latDeg * DEGR,
    lo = lonDeg * DEGR;
  return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
}

// Great-circle distance (m) from a direction to a polyline of lat/lon points.
function distanceToPath(x, y, z, path, radius) {
  let best = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i],
      b = path[i + 1];
    // Project onto the segment in 3D chord space, adequate at canyon scale.
    const abx = b[0] - a[0],
      aby = b[1] - a[1],
      abz = b[2] - a[2];
    const apx = x - a[0],
      apy = y - a[1],
      apz = z - a[2];
    const t = Math.max(
      0,
      Math.min(1, (apx * abx + apy * aby + apz * abz) / (abx * abx + aby * aby + abz * abz)),
    );
    const dx = apx - abx * t,
      dy = apy - aby * t,
      dz = apz - abz * t;
    best = Math.min(best, Math.hypot(dx, dy, dz));
  }
  return best * radius;
}

// Mars landmarks carved analytically on top of the MOLA-derived map, so they
// stay sharp at landing scale: Olympus Mons (21.9 km shield, 600 km across,
// 6 km basal escarpment, 80×60 km nested caldera 3.2 km deep) and the Valles
// Marineris system (≈4000 km long, up to 7 km deep, 200 km wide).
const OLYMPUS = toXYZ(18.65, -133.8);
const VALLES = [
  [-7.0, -101.0],
  [-6.5, -94.0],
  [-7.5, -87.0],
  [-9.5, -79.0],
  [-11.0, -72.0],
  [-12.5, -65.0],
  [-13.5, -58.0],
  [-12.8, -50.0],
  [-10.5, -43.0],
].map(([la, lo]) => toXYZ(la, lo));
const CANDOR = [
  [-6.5, -76.0],
  [-5.8, -70.0],
].map(([la, lo]) => toXYZ(la, lo));

export function marsFeatures(x, y, z, radius, base, noise) {
  let h = base;
  // Olympus Mons
  const dOly = Math.hypot(x - OLYMPUS[0], y - OLYMPUS[1], z - OLYMPUS[2]) * radius;
  if (dOly < 420e3) {
    const R = 300e3;
    const q = dOly / R;
    let shield = q < 1 ? 21900 * Math.pow(1 - q * q, 0.55) : 0;
    const scarp = 1 - smooth(0.93, 1.02, q);
    shield = Math.max(shield, scarp * 6000 * (0.85 + 0.15 * noise(x * 90, y * 90, z * 90)));
    const cal = dOly / 36e3;
    if (cal < 1.3) shield -= 3200 * (1 - smooth(0.85, 1.15, cal));
    h = Math.max(h, shield);
  }
  // Valles Marineris
  const w = 90e3 + 50e3 * noise(x * 40, y * 40, z * 40);
  const dV = Math.min(
    distanceToPath(x, y, z, VALLES, radius),
    distanceToPath(x, y, z, CANDOR, radius) * 1.15,
  );
  if (dV < w * 1.6) {
    const wall = smooth(w * 0.35, w, dV);
    const floor = -5200 - 1800 * (0.5 + 0.5 * noise(x * 25, y * 25, z * 25));
    h = Math.min(
      h,
      floor + (h - floor) * wall + (1 - wall) * 350 * ridged(noise, x * 400, y * 400, z * 400, 3),
    );
  }
  return h;
}

function smooth(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

const mix = (a, b, t) => a + (b - a) * t;
function mix3(out, a, b, t) {
  out[0] = mix(a[0], b[0], t);
  out[1] = mix(a[1], b[1], t);
  out[2] = mix(a[2], b[2], t);
  return out;
}

// ---------------------------------------------------------------------------
// Procedural worlds: the Galilean-type moons and Titan (for which no global
// colour mosaic of adequate quality is published under a CDN-friendly licence)
// and every exoplanet. `params` is plain JSON so it can be posted to a worker.

export function createProceduralSurface(params) {
  const noise = createNoise3D(params.seed);
  const noise2 = createNoise3D(params.seed ^ 0x5bd1e995);
  const R = params.radius;
  const craters = params.craters > 0 ? createCraterField(params.seed, params.craters, R) : null;
  const detail = params.detail ?? 100;
  const type = params.type;
  const sea = params.seaLevel ?? null;
  const pal = params.palette;

  function height(x, y, z, minWavelength = 5) {
    let h;
    switch (type) {
      case 'io': {
        h = 900 * fbm(noise, x * 3, y * 3, z * 3, 5);
        const m = ridged(noise2, x * 5, y * 5, z * 5, 5);
        h += Math.max(0, m - 0.62) * 26000; // isolated fault-block mountains
        break;
      }
      case 'europa': {
        h = 180 * fbm(noise, x * 6, y * 6, z * 6, 4);
        const l = ridged(noise2, x * 14, y * 14, z * 14, 4);
        h += Math.max(0, l - 0.78) * 900; // double ridges
        break;
      }
      case 'ganymede': {
        const dark = fbm(noise2, x * 2.5, y * 2.5, z * 2.5, 4);
        const grooves = Math.sin(
          (x * 0.8 + y * 0.6 + fbm(noise, x * 4, y * 4, z * 4, 3) * 1.5) * 380,
        );
        h = 1100 * dark + (dark < 0 ? 180 * grooves : 0);
        break;
      }
      case 'callisto':
        h = 700 * fbm(noise, x * 3, y * 3, z * 3, 5);
        break;
      case 'titan': {
        h =
          400 * fbm(noise, x * 3, y * 3, z * 3, 5) +
          700 * Math.max(0, fbm(noise2, x * 2, y * 2, z * 2, 4));
        const lat = Math.abs(z);
        if (lat < 0.45) {
          // Longitudinal linear dunes, 1–2 km apart, ~100 m high (Cassini RADAR)
          const lon = Math.atan2(y, x);
          const d = Math.sin((lon * R) / 1600 + 3 * noise(x * 30, y * 30, z * 30));
          h += 100 * Math.pow(Math.abs(d), 3) * (1 - lat / 0.45);
        }
        if (lat > 0.8 && fbm(noise, x * 8, y * 8, z * 8, 3) < -0.05) h = Math.min(h, -250); // polar seas
        break;
      }
      default: {
        // Exoplanets: continents + mountain chains.
        const cont = fbm(
          noise,
          x * params.continentScale,
          y * params.continentScale,
          z * params.continentScale,
          6,
        );
        const mtn = ridged(noise2, x * 6, y * 6, z * 6, 6);
        h =
          params.reliefAmp * (cont + params.continentBias) +
          params.mountainAmp * mtn * Math.max(0, cont + 0.15);
      }
    }
    h += spectralNoise(noise, x, y, z, R, detail, 25e3, minWavelength);
    if (craters && (sea === null || h > sea)) h += craters(x, y, z, minWavelength);
    if (sea !== null && h < sea) h = sea + (h - sea) * 0.002; // flat liquid surface
    return h;
  }

  // Colour (sRGB 0..1) at a surface point of given height.
  function color(x, y, z, h, out = [0, 0, 0]) {
    const n = fbm(noise2, x * 20, y * 20, z * 20, 4);
    switch (type) {
      case 'io': {
        const s = warped(noise, x * 3, y * 3, z * 3, 4);
        mix3(out, [0.86, 0.79, 0.36], [0.72, 0.42, 0.14], smooth(-0.2, 0.4, s));
        if (s < -0.35) mix3(out, out, [0.92, 0.9, 0.78], 0.8); // SO₂ frost
        const pat = fbm(noise2, x * 9, y * 9, z * 9, 3);
        if (pat > 0.45) mix3(out, out, [0.12, 0.09, 0.06], smooth(0.45, 0.55, pat)); // lava paterae
        if (Math.abs(z) > 0.8) mix3(out, out, [0.55, 0.42, 0.3], 0.5);
        break;
      }
      case 'europa': {
        mix3(out, [0.86, 0.87, 0.9], [0.72, 0.7, 0.66], 0.5 + 0.5 * n);
        const l = ridged(noise2, x * 14, y * 14, z * 14, 4);
        if (l > 0.72) mix3(out, out, [0.55, 0.32, 0.2], smooth(0.72, 0.85, l));
        break;
      }
      case 'ganymede': {
        const dark = fbm(noise2, x * 2.5, y * 2.5, z * 2.5, 4);
        mix3(out, [0.62, 0.6, 0.57], [0.33, 0.3, 0.27], smooth(-0.05, 0.1, dark));
        if (Math.abs(z) > 0.75) mix3(out, out, [0.85, 0.86, 0.9], 0.6);
        break;
      }
      case 'callisto':
        mix3(out, [0.3, 0.27, 0.23], [0.42, 0.39, 0.35], 0.5 + 0.5 * n);
        if (h > 200) mix3(out, out, [0.78, 0.78, 0.8], smooth(200, 700, h) * 0.8); // icy rims
        break;
      case 'titan': {
        mix3(out, [0.36, 0.25, 0.14], [0.62, 0.5, 0.32], smooth(0, 500, h));
        if (h < -200) mix3(out, out, [0.08, 0.07, 0.06], 0.9);
        break;
      }
      default:
        exoColor(pal, x, y, z, h, n, sea, params, out);
    }
    const v = 1 + 0.12 * n;
    out[0] = Math.min(1, out[0] * v);
    out[1] = Math.min(1, out[1] * v);
    out[2] = Math.min(1, out[2] * v);
    return out;
  }

  return { height, color, params };
}

function exoColor(pal, x, y, z, h, n, sea, params, out) {
  const lat = Math.abs(z);
  if (sea !== null && h <= sea + 0.5) {
    const depth = Math.min(1, Math.max(0, (sea - h) / 6)); // liquid surfaces are flattened 500:1
    mix3(out, pal.shallow, pal.deep, Math.sqrt(depth));
  } else {
    const rel = (h - (sea ?? 0)) / Math.max(1, params.mountainAmp + params.reliefAmp);
    mix3(out, pal.low, pal.mid, smooth(0.0, 0.35, rel + 0.08 * n));
    mix3(out, out, pal.high, smooth(0.35, 0.8, rel + 0.08 * n));
    if (params.life) {
      // Pigmented biofilms and vegetation belts in the temperate lowlands.
      const belt = (1 - smooth(0.25, 0.6, lat)) * smooth(0.0, 0.25, 0.32 - rel);
      mix3(out, out, pal.life, belt * (0.65 + 0.3 * n));
    }
  }
  const iceLat = params.iceLatitude ?? 1.1;
  if (lat > iceLat + 0.05 * n) mix3(out, out, [0.93, 0.95, 0.98], 0.9);
}

// Colour of a gas/ice giant cloud deck: latitude bands broken up by
// domain-warped turbulence and a few long-lived vortices.
export function createGiantSurface(params) {
  const noise = createNoise3D(params.seed);
  const pal = params.palette;
  return {
    color(x, y, z, _h, out = [0, 0, 0]) {
      const turb = warped(noise, x * 3, y * 3, z * 3, 5, 1.2);
      const band = Math.sin(z * params.bands + turb * 1.6 + 0.3 * Math.sin(z * 37));
      mix3(out, pal.a, pal.b, 0.5 + 0.5 * band);
      const t2 = fbm(noise, x * 12, y * 12, z * 50, 4);
      mix3(out, out, pal.c, Math.max(0, t2) * 0.6);
      return out;
    },
    height: () => 0,
    params,
  };
}
