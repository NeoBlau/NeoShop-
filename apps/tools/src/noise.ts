/**
 * Deterministic value noise and the patterns built on it.
 *
 * Everything here takes a seed and returns the same field every run, so the
 * generated textures are reproducible: regenerating the demo catalogue does
 * not silently change what the models look like.
 */

const PERM_SIZE = 512;

function buildPermutation(seed: number): Uint8Array {
  const permutation = new Uint8Array(PERM_SIZE);
  const base = new Uint8Array(256);
  for (let i = 0; i < 256; i += 1) base[i] = i;

  // xorshift32: small, fast, and stable across Node versions.
  let state = seed || 1;
  const next = (): number => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };

  for (let i = 255; i > 0; i -= 1) {
    const j = next() % (i + 1);
    const swap = base[i] ?? 0;
    base[i] = base[j] ?? 0;
    base[j] = swap;
  }

  for (let i = 0; i < PERM_SIZE; i += 1) permutation[i] = base[i & 255] ?? 0;
  return permutation;
}

const smoothstep = (t: number): number => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export class Noise {
  private readonly permutation: Uint8Array;

  constructor(seed: number) {
    this.permutation = buildPermutation(seed);
  }

  /** Hashed gradient-free value in [0,1) at integer lattice point. */
  private lattice(x: number, y: number): number {
    const xi = x & 255;
    const yi = y & 255;
    const hash = this.permutation[(this.permutation[xi] ?? 0) + yi] ?? 0;
    return hash / 255;
  }

  /** Value noise in [0,1], tiling on `period` so textures wrap seamlessly. */
  value(x: number, y: number, period: number): number {
    const wrap = (v: number): number => ((v % period) + period) % period;
    const x0 = Math.floor(wrap(x));
    const y0 = Math.floor(wrap(y));
    const x1 = (x0 + 1) % period;
    const y1 = (y0 + 1) % period;
    const fx = smoothstep(wrap(x) - x0);
    const fy = smoothstep(wrap(y) - y0);

    const top = lerp(this.lattice(x0, y0), this.lattice(x1, y0), fx);
    const bottom = lerp(this.lattice(x0, y1), this.lattice(x1, y1), fx);
    return lerp(top, bottom, fy);
  }

  /** Fractal sum. `octaves` doublings of frequency at half the amplitude. */
  fbm(x: number, y: number, period: number, octaves: number, gain = 0.5): number {
    let amplitude = 1;
    let total = 0;
    let normalization = 0;
    let frequency = 1;

    for (let octave = 0; octave < octaves; octave += 1) {
      total += this.value(x * frequency, y * frequency, period * frequency) * amplitude;
      normalization += amplitude;
      amplitude *= gain;
      frequency *= 2;
    }

    return total / normalization;
  }

  /** Ridged noise: creases instead of blobs. Good for scratches and weave. */
  ridged(x: number, y: number, period: number, octaves: number): number {
    return 1 - Math.abs(this.fbm(x, y, period, octaves) * 2 - 1);
  }
}

/**
 * Derives a tangent-space normal map from a height field with a Sobel filter.
 * Wraps at the edges, so a tiling height field yields a tiling normal map.
 */
export function heightToNormal(height: Float32Array, size: number, strength: number): Uint8Array {
  const normal = new Uint8Array(size * size * 3);
  const at = (x: number, y: number): number =>
    height[((y + size) % size) * size + ((x + size) % size)] ?? 0;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx =
        at(x - 1, y - 1) +
        2 * at(x - 1, y) +
        at(x - 1, y + 1) -
        (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1));
      const dy =
        at(x - 1, y - 1) +
        2 * at(x, y - 1) +
        at(x + 1, y - 1) -
        (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1));

      let nx = dx * strength;
      let ny = dy * strength;
      const nz = 1;
      const length = Math.hypot(nx, ny, nz);
      nx /= length;
      ny /= length;

      const index = (y * size + x) * 3;
      normal[index] = Math.round((nx * 0.5 + 0.5) * 255);
      normal[index + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      normal[index + 2] = Math.round((nz / length) * 255);
    }
  }

  return normal;
}

/** Cheap ambient occlusion: cavities in the height field darken. */
export function heightToOcclusion(
  height: Float32Array,
  size: number,
  radius: number,
  strength: number,
): Float32Array {
  const occlusion = new Float32Array(size * size);
  const at = (x: number, y: number): number =>
    height[((y + size) % size) * size + ((x + size) % size)] ?? 0;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const centre = at(x, y);
      // Four-tap neighbourhood average: enough to read as contact shadowing
      // once the map is on a surface, and cheap enough for 16 megapixels.
      const around =
        (at(x - radius, y) + at(x + radius, y) + at(x, y - radius) + at(x, y + radius)) / 4;
      const cavity = Math.max(0, around - centre);
      occlusion[y * size + x] = Math.max(0, Math.min(1, 1 - cavity * strength));
    }
  }

  return occlusion;
}
