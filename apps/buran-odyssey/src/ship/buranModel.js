// «Буран-М»: the 11F35 orbiter geometry, rebuilt parametrically from its
// published dimensions (length 36.37 m, span 23.92 m, fuselage Ø 5.6 m,
// double-delta wing swept 78°/45°, 45° fin with split rudder/speed brake,
// body flap, three-leg gear) and modernised with a triple plasma drive in
// place of the twin 17D12 OMS engines.
//
// Body axes (also the physics frame): +X forward, +Y right, +Z down; the
// origin is the centre of mass.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { drawFlag, drawText, paintChute, paintNozzle, paintTPS } from './tps.js';
import { GLSL_NOISE } from '../world/shaders.js';

export const X_NOSE = 19.0;
export const X_TAIL = -17.37;
const LENGTH = X_NOSE - X_TAIL;

// Fuselage stations: x, half-width, half-height, centre-line z.
const SECTIONS = [
  [19.0, 0.02, 0.02, 0.62],
  [18.8, 0.42, 0.38, 0.55],
  [18.4, 0.78, 0.7, 0.46],
  [17.8, 1.14, 1.04, 0.36],
  [16.8, 1.58, 1.46, 0.24],
  [15.4, 2.02, 1.88, 0.1],
  [14.0, 2.36, 2.2, 0.0],
  [12.5, 2.58, 2.44, -0.05],
  [11.0, 2.72, 2.56, -0.06],
  [9.5, 2.78, 2.58, -0.03],
  [0.0, 2.8, 2.6, 0.0],
  [-10.0, 2.8, 2.6, 0.0],
  [-13.0, 2.84, 2.6, -0.05],
  [-15.5, 2.86, 2.52, -0.08],
  [-17.37, 2.8, 2.36, -0.1],
];
const N_TOP = 2.15;
const N_BOTTOM = 3.3;

function profile(x) {
  const s = SECTIONS;
  if (x >= s[0][0]) return s[0];
  for (let i = 0; i < s.length - 1; i++) {
    const a = s[i],
      b = s[i + 1];
    if (x <= a[0] && x >= b[0]) {
      let t = (a[0] - x) / (a[0] - b[0]);
      t = t * t * (3 - 2 * t) * 0.5 + t * 0.5;
      return [x, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t];
    }
  }
  return s[s.length - 1];
}

// Canopy hump over the crew cabin.
function canopy(x) {
  const t = (x - 12.9) / 2.2;
  return Math.exp(-t * t) * 0.34;
}

const sgnPow = (v, p) => Math.sign(v) * Math.pow(Math.abs(v), p);

export function fuselagePoint(x, phi, out = new THREE.Vector3()) {
  const [, w, hh, zc] = profile(x);
  const c = Math.cos(phi),
    s = Math.sin(phi);
  const n = s > 0 ? N_BOTTOM : N_TOP;
  const top = s < 0 ? canopy(x) * Math.min(1, Math.abs(s) * 1.4) : 0;
  return out.set(x, w * sgnPow(c, 2 / n), zc + (hh + top) * sgnPow(s, 2 / n));
}

function buildFuselage() {
  const NX = 150,
    NP = 128;
  const pos = [],
    nrm = [],
    uv = [],
    idx = [];
  const p = new THREE.Vector3(),
    px = new THREE.Vector3(),
    pp = new THREE.Vector3();
  const du = new THREE.Vector3(),
    dv = new THREE.Vector3();
  const xs = [];
  for (let i = 0; i <= NX; i++) {
    const t = i / NX;
    xs.push(X_NOSE - LENGTH * (0.55 * Math.pow(t, 1.8) + 0.45 * t));
  }
  for (let i = 0; i <= NX; i++) {
    const x = xs[i];
    for (let j = 0; j <= NP; j++) {
      const phi = -Math.PI / 2 + (j / NP) * Math.PI * 2;
      fuselagePoint(x, phi, p);
      fuselagePoint(x - 0.01, phi, px);
      fuselagePoint(x, phi + 0.01, pp);
      du.subVectors(px, p);
      dv.subVectors(pp, p);
      const n = new THREE.Vector3().crossVectors(du, dv).normalize();
      if (i === 0) n.set(1, 0, 0);
      pos.push(p.x, p.y, p.z);
      nrm.push(n.x, n.y, n.z);
      uv.push((X_NOSE - x) / LENGTH, j / NP);
    }
  }
  const W = NP + 1;
  for (let i = 0; i < NX; i++)
    for (let j = 0; j < NP; j++) {
      const a = i * W + j,
        b = a + 1,
        c = a + W,
        d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  fixWinding(g, (c, n) => n.dot(new THREE.Vector3(0, c.y, c.z - 0).normalize()) > 0);
  return g;
}

// Base heat shield closing the aft fuselage.
function buildBase() {
  const pos = [],
    idx = [],
    uv = [];
  const p = new THREE.Vector3();
  const NP = 64;
  const [, , , zc] = profile(X_TAIL);
  pos.push(X_TAIL, 0, zc);
  uv.push(0.5, 0.5);
  for (let j = 0; j <= NP; j++) {
    fuselagePoint(X_TAIL, -Math.PI / 2 + (j / NP) * Math.PI * 2, p);
    pos.push(p.x, p.y, p.z);
    uv.push(0.5 + p.y / 6, 0.5 + p.z / 6);
  }
  for (let j = 1; j <= NP; j++) idx.push(0, j, j + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  fixWinding(g, (_c, n) => n.x < 0);
  return g;
}

// Flip all triangles if the first triangle's normal fails `outward`.
function fixWinding(g, outward) {
  const idx = g.index.array;
  const P = g.attributes.position;
  const a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    c = new THREE.Vector3();
  let votes = 0;
  const step = Math.max(3, Math.floor(idx.length / 3 / 64) * 3);
  for (let t = 0; t < idx.length; t += step) {
    a.fromBufferAttribute(P, idx[t]);
    b.fromBufferAttribute(P, idx[t + 1]);
    c.fromBufferAttribute(P, idx[t + 2]);
    const n = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a));
    if (n.lengthSq() < 1e-12) continue;
    const centre = a.clone().add(b).add(c).divideScalar(3);
    votes += outward(centre, n.normalize()) ? 1 : -1;
  }
  if (votes < 0) {
    for (let t = 0; t < idx.length; t += 3) {
      const tmp = idx[t + 1];
      idx[t + 1] = idx[t + 2];
      idx[t + 2] = tmp;
    }
    g.index.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- wing
const WING_ROOT_Y = 2.2,
  WING_TIP_Y = 12.0;
const LE_PTS = [
  [2.2, 7.0],
  [5.0, -6.2],
  [12.0, -13.2],
];
const TE_PTS = [
  [2.2, -16.9],
  [12.0, -15.6],
];
const HINGE_XC = 0.8;

function interp(pts, y) {
  if (y <= pts[0][0]) return pts[0][1];
  for (let i = 0; i < pts.length - 1; i++) {
    if (y <= pts[i + 1][0]) {
      const t = (y - pts[i][0]) / (pts[i + 1][0] - pts[i][0]);
      return pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t;
    }
  }
  return pts[pts.length - 1][1];
}

export const wingLE = (y) => interp(LE_PTS, y);
export const wingTE = (y) => interp(TE_PTS, y);
const wingZ = (y) => 1.78 - 0.035 * (y - WING_ROOT_Y);
const wingT = (y) => 1.15 + (0.22 - 1.15) * ((y - WING_ROOT_Y) / (WING_TIP_Y - WING_ROOT_Y));
const naca = (xc) =>
  5 *
  (0.2969 * Math.sqrt(xc) - 0.126 * xc - 0.3516 * xc * xc + 0.2843 * xc ** 3 - 0.1015 * xc ** 4);

function wingPoint(y, xc, top, out) {
  const le = wingLE(y),
    te = wingTE(y);
  const chord = le - te;
  const yt = wingT(y) * naca(xc) * (chord / 10) * 0.9 + (xc > 0 ? 0.02 : 0);
  const z = wingZ(y) + (top ? -yt * 1.35 : yt * 0.65);
  return out.set(le - xc * chord, y, z);
}

function wingUV(x, y, top) {
  const vv = (y - WING_ROOT_Y) / (WING_TIP_Y - WING_ROOT_Y);
  return [(7.0 - x) / 24.5, top ? 0.5 + 0.5 * vv : 0.5 * vv];
}

// A surface patch of the wing between span y0..y1 and chord xc0..xc1.
function wingPatch(y0, y1, xc0, xc1, ns, nc, closeTip, closeTE) {
  const pos = [],
    uv = [],
    idx = [];
  const p = new THREE.Vector3();
  let base = 0;
  for (const top of [true, false]) {
    for (let i = 0; i <= ns; i++) {
      const y = y0 + ((y1 - y0) * i) / ns;
      for (let j = 0; j <= nc; j++) {
        const s = j / nc;
        const xc = xc0 + (xc1 - xc0) * (xc0 === 0 ? 0.5 - 0.5 * Math.cos(Math.PI * s) : s);
        wingPoint(y, xc, top, p);
        pos.push(p.x, p.y, p.z);
        uv.push(...wingUV(p.x, p.y, top));
      }
    }
    const W = nc + 1;
    for (let i = 0; i < ns; i++)
      for (let j = 0; j < nc; j++) {
        const a = base + i * W + j,
          b = a + 1,
          c = a + W,
          d = c + 1;
        if (top) idx.push(a, b, c, b, d, c);
        else idx.push(a, c, b, b, c, d);
      }
    base += (ns + 1) * W;
  }
  const W = nc + 1;
  const topBase = 0,
    botBase = (ns + 1) * W;
  if (closeTip) {
    const i = ns;
    for (let j = 0; j < nc; j++) {
      const a = topBase + i * W + j,
        b = a + 1,
        c = botBase + i * W + j,
        d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  if (closeTE) {
    const j = nc;
    for (let i = 0; i < ns; i++) {
      const a = topBase + i * W + j,
        b = topBase + (i + 1) * W + j;
      const c = botBase + i * W + j,
        d = botBase + (i + 1) * W + j;
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  fixWinding(g, (c, n) => {
    const mid = wingZ(c.y);
    return (c.z < mid && n.z < 0) || (c.z >= mid && n.z > 0) || Math.abs(n.z) < 0.3;
  });
  return g;
}

function mirrorY(g) {
  const m = g.clone();
  m.scale(1, -1, 1);
  const idx = m.index.array;
  for (let t = 0; t < idx.length; t += 3) {
    const tmp = idx[t + 1];
    idx[t + 1] = idx[t + 2];
    idx[t + 2] = tmp;
  }
  m.computeVertexNormals();
  return m;
}

// ---------------------------------------------------------------- fin
const FIN_ROOT_Z = -2.35,
  FIN_H = 7.9;
const finLE = (h) => -9.2 + (-16.5 - -9.2) * (h / FIN_H);
const finTE = (h) => -18.0 + (-18.7 - -18.0) * (h / FIN_H);
const finT = (h) => 0.62 + (0.2 - 0.62) * (h / FIN_H);
const RUDDER_XC = 0.66;

function finPatch(xc0, xc1, side, withCenter) {
  const pos = [],
    uv = [],
    idx = [];
  const NH = 20,
    NC = 20;
  const p = [];
  const sides = side === 0 ? [1, -1] : [side];
  let base = 0;
  for (const s of sides) {
    for (let i = 0; i <= NH; i++) {
      const h = (FIN_H * i) / NH;
      const le = finLE(h),
        te = finTE(h),
        ch = le - te;
      for (let j = 0; j <= NC; j++) {
        const u = j / NC;
        const xc = xc0 + (xc1 - xc0) * (xc0 === 0 ? 0.5 - 0.5 * Math.cos(Math.PI * u) : u);
        const yt = finT(h) * naca(xc) * 0.5 + (xc > 0 ? 0.01 : 0);
        p.push([le - xc * ch, s * yt, FIN_ROOT_Z - h]);
        pos.push(le - xc * ch, s * yt, FIN_ROOT_Z - h);
        uv.push((-9.2 - (le - xc * ch)) / 9.6, (h / FIN_H) * 0.5 + (s > 0 ? 0 : 0.5));
      }
    }
    const W = NC + 1;
    for (let i = 0; i < NH; i++)
      for (let j = 0; j < NC; j++) {
        const a = base + i * W + j,
          b = a + 1,
          c = a + W,
          d = c + 1;
        if (s > 0) idx.push(a, b, c, b, d, c);
        else idx.push(a, c, b, b, c, d);
      }
    base += (NH + 1) * W;
  }
  if (withCenter) {
    // flat inner face of a split rudder half
    const s = side;
    const start = pos.length / 3;
    for (let i = 0; i <= NH; i++) {
      const h = (FIN_H * i) / NH;
      const le = finLE(h),
        te = finTE(h),
        ch = le - te;
      pos.push(le - xc0 * ch, 0, FIN_ROOT_Z - h, le - xc1 * ch, 0, FIN_ROOT_Z - h);
      uv.push(0.9, 0.2, 0.95, 0.2);
    }
    for (let i = 0; i < NH; i++) {
      const a = start + i * 2,
        b = a + 1,
        c = a + 2,
        d = a + 3;
      if (s > 0) idx.push(a, c, b, b, c, d);
      else idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------- textures
function fuselageTextures(anisotropy, hi) {
  const W = hi ? 4096 : 2048,
    H = hi ? 2048 : 1024;
  const pxPerM = W / LENGTH;
  const tile = Math.max(6, Math.round(0.152 * pxPerM));
  const zone = (u, v) => {
    const x = X_NOSE - u * LENGTH;
    const phi = -Math.PI / 2 + v * Math.PI * 2;
    const s = Math.sin(phi);
    if (x > 17.9) return 'rcc';
    if (s > 0.18 - Math.max(0, (x - 13) * 0.12)) return 'black';
    if (s < -0.72 && x < 9.6 && x > -9.0) return 'felt'; // payload bay doors
    return 'white';
  };
  return paintTPS({
    width: W,
    height: H,
    tileU: tile,
    tileV: tile,
    zoneFn: zone,
    seed: 11,
    anisotropy,
    decals: (c) => {
      const vy = (phi) => (1 - (phi + Math.PI / 2) / (Math.PI * 2)) * H; // canvas row
      const ux = (x) => ((X_NOSE - x) / LENGTH) * W;
      // Payload bay door outline and hinge line
      c.strokeStyle = 'rgba(40,40,40,0.9)';
      c.lineWidth = Math.max(2, tile * 0.25);
      for (const phi of [
        -Math.PI / 2 - 1.2,
        -Math.PI / 2 + 1.2,
        -Math.PI / 2 + 0.001,
        (3 * Math.PI) / 2 - 0.001,
      ]) {
        c.beginPath();
        c.moveTo(ux(9.6), vy(phi));
        c.lineTo(ux(-9.0), vy(phi));
        c.stroke();
      }
      for (const x of [9.6, -9.0, 4.8, 0, -4.6]) {
        c.beginPath();
        c.moveTo(ux(x), vy(-Math.PI / 2 - 1.2));
        c.lineTo(ux(x), vy(-Math.PI / 2 + 1.2));
        c.stroke();
      }
      // Lettering: left flank reads nose-to-tail normally, right flank is rotated.
      const size = Math.round(0.95 * pxPerM);
      // White upper flanks: phi = π + 0.35 (left) and −0.35 (right).
      const phiL = Math.PI + 0.38,
        phiR = -0.38;
      drawText(c, 'БУРАН-М', ux(5.5), vy(phiL), size, 0, '#141414');
      drawText(c, 'БУРАН-М', ux(5.5), vy(phiR), size, Math.PI, '#141414');
      drawText(
        c,
        'НПО «МОЛНИЯ» · 11Ф35-М',
        ux(-1.5),
        vy(Math.PI + 0.12),
        Math.round(size * 0.32),
        0,
        '#303030',
        '600',
      );
      drawText(
        c,
        'НПО «МОЛНИЯ» · 11Ф35-М',
        ux(-1.5),
        vy(-0.12),
        Math.round(size * 0.32),
        Math.PI,
        '#303030',
        '600',
      );
      drawFlag(c, ux(11.4), vy(phiL), size * 1.5, size, 0);
      drawFlag(c, ux(11.4), vy(phiR), size * 1.5, size, Math.PI);
      // RCS port clusters on the nose
      c.fillStyle = '#050505';
      for (const [x, phi] of [
        [17.2, -0.3],
        [17.2, 0.0],
        [17.2, Math.PI],
        [17.2, Math.PI + 0.3],
        [16.9, -Math.PI / 2],
      ]) {
        for (let k = 0; k < 3; k++) {
          c.beginPath();
          c.arc(ux(x - k * 0.35), vy(phi), tile * 0.8, 0, Math.PI * 2);
          c.fill();
        }
      }
    },
  });
}

function wingTextures(anisotropy, hi) {
  const S = hi ? 2048 : 1024;
  const tile = Math.max(5, Math.round((0.152 * S) / 24.5));
  const zone = (u, v) => {
    const top = v >= 0.5;
    const vv = top ? (v - 0.5) * 2 : v * 2;
    const y = WING_ROOT_Y + vv * (WING_TIP_Y - WING_ROOT_Y);
    const x = 7.0 - u * 24.5;
    const le = wingLE(y),
      te = wingTE(y);
    const xc = (le - x) / (le - te);
    if (xc < 0.045) return 'rcc';
    if (!top) return 'black';
    if (xc < 0.1) return 'black';
    return 'white';
  };
  return paintTPS({
    width: S,
    height: S,
    tileU: tile,
    tileV: Math.round(tile * 0.85),
    zoneFn: zone,
    seed: 29,
    anisotropy,
    decals: (c) => {
      // Elevon hinge lines on the upper surface
      c.strokeStyle = 'rgba(30,30,30,0.85)';
      c.lineWidth = 3;
      c.beginPath();
      for (let k = 0; k <= 20; k++) {
        const y = WING_ROOT_Y + (k / 20) * (WING_TIP_Y - WING_ROOT_Y);
        const x = wingLE(y) - HINGE_XC * (wingLE(y) - wingTE(y));
        const u = ((7 - x) / 24.5) * S;
        const v = (1 - (0.5 + 0.5 * (k / 20))) * S;
        if (k === 0) c.moveTo(u, v);
        else c.lineTo(u, v);
      }
      c.stroke();
    },
  });
}

function genericTiles(zone, anisotropy) {
  return paintTPS({
    width: 512,
    height: 512,
    tileU: 32,
    tileV: 32,
    zoneFn: () => zone,
    seed: zone.length * 7,
    anisotropy,
  });
}

// ---------------------------------------------------------------- plume
function plumeMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uThrottle: { value: 0 },
      uTime: { value: 0 },
      uAtm: { value: 0 },
      uCore: { value: new THREE.Color(0.75, 0.85, 1.0) },
      uEdge: { value: new THREE.Color(0.45, 0.25, 1.0) },
    },
    vertexShader: /* glsl */ `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <logdepthbuf_pars_fragment>
      ${GLSL_NOISE}
      uniform float uThrottle; uniform float uTime; uniform float uAtm; uniform vec3 uCore; uniform vec3 uEdge;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() {
        #include <logdepthbuf_fragment>
        float along = 1.0 - vUv.y;            // 0 at nozzle exit, 1 at tail
        float rim = abs(dot(normalize(vN), normalize(vV)));
        float core = pow(rim, 2.2);
        float diamonds = uAtm > 0.05 ? 0.65 + 0.35 * cos(along * 38.0 - uTime * 3.0) : 1.0;
        float flicker = 0.85 + 0.15 * snoise(vec3(vUv * vec2(6.0, 14.0), uTime * 7.0));
        float fall = pow(1.0 - along, 1.6 + uAtm * 1.5);
        vec3 col = mix(uEdge, uCore, core) * (core * 1.6 + 0.25);
        float a = fall * core * diamonds * flicker * uThrottle;
        gl_FragColor = vec4(col * a * 9.0, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

// Plasma sheath: brightest on the windward (stagnation) side.
function sheathMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uFlow: { value: new THREE.Vector3(1, 0, 0) },
      uIntensity: { value: 0 },
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(1.0, 0.45, 0.25) },
    },
    vertexShader: /* glsl */ `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec3 vNl; varying vec3 vPos; varying vec3 vN; varying vec3 vV;
      void main() {
        vNl = normal; vPos = position;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <logdepthbuf_pars_fragment>
      ${GLSL_NOISE}
      uniform vec3 uFlow; uniform float uIntensity; uniform float uTime; uniform vec3 uColor;
      varying vec3 vNl; varying vec3 vPos; varying vec3 vN; varying vec3 vV;
      void main() {
        #include <logdepthbuf_fragment>
        float wind = max(dot(normalize(vNl), uFlow), 0.0);
        float fres = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        float streak = 0.6 + 0.4 * snoise(vPos * 0.6 + uFlow * uTime * 25.0);
        float a = (pow(wind, 1.5) * 0.9 + fres * 0.35) * streak * uIntensity;
        gl_FragColor = vec4(uColor * a * 6.0, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

function wheel(radius, width) {
  const pts = [];
  for (let k = 0; k <= 16; k++) {
    const a = -Math.PI / 2 + (k / 16) * Math.PI;
    pts.push(
      new THREE.Vector2(radius * 0.62 + Math.cos(a) * radius * 0.38, Math.sin(a) * width * 0.5),
    );
  }
  return new THREE.LatheGeometry(pts, 40); // axle along Y
}

// ---------------------------------------------------------------- assembly
export class BuranModel {
  constructor({ anisotropy = 8, hiRes = true, envMap = null } = {}) {
    this.group = new THREE.Group();
    this.group.name = 'Buran-M';
    const fus = fuselageTextures(anisotropy, hiRes);
    const wingTex = wingTextures(anisotropy, hiRes);
    const white = genericTiles('white', anisotropy);
    const black = genericTiles('black', anisotropy);
    this.hot = []; // materials that glow with hull temperature

    const tpsMat = (t) => {
      const m = new THREE.MeshStandardMaterial({
        map: t.map,
        normalMap: t.normalMap,
        roughnessMap: t.roughnessMap,
        roughness: 1,
        metalness: 0,
        emissiveMap: t.emissiveMap,
        emissive: new THREE.Color(0, 0, 0),
        envMap,
        normalScale: new THREE.Vector2(0.9, 0.9),
      });
      this.hot.push(m);
      return m;
    };
    const fusMat = tpsMat(fus);
    const wingMat = tpsMat(wingTex);
    const whiteMat = tpsMat(white);
    const blackMat = tpsMat(black);
    for (const t of [white, black]) {
      for (const k of ['map', 'normalMap', 'roughnessMap', 'emissiveMap']) t[k].repeat.set(1, 1);
    }

    const add = (geo, mat, parent = this.group) => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      m.receiveShadow = true;
      parent.add(m);
      return m;
    };

    const fusGeo = buildFuselage();
    add(fusGeo, fusMat);
    add(buildBase(), blackMat);

    // Wings (fixed part) and elevons
    const wingR = wingPatch(WING_ROOT_Y, WING_TIP_Y, 0, HINGE_XC, 36, 30, true, true);
    add(wingR, wingMat);
    add(mirrorY(wingR), wingMat);
    this.elevons = [];
    for (const [y0, y1] of [
      [WING_ROOT_Y + 0.4, 7.1],
      [7.1, WING_TIP_Y - 0.15],
    ]) {
      for (const side of [1, -1]) {
        let g = wingPatch(y0, y1, HINGE_XC, 1.0, 10, 6, true, false);
        if (side < 0) g = mirrorY(g);
        const h0 = new THREE.Vector3(),
          h1 = new THREE.Vector3();
        wingPoint(y0, HINGE_XC, true, h0);
        wingPoint(y1, HINGE_XC, true, h1);
        h0.z = wingZ(y0);
        h1.z = wingZ(y1);
        if (side < 0) {
          h0.y *= -1;
          h1.y *= -1;
        }
        g.translate(-h0.x, -h0.y, -h0.z);
        const pivot = new THREE.Group();
        pivot.position.copy(h0);
        this.group.add(pivot);
        add(g, wingMat, pivot);
        const axis = h1.clone().sub(h0).normalize();
        this.elevons.push({ pivot, axis, side, inboard: y0 < 5 });
      }
    }

    // Fin + split rudder / speed brake
    add(finPatch(0, RUDDER_XC, 0, false), whiteMat);
    this.rudder = [];
    const hA = new THREE.Vector3(finLE(0) - RUDDER_XC * (finLE(0) - finTE(0)), 0, FIN_ROOT_Z);
    const hB = new THREE.Vector3(
      finLE(FIN_H) - RUDDER_XC * (finLE(FIN_H) - finTE(FIN_H)),
      0,
      FIN_ROOT_Z - FIN_H,
    );
    for (const side of [1, -1]) {
      const g = finPatch(RUDDER_XC, 1.0, side, true);
      g.translate(-hA.x, -hA.y, -hA.z);
      const pivot = new THREE.Group();
      pivot.position.copy(hA);
      this.group.add(pivot);
      add(g, whiteMat, pivot);
      this.rudder.push({ pivot, axis: hB.clone().sub(hA).normalize(), side });
    }

    // OMS / aft RCS pods either side of the fin root
    const podPts = [];
    for (let k = 0; k <= 24; k++) {
      const t = k / 24;
      const r = 0.95 * Math.sqrt(Math.min(1, t * 5)) * (t > 0.9 ? 1 - (t - 0.9) * 1.5 : 1);
      podPts.push(new THREE.Vector2(Math.max(0.001, r), -t * 6.6));
    }
    const podGeo = new THREE.LatheGeometry(podPts, 40);
    podGeo.rotateZ(-Math.PI / 2); // nose forward, extends aft along −X
    for (const side of [1, -1]) {
      const pod = add(podGeo, whiteMat);
      pod.position.set(-10.9, side * 1.75, -2.05);
    }

    // Body flap
    const flapGeo = new THREE.BoxGeometry(2.2, 5.4, 0.34, 4, 8, 1);
    flapGeo.translate(-1.1, 0, 0);
    this.bodyFlap = new THREE.Group();
    this.bodyFlap.position.set(X_TAIL + 0.3, 0, 2.05);
    this.group.add(this.bodyFlap);
    add(flapGeo, blackMat, this.bodyFlap);

    // Cockpit glazing
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0x0a0e14,
      roughness: 0.04,
      metalness: 0.1,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      envMap,
      envMapIntensity: 2.2,
    });
    const frame = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.6,
      metalness: 0.4,
    });
    const panes = [
      [15.25, 16.15, -0.52, -0.2],
      [15.25, 16.15, -0.18, 0.18],
      [15.25, 16.15, 0.2, 0.52],
      [14.1, 15.0, -0.95, -0.62],
      [14.1, 15.0, 0.62, 0.95],
      [13.2, 13.9, -0.35, -0.05],
      [13.2, 13.9, 0.05, 0.35],
      [13.2, 14.4, -1.45, -1.15],
      [13.2, 14.4, 1.15, 1.45],
    ];
    for (const [x0, x1, a0, a1] of panes) {
      add(this._surfacePatch(x0, x1, -Math.PI / 2 + a0, -Math.PI / 2 + a1, 0.035), glass);
      add(
        this._surfacePatch(
          x0 - 0.06,
          x1 + 0.06,
          -Math.PI / 2 + a0 - 0.02,
          -Math.PI / 2 + a1 + 0.02,
          0.02,
        ),
        frame,
      );
    }

    // Plasma drive: three nozzles on the base
    const nozzleTex = paintNozzle(anisotropy);
    const nozzleMat = new THREE.MeshStandardMaterial({
      map: nozzleTex,
      metalness: 0.85,
      roughness: 0.32,
      side: THREE.DoubleSide,
      envMap,
    });
    this.nozzleGlow = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide });
    const bell = [];
    for (let k = 0; k <= 30; k++) {
      const t = k / 30;
      bell.push(new THREE.Vector2(0.3 + 0.55 * Math.pow(t, 0.62), -t * 2.3));
    }
    const bellGeo = new THREE.LatheGeometry(bell, 48);
    bellGeo.rotateZ(-Math.PI / 2); // exit toward −X
    const innerGeo = bellGeo.clone();
    innerGeo.scale(0.995, 0.97, 0.97);
    this.engines = [];
    const plumeGeo = new THREE.CylinderGeometry(0.8, 2.6, 1, 48, 24, true);
    plumeGeo.translate(0, -0.5, 0);
    plumeGeo.rotateZ(-Math.PI / 2); // along −X
    this.plumeMat = plumeMaterial();
    for (const [y, z] of [
      [-1.25, 0.55],
      [1.25, 0.55],
      [0, -1.05],
    ]) {
      const n = add(bellGeo, nozzleMat);
      n.position.set(X_TAIL - 0.05, y, z);
      const inner = new THREE.Mesh(innerGeo, this.nozzleGlow);
      inner.position.copy(n.position);
      this.group.add(inner);
      const plume = new THREE.Mesh(plumeGeo, this.plumeMat);
      plume.position.set(X_TAIL - 2.3, y, z);
      plume.castShadow = false;
      plume.renderOrder = 10;
      plume.frustumCulled = false;
      this.group.add(plume);
      this.engines.push({ nozzle: n, plume });
    }
    this.engineLight = new THREE.PointLight(0x9fb5ff, 0, 120, 2);
    this.engineLight.position.set(X_TAIL - 6, 0, 0);
    this.group.add(this.engineLight);

    // Landing gear
    const strutMat = new THREE.MeshStandardMaterial({
      color: 0xb8bcc2,
      metalness: 0.9,
      roughness: 0.3,
      envMap,
    });
    const tireMat = new THREE.MeshStandardMaterial({
      color: 0x151515,
      roughness: 0.92,
      metalness: 0,
    });
    this.gear = [];
    const makeGear = (x, y, z, len, wr, twin) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, y, z);
      this.group.add(pivot);
      const strut = new THREE.CylinderGeometry(0.11, 0.13, len, 16);
      strut.rotateX(Math.PI / 2);
      strut.translate(0, 0, len / 2);
      add(strut, strutMat, pivot);
      const oleo = new THREE.CylinderGeometry(0.17, 0.17, len * 0.4, 16);
      oleo.rotateX(Math.PI / 2);
      oleo.translate(0, 0, len * 0.25);
      add(oleo, strutMat, pivot);
      const wg = wheel(wr, wr * 0.55);
      for (const s of [-1, 1]) {
        const w = add(wg, tireMat, pivot);
        w.position.set(0, s * twin, len);
      }
      const axle = new THREE.CylinderGeometry(0.06, 0.06, twin * 2 + 0.2, 8);
      const ax = add(axle, strutMat, pivot);
      ax.position.set(0, 0, len);
      pivot.visible = false;
      this.gear.push({ pivot, len, wr });
    };
    makeGear(12.5, 0, 2.3, 2.4, 0.45, 0.3);
    makeGear(-3.5, 3.6, 2.0, 2.6, 0.62, 0.36);
    makeGear(-3.5, -3.6, 2.0, 2.6, 0.62, 0.36);
    this.gearDeploy = 0;

    // Drag chute cluster (three canopies, as on the real vehicle)
    this.chute = new THREE.Group();
    const chuteMat = new THREE.MeshStandardMaterial({
      map: paintChute(),
      side: THREE.DoubleSide,
      roughness: 0.9,
    });
    const dome = [];
    for (let k = 0; k <= 16; k++) {
      const a = (k / 16) * (Math.PI / 2) * 0.92;
      dome.push(new THREE.Vector2(Math.sin(a) * 5.2, Math.cos(a) * 3.4));
    }
    const domeGeo = new THREE.LatheGeometry(dome, 32);
    domeGeo.rotateZ(Math.PI / 2); // apex downstream (−X), mouth facing the orbiter
    const lines = [];
    for (const [dy, dz] of [
      [0, -4.5],
      [4.2, 2.4],
      [-4.2, 2.4],
    ]) {
      const c = new THREE.Mesh(domeGeo, chuteMat);
      c.position.set(-34, dy, dz);
      this.chute.add(c);
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        lines.push(-34 + 0.4, dy + Math.cos(a) * 5.0, dz + Math.sin(a) * 5.0, -14, 0, 0);
      }
    }
    lines.push(-14, 0, 0, 0, 0, 0);
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
    this.chute.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0xdddddd })));
    this.chuteAnchor = new THREE.Group();
    this.chuteAnchor.position.set(X_TAIL, 0, -1.2);
    this.chuteAnchor.add(this.chute);
    this.chuteAnchor.visible = false;
    this.group.add(this.chuteAnchor);

    // Plasma sheath (entry heating)
    const sheathGeo = mergeGeometries([
      stripToPN(fusGeo),
      stripToPN(wingR),
      stripToPN(mirrorY(wingR)),
    ]);
    sheathGeo.scale(1.05, 1.08, 1.08);
    this.sheathMat = sheathMaterial();
    this.sheath = new THREE.Mesh(sheathGeo, this.sheathMat);
    this.sheath.renderOrder = 11;
    this.sheath.visible = false;
    this.group.add(this.sheath);

    // Hardpoints used by the RCS puff system (body frame, exhaust directions).
    this.rcsThrusters = [
      { p: [17.6, 0.9, 0.0], d: [0, 1, 0] },
      { p: [17.6, -0.9, 0.0], d: [0, -1, 0] },
      { p: [17.8, 0, -0.6], d: [0, 0, -1] },
      { p: [17.8, 0, 0.9], d: [0, 0, 1] },
      { p: [-16.8, 2.6, -2.1], d: [0, 1, 0] },
      { p: [-16.8, -2.6, -2.1], d: [0, -1, 0] },
      { p: [-16.8, 1.8, -2.9], d: [0, 0, -1] },
      { p: [-16.8, -1.8, -2.9], d: [0, 0, -1] },
      { p: [-16.8, 1.8, -1.2], d: [0, 0, 1] },
      { p: [-16.8, -1.8, -1.2], d: [0, 0, 1] },
      { p: [18.2, 0.4, 0.2], d: [1, 0, 0] },
      { p: [-17.3, 1.8, -2.0], d: [-1, 0, 0] },
      { p: [-17.3, -1.8, -2.0], d: [-1, 0, 0] },
    ];
  }

  _surfacePatch(x0, x1, p0, p1, offset) {
    const NX = 8,
      NP = 8;
    const pos = [],
      idx = [];
    const p = new THREE.Vector3(),
      q = new THREE.Vector3(),
      r = new THREE.Vector3();
    for (let i = 0; i <= NX; i++)
      for (let j = 0; j <= NP; j++) {
        const x = x0 + ((x1 - x0) * i) / NX;
        const ph = p0 + ((p1 - p0) * j) / NP;
        fuselagePoint(x, ph, p);
        fuselagePoint(x - 0.01, ph, q);
        fuselagePoint(x, ph + 0.01, r);
        const n = new THREE.Vector3().crossVectors(q.sub(p), r.sub(p)).normalize();
        pos.push(p.x + n.x * offset, p.y + n.y * offset, p.z + n.z * offset);
      }
    const W = NP + 1;
    for (let i = 0; i < NX; i++)
      for (let j = 0; j < NP; j++) {
        const a = i * W + j,
          b = a + 1,
          c = a + W,
          d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    fixWinding(g, (c, n) => n.dot(new THREE.Vector3(0, c.y, c.z).normalize()) > 0);
    g.computeVertexNormals();
    return g;
  }

  // state: { throttle, pitch, roll, yaw, speedBrake, bodyFlap, gear (0..1), chute,
  //          hullTemp, plasma, flowLocal (Vector3), atmFactor, time }
  update(s) {
    for (const e of this.elevons) {
      const cmd = -(s.pitch * 0.35 + s.roll * 0.3 * e.side);
      e.pivot.quaternion.setFromAxisAngle(e.axis, cmd * e.side);
    }
    for (const r of this.rudder) {
      const a = s.yaw * 0.35 + r.side * s.speedBrake * 0.9;
      r.pivot.quaternion.setFromAxisAngle(r.axis, a);
    }
    this.bodyFlap.rotation.y = s.bodyFlap * 0.3;

    // Gear: stowed = folded forward/inboard into the bays.
    this.gearDeploy = s.gear;
    for (const g of this.gear) {
      g.pivot.visible = s.gear > 0.02;
      g.pivot.rotation.y = -(1 - s.gear) * Math.PI * 0.5;
    }

    // Engines
    const thr = s.throttle;
    this.plumeMat.uniforms.uThrottle.value = thr;
    this.plumeMat.uniforms.uTime.value = s.time;
    this.plumeMat.uniforms.uAtm.value = s.atmFactor;
    const len = 6 + thr * (22 + 40 * (1 - s.atmFactor));
    const spread = 1 + 2.2 * (1 - s.atmFactor);
    for (const e of this.engines) {
      e.plume.visible = thr > 0.001;
      e.plume.scale.set(len, 0.35 * spread + 0.65, 0.35 * spread + 0.65);
    }
    this.nozzleGlow.color.setRGB(0.4 * thr, 0.55 * thr, 1.4 * thr);
    this.engineLight.intensity = thr * 4000;

    // Hull glow: blackbody emission of the TPS above ~800 K.
    const T = s.hullTemp;
    const glow = Math.max(0, (T - 800) / 1100);
    const col = tempColor(T);
    const e = glow * glow * glow * 0.9;
    for (const m of this.hot) m.emissive.setRGB(col.r * e, col.g * e, col.b * e);

    this.sheath.visible = s.plasma > 0.01;
    this.sheathMat.uniforms.uIntensity.value = Math.min(1.5, s.plasma);
    this.sheathMat.uniforms.uTime.value = s.time;
    if (s.flowLocal) this.sheathMat.uniforms.uFlow.value.copy(s.flowLocal);
    if (s.plasmaColor) this.sheathMat.uniforms.uColor.value.copy(s.plasmaColor);

    this.chuteAnchor.visible = s.chute;
    if (s.chute && s.flowLocal) {
      // Canopies stream along the relative wind (flowLocal points into the wind).
      const back = s.flowLocal.clone().negate().normalize();
      this.chuteAnchor.quaternion.setFromUnitVectors(new THREE.Vector3(-1, 0, 0), back);
      const breathe = 1 + 0.03 * Math.sin(s.time * 3.1);
      this.chute.scale.set(1, breathe, breathe);
    }
  }
}

function stripToPN(g) {
  const n = new THREE.BufferGeometry();
  n.setAttribute('position', g.attributes.position.clone());
  n.setAttribute('normal', g.attributes.normal.clone());
  n.setIndex(g.index.clone());
  return n;
}

function tempColor(T) {
  // Approximate incandescence colour of a grey body.
  const t = Math.max(0, Math.min(1, (T - 800) / 1200));
  return new THREE.Color(1, 0.25 + 0.55 * t, 0.05 + 0.5 * t * t);
}
