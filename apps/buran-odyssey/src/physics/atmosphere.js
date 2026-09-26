// Atmosphere model: density, pressure, temperature and speed of sound versus
// geometric altitude. Density is hydrostatic: for bodies without a measured
// table the scale height H = R·T / (M·g) and the surface density
// ρ0 = P0·M / (R·T0) follow from the ideal gas law. Below the reference level
// (gas giants, whose "surface" is the 1 bar level) the same exponential keeps
// going, which is what makes a dive into Jupiter lethal.

import { R_GAS } from '../core/constants.js';

export class Atmosphere {
  constructor(def, surfaceGravity) {
    this.def = def;
    this.composition = def.composition;
    this.molarMass = def.molarMass;
    this.gamma = def.gamma ?? 1.4;
    this.T0 = def.T0;
    this.P0 = def.P0;
    this.lapse = def.lapse ?? 0;
    this.Tmin = def.Tmin ?? def.T0 * 0.5;
    this.table = def.table ?? null;
    this.rho0 = def.table ? def.table[0][1] : (def.P0 * def.molarMass) / (R_GAS * def.T0);
    this.H = def.table ? 8500 : (R_GAS * def.T0) / (def.molarMass * surfaceGravity);
    // Where density falls to 1e-9 kg/m³ drag becomes negligible even at orbital
    // speed; that is the entry interface the HUD and the renderer use.
    this.top = def.top ?? Math.max(20e3, this.H * Math.log(this.rho0 / 1e-9));
    this.heatK = def.heatK ?? 1.7415e-4;
    this.crushPressure = def.crushPressure ?? Infinity;
  }

  density(h) {
    if (h > this.top * 1.6) return 0;
    if (this.table) {
      const t = this.table;
      if (h <= t[0][0]) return t[0][1] * Math.exp(-(h - t[0][0]) / t[0][2]);
      let i = t.length - 1;
      while (i > 0 && t[i][0] > h) i--;
      return t[i][1] * Math.exp(-(h - t[i][0]) / t[i][2]);
    }
    return this.rho0 * Math.exp(-h / this.H);
  }

  temperature(h) {
    return Math.max(this.Tmin, this.T0 - this.lapse * h);
  }

  pressure(h) {
    // p = ρ R T / M keeps pressure consistent with whichever density model is used.
    return (this.density(h) * R_GAS * this.temperature(h)) / this.molarMass;
  }

  speedOfSound(h) {
    return Math.sqrt((this.gamma * R_GAS * this.temperature(h)) / this.molarMass);
  }
}
