// Two-body orbital mechanics: conversion between Keplerian elements and state
// vectors, and exact propagation with the universal-variable formulation
// (Vallado, "Fundamentals of Astrodynamics", alg. 8), which handles circular,
// elliptic, parabolic and hyperbolic arcs with a single code path.

import * as THREE from 'three';

const TWO_PI = Math.PI * 2;

export function solveKeplerElliptic(M, e) {
  M = ((M % TWO_PI) + TWO_PI) % TWO_PI;
  let E = e < 0.8 ? M : Math.PI;
  for (let i = 0; i < 30; i++) {
    const f = E - e * Math.sin(E) - M;
    const d = f / (1 - e * Math.cos(E));
    E -= d;
    if (Math.abs(d) < 1e-13) break;
  }
  return E;
}

export function solveKeplerHyperbolic(M, e) {
  let H = Math.asinh(M / e);
  for (let i = 0; i < 50; i++) {
    const f = e * Math.sinh(H) - H - M;
    const d = f / (e * Math.cosh(H) - 1);
    H -= d;
    if (Math.abs(d) < 1e-13) break;
  }
  return H;
}

// Rotation from the orbital (perifocal) frame to the reference frame.
function perifocalBasis(i, Omega, omega) {
  const cO = Math.cos(Omega),
    sO = Math.sin(Omega);
  const cw = Math.cos(omega),
    sw = Math.sin(omega);
  const ci = Math.cos(i),
    si = Math.sin(i);
  const P = new THREE.Vector3(cO * cw - sO * sw * ci, sO * cw + cO * sw * ci, sw * si);
  const Q = new THREE.Vector3(-cO * sw - sO * cw * ci, -sO * sw + cO * cw * ci, cw * si);
  return { P, Q };
}

// el: { a, e, i, Omega, omega, M } (radians, metres). Returns r, v in the frame
// the elements are referred to.
export function elementsToState(el, mu, outR = new THREE.Vector3(), outV = new THREE.Vector3()) {
  const { a, e, i, Omega, omega, M } = el;
  const { P, Q } = perifocalBasis(i, Omega, omega);
  let x, y, vx, vy;
  if (e < 1) {
    const E = solveKeplerElliptic(M, e);
    const cE = Math.cos(E),
      sE = Math.sin(E);
    const b = a * Math.sqrt(1 - e * e);
    x = a * (cE - e);
    y = b * sE;
    const n = Math.sqrt(mu / (a * a * a));
    const Edot = n / (1 - e * cE);
    vx = -a * sE * Edot;
    vy = b * cE * Edot;
  } else {
    const H = solveKeplerHyperbolic(M, e);
    const aa = Math.abs(a);
    const b = aa * Math.sqrt(e * e - 1);
    x = aa * (e - Math.cosh(H));
    y = b * Math.sinh(H);
    const n = Math.sqrt(mu / (aa * aa * aa));
    const Hdot = n / (e * Math.cosh(H) - 1);
    vx = -aa * Math.sinh(H) * Hdot;
    vy = b * Math.cosh(H) * Hdot;
  }
  outR.set(0, 0, 0).addScaledVector(P, x).addScaledVector(Q, y);
  outV.set(0, 0, 0).addScaledVector(P, vx).addScaledVector(Q, vy);
  return { r: outR, v: outV };
}

const _h = new THREE.Vector3();
const _n = new THREE.Vector3();
const _e = new THREE.Vector3();

// Full osculating element set, with the derived quantities the HUD shows.
export function stateToElements(r, v, mu) {
  const rm = r.length();
  const vm2 = v.lengthSq();
  _h.crossVectors(r, v);
  const hm = _h.length();
  _n.set(-_h.y, _h.x, 0);
  const nm = _n.length();
  const rv = r.dot(v);
  _e.copy(r)
    .multiplyScalar(vm2 - mu / rm)
    .addScaledVector(v, -rv)
    .divideScalar(mu);
  const e = _e.length();
  const energy = vm2 / 2 - mu / rm;
  const a = Math.abs(1 - e) > 1e-10 ? -mu / (2 * energy) : Infinity;
  const i = Math.acos(THREE.MathUtils.clamp(_h.z / Math.max(hm, 1e-30), -1, 1));
  let Omega = nm > 1e-12 ? Math.acos(THREE.MathUtils.clamp(_n.x / nm, -1, 1)) : 0;
  if (_n.y < 0) Omega = TWO_PI - Omega;
  let omega;
  if (nm > 1e-12 && e > 1e-10) {
    omega = Math.acos(THREE.MathUtils.clamp(_n.dot(_e) / (nm * e), -1, 1));
    if (_e.z < 0) omega = TWO_PI - omega;
  } else if (e > 1e-10) {
    omega = Math.atan2(_e.y, _e.x);
    if (_h.z < 0) omega = TWO_PI - omega;
  } else omega = 0;
  let nu;
  if (e > 1e-10) {
    nu = Math.acos(THREE.MathUtils.clamp(_e.dot(r) / (e * rm), -1, 1));
    if (rv < 0) nu = TWO_PI - nu;
  } else {
    // circular: argument of latitude measured from the node (or x axis)
    const ref = nm > 1e-12 ? _n.clone().normalize() : new THREE.Vector3(1, 0, 0);
    nu = Math.acos(THREE.MathUtils.clamp(ref.dot(r) / rm, -1, 1));
    if (r.z < 0 || (nm <= 1e-12 && r.y < 0)) nu = TWO_PI - nu;
  }
  const p = (hm * hm) / mu;
  const periapsis = p / (1 + e);
  const apoapsis = e < 1 ? p / (1 - e) : Infinity;
  const period = e < 1 ? TWO_PI * Math.sqrt((a * a * a) / mu) : Infinity;

  // Mean anomaly and time to periapsis / apoapsis.
  let M = 0,
    timeToPe = Infinity,
    timeToAp = Infinity;
  if (e < 1) {
    const E =
      2 * Math.atan2(Math.sqrt(1 - e) * Math.sin(nu / 2), Math.sqrt(1 + e) * Math.cos(nu / 2));
    M = E - e * Math.sin(E);
    const n = Math.sqrt(mu / (a * a * a));
    const Mn = ((M % TWO_PI) + TWO_PI) % TWO_PI;
    timeToPe = (TWO_PI - Mn) / n;
    timeToAp = ((Math.PI - Mn + TWO_PI) % TWO_PI) / n;
  } else if (e > 1) {
    const H = 2 * Math.atanh(Math.sqrt((e - 1) / (e + 1)) * Math.tan(nu / 2));
    M = e * Math.sinh(H) - H;
    const n = Math.sqrt(mu / Math.abs(a * a * a));
    timeToPe = M < 0 ? -M / n : Infinity;
  }
  return {
    a,
    e,
    i,
    Omega,
    omega,
    nu,
    M,
    energy,
    p,
    periapsis,
    apoapsis,
    period,
    timeToPe,
    timeToAp,
    h: hm,
    eVec: _e.clone(),
    hVec: _h.clone(),
  };
}

function stumpff(z) {
  if (z > 1e-6) {
    const s = Math.sqrt(z);
    return { c2: (1 - Math.cos(s)) / z, c3: (s - Math.sin(s)) / (s * s * s) };
  }
  if (z < -1e-6) {
    const s = Math.sqrt(-z);
    return { c2: (1 - Math.cosh(s)) / z, c3: (Math.sinh(s) - s) / (s * s * s) };
  }
  return { c2: 0.5 - z / 24, c3: 1 / 6 - z / 120 };
}

// Advance a two-body state by dt seconds. Mutates r and v in place.
export function propagateUniversal(r, v, mu, dt) {
  if (dt === 0) return;
  const sqmu = Math.sqrt(mu);
  const r0 = r.length();
  const v0 = v.length();
  const rv0 = r.dot(v);
  const alpha = 2 / r0 - (v0 * v0) / mu; // 1/a
  let chi;
  if (alpha > 1e-12) chi = sqmu * dt * alpha;
  else if (Math.abs(alpha) <= 1e-12) {
    const hm = new THREE.Vector3().crossVectors(r, v).length();
    const p = (hm * hm) / mu;
    const s = 0.5 * Math.atan(1 / (3 * Math.sqrt(mu / (p * p * p)) * dt));
    const w = Math.atan(Math.cbrt(Math.tan(s)));
    chi = (Math.sqrt(p) * 2) / Math.tan(2 * w);
  } else {
    const a = 1 / alpha;
    const sgn = Math.sign(dt);
    chi =
      sgn *
      Math.sqrt(-a) *
      Math.log(
        Math.abs((-2 * mu * alpha * dt) / (rv0 + sgn * Math.sqrt(-mu * a) * (1 - r0 * alpha))),
      );
    if (!isFinite(chi)) chi = sqmu * dt * Math.abs(alpha);
  }
  let c2 = 0.5,
    c3 = 1 / 6,
    rr = r0,
    psi = 0;
  for (let it = 0; it < 60; it++) {
    psi = chi * chi * alpha;
    ({ c2, c3 } = stumpff(psi));
    rr = chi * chi * c2 + (rv0 / sqmu) * chi * (1 - psi * c3) + r0 * (1 - psi * c2);
    const f =
      sqmu * dt - chi * chi * chi * c3 - (rv0 / sqmu) * chi * chi * c2 - r0 * chi * (1 - psi * c3);
    const d = f / rr;
    chi += d;
    if (Math.abs(d) < 1e-9 * Math.max(1, Math.abs(chi))) break;
  }
  const f = 1 - ((chi * chi) / r0) * c2;
  const g = dt - ((chi * chi * chi) / sqmu) * c3;
  const gdot = 1 - ((chi * chi) / rr) * c2;
  const fdot = (sqmu / (rr * r0)) * chi * (psi * c3 - 1);
  const rx = f * r.x + g * v.x,
    ry = f * r.y + g * v.y,
    rz = f * r.z + g * v.z;
  const vx = fdot * r.x + gdot * v.x,
    vy = fdot * r.y + gdot * v.y,
    vz = fdot * r.z + gdot * v.z;
  r.set(rx, ry, rz);
  v.set(vx, vy, vz);
}

// Sample a conic as a polyline in its reference frame (for map view).
export function sampleOrbit(el, mu, count, maxRadius) {
  const pts = [];
  const { P, Q } = perifocalBasis(el.i, el.Omega, el.omega);
  const e = el.e;
  const p = el.p;
  let nuMin = -Math.PI,
    nuMax = Math.PI;
  if (e >= 1) {
    const nuInf = Math.acos(-1 / e) - 1e-3;
    const nuR = Math.acos(THREE.MathUtils.clamp((p / maxRadius - 1) / e, -1, 1));
    nuMax = Math.min(nuInf, nuR);
    nuMin = -nuMax;
  }
  for (let k = 0; k <= count; k++) {
    const nu = nuMin + ((nuMax - nuMin) * k) / count;
    const rr = p / (1 + e * Math.cos(nu));
    if (rr > maxRadius * 1.0001 || rr < 0) continue;
    const x = rr * Math.cos(nu),
      y = rr * Math.sin(nu);
    pts.push(new THREE.Vector3().addScaledVector(P, x).addScaledVector(Q, y));
  }
  return pts;
}
