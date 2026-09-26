// Alien biosphere for habitable-zone exoplanets with liquid water: three
// morphotypes of bioluminescent flora (tall light-stalks, fan fronds, low
// microbial mounds/stromatolites) plus drifting luminous spores. Plants are
// streamed in cells around the ship, deterministically from the planet seed,
// and sit exactly on the same height function the landing gear touches.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { hash3 } from '../core/rng.js';

function withGlow(g, glowFn) {
  const n = g.attributes.position.count;
  const glow = new Float32Array(n);
  const p = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    p.fromBufferAttribute(g.attributes.position, i);
    glow[i] = glowFn(p, i);
  }
  g.setAttribute('aGlow', new THREE.BufferAttribute(glow, 1));
  if (!g.index) return g;
  return g.toNonIndexed();
}

function stalk() {
  const parts = [];
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.3, 2, 0.1),
    new THREE.Vector3(-0.2, 4.5, 0.3),
    new THREE.Vector3(0.4, 7, -0.2),
  ]);
  const tube = new THREE.TubeGeometry(curve, 24, 0.22, 8, false);
  // taper
  const pos = tube.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = 1 - (y / 7) * 0.6;
    const c = curve.getPoint(Math.min(1, Math.max(0, y / 7)));
    pos.setX(i, c.x + (pos.getX(i) - c.x) * t);
    pos.setZ(i, c.z + (pos.getZ(i) - c.z) * t);
  }
  parts.push(withGlow(tube, (p) => Math.max(0, (p.y - 5) / 2) * 0.3));
  const bulb = new THREE.SphereGeometry(0.75, 20, 14);
  bulb.scale(1, 1.35, 1);
  bulb.translate(0.4, 7.6, -0.2);
  parts.push(withGlow(bulb, () => 1));
  for (let k = 0; k < 4; k++) {
    const b = new THREE.SphereGeometry(0.28, 10, 8);
    const t = 0.35 + k * 0.15;
    const c = curve.getPoint(t);
    b.translate(c.x + (k % 2 ? 0.35 : -0.35), c.y, c.z + 0.2);
    parts.push(withGlow(b, () => 0.8));
  }
  return mergeGeometries(parts.map(clean));
}

function frond() {
  const parts = [];
  for (let k = 0; k < 6; k++) {
    const g = new THREE.PlaneGeometry(1.2, 5, 4, 16);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) + 2.5; // 0..5
      const x = pos.getX(i) * (1 - y / 7);
      const bend = (y * y) / 12;
      pos.setXYZ(i, x, y - bend * 0.3, bend);
    }
    g.rotateY((k / 6) * Math.PI * 2);
    g.rotateX(0);
    parts.push(
      withGlow(g, (p, i) => (Math.abs(g.attributes.uv.getX(i) - 0.5) < 0.08 ? 0.9 : 0.05)),
    );
  }
  const core = new THREE.SphereGeometry(0.5, 12, 8);
  core.translate(0, 0.3, 0);
  parts.push(withGlow(core, () => 0.6));
  return mergeGeometries(parts.map(clean));
}

function mound() {
  const g = new THREE.SphereGeometry(1.4, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  g.scale(1, 0.55, 1);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const n = hash3(
      Math.round(pos.getX(i) * 10),
      Math.round(pos.getY(i) * 10),
      Math.round(pos.getZ(i) * 10),
      5,
    );
    pos.setY(i, pos.getY(i) * (0.85 + 0.3 * n));
  }
  return clean(withGlow(g, (p, i) => (hash3(i, 3, 7, 11) > 0.82 ? 1 : 0.02)));
}

function clean(g) {
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', g.attributes.position);
  g.computeVertexNormals();
  out.setAttribute('normal', g.attributes.normal);
  out.setAttribute('aGlow', g.attributes.aGlow);
  return out.index ? out.toNonIndexed() : out;
}

function floraMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSun: { value: new THREE.Vector3(0, 1, 0) },
      uBase: { value: new THREE.Color(0.1, 0.3, 0.1) },
      uGlow: { value: new THREE.Color(0.2, 1, 0.8) },
      uDay: { value: 1 },
      uFogColor: { value: new THREE.Color() },
      uFogDensity: { value: 0 },
    },
    vertexShader: /* glsl */ `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      attribute float aGlow; attribute float aPhase;
      varying float vGlow; varying vec3 vNw; varying float vPhase; varying float vDist;
      uniform float uTime;
      void main() {
        vGlow = aGlow; vPhase = aPhase;
        vec3 p = position;
        float sway = sin(uTime * 0.7 + aPhase * 6.0) * 0.04 * p.y;
        p.x += sway; p.z += sway * 0.6;
        vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
        vNw = normalize(mat3(modelMatrix * instanceMatrix) * normal);
        vec4 mv = viewMatrix * wp;
        vDist = length(mv.xyz);
        gl_Position = projectionMatrix * mv;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform float uTime; uniform vec3 uSun; uniform vec3 uBase; uniform vec3 uGlow; uniform float uDay;
      uniform vec3 uFogColor; uniform float uFogDensity;
      varying float vGlow; varying vec3 vNw; varying float vPhase; varying float vDist;
      void main() {
        #include <logdepthbuf_fragment>
        float lambert = max(dot(normalize(vNw), uSun), 0.0) * uDay + 0.06;
        float pulse = 0.55 + 0.45 * sin(uTime * (1.2 + vPhase) + vPhase * 20.0);
        vec3 col = uBase * lambert * 1.6 + uGlow * vGlow * pulse * mix(3.5, 1.2, uDay);
        float f = 1.0 - exp(-vDist * uFogDensity);
        gl_FragColor = vec4(mix(col, uFogColor, clamp(f, 0.0, 1.0)), 1.0);
      }`,
  });
}

const CELL = 180;
const RANGE = 6;

export class FloraField {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'flora';
    this.material = floraMaterial();
    this.species = [
      { geo: stalk(), per: 5, scale: [0.6, 1.6] },
      { geo: frond(), per: 9, scale: [0.6, 1.4] },
      { geo: mound(), per: 7, scale: [0.6, 2.2] },
    ];
    const maxPer = (2 * RANGE + 1) ** 2;
    this.meshes = this.species.map((s) => {
      const count = maxPer * s.per;
      const phase = new Float32Array(count);
      for (let i = 0; i < count; i++) phase[i] = Math.random();
      s.geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
      const m = new THREE.InstancedMesh(s.geo, this.material, count);
      m.frustumCulled = false;
      m.castShadow = true;
      m.count = 0;
      this.group.add(m);
      return m;
    });
    this.spores = this._spores(700);
    this.group.add(this.spores);
    this.body = null;
    this.anchorKey = '';
    this.group.visible = false;
  }

  _spores(n) {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(n * 3);
    const ph = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      p.set(
        [(Math.random() - 0.5) * 1600, Math.random() * 60 + 2, (Math.random() - 0.5) * 1600],
        i * 3,
      );
      ph[i] = Math.random() * 100;
    }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uGlow: { value: new THREE.Color(0.3, 1, 0.8) },
        uDay: { value: 1 },
      },
      vertexShader: /* glsl */ `
        #include <common>
        #include <logdepthbuf_pars_vertex>
        attribute float aPhase; uniform float uTime; varying float vA;
        void main() {
          vec3 p = position + vec3(sin(uTime * 0.21 + aPhase) * 12.0, sin(uTime * 0.37 + aPhase * 2.0) * 4.0, cos(uTime * 0.17 + aPhase) * 12.0);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = clamp(1400.0 / -mv.z, 1.0, 14.0);
          vA = 0.5 + 0.5 * sin(uTime * 2.0 + aPhase * 7.0);
          gl_Position = projectionMatrix * mv;
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: /* glsl */ `
        #include <common>
        #include <logdepthbuf_pars_fragment>
        uniform vec3 uGlow; uniform float uDay; varying float vA;
        void main() {
          #include <logdepthbuf_fragment>
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d) * vA * mix(1.0, 0.35, uDay);
          gl_FragColor = vec4(uGlow * a * 3.0, a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(g, m);
    pts.frustumCulled = false;
    return pts;
  }

  // shipLocal: ship position in the body-fixed frame of `body`.
  update(body, shipLocal, altitude, time, sunLocalDir, sunWorldDir, fog) {
    const life = body?.def.life;
    if (!life || altitude > 6000 || !body.terrain) {
      this.group.visible = false;
      return;
    }
    if (this.body !== body) {
      this.body = body;
      this.group.removeFromParent();
      body.visual.root.add(this.group);
      this.material.uniforms.uBase.value.setRGB(...life.pigment);
      this.material.uniforms.uGlow.value.setRGB(...life.glow);
      this.spores.material.uniforms.uGlow.value.setRGB(...life.glow);
      this.anchorKey = '';
    }
    this.group.visible = true;
    const R = body.radius;
    const up = shipLocal.clone().normalize();
    // Anchor on a lattice of the tangent plane so plants never pop while moving.
    const key = [
      Math.round((up.x * R) / CELL),
      Math.round((up.y * R) / CELL),
      Math.round((up.z * R) / CELL),
    ].join(',');
    if (key !== this.anchorKey) {
      this.anchorKey = key;
      this._populate(body, up);
    }
    const u = this.material.uniforms;
    u.uTime.value = time;
    this.spores.material.uniforms.uTime.value = time;
    u.uSun.value.copy(sunWorldDir); // normals are transformed to world space in the shader
    const day = THREE.MathUtils.smoothstep(sunLocalDir.dot(up), -0.1, 0.2);
    u.uDay.value = day;
    this.spores.material.uniforms.uDay.value = day;
    if (fog) {
      u.uFogColor.value.copy(fog.color);
      u.uFogDensity.value = fog.density;
    }
  }

  _populate(body, up) {
    const R = body.radius;
    const t = body.terrain;
    const provider = body.heightProvider;
    const sea = provider.sea;
    // Tangent basis at the anchor
    const e1 = new THREE.Vector3(-up.y, up.x, 0);
    if (e1.lengthSq() < 1e-8) e1.set(1, 0, 0);
    e1.normalize();
    const e2 = new THREE.Vector3().crossVectors(up, e1);
    const cx = Math.round((up.x * R) / CELL),
      cy = Math.round((up.y * R) / CELL),
      cz = Math.round((up.z * R) / CELL);
    const anchorDir = up.clone();
    const h0 = t.groundHeight(anchorDir.x, anchorDir.y, anchorDir.z);
    const anchor = anchorDir.clone().multiplyScalar(R + h0);
    this.group.position.copy(anchor);
    this.group.quaternion.identity();
    const counts = this.species.map(() => 0);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const yUp = new THREE.Vector3(0, 1, 0);
    const d = new THREE.Vector3();
    for (let i = -RANGE; i <= RANGE; i++)
      for (let j = -RANGE; j <= RANGE; j++) {
        this.species.forEach((s, si) => {
          for (let k = 0; k < s.per; k++) {
            const hx = hash3(cx * 31 + i, cy * 17 + j, cz * 13 + k, si * 101 + 7);
            const hy = hash3(cx * 29 + i, cy * 19 + j, cz * 11 + k, si * 103 + 3);
            const hz = hash3(cx + i, cy + j, cz + k * 7, si * 107 + 5);
            if (hz > 0.8) continue;
            d.copy(anchorDir)
              .multiplyScalar(R)
              .addScaledVector(e1, (i + hx) * CELL)
              .addScaledVector(e2, (j + hy) * CELL)
              .normalize();
            const h = t.groundHeight(d.x, d.y, d.z);
            if (sea !== null && sea !== undefined && h <= sea + 1.5) continue;
            const pos = d
              .clone()
              .multiplyScalar(R + h)
              .sub(anchor);
            q.setFromUnitVectors(yUp, d);
            q.multiply(new THREE.Quaternion().setFromAxisAngle(yUp, hz * 40));
            const sc = s.scale[0] + (s.scale[1] - s.scale[0]) * hash3(i, j, k, si + 99);
            m4.compose(pos, q, new THREE.Vector3(sc, sc, sc));
            this.meshes[si].setMatrixAt(counts[si]++, m4);
          }
        });
      }
    this.meshes.forEach((m, i) => {
      m.count = counts[i];
      m.instanceMatrix.needsUpdate = true;
    });
    // Spores float around the anchor in its tangent frame.
    q.setFromUnitVectors(yUp, up);
    this.spores.quaternion.copy(q);
  }
}
