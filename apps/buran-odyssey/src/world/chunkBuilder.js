// Pure chunk-geometry builder shared by the terrain workers and the
// main-thread fallback. No THREE import: it runs inside module workers,
// which do not see the page's import map.

export const N = 32;
export const SAMPLES = N + 3;
export const FACES = [
  { n: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1] },
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  { n: [0, 1, 0], u: [0, 0, 1], v: [1, 0, 0] },
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  { n: [0, 0, -1], u: [0, 1, 0], v: [1, 0, 0] },
];

export function borderLoop() {
  const V = N + 1;
  const loop = [];
  for (let i = 0; i < N; i++) loop.push(i);
  for (let j = 0; j < N; j++) loop.push(j * V + N);
  for (let i = N; i > 0; i--) loop.push(N * V + i);
  for (let j = N; j > 0; j--) loop.push(j * V);
  return loop;
}
const BORDER = borderLoop();

export function cubeDir(face, a, b, out) {
  const ta = Math.tan((a * Math.PI) / 4);
  const tb = Math.tan((b * Math.PI) / 4);
  const x = face.n[0] + face.u[0] * ta + face.v[0] * tb;
  const y = face.n[1] + face.u[1] * ta + face.v[1] * tb;
  const z = face.n[2] + face.u[2] * ta + face.v[2] * tb;
  const l = Math.hypot(x, y, z);
  out[0] = x / l;
  out[1] = y / l;
  out[2] = z / l;
  return out;
}

class V3 {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.z = 0;
  }
  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
  crossVectors(a, b) {
    return this.set(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
  }
  normalize() {
    const l = Math.hypot(this.x, this.y, this.z) || 1;
    this.x /= l;
    this.y /= l;
    this.z /= l;
    return this;
  }
}

// job: { face, x, y, size, arc, R, mode, rockTint }
export function buildChunkArrays(job, provider, detailNoise) {
  const t = { detailNoise, mode: job.mode, rockTint: job.rockTint };
  const face = FACES[job.face];
  const self = job;
  const dirv = [0, 0, 0];
  const R = job.R;
  const spacing = self.arc / N;
  const minWl = spacing * 2;
  const S = SAMPLES;
  const pos = new Float64Array(S * S * 3);
  const dirs = new Float32Array(S * S * 3);
  const hs = new Float32Array(S * S);
  for (let j = 0; j < S; j++)
    for (let i = 0; i < S; i++) {
      const a = self.x + (self.size * (i - 1)) / N;
      const b = self.y + (self.size * (j - 1)) / N;
      const dir = cubeDir(face, a, b, dirv);
      const h = provider ? provider.height(dir[0], dir[1], dir[2], minWl) : 0;
      const k = j * S + i;
      const r = R + h;
      pos[k * 3] = dir[0] * r;
      pos[k * 3 + 1] = dir[1] * r;
      pos[k * 3 + 2] = dir[2] * r;
      dirs[k * 3] = dir[0];
      dirs[k * 3 + 1] = dir[1];
      dirs[k * 3 + 2] = dir[2];
      hs[k] = h;
    }
  const ci = (N / 2 + 1) * S + (N / 2 + 1);
  const center = { x: pos[ci * 3], y: pos[ci * 3 + 1], z: pos[ci * 3 + 2] };

  const V = N + 1;
  const vCount = V * V + BORDER.length;
  const position = new Float32Array(vCount * 3);
  const normal = new Float32Array(vCount * 3);
  const uv = new Float32Array(vCount * 2);
  const color = new Float32Array(vCount * 3);
  const lons = new Float32Array(V * V);
  let minU = 1,
    maxU = 0;
  const nrm = new V3(),
    du = new V3(),
    dv = new V3();
  const col = [1, 1, 1];
  const noise = t.detailNoise;
  for (let j = 0; j < V; j++)
    for (let i = 0; i < V; i++) {
      const k = (j + 1) * S + (i + 1);
      const o = j * V + i;
      position[o * 3] = pos[k * 3] - center.x;
      position[o * 3 + 1] = pos[k * 3 + 1] - center.y;
      position[o * 3 + 2] = pos[k * 3 + 2] - center.z;
      const kl = k - 1,
        kr = k + 1,
        kd = k - S,
        ku = k + S;
      du.set(
        pos[kr * 3] - pos[kl * 3],
        pos[kr * 3 + 1] - pos[kl * 3 + 1],
        pos[kr * 3 + 2] - pos[kl * 3 + 2],
      );
      dv.set(
        pos[ku * 3] - pos[kd * 3],
        pos[ku * 3 + 1] - pos[kd * 3 + 1],
        pos[ku * 3 + 2] - pos[kd * 3 + 2],
      );
      nrm.crossVectors(du, dv).normalize();
      normal[o * 3] = nrm.x;
      normal[o * 3 + 1] = nrm.y;
      normal[o * 3 + 2] = nrm.z;
      const dx = dirs[k * 3],
        dy = dirs[k * 3 + 1],
        dz = dirs[k * 3 + 2];
      const lon = Math.atan2(dy, dx);
      const lat = Math.asin(Math.max(-1, Math.min(1, dz)));
      const u = lon / (2 * Math.PI) + 0.5;
      lons[o] = u;
      minU = Math.min(minU, u);
      maxU = Math.max(maxU, u);
      uv[o * 2 + 1] = lat / Math.PI + 0.5;
      // Colour: slope, fine albedo variation, or the full procedural palette.
      const slope = 1 - (nrm.x * dx + nrm.y * dy + nrm.z * dz);
      const h = hs[k];
      const f = 1 / Math.max(1, spacing);
      const n1 = noise(dx * R * 0.004, dy * R * 0.004, dz * R * 0.004);
      const n2 =
        spacing < 60 ? noise(dx * R * 0.05, dy * R * 0.05, dz * R * 0.05) * Math.min(1, 25 * f) : 0;
      if (t.mode === 'procedural' && provider) {
        provider.color(dx, dy, dz, h, col);
        col[0] = Math.pow(col[0], 2.2);
        col[1] = Math.pow(col[1], 2.2);
        col[2] = Math.pow(col[2], 2.2);
      } else {
        col[0] = col[1] = col[2] = 1;
      }
      let shade = 1 + 0.16 * n1 + 0.1 * n2;
      const rock = Math.min(1, Math.max(0, (slope - 0.08) * 4));
      shade *= 1 - 0.28 * rock;
      const tint = t.rockTint;
      color[o * 3] = col[0] * shade * (1 - rock * 0.3 + rock * 0.3 * tint[0]);
      color[o * 3 + 1] = col[1] * shade * (1 - rock * 0.3 + rock * 0.3 * tint[1]);
      color[o * 3 + 2] = col[2] * shade * (1 - rock * 0.3 + rock * 0.3 * tint[2]);
    }
  // Longitude seam: keep u continuous inside the chunk (texture repeats).
  const seam = maxU - minU > 0.5;
  for (let o = 0; o < V * V; o++) {
    let u = lons[o];
    if (seam && u < 0.5) u += 1;
    uv[o * 2] = u;
  }
  // Poles: longitude is undefined, borrow it from the neighbour.
  for (let o = 0; o < V * V; o++) {
    const d = Math.abs(uv[o * 2 + 1] - 0.5);
    if (d > 0.4999) uv[o * 2] = uv[(o === 0 ? 1 : o - 1) * 2];
  }
  // Skirts
  const skirt = spacing * 3 + 5;
  for (let s = 0; s < BORDER.length; s++) {
    const src = BORDER[s];
    const o = V * V + s;
    const i = src % V,
      j = Math.floor(src / V);
    const k = (j + 1) * S + (i + 1);
    position[o * 3] = position[src * 3] - dirs[k * 3] * skirt;
    position[o * 3 + 1] = position[src * 3 + 1] - dirs[k * 3 + 1] * skirt;
    position[o * 3 + 2] = position[src * 3 + 2] - dirs[k * 3 + 2] * skirt;
    normal.copyWithin(o * 3, src * 3, src * 3 + 3);
    uv.copyWithin(o * 2, src * 2, src * 2 + 2);
    color.copyWithin(o * 3, src * 3, src * 3 + 3);
  }
  return { position, normal, uv, color, center: [center.x, center.y, center.z] };
}
