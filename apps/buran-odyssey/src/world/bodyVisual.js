// Visual representation of one celestial body: LOD terrain or cloud-deck
// sphere, scattering atmosphere, clouds, rings, stellar photosphere and a
// point sprite that keeps distant worlds visible as stars.

import * as THREE from 'three';
import { createNoise3D } from '../core/noise.js';
import { hashString } from '../core/rng.js';
import { Terrain } from './terrain.js';
import { HeightMap, ProceduralHeightProvider, SolHeightProvider } from './heightfield.js';
import {
  blackbodyColor,
  createAtmosphereMaterial,
  createRingMaterial,
  createStarMaterial,
  createSurfaceMaterial,
  makeGlowTexture,
} from './shaders.js';

let glowTexture = null;
let sphereGeometry = null;
function unitSphere() {
  if (!sphereGeometry) {
    sphereGeometry = new THREE.SphereGeometry(1, 256, 128);
    sphereGeometry.rotateX(Math.PI / 2); // poles on +Z, lon 0 on +X, lon 90° on +Y
    const n = sphereGeometry.attributes.position.count;
    sphereGeometry.setAttribute(
      'color',
      new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3),
    );
  }
  return sphereGeometry;
}

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();

export class BodyVisual {
  constructor(body, ctx) {
    this.body = body;
    this.ctx = ctx;
    this.root = new THREE.Group(); // body-fixed frame
    this.root.name = body.id;
    this.inertial = new THREE.Group(); // translated, not rotated
    this.terrain = null;
    this.sphere = null;
    this.atmosphere = null;
    this.clouds = null;
    this.rings = null;
    this.dot = null;
    this.glow = null;
    this.surfaceMaterial = null;
    this.cloudRate = 0;
    this.loaded = false;
    body.visual = this;
  }

  async build() {
    const b = this.body;
    const def = b.def;
    const L = this.ctx.loader;
    const detailNoise = createNoise3D(hashString(b.id) ^ 0xabcdef);

    if (b.kind === 'star') {
      const color = def.star?.teff ? blackbodyColor(def.star.teff) : new THREE.Color(1, 1, 1);
      let map = null;
      if (def.textures?.map) map = await L.texture(def.textures.map).catch(() => null);
      const mat = createStarMaterial(map, def.textures?.map ? new THREE.Color(1, 1, 1) : color);
      this.sphere = new THREE.Mesh(unitSphere(), mat);
      this.sphere.scale.setScalar(b.radius);
      this.root.add(this.sphere);
      if (!glowTexture) glowTexture = makeGlowTexture();
      this.glow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTexture,
          color: color.clone().multiplyScalar(3.0),
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          transparent: true,
        }),
      );
      this.glow.scale.setScalar(b.radius * 9);
      this.inertial.add(this.glow);
      this.starColor = color;
      this._addDot(color, 5);
      this.loaded = true;
      return;
    }

    // Surface material and textures
    let map = null,
      night = null,
      spec = null;
    const texDefs = def.textures ?? {};
    if (texDefs.map) map = await L.texture(texDefs.map).catch(() => null);
    if (texDefs.night) night = await L.texture(texDefs.night).catch(() => null);
    if (texDefs.specular)
      spec = await L.texture(texDefs.specular, { srgb: false }).catch(() => null);

    if (b.gasGiant || def.giant) {
      if (!map && def.giant)
        map = await this.ctx.workers.generate({
          kind: 'giant',
          params: def.giant,
          width: 2048,
          height: 1024,
        });
      this.surfaceMaterial = createSurfaceMaterial({ map });
      this.surfaceMaterial.roughness = 1;
      this.sphere = new THREE.Mesh(unitSphere(), this.surfaceMaterial);
      this.sphere.scale.setScalar(b.radius);
      this.sphere.receiveShadow = false;
      this.root.add(this.sphere);
    } else {
      let provider;
      if (def.procedural) provider = new ProceduralHeightProvider(def.procedural);
      else provider = new SolHeightProvider(b);
      b.heightProvider = provider;
      const procedural = provider.mode === 'procedural';
      let nearMaterial = null;
      if (procedural) {
        // Global colour map painted by the same generator, for the far LODs.
        const params = def.procedural ?? provider.surface.params;
        map = await this.ctx.workers
          .generate({ kind: 'surface', params, width: 2048, height: 1024 })
          .catch(() => null);
        nearMaterial = createSurfaceMaterial({ procedural: true });
        this.nearMaterial = nearMaterial;
      }
      this.surfaceMaterial = createSurfaceMaterial({ map, night, specular: spec });
      const pool = this.ctx.terrainPool;
      if (pool) {
        pool.register(
          b.id,
          def.procedural
            ? { id: b.id, procedural: def.procedural }
            : { id: b.id, radius: b.radius, def },
        );
      }
      this.terrain = new Terrain(b, provider, this.surfaceMaterial, {
        pool,
        poolKey: b.id,
        nearMaterial,
        farMap: !!map,
        detailNoise,
        splitFactor: this.ctx.quality.splitFactor * (procedural ? 1.3 : 1),
        rockTint: def.rockTint ?? [0.85, 0.8, 0.74],
      });
      b.finestWavelength = this.terrain.finestWavelength;
      b.terrain = this.terrain;
      this.root.add(this.terrain.group);
      // Elevation and ocean masks load in the background; chunks rebuild when they arrive.
      const t = def.terrain;
      if (t?.heightMap) {
        L.image(t.heightMap)
          .then((img) => {
            const map = HeightMap.fromImage(img, 4096, 1);
            pool?.raster(b.id, 'height', map);
            provider.setMap(map);
          })
          .catch((e) => console.warn('height map', b.id, e.message));
      }
      if (t?.ocean) {
        L.image(t.ocean)
          .then((img) => {
            const map = HeightMap.fromImage(img, 2048, 1);
            pool?.raster(b.id, 'ocean', map);
            provider.setOcean(map);
          })
          .catch((e) => console.warn('ocean mask', b.id, e.message));
      }
    }

    if (b.atmosphere) {
      const top = b.atmosphere.top;
      const g = new THREE.SphereGeometry(1 + top / b.radius, 128, 64);
      this.atmosphereMaterial = createAtmosphereMaterial(b);
      this.atmosphere = new THREE.Mesh(g, this.atmosphereMaterial);
      this.atmosphere.scale.setScalar(b.radius);
      this.atmosphere.renderOrder = 5;
      this.atmosphere.frustumCulled = false;
      this.inertial.add(this.atmosphere);
    }

    if (texDefs.clouds) {
      const alpha = await L.texture(texDefs.clouds, { srgb: false }).catch(() => null);
      if (alpha) this._addClouds(alpha, null, 9000, 0);
    }
    const deck = def.atmosphere?.cloudDeck;
    if (deck) {
      const tex = await this.ctx.workers.generate({
        kind: 'clouds',
        params: { seed: hashString(b.id + 'clouds'), color: deck.color, opacity: 0.97 },
        width: 2048,
        height: 1024,
      });
      // Venus's cloud tops super-rotate once every ~4 days (retrograde).
      this._addClouds(null, tex, deck.top, (-2 * Math.PI) / (4 * 86400) - b.rotationRate);
    }

    if (def.rings) {
      const tex = await L.texture(def.rings.texture, { repeat: false }).catch(() => null);
      if (tex) {
        const g = new THREE.RingGeometry(def.rings.inner, def.rings.outer, 512, 1);
        const pos = g.attributes.position;
        const uv = g.attributes.uv;
        for (let i = 0; i < pos.count; i++) {
          const r = Math.hypot(pos.getX(i), pos.getY(i));
          uv.setXY(i, (r - def.rings.inner) / (def.rings.outer - def.rings.inner), 0.5);
        }
        this.ringMaterial = createRingMaterial(tex, b.radius);
        this.rings = new THREE.Mesh(g, this.ringMaterial);
        this.rings.renderOrder = 4;
        this.root.add(this.rings);
      }
    }

    const albedoColor = new THREE.Color().setHSL(0.08, 0.2, 0.6);
    this._addDot(albedoColor, 3);
    this.loaded = true;
  }

  _addClouds(alphaMap, map, altitude, relativeRate) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map,
      alphaMap,
      transparent: true,
      depthWrite: false,
      roughness: 1,
      metalness: 0,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(unitSphere(), mat);
    mesh.scale.setScalar(this.body.radius + altitude);
    mesh.renderOrder = 3;
    this.clouds = mesh;
    this.cloudRate = relativeRate;
    this.root.add(mesh);
  }

  _addDot(color, size) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
    const m = new THREE.PointsMaterial({
      color,
      size,
      sizeAttenuation: false,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.dot = new THREE.Points(g, m);
    this.dot.frustumCulled = false;
    this.dot.renderOrder = 6;
    this.inertial.add(this.dot);
  }

  // f: { origin, camPos, camera, starPos, t, pixelAngle, budgetMs, fluxScale }
  update(f) {
    const b = this.body;
    this.root.position.subVectors(b.pos, f.origin);
    this.root.quaternion.copy(b.quat);
    this.inertial.position.copy(this.root.position);
    const rel = _v.subVectors(f.camPos, b.pos);
    const dist = rel.length();
    const angRadius = b.radius / Math.max(dist, 1);
    const sunDir = new THREE.Vector3().subVectors(f.starPos, b.pos);
    if (sunDir.lengthSq() < 1) sunDir.set(1, 0, 0);
    sunDir.normalize();

    if (this.dot) {
      this.dot.visible = angRadius < f.pixelAngle * 2.5;
      this.dot.material.opacity =
        b.kind === 'star' ? 1 : Math.min(1, 0.4 + 0.4 * Math.sqrt(f.fluxScale));
    }
    if (this.glow) {
      // Keep the corona legible from the outer planets without blowing out close in.
      const s = Math.max(b.radius * 9, dist * f.pixelAngle * 60);
      this.glow.scale.setScalar(s);
    }

    if (this.terrain) {
      _q.copy(b.quat).invert();
      const camLocal = rel.clone().applyQuaternion(_q);
      const budget = dist < b.radius * 40 ? f.budgetMs : 0.5;
      this.pendingChunks = this.terrain.update(camLocal, budget);
    }
    if (this.clouds && this.cloudRate) {
      this.clouds.rotation.z = (f.t * this.cloudRate) % (Math.PI * 2);
    }
    if (this.nearMaterial) {
      const a = this.nearMaterial.userData.uniforms,
        b2 = this.surfaceMaterial.userData.uniforms;
      a.uSunView.value.copy(b2.uSunView.value);
      a.uFogColor.value.copy(b2.uFogColor.value);
      a.uFogDensity.value = b2.uFogDensity.value;
    }
    if (this.surfaceMaterial) {
      const u = this.surfaceMaterial.userData.uniforms;
      u.uSunView.value.copy(sunDir).transformDirection(f.camera.matrixWorldInverse);
      // Aerial perspective when the camera is inside the atmosphere.
      if (b.atmosphere) {
        const alt = dist - b.radius;
        const a = b.atmosphere;
        const ext =
          (a.def.rayleigh[0] + a.def.rayleigh[1] + a.def.rayleigh[2]) / 3 + a.def.mie[1] * 1.1;
        const rhoRatio = a.density(Math.max(alt, -5000)) / a.rho0;
        u.uFogDensity.value =
          alt < a.top ? ext * Math.max(rhoRatio, 0) * (a.def.cloudDeck ? 6 : 1) : 0;
        const up = rel.clone().normalize();
        const sunElev = up.dot(sunDir);
        const light = THREE.MathUtils.smoothstep(sunElev, -0.15, 0.25);
        u.uFogColor.value
          .setRGB(...a.def.fog)
          .multiplyScalar(light * 0.9 * Math.min(1.5, f.fluxScale * 1.5));
      }
    }
    if (this.atmosphere) {
      const m = this.atmosphereMaterial.uniforms;
      m.uCam.value.copy(rel).divideScalar(b.radius);
      m.uSun.value.copy(sunDir);
      m.uSunI.value = 10 * Math.min(1.6, f.fluxScale);
      const inside = dist < b.radius + b.atmosphere.top;
      this.atmosphereMaterial.side = inside ? THREE.BackSide : THREE.FrontSide;
    }
    if (this.rings) {
      _q.copy(b.quat).invert();
      this.ringMaterial.uniforms.uSunObj.value.copy(sunDir).applyQuaternion(_q);
      this.ringMaterial.uniforms.uCamObj.value.copy(rel).applyQuaternion(_q);
      this.ringMaterial.uniforms.uLight.value = Math.min(2, 1.2 * Math.sqrt(f.fluxScale) + 0.3);
    }
    if (b.kind === 'star' && this.sphere) this.sphere.material.uniforms.uTime.value = f.realTime;
  }

  dispose() {
    this.terrain?.dispose();
    if (this.terrain) this.ctx.terrainPool?.drop(this.body.id);
    this.root.removeFromParent();
    this.inertial.removeFromParent();
    this.root.traverse((o) => {
      if (o.geometry && o.geometry !== sphereGeometry) o.geometry.dispose();
    });
  }
}
