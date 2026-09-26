// Celestial background: an 8K all-sky Milky Way mosaic oriented in galactic
// coordinates (IAU 1958 galactic pole, J2000) plus a field of resolved point
// stars so the sky stays crisp at 4K. From another star a few dozen light
// years away the Milky Way looks the same; only nearby stars shift.

import * as THREE from 'three';
import { DEG, OBLIQUITY_J2000 } from '../core/constants.js';
import { Random } from '../core/rng.js';
import { blackbodyColor } from './shaders.js';

function eqToEcl(raDeg, decDeg) {
  const ra = raDeg * DEG,
    dec = decDeg * DEG;
  const v = new THREE.Vector3(
    Math.cos(dec) * Math.cos(ra),
    Math.cos(dec) * Math.sin(ra),
    Math.sin(dec),
  );
  return v.applyAxisAngle(new THREE.Vector3(1, 0, 0), -OBLIQUITY_J2000);
}

export const GALACTIC = (() => {
  const Z = eqToEcl(192.85948, 27.12825); // north galactic pole
  const Xraw = eqToEcl(266.4051, -28.93617); // galactic centre
  const X = Xraw.clone().addScaledVector(Z, -Xraw.dot(Z)).normalize();
  const Y = new THREE.Vector3().crossVectors(Z, X);
  return { X, Y, Z };
})();

export class Sky {
  constructor(scene) {
    this.scene = scene;
    const { X, Y, Z } = GALACTIC;
    // world (ecliptic) direction -> texture direction
    const m = new THREE.Matrix4().set(
      X.x,
      X.y,
      X.z,
      0,
      Z.x,
      Z.y,
      Z.z,
      0,
      -Y.x,
      -Y.y,
      -Y.z,
      0,
      0,
      0,
      0,
      1,
    );
    this.rotation = new THREE.Euler().setFromRotationMatrix(m);
    this.stars = this._makeStars(12000, 7);
    scene.add(this.stars);
  }

  setTexture(tex) {
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    this.scene.background = tex;
    this.scene.backgroundRotation.copy(this.rotation);
    this.scene.backgroundIntensity = 0.55;
  }

  _makeStars(count, seed) {
    const rnd = new Random(seed);
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const { X, Y, Z } = GALACTIC;
    const R = 5e14;
    const v = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      // Concentrate stars toward the galactic plane.
      let b;
      do b = Math.asin(rnd.range(-1, 1));
      while (rnd.next() > 0.35 + 0.65 * Math.exp(-Math.abs(b) / (18 * DEG)));
      const l = rnd.range(0, Math.PI * 2);
      v.set(0, 0, 0)
        .addScaledVector(X, Math.cos(b) * Math.cos(l))
        .addScaledVector(Y, Math.cos(b) * Math.sin(l))
        .addScaledVector(Z, Math.sin(b));
      pos.set([v.x * R, v.y * R, v.z * R], i * 3);
      // Apparent magnitude with N(<m) ∝ 10^(0.45 m); brightest few are 0–1 mag.
      const mag = Math.log10(1 + rnd.next() * (Math.pow(10, 0.45 * 7.5) - 1)) / 0.45 - 0.5;
      const flux = Math.pow(10, -0.4 * mag);
      const T =
        rnd.weighted([
          [3400, 30],
          [4400, 25],
          [5600, 18],
          [6800, 12],
          [9000, 9],
          [15000, 6],
        ]) * rnd.range(0.9, 1.1);
      const c = blackbodyColor(T);
      const lum = Math.min(4, 0.35 + flux * 1.8);
      col.set([c.r * lum, c.g * lum, c.b * lum], i * 3);
      size[i] = Math.min(4.5, 1.1 + Math.sqrt(flux) * 1.8);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('size', new THREE.BufferAttribute(size, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 1 }, uFade: { value: 1 } },
      vertexShader: /* glsl */ `
        #include <common>
        #include <logdepthbuf_pars_vertex>
        attribute float size; varying vec3 vColor; uniform float uScale;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = size * uScale;
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: /* glsl */ `
        #include <common>
        #include <logdepthbuf_pars_fragment>
        varying vec3 vColor; uniform float uFade;
        void main() {
          #include <logdepthbuf_fragment>
          vec2 d = gl_PointCoord - 0.5;
          float a = exp(-dot(d, d) * 18.0);
          gl_FragColor = vec4(vColor * a * uFade, a);
        }`,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(g, mat);
    pts.frustumCulled = false;
    pts.renderOrder = -10;
    return pts;
  }

  update(pixelRatio, fade) {
    this.stars.material.uniforms.uScale.value = pixelRatio;
    this.stars.material.uniforms.uFade.value = fade;
    this.scene.backgroundIntensity = 0.55 * fade;
  }
}
