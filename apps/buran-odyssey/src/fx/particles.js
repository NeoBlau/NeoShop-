// Particle effects.
//  * SurfaceDust — landing/rollout/exhaust ejecta simulated in the body-fixed
//    frame with real local gravity and, where there is air, drag and settling.
//    In vacuum (Moon, Mercury, Europa) grains fly on clean ballistic arcs and
//    never billow; on Mars they hang in thin CO₂; on Venus the 65 kg/m³
//    atmosphere turns everything into slow, dense clouds.
//  * LocalPuffs — RCS jets and entry sparks, in the ship's own frame.

import * as THREE from 'three';

export const SURFACE_FX = {
  'dust-red': { color: [0.6, 0.34, 0.2], size: 0.9, life: 9, count: 1.0, drag: 1.0 },
  regolith: { color: [0.42, 0.41, 0.4], size: 0.45, life: 6, count: 1.0, drag: 0 },
  ice: { color: [0.75, 0.82, 0.9], size: 0.4, life: 5, count: 0.8, drag: 0, sparkle: true },
  smog: { color: [0.86, 0.6, 0.28], size: 5.0, life: 14, count: 0.6, drag: 3.5 },
  sulfur: { color: [0.75, 0.68, 0.28], size: 0.5, life: 6, count: 1.0, drag: 0 },
  hydrocarbon: { color: [0.42, 0.3, 0.16], size: 2.2, life: 10, count: 0.8, drag: 2.0 },
  soil: { color: [0.5, 0.42, 0.32], size: 1.4, life: 6, count: 0.8, drag: 1.2 },
  water: { color: [0.9, 0.95, 1.0], size: 1.8, life: 3, count: 1.2, drag: 1.5 },
  gas: { color: [0.8, 0.8, 0.8], size: 3, life: 3, count: 0, drag: 2 },
};

const MAX = 6000;

function spriteMaterial(additive) {
  return new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 800 } },
    vertexShader: /* glsl */ `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      attribute float aSize; attribute float aAlpha; attribute vec3 aColor;
      varying float vAlpha; varying vec3 vColor; uniform float uScale;
      void main() {
        vAlpha = aAlpha; vColor = aColor;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(aSize * uScale / max(-mv.z, 0.1), 1.0, 256.0);
        gl_Position = projectionMatrix * mv;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <logdepthbuf_pars_fragment>
      varying float vAlpha; varying vec3 vColor;
      void main() {
        #include <logdepthbuf_fragment>
        vec2 d = gl_PointCoord - 0.5;
        float a = smoothstep(0.5, 0.0, length(d)) * vAlpha;
        if (a < 0.003) discard;
        gl_FragColor = vec4(vColor, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}

export class SurfaceDust {
  constructor(scene) {
    this.p = new Float64Array(MAX * 3); // body-fixed metres
    this.v = new Float32Array(MAX * 3);
    this.age = new Float32Array(MAX);
    this.life = new Float32Array(MAX);
    this.size0 = new Float32Array(MAX);
    this.drag = new Float32Array(MAX);
    this.ground = new Float64Array(MAX); // local ground radius at the emission point
    this.count = 0;
    this.body = null;
    const g = new THREE.BufferGeometry();
    this.pos = new THREE.BufferAttribute(new Float32Array(MAX * 3), 3);
    this.pos.setUsage(THREE.DynamicDrawUsage);
    this.col = new THREE.BufferAttribute(new Float32Array(MAX * 3), 3);
    this.size = new THREE.BufferAttribute(new Float32Array(MAX), 1);
    this.alpha = new THREE.BufferAttribute(new Float32Array(MAX), 1);
    g.setAttribute('position', this.pos);
    g.setAttribute('aColor', this.col);
    g.setAttribute('aSize', this.size);
    g.setAttribute('aAlpha', this.alpha);
    this.mesh = new THREE.Points(g, spriteMaterial(false));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 8;
    scene.add(this.mesh);
  }

  // pos/vel in the body-fixed frame of `body`.
  emit(body, type, pos, vel, spread, n, groundRadius) {
    const fx = SURFACE_FX[type] ?? SURFACE_FX.regolith;
    if (this.body !== body) {
      this.count = 0;
      this.body = body;
    }
    const k = Math.floor(n * fx.count);
    for (let i = 0; i < k; i++) {
      if (this.count >= MAX) this._kill(0);
      const j = this.count++;
      this.p[j * 3] = pos.x + (Math.random() - 0.5) * 2;
      this.p[j * 3 + 1] = pos.y + (Math.random() - 0.5) * 2;
      this.p[j * 3 + 2] = pos.z + (Math.random() - 0.5) * 2;
      this.v[j * 3] = vel.x + (Math.random() - 0.5) * spread;
      this.v[j * 3 + 1] = vel.y + (Math.random() - 0.5) * spread;
      this.v[j * 3 + 2] = vel.z + (Math.random() - 0.5) * spread;
      this.age[j] = 0;
      this.life[j] = fx.life * (0.5 + Math.random());
      this.size0[j] = fx.size * (0.5 + Math.random());
      this.drag[j] = fx.drag;
      this.ground[j] = groundRadius ?? pos.length();
      const s = fx.sparkle && Math.random() < 0.3 ? 1.6 : 0.85 + Math.random() * 0.3;
      this.col.setXYZ(j, fx.color[0] * s, fx.color[1] * s, fx.color[2] * s);
    }
  }

  _kill(j) {
    const last = --this.count;
    if (j === last) return;
    for (let c = 0; c < 3; c++) {
      this.p[j * 3 + c] = this.p[last * 3 + c];
      this.v[j * 3 + c] = this.v[last * 3 + c];
    }
    this.age[j] = this.age[last];
    this.life[j] = this.life[last];
    this.size0[j] = this.size0[last];
    this.drag[j] = this.drag[last];
    this.ground[j] = this.ground[last];
    this.col.setXYZ(j, this.col.getX(last), this.col.getY(last), this.col.getZ(last));
  }

  update(dt, origin) {
    const b = this.body;
    if (!b || !this.count) {
      this.mesh.visible = false;
      return;
    }
    this.mesh.visible = true;
    const gm = b.gm;
    const q = b.quat;
    const o = new THREE.Vector3().subVectors(b.pos, origin);
    const tmp = new THREE.Vector3();
    for (let j = this.count - 1; j >= 0; j--) {
      this.age[j] += dt;
      if (this.age[j] > this.life[j]) {
        this._kill(j);
        continue;
      }
      const x = this.p[j * 3],
        y = this.p[j * 3 + 1],
        z = this.p[j * 3 + 2];
      const r = Math.hypot(x, y, z);
      const g = gm / (r * r);
      const d = this.drag[j];
      for (let c = 0; c < 3; c++) {
        const pc = this.p[j * 3 + c];
        this.v[j * 3 + c] += (-g * (pc / r) - d * this.v[j * 3 + c]) * dt;
        this.p[j * 3 + c] += this.v[j * 3 + c] * dt;
      }
      // Ground: grains stop where they land.
      const gr = this.ground[j];
      if (r < gr) {
        const s = (gr + 0.05) / r;
        this.p[j * 3] *= s;
        this.p[j * 3 + 1] *= s;
        this.p[j * 3 + 2] *= s;
        this.v[j * 3] *= 0.2;
        this.v[j * 3 + 1] *= 0.2;
        this.v[j * 3 + 2] *= 0.2;
      }
    }
    for (let j = 0; j < this.count; j++) {
      tmp
        .set(this.p[j * 3], this.p[j * 3 + 1], this.p[j * 3 + 2])
        .applyQuaternion(q)
        .add(o);
      this.pos.setXYZ(j, tmp.x, tmp.y, tmp.z);
      const t = this.age[j] / this.life[j];
      this.alpha.setX(j, (1 - t) * Math.min(1, this.age[j] * 8) * 0.85);
      this.size.setX(j, this.size0[j] * (1 + t * (this.drag[j] > 0 ? 6 : 1.5)));
    }
    this.mesh.geometry.setDrawRange(0, this.count);
    this.pos.needsUpdate = true;
    this.col.needsUpdate = true;
    this.size.needsUpdate = true;
    this.alpha.needsUpdate = true;
  }
}

// Short-lived sprites in the ship frame: RCS plumes, entry sparks.
export class LocalPuffs {
  constructor(parent, max = 1500, additive = false) {
    this.max = max;
    this.p = new Float32Array(max * 3);
    this.v = new Float32Array(max * 3);
    this.age = new Float32Array(max);
    this.life = new Float32Array(max);
    this.s0 = new Float32Array(max);
    this.count = 0;
    const g = new THREE.BufferGeometry();
    this.pos = new THREE.BufferAttribute(new Float32Array(max * 3), 3);
    this.col = new THREE.BufferAttribute(new Float32Array(max * 3), 3);
    this.size = new THREE.BufferAttribute(new Float32Array(max), 1);
    this.alpha = new THREE.BufferAttribute(new Float32Array(max), 1);
    g.setAttribute('position', this.pos);
    g.setAttribute('aColor', this.col);
    g.setAttribute('aSize', this.size);
    g.setAttribute('aAlpha', this.alpha);
    this.mesh = new THREE.Points(g, spriteMaterial(additive));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 9;
    parent.add(this.mesh);
  }

  emit(px, py, pz, vx, vy, vz, life, size, color) {
    if (this.count >= this.max) return;
    const j = this.count++;
    this.p.set([px, py, pz], j * 3);
    this.v.set([vx, vy, vz], j * 3);
    this.age[j] = 0;
    this.life[j] = life;
    this.s0[j] = size;
    this.col.setXYZ(j, color[0], color[1], color[2]);
  }

  update(dt) {
    for (let j = this.count - 1; j >= 0; j--) {
      this.age[j] += dt;
      if (this.age[j] > this.life[j]) {
        const l = --this.count;
        this.p.copyWithin(j * 3, l * 3, l * 3 + 3);
        this.v.copyWithin(j * 3, l * 3, l * 3 + 3);
        this.age[j] = this.age[l];
        this.life[j] = this.life[l];
        this.s0[j] = this.s0[l];
        this.col.setXYZ(j, this.col.getX(l), this.col.getY(l), this.col.getZ(l));
        continue;
      }
      for (let c = 0; c < 3; c++) this.p[j * 3 + c] += this.v[j * 3 + c] * dt;
    }
    for (let j = 0; j < this.count; j++) {
      this.pos.setXYZ(j, this.p[j * 3], this.p[j * 3 + 1], this.p[j * 3 + 2]);
      const t = this.age[j] / this.life[j];
      this.alpha.setX(j, (1 - t) * 0.7);
      this.size.setX(j, this.s0[j] * (1 + t * 3));
    }
    this.mesh.geometry.setDrawRange(0, this.count);
    this.pos.needsUpdate = true;
    this.col.needsUpdate = true;
    this.size.needsUpdate = true;
    this.alpha.needsUpdate = true;
  }
}
