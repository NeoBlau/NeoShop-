// Seamless orbit-to-surface terrain: a cube-sphere quadtree whose chunks are
// refined around the camera until vertices are ~1–2 m apart. Chunk vertices
// are stored relative to the chunk centre (float32-safe) and the chunk sits in
// the body-fixed frame; with the camera at the render origin every matrix is
// composed in double precision, so there is no jitter even on the surface of
// Jupiter's moons 5 AU from the Sun.

import * as THREE from 'three';
import { buildChunkArrays, borderLoop, FACES, N } from './chunkBuilder.js';

let sharedIndex = null;
function chunkIndex() {
  if (sharedIndex) return sharedIndex;
  const idx = [];
  const V = N + 1;
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const a = j * V + i,
        b = a + 1,
        c = a + V,
        d = c + 1;
      idx.push(a, b, d, a, d, c);
    }
  // Skirts: one extra vertex per border vertex, hanging below the surface.
  const base = V * V;
  const border = borderLoop();
  for (let k = 0; k < border.length; k++) {
    const a = border[k],
      b = border[(k + 1) % border.length];
    const sa = base + k,
      sb = base + ((k + 1) % border.length);
    idx.push(a, sa, b, b, sa, sb);
  }
  sharedIndex = idx;
  return idx;
}

const _p = new THREE.Vector3();

function cubeToSphere(face, a, b, out) {
  const ta = Math.tan((a * Math.PI) / 4);
  const tb = Math.tan((b * Math.PI) / 4);
  out.set(
    face.n[0] + face.u[0] * ta + face.v[0] * tb,
    face.n[1] + face.u[1] * ta + face.v[1] * tb,
    face.n[2] + face.u[2] * ta + face.v[2] * tb,
  );
  return out.normalize();
}

class Chunk {
  constructor(terrain, face, level, x, y, size) {
    this.t = terrain;
    this.face = face;
    this.level = level;
    this.x = x;
    this.y = y;
    this.size = size;
    this.children = null;
    this.mesh = null;
    this.queued = false;
    this.lastUsed = 0;
    const R = terrain.R;
    cubeToSphere(FACES[face], x + size / 2, y + size / 2, _p);
    this.dir = _p.clone();
    // Arc length of the chunk edge (the cube warp keeps chunks near-square).
    this.arc = ((Math.PI / 2) * R * size) / 2;
    // LOD distance is measured to the real surface under the chunk centre,
    // not to the mean sphere: a 21 km volcano must refine like flat ground.
    const hc =
      terrain.provider && level > 2 ? terrain.provider.height(_p.x, _p.y, _p.z, this.arc / 4) : 0;
    this.centerSurface = _p.clone().multiplyScalar(R + hc);
    this.boundRadius = this.arc * 0.8 + (level > 2 ? 0 : terrain.reliefRange);
  }

  build() {
    const t = this.t;
    // Procedural worlds: far chunks take colour from the painted global map,
    // near chunks compute it per vertex from the generator (sharp coastlines).
    const near = t.mode === 'procedural' && (!t.farMap || this.level >= t.nearLevel);
    const job = {
      face: this.face,
      x: this.x,
      y: this.y,
      size: this.size,
      arc: this.arc,
      R: t.R,
      mode: near ? 'procedural' : 'texture',
      rockTint: t.rockTint,
    };
    this.near = near;
    if (t.pool) {
      this.inflight = true;
      const version = t.version;
      t.inflight++;
      t.pool.build(t.poolKey, job).then((a) => {
        t.inflight--;
        this.inflight = false;
        if (this.dead || version !== t.version) return;
        this._makeMesh(a);
      });
      return;
    }
    this._makeMesh(buildChunkArrays(job, t.provider, t.detailNoise));
  }

  _makeMesh(a) {
    const t = this.t;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(a.position, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(a.normal, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(a.uv, 2));
    g.setAttribute('color', new THREE.BufferAttribute(a.color, 3));
    g.setIndex(chunkIndex());
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, this.near && t.nearMaterial ? t.nearMaterial : t.material);
    mesh.position.set(a.center[0], a.center[1], a.center[2]);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    mesh.visible = false;
    mesh.frustumCulled = true;
    t.group.add(mesh);
    this.mesh = mesh;
  }

  split() {
    const h = this.size / 2;
    const L = this.level + 1;
    this.children = [
      new Chunk(this.t, this.face, L, this.x, this.y, h),
      new Chunk(this.t, this.face, L, this.x + h, this.y, h),
      new Chunk(this.t, this.face, L, this.x, this.y + h, h),
      new Chunk(this.t, this.face, L, this.x + h, this.y + h, h),
    ];
  }

  disposeChildren() {
    if (!this.children) return;
    for (const c of this.children) {
      c.disposeChildren();
      c.disposeMesh();
      c.dead = true;
    }
    this.children = null;
  }

  disposeMesh() {
    if (this.mesh) {
      this.t.group.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh = null;
    }
    this.queued = false;
  }
}

export class Terrain {
  constructor(body, provider, material, options = {}) {
    this.body = body;
    this.provider = provider;
    this.material = material;
    this.R = body.radius;
    this.mode = provider?.mode ?? 'texture';
    this.group = new THREE.Group();
    this.group.name = 'terrain:' + body.id;
    this.splitFactor = options.splitFactor ?? 2.6;
    this.rockTint = options.rockTint ?? [0.8, 0.78, 0.75];
    this.detailNoise = options.detailNoise;
    this.reliefRange = provider
      ? Math.max(Math.abs(provider.maxHeight ?? 0), Math.abs(provider.minHeight ?? 0))
      : 0;
    const faceArc = (Math.PI / 2) * this.R;
    this.maxLevel = Math.max(
      2,
      Math.ceil(Math.log2(faceArc / (N * (options.finestSpacing ?? 1.6)))),
    );
    this.finestWavelength = (faceArc / Math.pow(2, this.maxLevel) / N) * 2;
    this.roots = FACES.map((_, f) => new Chunk(this, f, 0, -1, -1, 2));
    this.queue = [];
    this.version = provider?.version ?? 0;
    this.frame = 0;
    this.buildCount = 0;
    this.nearMaterial = options.nearMaterial ?? null;
    this.farMap = !!options.farMap;
    this.nearLevel = options.nearLevel ?? 6;
    this.pool = options.pool ?? null; // TerrainWorkerPool
    this.poolKey = options.poolKey ?? body.id;
    this.inflight = 0;
  }

  setSplitFactor(k) {
    this.splitFactor = k;
  }

  // Exact ground height for physics, matching the finest mesh.
  groundHeight(dx, dy, dz) {
    return this.provider ? this.provider.height(dx, dy, dz, this.finestWavelength) : 0;
  }

  rebuildAll() {
    for (const r of this.roots) {
      r.disposeChildren();
      r.disposeMesh();
    }
    this.queue.length = 0;
  }

  // camLocal: camera position in the body-fixed frame (metres, double).
  update(camLocal, budgetMs = 4) {
    this.frame++;
    if (this.provider && this.provider.version !== this.version) {
      this.version = this.provider.version;
      this.rebuildAll();
    }
    const camDist = camLocal.length();
    const horizon = Math.sqrt(Math.max(0, camDist * camDist - this.R * this.R * 0.98));
    this.queue.length = 0;
    for (const r of this.roots) this._visit(r, camLocal, camDist, horizon);
    // Coarse first, then nearest.
    this.queue.sort((a, b) => a.level - b.level || a._d - b._d);
    const start = performance.now();
    let built = 0;
    let waiting = 0;
    for (const c of this.queue) {
      if (c.inflight) {
        waiting++;
        continue;
      }
      if (this.pool) {
        if (this.pool.busy(this.inflight)) break;
      } else if (built > 0 && performance.now() - start > budgetMs) break;
      c.build();
      built++;
    }
    this.buildCount += built;
    for (const r of this.roots) this._show(r);
    return Math.max(0, this.queue.length - built - (this.pool ? 0 : waiting)) + this.inflight;
  }

  _visit(c, cam, camDist, horizon) {
    const d = Math.max(0, cam.distanceTo(c.centerSurface) - c.boundRadius);
    c._d = d;
    c.lastUsed = this.frame;
    if (!c.mesh) this.queue.push(c);
    const beyond =
      cam.distanceTo(c.centerSurface) - c.boundRadius > horizon + c.arc && camDist > this.R * 1.001;
    const want = c.level < this.maxLevel && d < c.arc * this.splitFactor && !beyond;
    if (want) {
      if (!c.children) c.split();
      for (const k of c.children) this._visit(k, cam, camDist, horizon);
    } else if (c.children) {
      c.disposeChildren();
    }
  }

  // A chunk is drawn when it has a mesh and its children cannot fully cover it.
  _show(c) {
    if (c.children && c.children.every((k) => this._ready(k))) {
      if (c.mesh) c.mesh.visible = false;
      for (const k of c.children) this._show(k);
      return;
    }
    if (c.mesh) c.mesh.visible = true;
    if (c.children) for (const k of c.children) this._hide(k);
  }

  _ready(c) {
    if (!c.mesh) return false;
    if (!c.children) return true;
    return true;
  }

  _hide(c) {
    if (c.mesh) c.mesh.visible = false;
    if (c.children) for (const k of c.children) this._hide(k);
  }

  dispose() {
    this.rebuildAll();
  }

  get chunkCount() {
    return this.group.children.length;
  }
}
