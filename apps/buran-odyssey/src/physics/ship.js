// Flight dynamics of «Буран-М»: 6-DOF rigid body, patched-conic gravity,
// hypersonic-to-subsonic aerodynamics, entry heating, landing gear and the
// on-rails propagator used for high time-warp.
//
// Integration: semi-implicit (symplectic) Euler at a fixed 240 Hz step,
// independent of the render frame rate. Gravity from the dominant body only
// (F = G·M·m / r², the patched-conic model); the reference body switches at
// the Laplace sphere of influence.

import * as THREE from 'three';
import {
  G0,
  R_GAS,
  SIGMA_SB,
  SOLAR_CONSTANT,
  AU,
  clamp,
  smoothstep,
  lerp,
} from '../core/constants.js';
import { propagateUniversal, stateToElements } from './kepler.js';

export const PHYSICS_DT = 1 / 240;

export const SPEC = {
  dryMass: 72000, // kg — 11F35 empty mass ~62 t plus plasma drive and reactor shielding
  fuelMax: 38000, // kg of working mass (xenon/argon-lithium) for the plasma drive
  rcsFuelMax: 1600, // kg hydrazine-class monopropellant
  thrustVac: 1.6e6, // N, three plasma engines
  ispVac: 3200, // s
  rcsTorque: [9.0e5, 1.6e6, 1.6e6], // N·m about x (roll), y (pitch), z (yaw)
  rcsForce: 4.4e4, // N translation
  rcsIsp: 290,
  inertiaPerKg: [32, 118, 132], // m² — Ixx, Iyy, Izz / m
  S: 250, // m² wing reference area
  span: 23.92,
  chord: 11.5, // mean aerodynamic chord
  noseRadius: 1.0, // m, for Sutton–Graves stagnation heating
  tpsLimit: 1920, // K, RCC nose cap / leading edge limit
  tpsFail: 2300,
  emissivity: 0.85,
  arealHeatCapacity: 16000, // J/(m²·K) of the TPS surface layer
  gLimit: 9.0,
  chuteArea: 3 * 75, // m²
  chuteCd: 0.62,
  chuteMaxSpeed: 140,
  hullCrushPressure: 1.0e7, // Pa — reinforced hull, survives Venus (9.2 MPa)
  cabinMaxTemp: 390, // K — avionics limit
};

const GEAR = [
  { p: new THREE.Vector3(12.5, 0, 5.15), k: 1.4e6, c: 2.2e5, stroke: 0.55, nose: true },
  { p: new THREE.Vector3(-3.5, 3.6, 5.22), k: 2.6e6, c: 3.6e5, stroke: 0.6 },
  { p: new THREE.Vector3(-3.5, -3.6, 5.22), k: 2.6e6, c: 3.6e5, stroke: 0.6 },
];
const HULL = [
  [19.0, 0, 0.62],
  [15.0, 0, 2.3],
  [5, 0, 2.62],
  [-8, 0, 2.62],
  [-16.5, 0, 2.4],
  [-13.4, 12.0, 1.4],
  [-13.4, -12.0, 1.4],
  [-18.6, 0, -10.2],
  [0, 0, -2.62],
  [-12, 2.7, -2.4],
  [-12, -2.7, -2.4],
  [-19.6, 0, 0.5],
  [-19.4, 0, 2.05],
].map((a) => new THREE.Vector3(...a));

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _d = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _qi = new THREE.Quaternion();

export class Ship {
  constructor() {
    this.ref = null;
    this.r = new THREE.Vector3();
    this.v = new THREE.Vector3();
    this.q = new THREE.Quaternion();
    this.w = new THREE.Vector3();
    this.fuel = SPEC.fuelMax;
    this.rcsFuel = SPEC.rcsFuelMax;
    this.hullTemp = 290;
    this.cabinTemp = 293;
    this.integrity = 1;
    this.destroyed = false;
    this.destroyReason = '';
    this.gForce = 0;
    this.maxG = 0;
    this.heatFlux = 0;
    this.dynPressure = 0;
    this.mach = 0;
    this.alpha = 0;
    this.beta = 0;
    this.airDensity = 0;
    this.airPressure = 0;
    this.airTemp = 0;
    this.altitude = 0;
    this.groundAltitude = Infinity;
    this.groundNormal = new THREE.Vector3(0, 0, 1);
    this.surfaceSpeed = 0;
    this.verticalSpeed = 0;
    this.landed = false;
    this.lock = null;
    this.contactCount = 0;
    this.gearContact = [false, false, false];
    this.touchdownSpeed = 0;
    this.chuteDeployed = false;
    this.chuteLost = false;
    this.events = [];
    this.thrust = 0;
    this.aeroLocal = new THREE.Vector3();
    this.airVelLocal = new THREE.Vector3(1, 0, 0);
    this.plasma = 0;
    this.rcsActivity = new THREE.Vector3();
    this.rcsTranslate = new THREE.Vector3();
    this.sasTarget = null;
    this.onWater = false;
    this._nonGrav = new THREE.Vector3();
  }

  get mass() {
    return SPEC.dryMass + this.fuel + this.rcsFuel;
  }

  // -------------------------------------------------------------- frames
  worldPos(out = new THREE.Vector3()) {
    return out.copy(this.ref.pos).add(this.r);
  }

  worldVel(out = new THREE.Vector3()) {
    return out.copy(this.ref.vel).add(this.v);
  }

  surfaceVelocity(out = new THREE.Vector3()) {
    this.ref.surfaceVelocity(this.r, _d);
    return out.copy(this.v).sub(_d);
  }

  elements() {
    return stateToElements(this.r, this.v, this.ref.gm);
  }

  // Elements referred to the reference body's equator (what the HUD shows:
  // "51.6°" for the ISS orbit, not its tilt against the ecliptic).
  equatorialElements() {
    const ref = this.ref;
    if (ref.kind === 'star' || !ref._node) return this.elements();
    const Y = new THREE.Vector3().crossVectors(ref.pole, ref._node);
    const m = new THREE.Matrix4().makeBasis(ref._node, Y, ref.pole).transpose();
    return stateToElements(this.r.clone().applyMatrix4(m), this.v.clone().applyMatrix4(m), ref.gm);
  }

  setState(ref, r, v, q) {
    this.ref = ref;
    this.r.copy(r);
    this.v.copy(v);
    if (q) this.q.copy(q);
    this.w.set(0, 0, 0);
    this.lock = null;
    this.landed = false;
  }

  // -------------------------------------------------------------- SOI
  checkSoi(system, t) {
    const ref = this.ref;
    if (ref.parent && this.r.length() > ref.soi) {
      const p = ref.parent;
      this.r.add(ref.pos).sub(p.pos);
      this.v.add(ref.vel).sub(p.vel);
      this.ref = p;
      this.events.push({ type: 'soi', body: p });
      return true;
    }
    for (const c of ref.children) {
      if (_a.subVectors(this.r, c.relPos).length() < c.soi) {
        this.r.sub(c.relPos);
        this.v.sub(c.relVel);
        this.ref = c;
        c.updateRotation(t);
        this.events.push({ type: 'soi', body: c });
        return true;
      }
    }
    return false;
  }

  // -------------------------------------------------------------- environment
  sampleEnvironment() {
    const ref = this.ref;
    const rm = this.r.length();
    this.altitude = rm - ref.radius;
    const atm = ref.atmosphere;
    if (atm) {
      this.airDensity = atm.density(this.altitude);
      this.airTemp = atm.temperature(this.altitude);
      this.airPressure =
        this.airDensity > 0 ? (this.airDensity * R_GAS * this.airTemp) / atm.molarMass : 0;
      this.speedOfSound = atm.speedOfSound(this.altitude);
    } else {
      this.airDensity = 0;
      this.airPressure = 0;
      this.airTemp = 3;
      this.speedOfSound = 1;
    }
    // Terrain under the ship
    if (ref.heightProvider && ref.terrain) {
      _qi.copy(ref.quat).invert();
      const dir = _a.copy(this.r).applyQuaternion(_qi).divideScalar(rm);
      const h = ref.terrain.groundHeight(dir.x, dir.y, dir.z);
      this.groundHeight = h;
      this.groundAltitude = rm - (ref.radius + h);
      // Ground normal by central differences (body-fixed -> inertial).
      const e = 2 / ref.radius;
      const t1 = _b.set(-dir.y, dir.x, 0);
      if (t1.lengthSq() < 1e-12) t1.set(1, 0, 0);
      t1.normalize();
      const t2 = _c.crossVectors(dir, t1);
      const p0 = dir.clone().multiplyScalar(ref.radius + h);
      const d1 = dir.clone().addScaledVector(t1, e).normalize();
      const d2 = dir.clone().addScaledVector(t2, e).normalize();
      const p1 = d1.multiplyScalar(ref.radius + ref.terrain.groundHeight(d1.x, d1.y, d1.z));
      const p2 = d2.multiplyScalar(ref.radius + ref.terrain.groundHeight(d2.x, d2.y, d2.z));
      const n = new THREE.Vector3().crossVectors(p1.sub(p0), p2.sub(p0)).normalize();
      if (n.dot(dir) < 0) n.negate();
      this.groundNormal.copy(n.applyQuaternion(ref.quat));
      this.onWater = ref.heightProvider.isOcean
        ? ref.heightProvider.isOcean(dir.x, dir.y, dir.z) && h < 2
        : false;
    } else {
      this.groundHeight = 0;
      this.groundAltitude = ref.gasGiant || ref.kind === 'star' ? Infinity : this.altitude;
      this.groundNormal.copy(this.r).normalize();
      this.onWater = false;
    }
    const vs = this.surfaceVelocity(new THREE.Vector3());
    this.surfaceSpeed = vs.length();
    this.verticalSpeed = vs.dot(_a.copy(this.r).normalize());
  }

  // -------------------------------------------------------------- aerodynamics
  // Coefficients over α (rad), β (rad), Mach. Subsonic: linear-lift delta wing
  // with polar CD = CD0 + k·CL²; hypersonic: modified Newtonian impact theory
  // (Cp = Cpmax·sin²θ); transonic drag rise between.
  static aeroCoefficients(alpha, beta, mach, cfg) {
    const sa = Math.sin(alpha),
      ca = Math.cos(alpha);
    const hyp = smoothstep(1.2, 5.0, mach);
    // Subsonic
    const stall = 1 - 0.45 * smoothstep(0.45, 0.85, Math.abs(alpha));
    const CLsub = 1.2 * Math.sin(2 * alpha) * stall;
    const CD0 = 0.04 + (cfg.gear ? 0.022 : 0) + cfg.speedBrake * 0.07 + cfg.bodyFlap * 0.01;
    const CDsub = CD0 + 0.2 * CLsub * CLsub + 1.1 * Math.abs(sa * sa * sa);
    // Transonic drag rise
    const wave = 0.07 * Math.exp(-((mach - 1.05) ** 2) / 0.05);
    // Newtonian (Cpmax ≈ 1.84 behind a normal shock at γ = 1.2–1.4)
    const CN = 1.84 * sa * Math.abs(sa) + 0.08 * sa;
    const CA = 0.07;
    const CLhyp = CN * ca - CA * sa;
    const CDhyp = Math.abs(CN * sa) + CA * ca;
    return {
      CL: lerp(CLsub, CLhyp, hyp),
      CD: lerp(CDsub, CDhyp, hyp) + wave,
      CY: -0.9 * Math.sin(beta),
      hyp,
    };
  }

  // -------------------------------------------------------------- main step
  // ctrl: { pitch, yaw, roll, throttle, tx, ty, tz, rcs, sas, sasMode, gear, brakes, chute, speedBrake }
  step(dt, ctrl, t) {
    if (this.destroyed) return;
    const ref = this.ref;
    ref.updateRotation(t);
    if (this.lock) {
      this._applyLock();
      return;
    }
    const m = this.mass;
    const I = SPEC.inertiaPerKg.map((k) => k * m);
    const force = _forceAcc.set(0, 0, 0); // inertial, non-gravitational
    const torque = _torqueAcc.set(0, 0, 0); // body
    const q = this.q;
    _qi.copy(q).invert();

    const rm = this.r.length();
    const alt = rm - ref.radius;
    const atm = ref.atmosphere;
    const rho = atm && alt < atm.top * 1.6 ? atm.density(alt) : 0;

    // --- Air-relative velocity
    const vAir = ref.surfaceVelocity(this.r, _a).negate().add(this.v); // inertial
    const V = vAir.length();
    const vb = _b.copy(vAir).applyQuaternion(_qi); // body
    this.airVelLocal.copy(vb).normalize(); // direction of travel through the air (body axes)
    const qbar = 0.5 * rho * V * V;
    this.dynPressure = qbar;
    const a = atm ? atm.speedOfSound(alt) : 1;
    this.mach = V / a;
    let atmFactor = 0;

    if (rho > 1e-10 && V > 0.5) {
      const alpha = Math.atan2(vb.z, vb.x);
      const beta = Math.asin(clamp(vb.y / V, -1, 1));
      this.alpha = alpha;
      this.beta = beta;
      const cfg = { gear: ctrl.gear > 0.5, speedBrake: ctrl.speedBrake, bodyFlap: 0 };
      const co = Ship.aeroCoefficients(alpha, beta, this.mach, cfg);
      const ev = _c.copy(vb).divideScalar(V);
      const upB = _d.set(0, 0, -1).addScaledVector(ev, ev.z).normalize(); // ⊥ to flow, "up"
      const sideB = new THREE.Vector3(0, 1, 0).addScaledVector(ev, -ev.y).normalize();
      const S = SPEC.S;
      const Fb = new THREE.Vector3()
        .addScaledVector(ev, -co.CD * qbar * S)
        .addScaledVector(upB, co.CL * qbar * S)
        .addScaledVector(sideB, co.CY * qbar * S);
      // Drag chute cluster
      if (this.chuteDeployed && !this.chuteLost) {
        if (V > SPEC.chuteMaxSpeed) {
          this.chuteLost = true;
          this.events.push({ type: 'chuteRupture' });
        } else Fb.addScaledVector(ev, -SPEC.chuteCd * SPEC.chuteArea * qbar);
      }
      this.aeroLocal.copy(Fb);
      force.add(Fb.applyQuaternion(q));

      // Moments: fly-by-wire commands angle of attack; natural stability and damping.
      const c = SPEC.chord,
        b = SPEC.span;
      const trim = lerp(0.1, 0.66, co.hyp) + ctrl.pitch * lerp(0.35, 0.25, co.hyp);
      const pRate = this.w.x,
        qRate = this.w.y,
        rRate = this.w.z;
      const Vn = Math.max(V, 20);
      const Cm = -0.9 * (alpha - trim) - 8 * ((qRate * c) / (2 * Vn));
      const Cl =
        0.12 * ctrl.roll * (1 - 0.6 * co.hyp) - 0.45 * ((pRate * b) / (2 * Vn)) - 0.08 * beta;
      const Cn =
        0.14 * beta * (1 - 0.5 * co.hyp) +
        0.06 * ctrl.yaw * (1 - co.hyp) -
        0.35 * ((rRate * b) / (2 * Vn));
      const damp = smoothstep(0, 400, qbar); // FBW is ineffective in near-vacuum
      torque.x += Cl * qbar * S * b * damp;
      torque.y += Cm * qbar * S * c * damp;
      torque.z += Cn * qbar * S * b * damp;
      // Fly-by-wire rate damping (ζ ≈ 0.7 of the short-period / dutch-roll modes):
      // at hypersonic speed the aerodynamic damping derivatives alone are tiny.
      const kP = 2 * 0.7 * Math.sqrt(0.9 * qbar * S * c * I[1]);
      const kR = 2 * 0.7 * Math.sqrt(0.2 * qbar * S * b * I[0]);
      const kY = 2 * 0.7 * Math.sqrt(0.14 * qbar * S * b * I[2]);
      torque.x -= kR * pRate * damp;
      torque.y -= kP * qRate * damp;
      torque.z -= kY * rRate * damp;
      atmFactor = clamp(rho / (atm.rho0 || 1), 0, 1);
    } else {
      this.alpha = 0;
      this.beta = 0;
      this.aeroLocal.set(0, 0, 0);
    }

    // --- Entry heating (Sutton–Graves convective + solar), TPS energy balance
    const k = atm ? atm.heatK : 0;
    const qConv = rho > 0 ? k * Math.sqrt(rho / SPEC.noseRadius) * V * V * V : 0;
    const starDist = this.worldPos(_c).distanceTo(ref.system.star.pos);
    const starL = ref.system.star.def.star?.luminosity ?? 3.828e26;
    const solar = (starL / (4 * Math.PI * starDist * starDist)) * 0.25 * 0.4;
    const Tamb = atm ? Math.max(3, atm.temperature(alt)) : 3;
    const hConv = rho > 0 ? 8 + 3.5 * Math.sqrt(rho * Math.max(V, 1)) : 0; // convective exchange with air
    const qNet =
      qConv * 0.85 +
      solar -
      SPEC.emissivity * SIGMA_SB * (this.hullTemp ** 4 - Tamb ** 4) -
      hConv * (this.hullTemp - Tamb) * (qConv < 5e3 ? 1 : 0);
    this.hullTemp = Math.max(3, this.hullTemp + (qNet / SPEC.arealHeatCapacity) * dt);
    this.heatFlux = qConv;
    this.plasma = clamp((qConv - 1.5e5) / 6e5, 0, 1.5);
    // Cabin heat soak (Venus!)
    this.cabinTemp +=
      ((Math.max(Tamb, this.hullTemp * 0.02 + 280) - this.cabinTemp) / 5400) *
      dt *
      (rho > 0.5 ? 1 : 0.02);
    if (this.hullTemp > SPEC.tpsLimit)
      this.integrity -= ((this.hullTemp - SPEC.tpsLimit) / 380) * dt * 0.15;

    // --- Plasma drive
    const pAmb = atm ? this.airPressure || 0 : 0;
    const thrust =
      this.fuel > 0 ? ctrl.throttle * SPEC.thrustVac * (1 - 0.3 * Math.min(1, pAmb / 101325)) : 0;
    if (thrust > 0) {
      force.add(_c.set(1, 0, 0).applyQuaternion(q).multiplyScalar(thrust));
      this.fuel = Math.max(
        0,
        this.fuel - (ctrl.throttle * SPEC.thrustVac * dt) / (SPEC.ispVac * G0),
      );
    }
    this.thrust = thrust;

    // --- RCS: attitude + translation
    const cmd = this._attitudeCommand(ctrl, I, rho);
    this.rcsActivity.copy(cmd);
    if (ctrl.rcs && this.rcsFuel > 0) {
      torque.x += cmd.x * SPEC.rcsTorque[0];
      torque.y += cmd.y * SPEC.rcsTorque[1];
      torque.z += cmd.z * SPEC.rcsTorque[2];
      const tr = _d.set(ctrl.tx, ctrl.ty, ctrl.tz);
      this.rcsTranslate.copy(tr);
      force.add(tr.clone().multiplyScalar(SPEC.rcsForce).applyQuaternion(q));
      const use = (Math.abs(cmd.x) + Math.abs(cmd.y) + Math.abs(cmd.z)) * 0.3 + tr.length();
      this.rcsFuel = Math.max(0, this.rcsFuel - (use * SPEC.rcsForce * dt) / (SPEC.rcsIsp * G0));
    } else this.rcsTranslate.set(0, 0, 0);

    // --- Ground contact
    this.contactCount = 0;
    if (ref.terrain && this.groundAltitude < 40) this._contacts(ctrl, force, torque);

    // --- Integrate translation (gravity F = G·M·m/r² toward the body centre)
    const gAcc = -ref.gm / (rm * rm * rm);
    this._nonGrav.copy(force).divideScalar(m);
    this.v.addScaledVector(this.r, gAcc * dt).addScaledVector(this._nonGrav, dt);
    this.r.addScaledVector(this.v, dt);

    // --- Integrate rotation (Euler's equations in body axes)
    const w = this.w;
    const Iw = _c.set(I[0] * w.x, I[1] * w.y, I[2] * w.z);
    const gyro = _d.crossVectors(w, Iw);
    w.x += ((torque.x - gyro.x) / I[0]) * dt;
    w.y += ((torque.y - gyro.y) / I[1]) * dt;
    w.z += ((torque.z - gyro.z) / I[2]) * dt;
    const wl = w.length();
    if (wl > 1e-9) {
      _q.setFromAxisAngle(_c.copy(w).divideScalar(wl), wl * dt);
      q.multiply(_q).normalize();
    }

    // --- Loads and failure modes
    this.gForce = this._nonGrav.length() / G0;
    this.maxG = Math.max(this.maxG * 0.999, this.gForce);
    if (this.gForce > SPEC.gLimit) this.integrity -= (this.gForce - SPEC.gLimit) * dt * 0.08;
    if (
      this.airPressure > (ref.atmosphere?.crushPressure ?? Infinity) ||
      this.airPressure > SPEC.hullCrushPressure
    )
      this.destroy(`Корпус раздавлен: ${(this.airPressure / 1e5).toFixed(1)} бар`);
    if (this.hullTemp > SPEC.tpsFail) this.destroy('Прогар теплозащиты');
    if (this.cabinTemp > SPEC.cabinMaxTemp) this.destroy('Перегрев бортовой аппаратуры');
    if (this.integrity <= 0) this.destroy('Разрушение конструкции');
    if (ref.kind === 'star' && rm < ref.radius * 1.05) this.destroy('Поглощён звездой');
    this.atmFactor = atmFactor;
  }

  // Attitude command in body axes, -1..1: pilot input where given, otherwise SAS.
  _attitudeCommand(ctrl, I, rho) {
    const out = new THREE.Vector3(ctrl.roll, ctrl.pitch, ctrl.yaw);
    if (!ctrl.sas) return out;
    const maxAcc = [SPEC.rcsTorque[0] / I[0], SPEC.rcsTorque[1] / I[1], SPEC.rcsTorque[2] / I[2]];
    const err = this._sasError(ctrl);
    const wv = this.w;
    const axes = ['x', 'y', 'z'];
    for (let i = 0; i < 3; i++) {
      const ax = axes[i];
      if (Math.abs(out[ax]) > 0.01) continue;
      const e = err ? err[ax] : 0;
      // Time-optimal rate profile with a proportional band near zero.
      const wDes =
        Math.sign(e) * Math.min(Math.sqrt(2 * maxAcc[i] * 0.7 * Math.abs(e)), 0.25) * (err ? 1 : 0);
      const dw = wDes - wv[ax];
      // Deadband: real attitude control fires in pulses, not continuously.
      if (Math.abs(e) < 0.003 && Math.abs(dw) < 0.0015) {
        out[ax] = 0;
        continue;
      }
      out[ax] = clamp((dw / (maxAcc[i] * 0.6)) * (rho > 0.05 ? 0.4 : 1), -1, 1);
    }
    return out;
  }

  // Rotation error (body axes, rad) toward the SAS target, or null to just kill rates.
  _sasError(ctrl) {
    const mode = ctrl.sasMode;
    const q = this.q;
    let fwd;
    const orbital = this.altitude > (this.ref.atmosphereTop() || 0) + 5000;
    const vel = orbital ? this.v.clone() : this.surfaceVelocity(new THREE.Vector3());
    if (vel.lengthSq() < 1)
      return mode === 'hold' && this.sasTarget ? quatError(q, this.sasTarget) : null;
    switch (mode) {
      case 'prograde':
        fwd = vel.normalize();
        break;
      case 'retrograde':
        fwd = vel.normalize().negate();
        break;
      case 'radialOut':
        fwd = this.r.clone().normalize();
        break;
      case 'radialIn':
        fwd = this.r.clone().normalize().negate();
        break;
      case 'normal':
        fwd = new THREE.Vector3().crossVectors(this.r, this.v).normalize();
        break;
      case 'antiNormal':
        fwd = new THREE.Vector3().crossVectors(this.v, this.r).normalize();
        break;
      case 'target':
        fwd = ctrl.targetDir ? ctrl.targetDir.clone() : null;
        break;
      default:
        return this.sasTarget ? quatError(q, this.sasTarget) : null;
    }
    if (!fwd) return null;
    const fb = fwd.applyQuaternion(_qi.copy(q).invert());
    // Rotation taking body +X onto fb: axis = X × fb.
    const axis = new THREE.Vector3(0, -fb.z, fb.y);
    const s = axis.length();
    const ang = Math.atan2(s, fb.x);
    if (s < 1e-9) return new THREE.Vector3(0, fb.x < 0 ? Math.PI : 0, 0);
    return axis.multiplyScalar(ang / s);
  }

  _contacts(ctrl, force, torque) {
    const ref = this.ref;
    const q = this.q;
    const qi = _qi.copy(ref.quat).invert();
    let destroyed = null;
    const pts = [];
    if (ctrl.gear > 0.98) GEAR.forEach((g, i) => pts.push({ p: g.p, gear: g, idx: i }));
    for (const h of HULL) pts.push({ p: h, gear: null });
    this.gearContact = [false, false, false];
    let hullHit = false;
    for (const c of pts) {
      const arm = _a.copy(c.p).applyQuaternion(q); // inertial lever arm
      const P = _b.copy(this.r).add(arm);
      const Pm = P.length();
      const dir = _c.copy(P).applyQuaternion(qi).divideScalar(Pm);
      const hg = ref.terrain.groundHeight(dir.x, dir.y, dir.z);
      const pen = ref.radius + hg - Pm;
      if (pen <= 0) continue;
      this.contactCount++;
      const n = this.groundNormal;
      // Contact point velocity relative to the (rotating) ground.
      const wI = _d.copy(this.w).applyQuaternion(q);
      const vP = new THREE.Vector3()
        .crossVectors(wI, arm)
        .add(this.v)
        .sub(ref.surfaceVelocity(P, new THREE.Vector3()));
      const vn = vP.dot(n);
      const vt = vP.clone().addScaledVector(n, -vn);
      let N, mu, visc;
      if (this.onWater) {
        N = Math.max(0, 4e5 * pen - 6e5 * vn);
        mu = 0.9;
        visc = 3e5;
        if (!this.splashed) {
          this.splashed = true;
          this.events.push({ type: 'splash', speed: vP.length() });
        }
      } else if (c.gear) {
        const g = c.gear;
        N = Math.max(0, g.k * pen - g.c * vn);
        if (pen > g.stroke && vn < -4.5) destroyed = 'Разрушение шасси при посадке';
        mu = 0;
        visc = 2.5e5;
        this.gearContact[c.idx] = true;
        if (!this._gearWasDown?.[c.idx] && vn < -0.3) {
          this.touchdownSpeed = -vn;
          this.events.push({ type: 'touchdown', speed: -vn, gear: c.idx });
        }
      } else {
        N = Math.max(0, 8e6 * pen - 1.2e6 * vn);
        mu = 0.55;
        visc = 4e5;
        if (vn < -3.0 || vt.length() > 60) destroyed = destroyed ?? 'Удар корпусом о поверхность';
        else if (vn < -0.8) this.integrity -= 0.02;
        hullHit = true;
      }
      const F = n.clone().multiplyScalar(N);
      if (c.gear) {
        // Tyres: free rolling along the fuselage axis (brakes add friction), grip laterally.
        const fwd = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
        fwd.addScaledVector(n, -fwd.dot(n)).normalize();
        const lat = new THREE.Vector3().crossVectors(n, fwd);
        const vf = vt.dot(fwd),
          vl = vt.dot(lat);
        const muRoll = ctrl.brakes && !c.gear.nose ? 0.45 : 0.012;
        const ff = -Math.sign(vf) * Math.min(muRoll * N, Math.abs(vf) * visc);
        const fl = -Math.sign(vl) * Math.min(0.75 * N, Math.abs(vl) * visc);
        // Nose-wheel steering follows the yaw input on the ground.
        const steer = c.gear.nose ? ctrl.yaw * 0.25 * N : 0;
        F.addScaledVector(fwd, ff).addScaledVector(lat, fl + steer);
      } else {
        const vtl = vt.length();
        if (vtl > 1e-4) F.addScaledVector(vt, -Math.min(mu * N, vtl * visc) / vtl);
      }
      force.add(F);
      const tb = new THREE.Vector3().crossVectors(arm, F).applyQuaternion(_q.copy(q).invert());
      torque.add(tb);
    }
    this._gearWasDown = this.gearContact.slice();
    if (hullHit && !this._hullWas) this.events.push({ type: 'scrape', speed: this.surfaceSpeed });
    this._hullWas = hullHit;
    if (destroyed) this.destroy(destroyed);
    // Settled on the ground?
    this.landed = this.contactCount > 0 && this.surfaceSpeed < 0.25 && this.w.length() < 0.02;
  }

  lockToSurface() {
    if (!this.landed || this.lock) return;
    const qi = new THREE.Quaternion().copy(this.ref.quat).invert();
    this.lock = {
      r: this.r.clone().applyQuaternion(qi),
      q: qi.clone().multiply(this.q),
    };
  }

  unlock() {
    this.lock = null;
  }

  _applyLock() {
    this.r.copy(this.lock.r).applyQuaternion(this.ref.quat);
    this.ref.surfaceVelocity(this.r, this.v);
    this.q.copy(this.ref.quat).multiply(this.lock.q);
    this.w.set(0, 0, 0);
    this.gForce = this.ref.surfaceGravity / G0;
  }

  // Exact two-body propagation for time warp. Returns false (and stops early)
  // when something needs full physics: atmosphere, terrain proximity.
  propagateOnRails(dt, system, t0, sasMode) {
    if (this.lock) {
      system.update(t0 + dt);
      this._applyLock();
      return { ok: true, t: t0 + dt };
    }
    let t = t0;
    let remaining = dt;
    let guard = 0;
    while (remaining > 0 && guard++ < 4000) {
      const rm = this.r.length();
      const vm = this.v.length();
      const el = this.elements();
      let h = Math.min(
        remaining,
        isFinite(el.period) ? el.period / 90 : (rm / Math.max(vm, 1)) * 0.05,
      );
      h = Math.max(h, 0.5);
      propagateUniversal(this.r, this.v, this.ref.gm, h);
      t += h;
      remaining -= h;
      system.update(t);
      this.checkSoi(system, t);
      const ref = this.ref;
      const alt = this.r.length() - ref.radius;
      const guardAlt =
        (ref.atmosphere ? ref.atmosphere.top : 0) + Math.max(ref.maxTerrain || 0, 0) + 15000;
      if (alt < guardAlt && this.v.dot(this.r) < 0) return { ok: false, t, reason: 'altitude' };
    }
    if (sasMode === 'prograde' || sasMode === 'retrograde') {
      const f = this.v.clone().normalize();
      if (sasMode === 'retrograde') f.negate();
      this.q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), f);
    }
    this.w.set(0, 0, 0);
    return { ok: true, t };
  }

  destroy(reason) {
    if (this.destroyed) return;
    this.destroyed = true;
    this.destroyReason = reason;
    this.integrity = 0;
    this.events.push({ type: 'destroyed', reason });
  }

  refuel() {
    this.fuel = SPEC.fuelMax;
    this.rcsFuel = SPEC.rcsFuelMax;
    this.integrity = 1;
    this.hullTemp = Math.max(this.airTemp || 290, 250);
    this.cabinTemp = 293;
  }
}

const _forceAcc = new THREE.Vector3();
const _torqueAcc = new THREE.Vector3();

function quatError(q, target) {
  const e = q.clone().invert().multiply(target);
  if (e.w < 0) e.set(-e.x, -e.y, -e.z, -e.w);
  const s = Math.sqrt(1 - Math.min(1, e.w * e.w));
  const ang = 2 * Math.acos(Math.min(1, e.w));
  if (s < 1e-9) return new THREE.Vector3();
  return new THREE.Vector3(e.x / s, e.y / s, e.z / s).multiplyScalar(ang);
}

// Hohmann transfer helper for the navigation computer.
export function hohmann(mu, r1, r2) {
  const a = (r1 + r2) / 2;
  const dv1 = Math.sqrt(mu / r1) * (Math.sqrt((2 * r2) / (r1 + r2)) - 1);
  const dv2 = Math.sqrt(mu / r2) * (1 - Math.sqrt((2 * r1) / (r1 + r2)));
  const tof = Math.PI * Math.sqrt((a * a * a) / mu);
  const phase = Math.PI - tof * Math.sqrt(mu / (r2 * r2 * r2));
  return { dv1, dv2, tof, phase };
}

export { SOLAR_CONSTANT, AU };
