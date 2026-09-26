// Runtime celestial bodies: ephemerides (where each body is at time t) and
// orientation (how its surface is turned). All positions are in the inertial
// J2000 ecliptic frame, metres, relative to the system's central star.

import * as THREE from 'three';
import { AU, DAY, DEG, JULIAN_CENTURY, OBLIQUITY_J2000 } from '../core/constants.js';
import { elementsToState } from './kepler.js';
import { Atmosphere } from './atmosphere.js';

const EQ_TO_ECL = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(1, 0, 0),
  -OBLIQUITY_J2000,
);
const YEAR_DAYS = 365.25;

export class Body {
  constructor(def, system) {
    this.def = def;
    this.system = system;
    this.id = def.id;
    this.name = def.name;
    this.kind = def.kind;
    this.gm = def.gm;
    this.radius = def.radius;
    this.gasGiant = !!def.gasGiant;
    this.parent = null;
    this.children = [];
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.relPos = new THREE.Vector3(); // relative to parent
    this.relVel = new THREE.Vector3();
    this.quat = new THREE.Quaternion(); // body-fixed -> inertial
    this.angVel = new THREE.Vector3(); // inertial, rad/s
    this.pole = new THREE.Vector3(0, 0, 1);
    this.surfaceGravity = def.gm / (def.radius * def.radius);
    this.atmosphere = def.atmosphere ? new Atmosphere(def.atmosphere, this.surfaceGravity) : null;
    this.soi = Infinity;
    this.heightProvider = null; // attached by the world layer
    this.visual = null;
    this.maxTerrain = def.terrain ? (def.terrain.max ?? 8000) : (def.terrainMax ?? 0);
    this._setupRotation();
  }

  _setupRotation() {
    const r = this.def.rotation;
    if (!r) return;
    const ra = r.ra * DEG;
    const dec = r.dec * DEG;
    // Pole and the ascending node of the body equator on the ICRF equator.
    const pole = new THREE.Vector3(
      Math.cos(dec) * Math.cos(ra),
      Math.cos(dec) * Math.sin(ra),
      Math.sin(dec),
    );
    const node = new THREE.Vector3(-Math.sin(ra), Math.cos(ra), 0);
    if (!r.ecliptic) {
      pole.applyQuaternion(EQ_TO_ECL);
      node.applyQuaternion(EQ_TO_ECL);
    }
    this.pole.copy(pole).normalize();
    this._node = node.normalize();
    this._nodeCross = new THREE.Vector3().crossVectors(this.pole, this._node);
    this.rotationRate = (r.wd * DEG) / DAY; // rad/s, negative = retrograde
    this.siderealDay = Math.abs((2 * Math.PI) / this.rotationRate);
    this.angVel.copy(this.pole).multiplyScalar(this.rotationRate);
  }

  updateRotation(t) {
    const r = this.def.rotation;
    if (!r) return;
    const W = r.w0 * DEG + this.rotationRate * t;
    const cW = Math.cos(W),
      sW = Math.sin(W);
    const X = this._node.clone().multiplyScalar(cW).addScaledVector(this._nodeCross, sW);
    const Z = this.pole;
    const Y = new THREE.Vector3().crossVectors(Z, X);
    _m.makeBasis(X, Y, Z);
    this.quat.setFromRotationMatrix(_m);
  }

  // Heliocentric -> body-fixed (rotating) direction/position helpers.
  toBodyFixed(vInertialRel, out = new THREE.Vector3()) {
    _qi.copy(this.quat).invert();
    return out.copy(vInertialRel).applyQuaternion(_qi);
  }

  toInertial(vBodyFixed, out = new THREE.Vector3()) {
    return out.copy(vBodyFixed).applyQuaternion(this.quat);
  }

  // Velocity of the atmosphere / ground at inertial offset r from the centre.
  surfaceVelocity(r, out = new THREE.Vector3()) {
    return out.crossVectors(this.angVel, r);
  }

  latLon(rInertialRel) {
    const b = this.toBodyFixed(rInertialRel, _v).normalize();
    return { lat: Math.asin(THREE.MathUtils.clamp(b.z, -1, 1)), lon: Math.atan2(b.y, b.x) };
  }

  dirFromLatLon(latDeg, lonDeg, out = new THREE.Vector3()) {
    const la = latDeg * DEG,
      lo = lonDeg * DEG;
    return out.set(Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la));
  }

  terrainHeight(dirBodyFixed) {
    return this.heightProvider ? this.heightProvider.height(dirBodyFixed) : 0;
  }

  atmosphereTop() {
    return this.atmosphere ? this.atmosphere.top : 0;
  }
}

const _m = new THREE.Matrix4();
const _qi = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _br = new THREE.Vector3();
const _bv = new THREE.Vector3();

// JPL approximate elements -> heliocentric state.
function jplState(orbit, t, mu, outR, outV) {
  const T = t / JULIAN_CENTURY;
  const e0 = orbit.el,
    rt = orbit.rates;
  const a = (e0[0] + rt[0] * T) * AU;
  const e = e0[1] + rt[1] * T;
  const I = (e0[2] + rt[2] * T) * DEG;
  const L = (e0[3] + rt[3] * T) * DEG;
  const varpi = (e0[4] + rt[4] * T) * DEG;
  const Omega = (e0[5] + rt[5] * T) * DEG;
  const omega = varpi - Omega;
  const M = L - varpi;
  return elementsToState({ a, e, i: I, Omega, omega, M }, mu, outR, outV);
}

// Mean-element moon orbits, in the ecliptic or in the parent's equator.
function keplerState(orbit, t, mu, parent, outR, outV) {
  const days = t / DAY;
  const years = days / YEAR_DAYS;
  const Omega = (orbit.node + (orbit.nodeRate ?? 0) * years) * DEG;
  const varpi = (orbit.peri + (orbit.periRate ?? 0) * years) * DEG;
  const L = (orbit.L0 + orbit.n * days) * DEG;
  const omega = varpi - Omega;
  const M = L - varpi;
  const el = { a: orbit.a, e: orbit.e, i: orbit.i * DEG, Omega, omega, M };
  elementsToState(el, mu, outR, outV);
  if (orbit.frame === 'parentEquator' && parent) {
    // Elements are referred to the parent's equator: rotate by the parent's
    // (non-rotating) equatorial frame.
    const Z = parent.pole;
    const X = parent._node;
    const Y = new THREE.Vector3().crossVectors(Z, X);
    _m.makeBasis(X, Y, Z);
    outR.applyMatrix4(_m);
    outV.applyMatrix4(_m);
  }
}

// Procedural systems use plain elements with a fixed epoch.
function simpleState(orbit, t, mu, parent, outR, outV) {
  const n = Math.sqrt(mu / Math.abs(orbit.a) ** 3);
  const el = {
    a: orbit.a,
    e: orbit.e,
    i: orbit.i,
    Omega: orbit.Omega,
    omega: orbit.omega,
    M: orbit.M0 + n * t,
  };
  elementsToState(el, mu, outR, outV);
  if (orbit.frame === 'parentEquator' && parent) {
    const Y = new THREE.Vector3().crossVectors(parent.pole, parent._node);
    _m.makeBasis(parent._node, Y, parent.pole);
    outR.applyMatrix4(_m);
    outV.applyMatrix4(_m);
  }
}

export class StarSystem {
  constructor(defs, meta = {}) {
    this.meta = meta; // { name, seed, sol }
    this.bodies = [];
    this.byId = new Map();
    for (const d of defs) {
      const b = new Body(d, this);
      this.bodies.push(b);
      this.byId.set(d.id, b);
    }
    for (const b of this.bodies) {
      if (b.def.parent) {
        b.parent = this.byId.get(b.def.parent);
        b.parent.children.push(b);
      }
    }
    this.star = this.bodies.find((b) => !b.parent);
    // Parents first so children can add their parent's state.
    this.ordered = [];
    const visit = (b) => {
      this.ordered.push(b);
      b.children.forEach(visit);
    };
    visit(this.star);
    this.update(0);
    this._computeSoi();
  }

  _computeSoi() {
    for (const b of this.bodies) {
      if (!b.parent) continue;
      const a = b.relPos.length();
      b.soi = a * Math.pow(b.gm / b.parent.gm, 0.4); // Laplace sphere of influence
    }
  }

  update(t) {
    this.t = t;
    for (const b of this.ordered) this.updateBody(b, t);
  }

  updateBody(b, t) {
    b.updateRotation(t);
    if (!b.parent) {
      b.pos.set(0, 0, 0);
      b.vel.set(0, 0, 0);
      return;
    }
    const o = b.def.orbit;
    const mu = b.parent.gm + b.gm;
    if (o.type === 'jpl') jplState(o, t, mu, b.relPos, b.relVel);
    else if (o.type === 'kepler') keplerState(o, t, mu, b.parent, b.relPos, b.relVel);
    else simpleState(o, t, mu, b.parent, b.relPos, b.relVel);
    if (o.barycenterWith) {
      // JPL tabulates the Earth–Moon barycentre; move Earth off it by the
      // Moon's share (≈4670 km) so both bodies sit where they really are.
      const m = this.byId.get(o.barycenterWith);
      keplerState(m.def.orbit, t, b.gm + m.gm, b, _br, _bv);
      const k = m.gm / (b.gm + m.gm);
      b.relPos.addScaledVector(_br, -k);
      b.relVel.addScaledVector(_bv, -k);
    }
    b.pos.copy(b.parent.pos).add(b.relPos);
    b.vel.copy(b.parent.vel).add(b.relVel);
  }

  get(id) {
    return this.byId.get(id);
  }
}
