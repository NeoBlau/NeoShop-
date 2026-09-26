// Procedural star systems grounded in observational astrophysics:
//  * spectral class drawn from the local stellar census (≈75% M dwarfs, then
//    K, G, F, A), radius/mass/temperature within the main-sequence ranges of
//    each class and luminosity from L = 4πR²σT⁴;
//  * habitable zone from the Kopparapu et al. (2013) flux limits
//    (runaway greenhouse 1.1 S⊕, maximum greenhouse 0.36 S⊕), frost line at
//    2.7·√L AU;
//  * planet class set by where it formed (rocky inside the frost line, giants
//    outside), radius from the Chen & Kipping mass–radius relation, surface
//    temperature from radiative equilibrium plus a greenhouse term;
//  * tidal locking for close-in planets of M dwarfs;
//  * life only where liquid water can exist, with pigments shifted toward the
//    star's spectrum (dark, near-black foliage under M dwarfs).

import {
  AU,
  DAY,
  EARTH_MASS,
  EARTH_RADIUS,
  G,
  LIGHT_YEAR,
  R_GAS,
  SIGMA_SB,
  SOLAR_LUMINOSITY,
  SOLAR_MASS,
  SOLAR_RADIUS,
} from '../core/constants.js';
import { Random, hashString } from '../core/rng.js';

const CLASSES = [
  { cls: 'M', w: 76, T: [2600, 3850], M: [0.08, 0.57], R: [0.11, 0.6] },
  { cls: 'K', w: 12, T: [3900, 5300], M: [0.6, 0.88], R: [0.7, 0.95] },
  { cls: 'G', w: 7.6, T: [5300, 6000], M: [0.88, 1.15], R: [0.9, 1.2] },
  { cls: 'F', w: 3, T: [6000, 7300], M: [1.15, 1.6], R: [1.2, 1.7] },
  { cls: 'A', w: 0.6, T: [7300, 10000], M: [1.6, 2.4], R: [1.7, 2.5] },
];

const GREEK = ['b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];

export function generateNeighborhood(count = 14) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const name = `BRN-${(1000 + ((i * 7919 + 431) % 9000)).toString()}`;
    const seed = hashString(name);
    const rnd = new Random(seed);
    const star = makeStar(rnd);
    // Bias the catalogue slightly so the neighbourhood is worth visiting.
    out.push({
      name,
      seed,
      distance: rnd.range(4.2, 48) * LIGHT_YEAR,
      dir: randomDir(rnd),
      ...star,
    });
  }
  return out.sort((a, b) => a.distance - b.distance);
}

function randomDir(rnd) {
  const z = rnd.range(-1, 1);
  const a = rnd.range(0, Math.PI * 2);
  const s = Math.sqrt(1 - z * z);
  return [s * Math.cos(a), s * Math.sin(a), z];
}

function makeStar(rnd) {
  const c = rnd.weighted(CLASSES.map((k) => [k, k.w]));
  const f = rnd.next();
  const teff = c.T[0] + (c.T[1] - c.T[0]) * f;
  const mass = (c.M[0] + (c.M[1] - c.M[0]) * f) * SOLAR_MASS;
  const radius = (c.R[0] + (c.R[1] - c.R[0]) * f) * SOLAR_RADIUS;
  const luminosity = 4 * Math.PI * radius * radius * SIGMA_SB * teff ** 4;
  const sub = Math.min(9, Math.floor((1 - f) * 10));
  return { cls: c.cls, spectral: `${c.cls}${sub}V`, teff, mass, radius, luminosity };
}

const rgb = (r, g, b) => [r, g, b];

function lifePigment(teff, rnd) {
  // Photosynthetic pigments tuned to the stellar peak (Kiang et al. 2007).
  if (teff < 3900)
    return rnd.pick([rgb(0.12, 0.08, 0.14), rgb(0.2, 0.08, 0.1), rgb(0.08, 0.1, 0.12)]);
  if (teff < 5300)
    return rnd.pick([rgb(0.55, 0.42, 0.12), rgb(0.45, 0.3, 0.1), rgb(0.25, 0.35, 0.12)]);
  if (teff < 6000)
    return rnd.pick([rgb(0.16, 0.34, 0.12), rgb(0.22, 0.38, 0.16), rgb(0.3, 0.36, 0.14)]);
  return rnd.pick([rgb(0.3, 0.42, 0.55), rgb(0.35, 0.5, 0.3)]);
}

export function generateSystem(entry) {
  const rnd = new Random(entry.seed ^ 0x51f15e);
  const L = entry.luminosity / SOLAR_LUMINOSITY;
  const hzIn = Math.sqrt(L / 1.1);
  const hzOut = Math.sqrt(L / 0.36);
  const frost = 2.7 * Math.sqrt(L);
  const starId = `exo-${entry.seed}`;
  const defs = [
    {
      id: starId,
      name: entry.name,
      kind: 'star',
      parent: null,
      gm: G * entry.mass,
      radius: entry.radius,
      rotation: { ra: 0, dec: 90, w0: 0, wd: 360 / rnd.range(8, 40), ecliptic: true },
      star: { teff: entry.teff, luminosity: entry.luminosity, spectral: entry.spectral },
      facts: `${entry.spectral}, Tэфф ${entry.teff.toFixed(0)} K, L = ${L.toFixed(4)} L☉. Обитаемая зона ${hzIn.toFixed(3)}–${hzOut.toFixed(3)} а.е.`,
    },
  ];
  const n = entry.cls === 'M' ? rnd.int(2, 5) : rnd.int(3, 7);
  let a = rnd.range(0.35, 0.8) * hzIn;
  const orbits = [];
  for (let i = 0; i < n; i++) {
    orbits.push(a);
    a *= rnd.range(1.45, 2.1);
  }
  // Nudge the closest orbit into the habitable zone most of the time.
  let hzOrbit = -1;
  if (rnd.chance(0.75)) {
    let best = 0;
    for (let i = 1; i < n; i++)
      if (Math.abs(Math.log(orbits[i] / hzIn)) < Math.abs(Math.log(orbits[best] / hzIn))) best = i;
    orbits[best] = rnd.range(hzIn * 1.02, hzOut * 0.75);
    hzOrbit = orbits[best];
    orbits.sort((x, y) => x - y);
  }
  orbits.forEach((aAU, i) => {
    const p = makePlanet(rnd, entry, starId, i, aAU, {
      hzIn,
      hzOut,
      frost,
      L,
      hzWorld: aAU === hzOrbit,
    });
    defs.push(p);
    if (p.gasGiant) {
      const nm = rnd.int(1, 3);
      for (let k = 0; k < nm; k++) defs.push(makeMoon(rnd, entry, p, k, { L, aAU }));
    }
  });
  return {
    meta: { name: entry.name, seed: entry.seed, sol: false, entry, hzIn, hzOut, frost },
    defs,
  };
}

function equilibriumT(entry, aAU, albedo) {
  return entry.teff * Math.sqrt(entry.radius / (2 * aAU * AU)) * Math.pow(1 - albedo, 0.25);
}

function makePlanet(rnd, entry, starId, i, aAU, z) {
  const id = `${starId}-${i}`;
  const name = `${entry.name} ${GREEK[i]}`;
  const inHZ = aAU >= z.hzIn && aAU <= z.hzOut;
  const beyondFrost = aAU > z.frost;
  const period = 2 * Math.PI * Math.sqrt((aAU * AU) ** 3 / (G * entry.mass));
  const orbit = {
    type: 'simple',
    a: aAU * AU,
    e: rnd.range(0, inHZ ? 0.06 : 0.15),
    i: rnd.range(0, 3) * (Math.PI / 180),
    Omega: rnd.range(0, Math.PI * 2),
    omega: rnd.range(0, Math.PI * 2),
    M0: rnd.range(0, Math.PI * 2),
  };
  // Tidal locking: close-in planets of low-mass stars (≲0.3 AU around M dwarfs).
  const locked = entry.cls === 'M' && aAU < 0.3;
  const rotPeriodDays = locked ? period / DAY : rnd.range(0.4, 3.0);
  const tilt = locked ? rnd.range(0, 2) : rnd.chance(0.15) ? rnd.range(40, 98) : rnd.range(0, 35);
  const rotation = {
    ra: rnd.range(0, 360),
    dec: 90 - tilt,
    w0: rnd.range(0, 360),
    wd: 360 / rotPeriodDays,
    ecliptic: true,
  };
  const seed = hashString(id);
  let kind;
  if (beyondFrost)
    kind = rnd.weighted([
      ['gas', 40],
      ['ice', 30],
      ['dwarf', 30],
    ]);
  else kind = 'rocky';

  if (kind === 'gas' || kind === 'ice') {
    const mE = kind === 'gas' ? rnd.logUniform(40, 1200) : rnd.logUniform(9, 30);
    const rE = kind === 'gas' ? 10.5 * Math.pow(mE / 318, 0.04) : 3.4 * Math.pow(mE / 14, 0.25);
    const T0 = Math.max(40, equilibriumT(entry, aAU, 0.34));
    const warm = T0 > 700;
    const pal =
      kind === 'ice'
        ? { a: rgb(0.55, 0.78, 0.86), b: rgb(0.42, 0.62, 0.85), c: rgb(0.8, 0.9, 0.95) }
        : warm
          ? { a: rgb(0.25, 0.28, 0.4), b: rgb(0.12, 0.13, 0.2), c: rgb(0.5, 0.35, 0.3) }
          : rnd.pick([
              { a: rgb(0.85, 0.72, 0.55), b: rgb(0.62, 0.42, 0.28), c: rgb(0.95, 0.9, 0.82) },
              { a: rgb(0.88, 0.82, 0.62), b: rgb(0.75, 0.62, 0.42), c: rgb(0.95, 0.92, 0.85) },
              { a: rgb(0.7, 0.62, 0.72), b: rgb(0.48, 0.42, 0.58), c: rgb(0.9, 0.88, 0.95) },
            ]);
    const M = 0.0023;
    const g = (G * mE * EARTH_MASS) / (rE * EARTH_RADIUS) ** 2;
    return {
      id,
      name,
      kind: 'planet',
      parent: starId,
      gasGiant: true,
      gm: G * mE * EARTH_MASS,
      radius: rE * EARTH_RADIUS,
      orbit,
      rotation,
      giant: { seed, palette: pal, bands: rnd.range(9, 22), radius: rE * EARTH_RADIUS },
      atmosphere: {
        P0: 1e5,
        T0,
        molarMass: M,
        gamma: 1.43,
        lapse: 0.0015,
        Tmin: T0 * 0.6,
        crushPressure: 2.2e6,
        composition: kind === 'gas' ? 'H₂ ~86%, He ~13%, CH₄, NH₃' : 'H₂, He, CH₄ ~2%, H₂O',
        rayleigh: kind === 'ice' ? [1.0e-6, 3.6e-6, 7e-6] : [2e-6, 3e-6, 5e-6],
        mie: [2.5e-6, 2.4e-6, 2.2e-6],
        mieH: 30e3,
        mieG: 0.7,
        heatK: 0.6556e-4,
        fog: pal.a,
      },
      surface: {
        particles: 'gas',
        desc: `${kind === 'gas' ? 'Газовый гигант' : 'Ледяной гигант'}: ${mE.toFixed(0)} M⊕, Tэфф ${T0.toFixed(0)} K, g = ${(g / 9.81).toFixed(2)} g.`,
      },
      science: { mass: mE, teq: T0, inHZ, locked },
    };
  }

  // Rocky / icy dwarf
  const dwarf = kind === 'dwarf';
  // Worlds placed in the habitable zone are drawn from the terrestrial range
  // that can retain an atmosphere (0.4–4 M⊕).
  const mE = dwarf
    ? rnd.logUniform(0.002, 0.05)
    : z.hzWorld
      ? rnd.logUniform(0.4, 4)
      : rnd.logUniform(0.08, 6);
  const rE = mE < 2 ? Math.pow(mE, 0.279) : Math.pow(mE, 0.589) * 0.82; // Chen & Kipping 2017
  const R = rE * EARTH_RADIUS;
  const gm = G * mE * EARTH_MASS;
  const g = gm / (R * R);
  const albedo = dwarf ? 0.55 : inHZ ? 0.3 : 0.2;
  const Teq = equilibriumT(entry, aAU, albedo);
  let atm = null;
  let P0 = 0;
  let T0 = Teq;
  let type = dwarf ? 'ice' : Teq > 1100 ? 'lava' : Teq > 340 ? 'desert' : inHZ ? 'terran' : 'cold';
  if (!dwarf && mE > 0.25 && type !== 'lava') {
    const hot = Teq > 320 && !inHZ;
    P0 = hot
      ? rnd.logUniform(5e5, 9e6)
      : type === 'terran'
        ? rnd.logUniform(4e4, 5e5)
        : rnd.logUniform(300, 6e4);
    const greenhouse = hot
      ? 0.9 * Teq * Math.pow(P0 / 1e5, 0.28)
      : 30 * Math.pow(P0 / 1e5, 0.5) + 5; // Earth: +33 K at 1 bar
    T0 = Teq + greenhouse;
  }
  // Liquid water: between the melting line and boiling at the surface pressure.
  const boil = P0 > 612 ? 373 * Math.pow(P0 / 101325, 0.05) : 0;
  const ocean = !dwarf && P0 > 612 && T0 > 273 && T0 < boil;
  if (type === 'terran' && !ocean) type = T0 < 273 ? 'cold' : 'desert';
  const life = ocean && type === 'terran' && rnd.chance(0.8);
  const co2 = type !== 'terran' || !life;
  if (P0 > 0) {
    const Mm = co2 ? 0.0435 : 0.0289;
    const rho0 = (P0 * Mm) / (R_GAS * T0);
    const kR = (rho0 / 1.225) * (co2 ? 2.4 : 1);
    const haze = rnd.range(0.4, 3) * (type === 'desert' ? 4 : 1);
    atm = {
      P0,
      T0,
      molarMass: Mm,
      gamma: co2 ? 1.29 : 1.4,
      lapse: g / 1100,
      Tmin: T0 * 0.55,
      composition: life
        ? `N₂ ${rnd.int(70, 80)}%, O₂ ${rnd.int(12, 28)}%, Ar, CO₂, H₂O`
        : co2
          ? 'CO₂ 90–97%, N₂, Ar'
          : 'N₂, CO₂',
      rayleigh: [5.8e-6 * kR, 13.5e-6 * kR, 33.1e-6 * kR].map((x) => Math.min(x, 6e-4)),
      mie: [4e-6 * haze, 3.8e-6 * haze, 3.4e-6 * haze].map((x) => Math.min(x, 2e-4)),
      mieH: 1500 * rnd.range(0.6, 3),
      mieG: 0.78,
      heatK: co2 ? 1.9027e-4 : 1.7415e-4,
      fog:
        type === 'desert'
          ? rgb(0.85, 0.66, 0.45)
          : life
            ? rgb(0.6, 0.72, 0.88)
            : rgb(0.7, 0.68, 0.64),
      cloudDeck: P0 > 3e6 ? { base: 40e3, top: 60e3, color: [0.95, 0.9, 0.78] } : undefined,
    };
  }
  const pal = palettes(type, rnd, entry.teff);
  const reliefAmp = dwarf ? 2500 : rnd.range(1500, 4500) / Math.max(0.6, g / 9.81);
  const mountainAmp = dwarf ? 3000 : rnd.range(2000, 7000) / Math.max(0.6, g / 9.81);
  const seaLevel = ocean ? rnd.range(-0.25, 0.2) * reliefAmp : null;
  const iceLat =
    type === 'cold' || dwarf ? rnd.range(0.2, 0.6) : T0 < 300 ? rnd.range(0.72, 0.92) : 1.2;
  const particles = {
    terran: 'soil',
    desert: 'dust-red',
    cold: 'dust-red',
    lava: 'regolith',
    ice: 'ice',
  }[type];
  const desc = {
    terran: 'Землеподобная планета с жидкой водой',
    desert: 'Сухая пустынная планета',
    cold: 'Холодная каменистая планета',
    lava: 'Раскалённая лавовая планета',
    ice: 'Ледяной карлик',
  }[type];
  const sites = [];
  for (let k = 0; k < 3; k++)
    sites.push({
      name: `${name}: точка ${k + 1}`,
      lat: rnd.range(-60, 60),
      lon: rnd.range(-180, 180),
    });
  return {
    id,
    name,
    kind: dwarf ? 'dwarf' : 'planet',
    parent: starId,
    gm,
    radius: R,
    orbit,
    rotation,
    atmosphere: atm ?? undefined,
    terrainMax: reliefAmp + mountainAmp,
    procedural: {
      type: 'exo',
      seed,
      radius: R,
      craters: P0 > 1e4 ? 0.08 : dwarf ? 1.0 : 0.5,
      detail: rnd.range(30, 60),
      seaLevel,
      palette: pal,
      continentScale: rnd.range(1.2, 3.2),
      continentBias: rnd.range(-0.25, 0.25),
      reliefAmp,
      mountainAmp,
      life,
      iceLatitude: iceLat,
    },
    rockTint: pal.rock,
    life: life
      ? {
          pigment: pal.life,
          glow: rnd.pick([
            [0.2, 1.0, 0.85],
            [0.9, 0.3, 1.0],
            [0.3, 0.6, 1.0],
            [1.0, 0.7, 0.2],
          ]),
        }
      : null,
    surface: {
      particles,
      desc: `${desc}. ${mE.toFixed(2)} M⊕, ${rE.toFixed(2)} R⊕, g = ${(g / 9.81).toFixed(2)} g, T = ${T0.toFixed(0)} K${P0 ? `, P = ${(P0 / 1e5).toFixed(2)} бар` : ''}${ocean ? ', океаны' : ''}${life ? ', ОБНАРУЖЕНА ЖИЗНЬ' : ''}${locked ? ', приливный захват' : ''}.`,
    },
    sites,
    science: { mass: mE, teq: Teq, t0: T0, inHZ, ocean, life, locked },
  };
}

function palettes(type, rnd, teff) {
  const life = lifePigment(teff, rnd);
  switch (type) {
    case 'terran':
      return {
        deep: rgb(0.02, 0.06, 0.16),
        shallow: rgb(0.05, 0.2, 0.3),
        low: rgb(0.45, 0.4, 0.3),
        mid: rgb(0.4, 0.34, 0.28),
        high: rgb(0.6, 0.58, 0.56),
        life,
        rock: [0.8, 0.76, 0.7],
      };
    case 'desert':
      return {
        deep: rgb(0.1, 0.1, 0.1),
        shallow: rgb(0.2, 0.2, 0.2),
        low: rgb(0.78, 0.55, 0.32),
        mid: rgb(0.66, 0.4, 0.22),
        high: rgb(0.5, 0.36, 0.26),
        life,
        rock: [0.9, 0.7, 0.55],
      };
    case 'lava':
      return {
        deep: rgb(0.1, 0.05, 0.03),
        shallow: rgb(0.2, 0.1, 0.05),
        low: rgb(0.12, 0.1, 0.09),
        mid: rgb(0.2, 0.17, 0.15),
        high: rgb(0.32, 0.28, 0.25),
        life,
        rock: [0.6, 0.55, 0.5],
      };
    case 'ice':
      return {
        deep: rgb(0.5, 0.6, 0.7),
        shallow: rgb(0.7, 0.8, 0.9),
        low: rgb(0.78, 0.8, 0.84),
        mid: rgb(0.66, 0.62, 0.6),
        high: rgb(0.9, 0.92, 0.95),
        life,
        rock: [0.85, 0.85, 0.9],
      };
    default:
      return {
        deep: rgb(0.1, 0.1, 0.1),
        shallow: rgb(0.2, 0.2, 0.2),
        low: rgb(0.52, 0.46, 0.4),
        mid: rgb(0.44, 0.38, 0.34),
        high: rgb(0.7, 0.7, 0.72),
        life,
        rock: [0.8, 0.78, 0.76],
      };
  }
}

function makeMoon(rnd, entry, planet, k, z) {
  const id = `${planet.id}-m${k}`;
  const icy = z.aAU > 2.7 * Math.sqrt(z.L);
  const R = rnd.range(600e3, 2600e3);
  const rho = icy ? 1900 : 3200;
  const gm = G * (4 / 3) * Math.PI * R ** 3 * rho;
  const a = planet.radius * rnd.range(6, 40) * (1 + k * 0.8);
  const seed = hashString(id);
  return {
    id,
    name: `${planet.name} ${['I', 'II', 'III'][k]}`,
    kind: 'moon',
    parent: planet.id,
    gm,
    radius: R,
    orbit: {
      type: 'simple',
      frame: 'parentEquator',
      a,
      e: rnd.range(0, 0.03),
      i: rnd.range(0, 1) * (Math.PI / 180),
      Omega: rnd.range(0, 6.28),
      omega: rnd.range(0, 6.28),
      M0: rnd.range(0, 6.28),
    },
    rotation: {
      ra: 0,
      dec: 90,
      w0: 0,
      wd: 360 / ((2 * Math.PI * Math.sqrt(a ** 3 / planet.gm)) / DAY),
      ecliptic: true,
    },
    terrainMax: 4000,
    procedural: {
      type: 'exo',
      seed,
      radius: R,
      craters: 1.0,
      detail: rnd.range(35, 60),
      seaLevel: null,
      palette: palettes(icy ? 'ice' : 'cold', rnd, entry.teff),
      continentScale: 2,
      continentBias: 0,
      reliefAmp: 1500,
      mountainAmp: 2000,
      life: false,
      iceLatitude: icy ? 0 : 1.2,
    },
    surface: {
      particles: icy ? 'ice' : 'regolith',
      desc: icy ? 'Ледяной спутник' : 'Каменистый спутник',
    },
    sites: [{ name: `${id}: полюс`, lat: 80, lon: 0 }],
  };
}
