// Science programme: every experiment can be done once per body. Data points
// accumulate toward the warp-drive qualification (the jump computer needs
// calibration data from real gravitational wells before it will engage).

import { DEG } from '../core/constants.js';

export const WARP_REQUIREMENT = 150;

export class Science {
  constructor(toast) {
    this.toast = toast;
    this.points = 0;
    this.done = new Set();
    this.progress = new Map();
    this.log = [];
    this.load();
  }

  load() {
    try {
      const s = JSON.parse(localStorage.getItem('buran.science') || 'null');
      if (s) {
        this.points = s.points;
        this.done = new Set(s.done);
        this.log = s.log || [];
      }
    } catch {
      /* storage unavailable: start fresh */
      this.points = 0;
    }
  }

  save() {
    try {
      localStorage.setItem(
        'buran.science',
        JSON.stringify({ points: this.points, done: [...this.done], log: this.log.slice(-60) }),
      );
    } catch {
      /* private mode: keep in memory only */
      return;
    }
  }

  reset() {
    this.points = 0;
    this.done.clear();
    this.log = [];
    this.save();
  }

  get warpReady() {
    return this.points >= WARP_REQUIREMENT;
  }

  award(key, pts, text) {
    if (this.done.has(key)) return false;
    this.done.add(key);
    this.points += pts;
    this.log.push({ text, pts, at: Date.now() });
    this.toast(`НАУКА +${pts}: ${text}`, 'science');
    this.save();
    return true;
  }

  _accumulate(key, dt, needed) {
    const v = (this.progress.get(key) || 0) + dt;
    this.progress.set(key, v);
    return v >= needed;
  }

  update(ship, dt, system, t) {
    if (ship.destroyed) return;
    const b = ship.ref;
    if (b.kind === 'star') {
      if (!system.meta.sol)
        this.award(
          `sys:${system.meta.seed}`,
          60,
          `Первые наблюдения системы ${system.meta.name} (${system.star.def.star.spectral})`,
        );
      return;
    }
    const el = ship.elements();
    const atmTop = b.atmosphereTop();
    const orbiting =
      el.e < 1 &&
      el.periapsis > b.radius + atmTop + (b.maxTerrain || 0) &&
      ship.altitude < b.radius * 4;
    if (orbiting && this._accumulate(`orbit:${b.id}`, dt, 90)) {
      this.award(`orbit:${b.id}`, 20, `Орбитальная съёмка: ${b.name}`);
    }
    if (b.atmosphere && ship.airDensity > 1e-6 && this._accumulate(`atm:${b.id}`, dt, 20)) {
      this.award(`atm:${b.id}`, 30, `Пробы атмосферы: ${b.name} (${b.atmosphere.composition})`);
    }
    if (b.gasGiant && ship.airPressure > 5e4) {
      this.award(`dive:${b.id}`, 45, `Зондирование облачного слоя: ${b.name}`);
    }
    if (ship.landed && ship.contactCount > 0) {
      this.award(`land:${b.id}`, 50, `Посадка: ${b.name}`);
      for (const s of b.def.sites || []) {
        const d = siteDistance(ship, b, s);
        if (d < 25e3)
          this.award(
            `site:${b.id}:${s.name}`,
            40,
            `Точная посадка (${(d / 1000).toFixed(1)} км): ${s.name}`,
          );
      }
      if (b.def.life) this.award(`bio:${b.id}`, 150, `Отбор образцов внеземной жизни: ${b.name}`);
    }
    if (b.def.life && ship.altitude < 20e3) {
      this.award(`biosig:${b.id}`, 80, `Биосигнатуры в атмосфере и спектре поверхности: ${b.name}`);
    }
    void t;
  }
}

export function siteDistance(ship, body, site) {
  const ll = body.latLon(ship.r);
  const la = site.lat * DEG,
    lo = site.lon * DEG;
  const c =
    Math.sin(ll.lat) * Math.sin(la) + Math.cos(ll.lat) * Math.cos(la) * Math.cos(ll.lon - lo);
  return Math.acos(Math.max(-1, Math.min(1, c))) * body.radius;
}

export function siteBearing(ship, body, site) {
  const ll = body.latLon(ship.r);
  const la = site.lat * DEG,
    lo = site.lon * DEG;
  const y = Math.sin(lo - ll.lon) * Math.cos(la);
  const x =
    Math.cos(ll.lat) * Math.sin(la) - Math.sin(ll.lat) * Math.cos(la) * Math.cos(lo - ll.lon);
  return (Math.atan2(y, x) / DEG + 360) % 360;
}
