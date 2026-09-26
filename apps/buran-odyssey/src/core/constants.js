// Physical constants (CODATA 2018 / IAU 2015) and unit helpers. Everything in
// the simulation is SI: metres, seconds, kilograms, kelvin, radians.

export const G = 6.6743e-11;
export const AU = 1.495978707e11;
export const LIGHT_YEAR = 9.4607304725808e15;
export const DAY = 86400;
export const JULIAN_CENTURY = 36525 * DAY;
export const G0 = 9.80665;
export const SIGMA_SB = 5.670374419e-8;
export const R_GAS = 8.314462618;
export const DEG = Math.PI / 180;
export const OBLIQUITY_J2000 = 23.43928 * DEG;
export const SOLAR_LUMINOSITY = 3.828e26;
export const SOLAR_MASS = 1.98847e30;
export const SOLAR_RADIUS = 6.957e8;
export const SOLAR_TEFF = 5772;
export const EARTH_MASS = 5.9722e24;
export const EARTH_RADIUS = 6.371e6;
export const SOLAR_CONSTANT = 1361;

// J2000.0 epoch (2000-01-01 12:00 TT). TT−UTC (~69 s) is ignored.
export const J2000_UNIX_MS = Date.UTC(2000, 0, 1, 12, 0, 0);

export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const wrapAngle = (a) => {
  a %= 2 * Math.PI;
  return a < 0 ? a + 2 * Math.PI : a;
};

export function formatDistance(m) {
  const a = Math.abs(m);
  if (a >= 0.1 * LIGHT_YEAR) return (m / LIGHT_YEAR).toFixed(2) + ' св.г.';
  if (a >= 0.01 * AU) return (m / AU).toFixed(3) + ' а.е.';
  if (a >= 1e7) return (m / 1e3).toFixed(0) + ' км';
  if (a >= 1e4) return (m / 1e3).toFixed(1) + ' км';
  return m.toFixed(0) + ' м';
}

export function formatSpeed(ms) {
  return Math.abs(ms) >= 1e4 ? (ms / 1e3).toFixed(2) + ' км/с' : ms.toFixed(1) + ' м/с';
}

export function formatDuration(s) {
  if (!isFinite(s)) return '∞';
  const neg = s < 0;
  s = Math.abs(s);
  const d = Math.floor(s / DAY);
  const h = Math.floor((s % DAY) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const pad = (n) => String(n).padStart(2, '0');
  const body = d > 0 ? `${d}д ${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(h)}:${pad(m)}:${pad(sec)}`;
  return (neg ? '−' : '') + body;
}
