/**
 * The second main location: a forest clearing high in the mountains.
 *
 *   pnpm --filter @3dsfera/tools run build:nature
 *
 * No large natural scene is downloadable without an account, so this one is
 * assembled rather than fetched: the trees, rocks, ferns and cliffs are Poly
 * Haven photogrammetry, CC0, and the ground they stand on is ours. Every tree
 * in it is a photograph of a tree.
 *
 * The shape is a clearing — a wide, nearly level glade with the forest closed
 * around it — rather than a path between two banks. The first attempt was the
 * latter and it was wrong in three ways worth writing down, because all three
 * are easy to walk back into:
 *
 *   1. A corridor five metres wide with the ground climbing on both sides has
 *      no middle distance. Standing in it you see two slopes and a strip of
 *      sky, which is a trench, not a landscape.
 *   2. The banks were a constant gradient with noise on top, and the noise was
 *      asked for at the wrong scale — see `relief` below, which is where that
 *      mistake is written down. A constant gradient renders as a flat plane
 *      and the eye reads it as folded card; noise at the wrong scale turns it
 *      into a field of spikes. Slopes need relief at the scale of several
 *      metres, and it has to come in *with* the slope or there is a crease
 *      along the join.
 *   3. Terrain UVs projected straight down from the XZ plane are fine on flat
 *      ground and smear to mud on anything steep — a vertical face gets one
 *      texel stretched down its whole height. Here they are arc length along
 *      the surface instead, which costs two extra passes over the grid and
 *      fixes it completely.
 *
 * What keeps the clearing walkable is not the slope but the height band: the
 * walkable map carries one byte of centimetres per cell, two and a half metres
 * of range in total, so the grid is built with a band around the clearing floor
 * and anything outside it has no floor at all. That is a hard guarantee, which
 * a slope test is not — noise on a bank can always cut a notch gentle enough
 * to walk up, and then the flood fill escapes onto the hillside and every
 * height in the clearing saturates the byte.
 *
 * Output is the same manifest the street writes, so the scene loads it with the
 * same code: geometry in four levels of detail, a walkable bitmap, a ground
 * bitmap, a spawn and six plots for suppliers.
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import draco3d from 'draco3dgltf';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import {
  Document,
  Logger,
  NodeIO,
  type Material,
  type Mesh,
  type Node as GltfNode,
  type Transform,
} from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRDracoMeshCompression } from '@gltf-transform/extensions';
import {
  dedup,
  instance,
  mergeDocuments,
  prune,
  simplify,
  textureCompress,
  unpartition,
  weld,
} from '@gltf-transform/functions';
import { buildWalkableGrid, countWalkable, packMask } from './location-walkable.js';
import { Noise } from './noise.js';
import { triangleCount } from './gltf-space.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SOURCES = path.resolve(HERE, '../../../assets/nature');
const ID = 'grove';
const OUT = path.resolve(HERE, `../../web/public/world/locations/${ID}`);

const SEED = 0x2f9a41c7;

/** Metres. X runs the length of the clearing, Z across it. */
const AREA = { minX: -82, maxX: 82, minZ: -58, maxZ: 58 } as const;
/** Terrain vertex spacing. One metre is finer than anything the eye catches. */
const TERRAIN_STEP = 1;
/**
 * Metres of surface one tile of each ground texture covers.
 *
 * Per material, because they are looked at from completely different
 * distances. The path is underfoot and wants detail; the banks are a wall
 * twenty metres off, and at three metres a tile the repeat reads as
 * wallpaper — the eye finds a grid long before it runs out of resolution.
 */
const GROUND_TILE: Record<Ground, number> = {
  trodden: 2.2,
  forest: 3.4,
  rock: 5.6,
};

/** How far the clearing reaches along X before the forest closes across it. */
const CLEARING_HALF_LENGTH = 54;
/** Half-width of the trodden path down the clearing. */
const PATH_HALF = 1.45;

/** Supplier plots: flat pads inside the clearing, backed by the treeline. */
const PLOT_COUNT = 6;
const PLOT_RADIUS = 3.3;
/** How far short of the treeline a pad sits, so the trees are behind it. */
const PLOT_INSET = 8.2;

/** Metres the rim stands above the clearing floor. */
const RIM = 26;

/**
 * How the scene should be lit, shipped in the manifest so the renderer does
 * not have to know which location it is showing.
 *
 * A location built for one sky cannot be lit like a location built for
 * another. The street is a Parisian noon lit by a photographed city HDRI; this
 * is a forest under a pure sky, which is a white dome filling half the world.
 * Left at the street's numbers it turned the canopy into white paper, and the
 * first two attempts to fix it by pulling the exposure down only made a grey
 * forest — because the problem was the ambient, not the exposure.
 *
 * So the environment came down and the sun went up, and then the sun came
 * back down again: at two the ground facing straight up burned out to pale
 * sand while the banks stayed in shade, which is a different way of looking
 * wrong. These numbers are the settled ones — enough sun for a shadow under
 * every tree, not enough to bleach the floor between them.
 */
const LIGHT = { exposure: 0.72, environment: 0.55, sun: 1.5, hemisphere: 0.22 } as const;

/**
 * Four levels, the same ladder the street uses — but with a texture budget per
 * level as well as a triangle one.
 *
 * The first build made all four levels the same size, because the geometry is
 * a tenth of the file and the textures are the rest: twenty scans times three
 * maps at 2K is thirty-eight megabytes whatever the triangles do. A level of
 * detail that does not reduce the download is not a level of detail.
 *
 * The error bounds are generous and get more so. Meshopt stops at whichever
 * comes first, the ratio or the error, and on photogrammetry the error binds
 * long before the ratio — which is how the first attempt produced a "six per
 * cent" level with forty per cent of the triangles still in it.
 */
const LEVELS = [
  { level: 0, ratio: 1, error: 0, texture: 2048 },
  { level: 1, ratio: 0.45, error: 0.08, texture: 1024 },
  { level: 2, ratio: 0.18, error: 0.3, texture: 512 },
  { level: 3, ratio: 0.06, error: 0.7, texture: 256 },
] as const;

const TEXTURE_MAX = 2048;

export const SOURCE = {
  title: 'Mountain Grove, assembled from Poly Haven scans',
  author: 'Poly Haven',
  licence: 'CC0',
  licenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  origin: 'https://polyhaven.com/',
} as const;

const noise = new Noise(SEED);

/**
 * Signed noise in [-1, 1] whose features are `metres` across.
 *
 * `Noise.value` interpolates between *integer* lattice points, and its
 * `period` argument is only the tiling period — so `fbm(x, z, 24, 4)` does not
 * give noise with twenty-four-metre features. It gives noise with one-metre
 * features that happens to repeat every twenty-four. Two versions of this
 * terrain asked for hills that way and got a field of one-metre spikes, which
 * is exactly what they rendered as.
 *
 * So the coordinates are divided here, and the period is left large enough
 * that nothing inside the location ever reaches the tile seam.
 */
function relief(x: number, z: number, metres: number, octaves: number): number {
  return noise.fbm(x / metres, z / metres, 64, octaves) * 2 - 1;
}

/** Z of the middle of the clearing at a given X. It wanders; a straight one reads as a road. */
function clearingCentre(x: number): number {
  return Math.sin(x / 33) * 8 + Math.sin(x / 12 + 1.7) * 2.4;
}

/** Half-width of the clearing at a given X: it opens out and pinches in. */
function clearingHalf(x: number): number {
  return 15.5 + Math.sin(x / 21 + 0.4) * 4.2 + Math.sin(x / 8.5 + 2.1) * 1.8;
}

/**
 * Polynomial smooth maximum.
 *
 * The clearing's sides and its two ends are each a distance, and the clearing
 * is where both are negative. A plain `max` of the two puts a right angle in
 * the treeline at each corner; this rounds them over `k` metres.
 */
function smoothMax(a: number, b: number, k: number): number {
  const h = Math.max(0, k - Math.abs(a - b)) / k;
  return Math.max(a, b) + (h * h * k) / 4;
}

/**
 * Metres from the edge of the clearing: negative inside, positive up the bank.
 *
 * Everything about the location's shape is a function of this one number —
 * where the ground lifts, which material the ground gets, and what is allowed
 * to grow where.
 */
function clearingEdge(x: number, z: number): number {
  const across = Math.abs(z - clearingCentre(x)) - clearingHalf(x);
  const along = Math.abs(x) - CLEARING_HALF_LENGTH;
  // A ragged treeline rather than a drawn curve: two metres of it, at the
  // scale of a few trees.
  const ragged = relief(x, z, 17, 3) * 2;
  return smoothMax(across, along, 7) + ragged;
}

interface Plot {
  x: number;
  z: number;
  /** +1 north of the clearing's middle, -1 south. */
  side: 1 | -1;
}

const PLOTS: Plot[] = Array.from({ length: PLOT_COUNT }, (_, index) => {
  const span = CLEARING_HALF_LENGTH * 2 - 26;
  const x = -CLEARING_HALF_LENGTH + 13 + (index * span) / (PLOT_COUNT - 1);
  const side: 1 | -1 = index % 2 === 0 ? 1 : -1;
  return { x, z: clearingCentre(x) + side * Math.max(6, clearingHalf(x) - PLOT_INSET), side };
});

/** Distance from a point to a line segment, in the XZ plane. */
function toSegment(x: number, z: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const length = dx * dx + dz * dz;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / length));
  return Math.hypot(x - (ax + dx * t), z - (az + dz * t));
}

/**
 * Distance to the trodden ground: the path down the clearing, the spurs off it
 * and the pads themselves.
 *
 * The path is only a material — the ground under it is the same ground. A path
 * cut into the terrain would be a trench, and a raised one a kerb; what makes
 * a path read as a path is that nothing grows on it.
 */
function pathDistance(x: number, z: number): number {
  let best = Math.abs(z - clearingCentre(x));

  for (const plot of PLOTS) {
    const junction = clearingCentre(plot.x);
    best = Math.min(best, toSegment(x, z, plot.x, junction, plot.x, plot.z));
    best = Math.min(best, Math.hypot(x - plot.x, z - plot.z) - PLOT_RADIUS);
  }

  return best;
}

/** True on a pavilion pad, which is level ground however the clearing rolls. */
function padAt(x: number, z: number): Plot | undefined {
  return PLOTS.find((plot) => Math.hypot(x - plot.x, z - plot.z) <= PLOT_RADIUS + 0.8);
}

/**
 * How much a point belongs to its pad: one at the middle, nought past the rim.
 *
 * The first version switched: inside the radius the ground was the pad's
 * level, outside it was whatever the terrain said. Where a pad happened to
 * reach the rising ground — and the treeline wanders by two metres, so some
 * do — that left a clean vertical step a metre high, which renders as a
 * quarry bench. Blending the last metre and a bit makes it a ramp.
 */
function padWeight(x: number, z: number, plot: Plot): number {
  const from = Math.hypot(x - plot.x, z - plot.z);
  const flat = PLOT_RADIUS - 0.6;
  const edge = PLOT_RADIUS + 0.8;
  if (from <= flat) return 1;
  if (from >= edge) return 0;

  const t = (from - flat) / (edge - flat);
  return 1 - t * t * (3 - 2 * t);
}

/**
 * The gentle unevenness of the clearing floor.
 *
 * Kept small on purpose. The ground bitmap has two and a half metres of range
 * and the grid is built with a band narrower than that, so ground the buyer
 * walks on has to stay within about a metre of level or it simply falls out of
 * the walkable map.
 */
function clearingFloor(x: number, z: number): number {
  return relief(x, z, 23, 3) * 0.52 + relief(x + 400, z - 250, 61, 2) * 0.34;
}

/** Terrain height, before the pavilion pads are levelled into it. */
function groundHeight(x: number, z: number): number {
  const floor = clearingFloor(x, z);
  const edge = clearingEdge(x, z);

  // The ground begins to lift a metre and a half before the treeline, so the
  // clearing has a lip rather than a step.
  const up = Math.max(0, edge + 1.5);
  if (up === 0) return floor;

  // Steep for the first four metres — steep enough that no step test will take
  // it, which is what makes the clearing a clearing — then easing into a
  // hillside and finally the rim.
  const steep = Math.min(up, 4) * 2.15;
  const hill = Math.max(0, up - 4);
  const climb = Math.min(RIM + 14, steep + hill * 0.58 + hill * hill * 0.0075);

  // Relief, coming in with the slope. Without this the bank is a plane and
  // renders as one; the amplitude has to ramp from zero at the lip or there is
  // a visible crease along it.
  const into = Math.min(1, up / 6);
  const hummocks =
    relief(x, z, 13, 4) * 3.4 * into + relief(x - 700, z + 310, 41, 3) * 6.2 * into * into;

  // The clearing floor's own roll fades out as the bank takes over, so the two
  // fields do not fight each other along the join.
  return floor * (1 - into * 0.8) + climb + hummocks;
}

/** Terrain height. */
function heightAt(x: number, z: number): number {
  const ground = groundHeight(x, z);
  const plot = padAt(x, z);
  if (!plot) return ground;

  // A pavilion stands on the level, so the pad is flat: the height at its own
  // centre, blended into the surrounding ground over its rim.
  const level = clearingFloor(plot.x, plot.z);
  const weight = padWeight(x, z, plot);
  return ground + (level - ground) * weight;
}

/** Gradient magnitude, for deciding what the ground is made of. */
function slopeAt(x: number, z: number): number {
  const dx = heightAt(x + 0.5, z) - heightAt(x - 0.5, z);
  const dz = heightAt(x, z + 0.5) - heightAt(x, z - 0.5);
  return Math.hypot(dx, dz);
}

/** Which of the three ground materials a patch of terrain gets. */
type Ground = 'trodden' | 'forest' | 'rock';

function groundAt(x: number, z: number): Ground {
  // A ragged edge to the path, so it looks walked rather than drawn.
  if (pathDistance(x, z) < PATH_HALF + relief(x, z, 6, 3) * 0.7) return 'trodden';
  // Too steep to hold soil. This is the fix for slopes that used to render as
  // smeared sand: they are rock now, because that is what they look like.
  return slopeAt(x, z) > 0.7 ? 'rock' : 'forest';
}

interface TerrainPart {
  position: Float32Array;
  normal: Float32Array;
  uv: Float32Array;
}

interface TerrainMesh {
  /** One vertex buffer per material, unshared, so UVs can be per triangle. */
  parts: Record<Ground, TerrainPart>;
}

/**
 * The ground.
 *
 * Heights and smooth normals are sampled on a shared grid, and then the
 * triangles are written out per material with their own vertices. The reason
 * for the copying is the texture coordinates, which is the third thing this
 * terrain got wrong and the one that took longest to see:
 *
 *   - Projected down from above (u = x, v = z), a slope has its texture
 *     stretched by one over the cosine of its angle. At sixty-five degrees
 *     that is two and a half times, and the banks here are sixty-five degrees
 *     for four metres. It renders as vertical smears.
 *   - Accumulated as arc length along each row and column, the stretching goes
 *     away and shear arrives instead: two neighbouring rows that crossed
 *     different amounts of slope arrive at different u for the same column.
 *     It renders as horizontal banding, which is worse.
 *   - Projected per triangle onto whichever world plane it faces most —
 *     what a shader would do as triplanar mapping, done once at build time —
 *     it is correct everywhere. The cost is that a vertex on the boundary
 *     between two projections needs two sets of coordinates, so the vertices
 *     cannot be shared. The normals still are: they are sampled from the grid
 *     rather than taken from the face, so the ground is smooth-shaded despite
 *     being a triangle soup.
 *
 * `weld()` later folds back the vertices that did agree, which is most of
 * them, so the simplifier still has edges to collapse.
 */
function buildTerrain(): TerrainMesh {
  const columns = Math.round((AREA.maxX - AREA.minX) / TERRAIN_STEP) + 1;
  const rows = Math.round((AREA.maxZ - AREA.minZ) / TERRAIN_STEP) + 1;
  const count = columns * rows;

  const height = new Float32Array(count);
  const normals = new Float32Array(count * 3);

  const index = (column: number, row: number): number => row * columns + column;
  const xAt = (column: number): number => AREA.minX + column * TERRAIN_STEP;
  const zAt = (row: number): number => AREA.minZ + row * TERRAIN_STEP;

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = xAt(column);
      const z = zAt(row);
      const at = index(column, row);
      height[at] = heightAt(x, z);

      // Central differences rather than face normals: a terrain lit by face
      // normals reads as a tin roof.
      const dx = heightAt(x + 0.5, z) - heightAt(x - 0.5, z);
      const dz = heightAt(x, z + 0.5) - heightAt(x, z - 0.5);
      const length = Math.hypot(-dx, 1, -dz);
      normals[at * 3] = -dx / length;
      normals[at * 3 + 1] = 1 / length;
      normals[at * 3 + 2] = -dz / length;
    }
  }

  const collected: Record<Ground, { position: number[]; normal: number[]; uv: number[] }> = {
    trodden: { position: [], normal: [], uv: [] },
    forest: { position: [], normal: [], uv: [] },
    rock: { position: [], normal: [], uv: [] },
  };

  const corner = (vertex: number): [number, number, number] => {
    const column = vertex % columns;
    const row = (vertex - column) / columns;
    return [xAt(column), height[vertex] ?? 0, zAt(row)];
  };

  const emit = (ground: Ground, vertices: [number, number, number]): void => {
    const target = collected[ground];
    const points = vertices.map(corner);
    const [a, b, c] = points as [
      [number, number, number],
      [number, number, number],
      [number, number, number],
    ];

    // Which world plane this triangle faces most. Its own geometric normal,
    // not the smoothed one: the projection has to match the shape of the
    // triangle being textured.
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    const nx = Math.abs(uy * vz - uz * vy);
    const ny = Math.abs(uz * vx - ux * vz);
    const nz = Math.abs(ux * vy - uy * vx);

    const axis: 0 | 1 | 2 = ny >= nx && ny >= nz ? 1 : nx >= nz ? 0 : 2;

    for (const [at, vertex] of vertices.entries()) {
      const point = points[at] as [number, number, number];
      target.position.push(point[0], point[1], point[2]);
      target.normal.push(
        normals[vertex * 3] ?? 0,
        normals[vertex * 3 + 1] ?? 1,
        normals[vertex * 3 + 2] ?? 0,
      );

      // Flat ground from above; a wall from whichever side it faces.
      const [u, v] =
        axis === 1
          ? [point[0], point[2]]
          : axis === 0
            ? [point[2], point[1]]
            : [point[0], point[1]];
      const tile = GROUND_TILE[ground];
      target.uv.push(u / tile, v / tile);
    }
  };

  for (let row = 0; row < rows - 1; row += 1) {
    for (let column = 0; column < columns - 1; column += 1) {
      const a = index(column, row);
      const b = index(column + 1, row);
      const c = index(column, row + 1);
      const d = index(column + 1, row + 1);

      const ground = groundAt(xAt(column) + TERRAIN_STEP / 2, zAt(row) + TERRAIN_STEP / 2);
      emit(ground, [a, c, b]);
      emit(ground, [b, c, d]);
    }
  }

  const parts = {} as Record<Ground, TerrainPart>;
  for (const ground of ['trodden', 'forest', 'rock'] as const) {
    const part = collected[ground];
    parts[ground] = {
      position: new Float32Array(part.position),
      normal: new Float32Array(part.normal),
      uv: new Float32Array(part.uv),
    };
  }

  return { parts };
}

/** A ground material built from one of the downloaded scanned texture sets. */
async function groundMaterial(document: Document, id: string, name: string): Promise<Material> {
  const dir = path.join(SOURCES, 'textures', id);
  const material = document.createMaterial(name).setRoughnessFactor(1).setMetallicFactor(0);

  const attach = async (
    file: string,
    apply: (texture: ReturnType<Document['createTexture']>) => void,
  ): Promise<void> => {
    const full = path.join(dir, file);
    if (!existsSync(full)) return;

    // Resized here rather than by textureCompress: a 2K ground tile is plenty,
    // and the scans arrive as 8K when the API has nothing smaller.
    const bytes = await sharp(readFileSync(full))
      .resize(TEXTURE_MAX, TEXTURE_MAX, { fit: 'cover' })
      .jpeg({ quality: 90 })
      .toBuffer();

    const texture = document
      .createTexture(`${name}-${path.parse(file).name}`)
      .setMimeType('image/jpeg')
      .setImage(new Uint8Array(bytes));

    apply(texture);
  };

  await attach('diffuse.jpg', (texture) => material.setBaseColorTexture(texture));
  await attach('normal.jpg', (texture) => material.setNormalTexture(texture));
  // Poly Haven packs occlusion, roughness and metalness into one image, which
  // is exactly what glTF wants.
  await attach('arm.jpg', (texture) => {
    material.setOcclusionTexture(texture);
    material.setMetallicRoughnessTexture(texture);
  });

  const info = material.getBaseColorTextureInfo();
  if (info) info.setWrapS(10497).setWrapT(10497);
  const normalInfo = material.getNormalTextureInfo();
  if (normalInfo) normalInfo.setWrapS(10497).setWrapT(10497);
  const ormInfo = material.getMetallicRoughnessTextureInfo();
  if (ormInfo) ormInfo.setWrapS(10497).setWrapT(10497);

  return material;
}

interface PropRecipe {
  id: string;
  /**
   * Triangles to keep *per variant*. Scans arrive at up to four million.
   *
   * Per variant rather than per file, because a Poly Haven "set" is one file
   * holding a dozen objects — seventeen grass tufts, six mossy rocks — and a
   * budget for the file would give each tuft a hundred triangles.
   */
  budget: number;
  /**
   * How much shape the simplifier may lose, as a fraction of the model's size.
   *
   * Generous on purpose for the scans: the default bound stops long before the
   * budget on a photogrammetry mesh, and a tree that arrives at two million
   * triangles and leaves at 1.3 million is not a tree a browser can draw
   * twelve of.
   */
  error?: number;
  /**
   * Foliage is alpha-cut cards, so every leaf edge is a border. Locking them
   * means nothing collapses at all; unlocking costs some leaf silhouette,
   * which at this budget is the cheaper loss.
   */
  lockBorder?: boolean;
  /** How many to place. */
  count: number;
  /**
   * Where it is allowed to stand, in metres of `clearingEdge`: negative is
   * inside the clearing, positive up the bank.
   */
  edge: [number, number];
  /** Keep this far off the path and the pads. Omitted means it may stand on them. */
  clearOfPath?: number;
  scale: [number, number];
  /** Sink into the ground by this fraction of its height, so nothing floats. */
  bury?: number;
  /**
   * Metres to keep between two of these. The default suits something about a
   * metre across; a scan that is a row of three firs fifteen metres long needs
   * to be told.
   */
  spacing?: number;
  /**
   * Cluster size. Trees and ferns grow in company; a uniform scatter of them
   * reads as an orchard. Each cluster is one rejection-sampled seed with the
   * rest dropped within a couple of metres of it.
   */
  clump?: [number, number];
}

const PROPS: PropRecipe[] = [
  // ── The rim: what closes the view, above the trees ────────────────────────
  { id: 'mountainside', budget: 45_000, count: 7, edge: [34, 52], scale: [1.8, 3.2], spacing: 26 },
  {
    id: 'coastal_cliff_04',
    budget: 80_000,
    error: 0.3,
    count: 4,
    edge: [24, 42],
    scale: [1, 1.5],
    spacing: 20,
  },
  {
    id: 'coastal_cliff_02',
    budget: 65_000,
    error: 0.3,
    count: 4,
    edge: [22, 40],
    scale: [0.9, 1.4],
    spacing: 20,
  },
  { id: 'rock_face_01', budget: 14_000, count: 12, edge: [8, 32], scale: [1, 2.2], spacing: 5 },
  { id: 'rock_face_02', budget: 16_000, count: 12, edge: [6, 28], scale: [0.9, 2], spacing: 5 },

  // ── The canopy ────────────────────────────────────────────────────────────
  //
  // Twenty-four metres across at full scale, and the reason this location
  // looks like a forest at all. Planted from just inside the treeline to a
  // little way up the bank, so the crowns reach out over the clearing and the
  // trunks stay out of it.
  {
    id: 'jacaranda_tree',
    budget: 95_000,
    error: 0.45,
    count: 28,
    edge: [-7, 18],
    clearOfPath: 7,
    scale: [0.72, 1.05],
    spacing: 9,
    clump: [1, 3],
  },
  // A few standing in the clearing itself: a glade with nothing in it is a
  // field, and shade on the ground is what sells the scale of the canopy.
  {
    id: 'jacaranda_tree',
    budget: 95_000,
    error: 0.45,
    count: 5,
    edge: [-17, -8],
    clearOfPath: 9,
    scale: [0.8, 1.1],
    spacing: 16,
  },
  {
    id: 'island_tree_01',
    budget: 45_000,
    error: 0.45,
    count: 40,
    edge: [-13, 24],
    clearOfPath: 4.2,
    scale: [0.9, 1.6],
    spacing: 4,
    clump: [1, 4],
  },
  {
    id: 'tree_small_02',
    budget: 30_000,
    error: 0.45,
    count: 48,
    edge: [-11, 26],
    clearOfPath: 3.6,
    scale: [0.8, 1.4],
    spacing: 3,
    clump: [2, 5],
  },
  // Three firs to a scan, so each placement is a stand rather than a tree.
  {
    id: 'fir_sapling_medium',
    budget: 14_000,
    error: 0.4,
    count: 20,
    edge: [-6, 22],
    clearOfPath: 5,
    scale: [0.7, 1.05],
    spacing: 7,
  },
  {
    id: 'fir_sapling',
    budget: 6_000,
    error: 0.4,
    count: 46,
    edge: [-9, 20],
    clearOfPath: 3.2,
    scale: [1, 2.4],
    spacing: 2.4,
    clump: [2, 4],
  },

  // ── The forest floor ──────────────────────────────────────────────────────
  {
    id: 'dead_tree_trunk',
    budget: 9_000,
    count: 9,
    edge: [-9, 16],
    clearOfPath: 3.4,
    scale: [0.9, 1.5],
    spacing: 6,
  },
  {
    id: 'dead_tree_trunk_02',
    budget: 9_000,
    count: 8,
    edge: [-7, 18],
    clearOfPath: 3.4,
    scale: [0.9, 1.3],
    spacing: 6,
  },
  {
    id: 'tree_stump_01',
    budget: 8_000,
    count: 20,
    edge: [-15, 14],
    clearOfPath: 2.8,
    scale: [0.9, 1.5],
    spacing: 3,
  },
  {
    id: 'tree_stump_02',
    budget: 8_000,
    count: 20,
    edge: [-15, 14],
    clearOfPath: 2.8,
    scale: [0.9, 1.5],
    spacing: 3,
  },
  {
    id: 'pine_roots',
    budget: 6_000,
    count: 22,
    edge: [-11, 12],
    clearOfPath: 1.4,
    scale: [0.8, 1.4],
    bury: 0.1,
    spacing: 2.4,
  },
  {
    id: 'root_cluster_01',
    budget: 9_000,
    count: 20,
    edge: [-9, 14],
    clearOfPath: 2.4,
    scale: [0.7, 1.2],
    bury: 0.2,
    spacing: 2.4,
  },
  {
    id: 'dry_branches_medium_01',
    budget: 2_500,
    count: 70,
    edge: [-17, 14],
    clearOfPath: 1.2,
    scale: [0.8, 1.6],
    bury: 0.02,
    spacing: 1.6,
    clump: [1, 3],
  },

  // Boulders. Buried a good way, because a scan sitting on curved terrain
  // otherwise rests on one corner.
  {
    id: 'boulder_01',
    budget: 12_000,
    error: 0.35,
    count: 24,
    edge: [-16, 20],
    clearOfPath: 3,
    scale: [0.8, 1.7],
    bury: 0.18,
    spacing: 4,
  },
  {
    id: 'rock_moss_set_01',
    budget: 3_500,
    count: 60,
    edge: [-17, 18],
    clearOfPath: 2.2,
    scale: [0.8, 1.8],
    bury: 0.15,
    spacing: 2,
    clump: [1, 3],
  },
  {
    id: 'rock_moss_set_02',
    budget: 3_000,
    count: 60,
    edge: [-17, 18],
    clearOfPath: 2.2,
    scale: [0.8, 1.8],
    bury: 0.15,
    spacing: 2,
    clump: [1, 3],
  },
  {
    id: 'rock_07',
    budget: 4_500,
    count: 40,
    edge: [-15, 22],
    clearOfPath: 2.2,
    scale: [1.2, 2.8],
    bury: 0.22,
    spacing: 2.4,
  },
  {
    id: 'rock_09',
    budget: 4_000,
    count: 38,
    edge: [-15, 22],
    clearOfPath: 2.2,
    scale: [1.6, 3.6],
    bury: 0.25,
    spacing: 2.4,
  },
  {
    id: 'stone_01',
    budget: 3_000,
    error: 0.3,
    count: 150,
    edge: [-19, 16],
    clearOfPath: 0.6,
    scale: [2, 5],
    bury: 0.3,
    spacing: 1,
    clump: [2, 5],
  },

  // ── What grows on it ──────────────────────────────────────────────────────
  //
  // Everything here taller than the step height blocks the cell it stands in,
  // which is why it is all kept off the path: a fern is a fence as far as the
  // walkable map is concerned. That is the right answer for a fern.
  {
    id: 'fern_02',
    budget: 1_600,
    // The green in this palette. The canopy scans are dry-climate broadleaves
    // with grey-green foliage and the grass is dry tufts, so without a lot of
    // fern right up against the path the clearing reads as a dry wash rather
    // than a glade — which is exactly how the first three builds of it read.
    count: 1_100,
    edge: [-19, 5],
    clearOfPath: 1.7,
    scale: [1, 2.1],
    spacing: 0.95,
    clump: [4, 11],
  },
  {
    id: 'shrub_01',
    budget: 6_000,
    error: 0.5,
    count: 260,
    edge: [-17, 18],
    clearOfPath: 2,
    scale: [0.7, 1.3],
    spacing: 1.8,
    clump: [1, 3],
  },
  {
    id: 'shrub_02',
    budget: 2_500,
    error: 0.5,
    count: 340,
    edge: [-17, 20],
    clearOfPath: 2,
    scale: [0.7, 1.2],
    spacing: 1.6,
    clump: [1, 3],
  },
  {
    id: 'shrub_03',
    budget: 2_100,
    count: 420,
    edge: [-19, 18],
    clearOfPath: 2.4,
    scale: [1, 2.4],
    spacing: 1.3,
    clump: [3, 6],
  },

  // Low enough to walk over, so these two are allowed everywhere — including
  // across the path, which is what stops it looking swept.
  {
    id: 'grass_medium_01',
    // Fifteen hundred triangles a tuft, which is what it ships as: simplified
    // to nine hundred the blades come out as twigs, and a tuft is only ever a
    // third of a metre across.
    budget: 1_500,
    count: 1_800,
    edge: [-21, 4],
    scale: [1.2, 2.8],
    spacing: 0.55,
    clump: [4, 12],
  },
  {
    id: 'grass_medium_02',
    budget: 1_600,
    count: 1_800,
    edge: [-21, 4],
    scale: [1.3, 3],
    spacing: 0.55,
    clump: [4, 12],
  },
];

interface Placement {
  x: number;
  y: number;
  z: number;
  yaw: number;
  scale: number;
  /** Which of the scan's variants stands here. */
  variant: number;
}

/** xorshift32, so a rebuild puts every rock back where it was. */
function random(seed: number): () => number {
  let state = seed | 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 0xffffff) / 0xffffff;
  };
}

/** Whether a prop of this recipe may stand here. */
function allowed(recipe: PropRecipe, x: number, z: number): boolean {
  if (x < AREA.minX + 2 || x > AREA.maxX - 2) return false;
  if (z < AREA.minZ + 2 || z > AREA.maxZ - 2) return false;

  const edge = clearingEdge(x, z);
  if (edge < recipe.edge[0] || edge > recipe.edge[1]) return false;

  if (recipe.clearOfPath !== undefined && pathDistance(x, z) < recipe.clearOfPath) return false;
  if (padAt(x, z)) return false;

  return true;
}

/**
 * Scatters one kind of prop.
 *
 * Rejection sampling against the clearing, the path and the pads, with the
 * option of dropping a few more beside each accepted seed: things that grow
 * grow in company, and a uniform scatter of ferns reads as a crop.
 *
 * Two things here are about cost rather than looks. The candidate points are
 * drawn from the clearing's own bounds when the recipe never leaves it, rather
 * than from the whole location — otherwise three quarters of every attempt is
 * spent on hillside a fern is not allowed on, and the counts silently come in
 * short. And the "is there room" test goes through a grid of buckets instead
 * of the list of what is already placed: at eighteen hundred grass tufts the
 * list is two billion comparisons and the build appears to hang.
 */
function scatter(recipe: PropRecipe, index: number, variants: number): Placement[] {
  const next = random(SEED ^ (index * 2654435761));
  const placed: Placement[] = [];
  const [clumpLow, clumpHigh] = recipe.clump ?? [1, 1];
  const spacing = recipe.spacing ?? 1.3;
  let attempts = 0;

  const size = (): number => recipe.scale[0] + next() * (recipe.scale[1] - recipe.scale[0]);
  const pick = (): number => Math.min(variants - 1, Math.floor(next() * variants));

  const bucketSize = Math.max(0.5, spacing);
  const buckets = new Map<number, Placement[]>();
  const bucketOf = (x: number, z: number): number =>
    Math.floor((x - AREA.minX) / bucketSize) * 4096 + Math.floor((z - AREA.minZ) / bucketSize);

  const room = (x: number, z: number, apart: number): boolean => {
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dz = -1; dz <= 1; dz += 1) {
        const near = buckets.get(bucketOf(x + dx * bucketSize, z + dz * bucketSize));
        if (!near) continue;
        for (const entry of near) {
          if (Math.hypot(entry.x - x, entry.z - z) < apart) return false;
        }
      }
    }
    return true;
  };

  const drop = (x: number, z: number): void => {
    const placement: Placement = {
      x,
      y: heightAt(x, z),
      z,
      yaw: next() * Math.PI * 2,
      scale: size(),
      variant: pick(),
    };

    placed.push(placement);
    const key = bucketOf(x, z);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(placement);
    else buckets.set(key, [placement]);
  };

  // Where to look for candidates. A recipe that never leaves the clearing gets
  // points from the clearing; anything that climbs gets the whole location.
  const insideOnly = recipe.edge[1] <= 4;

  const candidate = (): [number, number] => {
    if (!insideOnly) {
      return [
        AREA.minX + next() * (AREA.maxX - AREA.minX),
        AREA.minZ + next() * (AREA.maxZ - AREA.minZ),
      ];
    }

    const margin = 8;
    const x = -CLEARING_HALF_LENGTH - margin + next() * (CLEARING_HALF_LENGTH + margin) * 2;
    const half = clearingHalf(x) + margin;
    return [x, clearingCentre(x) - half + next() * half * 2];
  };

  while (placed.length < recipe.count && attempts < recipe.count * 400) {
    attempts += 1;

    const [x, z] = candidate();
    if (!allowed(recipe, x, z)) continue;
    if (!room(x, z, spacing)) continue;

    drop(x, z);

    const companions = clumpLow + Math.floor(next() * (clumpHigh - clumpLow + 1)) - 1;
    for (let extra = 0; extra < companions && placed.length < recipe.count; extra += 1) {
      const angle = next() * Math.PI * 2;
      const away = spacing * (1.05 + next() * 1.9);
      const cx = x + Math.cos(angle) * away;
      const cz = z + Math.sin(angle) * away;

      if (!allowed(recipe, cx, cz)) continue;
      if (!room(cx, cz, spacing * 0.85)) continue;

      drop(cx, cz);
    }
  }

  return placed;
}

/** One object out of a scan: its mesh, how tall it is and where its base sits. */
interface Variant {
  mesh: Mesh;
  height: number;
  /** Lowest point of the geometry, so a placement can seat it on the ground. */
  base: number;
}

/**
 * Loads one scan and returns every object in it.
 *
 * Poly Haven ships variants as separate nodes in one file, laid out in a row —
 * `grass_medium_01` is seventeen tufts strung along five metres of X, and
 * `fir_sapling_medium` is three firs five metres apart. The row offsets live in
 * the node transforms rather than the vertex data, so ignoring the nodes and
 * taking the meshes gives every object centred on its own origin, ready to be
 * planted wherever it is wanted.
 *
 * That is the difference between a forest floor and a line of grass across it.
 */
async function loadVariants(io: NodeIO, target: Document, recipe: PropRecipe): Promise<Variant[]> {
  const file = path.join(SOURCES, 'models', recipe.id, `${recipe.id}.gltf`);
  if (!existsSync(file)) {
    console.warn(`  ! ${recipe.id}: not in assets/nature`);
    return [];
  }

  const source = await io.read(file);
  source.setLogger(new Logger(Logger.Verbosity.ERROR));

  const before = triangleCount(source);
  const objects = source.getRoot().listMeshes().length;
  const wanted = recipe.budget * Math.max(1, objects);

  const transforms: Transform[] = [dedup(), weld()];
  if (before > wanted) {
    transforms.push(
      simplify({
        simplifier: MeshoptSimplifier,
        ratio: wanted / before,
        error: recipe.error ?? 0.2,
        lockBorder: recipe.lockBorder ?? false,
      }),
    );
  }

  await source.transform(...transforms);

  // Measured before the merge, because `mergeDocuments` returns a map from the
  // source properties and the accessors are easier to read on this side.
  const bounds = new Map<Mesh, { height: number; base: number }>();
  for (const mesh of source.getRoot().listMeshes()) {
    let low = Infinity;
    let high = -Infinity;

    for (const primitive of mesh.listPrimitives()) {
      const position = primitive.getAttribute('POSITION');
      if (!position) continue;
      low = Math.min(low, (position.getMin([]) as number[])[1] ?? 0);
      high = Math.max(high, (position.getMax([]) as number[])[1] ?? 0);
    }

    const height = Number.isFinite(high - low) ? high - low : 1;
    bounds.set(mesh, { height, base: Number.isFinite(low) ? low : 0 });
  }

  const map = mergeDocuments(target, source);
  const variants: Variant[] = [];

  for (const mesh of source.getRoot().listMeshes()) {
    // `mergeDocuments` returns a map over every property type, so the mesh it
    // hands back is typed as the base class and has to be narrowed.
    const copied = map.get(mesh) as Mesh | undefined;
    const measured = bounds.get(mesh);
    if (!copied || !measured) continue;
    variants.push({ mesh: copied, height: measured.height, base: measured.base });
  }

  console.log(
    `  ${recipe.id.padEnd(24)} ${before.toLocaleString('en').padStart(9)} → ` +
      `${triangleCount(source).toLocaleString('en').padStart(7)} tris, ` +
      `${variants.length} variant${variants.length === 1 ? '' : 's'} × ${recipe.count}`,
  );

  return variants;
}

async function main(): Promise<void> {
  if (!existsSync(path.join(SOURCES, 'models'))) {
    console.log('assets/nature is empty — run `make nature-assets` first');
    return;
  }

  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule(),
  });

  const document = new Document();
  document.setLogger(new Logger(Logger.Verbosity.ERROR));
  const buffer = document.createBuffer();
  const scene = document.createScene(ID);

  console.log('shaping the ground…');
  const terrain = buildTerrain();

  const materials: Record<Ground, Material> = {
    trodden: await groundMaterial(document, 'rocky_trail', 'grove-path'),
    forest: await groundMaterial(document, 'forest_ground_04', 'grove-floor'),
    rock: await groundMaterial(document, 'aerial_rocks_02', 'grove-rock'),
  };

  const terrainMesh = document.createMesh('terrain');

  for (const ground of ['trodden', 'forest', 'rock'] as const) {
    const part = terrain.parts[ground];
    const vertices = part.position.length / 3;
    if (vertices === 0) continue;

    // Indices, even though every triangle has its own vertices: the
    // simplifier needs an indexed primitive, and `weld()` will fold the
    // vertices that agree back together before it runs.
    const indices = new Uint32Array(vertices);
    for (let vertex = 0; vertex < vertices; vertex += 1) indices[vertex] = vertex;

    terrainMesh.addPrimitive(
      document
        .createPrimitive()
        .setAttribute(
          'POSITION',
          document
            .createAccessor(`terrain-${ground}-position`)
            .setType('VEC3')
            .setArray(part.position)
            .setBuffer(buffer),
        )
        .setAttribute(
          'NORMAL',
          document
            .createAccessor(`terrain-${ground}-normal`)
            .setType('VEC3')
            .setArray(part.normal)
            .setBuffer(buffer),
        )
        .setAttribute(
          'TEXCOORD_0',
          document
            .createAccessor(`terrain-${ground}-uv`)
            .setType('VEC2')
            .setArray(part.uv)
            .setBuffer(buffer),
        )
        .setIndices(
          document
            .createAccessor(`terrain-${ground}-indices`)
            .setType('SCALAR')
            .setArray(indices)
            .setBuffer(buffer),
        )
        .setMaterial(materials[ground]),
    );
  }

  console.log(
    `  ${(['trodden', 'forest', 'rock'] as const)
      .map(
        (ground) => `${ground} ${(terrain.parts[ground].position.length / 9).toLocaleString('en')}`,
      )
      .join(', ')} tris`,
  );

  scene.addChild(document.createNode('terrain').setMesh(terrainMesh));

  console.log('planting the scans…');
  let placements = 0;

  for (const [index, recipe] of PROPS.entries()) {
    const variants = await loadVariants(io, document, recipe);
    if (variants.length === 0) continue;

    const spots = scatter(recipe, index, variants.length);
    // What was placed, not what was asked for: a band that turns out to be
    // mostly out of bounds comes in short, and that is worth seeing.
    if (spots.length < recipe.count) {
      console.log(`    ${recipe.id}: ${spots.length} of ${recipe.count} placed`);
    }

    for (const spot of spots) {
      const variant = variants[spot.variant] ?? variants[0];
      if (!variant) continue;

      const node: GltfNode = document
        .createNode(`${recipe.id}-${placements}`)
        .setMesh(variant.mesh)
        // Seated rather than dropped: the scan's own base goes to the ground,
        // and then it sinks by its share of its height so a curved terrain
        // does not leave it resting on one corner.
        .setTranslation([
          spot.x,
          spot.y - (variant.base + variant.height * (recipe.bury ?? 0.04)) * spot.scale,
          spot.z,
        ])
        .setRotation([0, Math.sin(spot.yaw / 2), 0, Math.cos(spot.yaw / 2)])
        .setScale([spot.scale, spot.scale, spot.scale]);

      scene.addChild(node);
      placements += 1;
    }
  }

  console.log(
    `  ${placements} placements, ${triangleCount(document).toLocaleString('en')} unique tris`,
  );

  console.log('mapping the clearing…');
  // The band, not the slope, is what makes the clearing a clearing. A metre
  // and a bit either side of level: that is inside the two and a half metres
  // the ground bitmap can express, and it is a guarantee rather than a hope —
  // noise on a bank can always cut a notch gentle enough to walk up, and the
  // flood fill would take it.
  const grid = buildWalkableGrid(document, {
    ceiling: RIM + 30,
    floorBand: [-1.25, 1.25],
    floorAt: 0,
  });

  const walkable = countWalkable(grid);
  if (walkable < 2_000) throw new Error(`the clearing came out unwalkable: ${walkable} cells`);

  // The spawn: the west end of the clearing, on the path, looking east along it.
  const spawnX = -CLEARING_HALF_LENGTH + 5;
  const spawnZ = clearingCentre(spawnX);
  const spawn = {
    position: [spawnX, heightAt(spawnX, spawnZ), spawnZ] as [number, number, number],
    // The camera looks along its own -Z rotated by the yaw, so -π/2 looks down
    // +X, which is the way the clearing runs.
    yaw: -Math.PI / 2,
  };

  const anchors = PLOTS.map((plot, index) => ({
    name: `plot-${index + 1}`,
    sign: [plot.x, heightAt(plot.x, plot.z) + 2.6, plot.z] as [number, number, number],
    stand: [plot.x, heightAt(plot.x, plot.z), plot.z] as [number, number, number],
    // Turned to face the path, so a display is seen by somebody walking past
    // rather than by the trees behind it.
    facing: Math.atan2(0, clearingCentre(plot.x) - plot.z),
  }));

  console.log(
    `  walkable ${walkable} cells of ${grid.width}x${grid.height}, ${anchors.length} plots`,
  );

  mkdirSync(OUT, { recursive: true });
  writeFileSync(path.join(OUT, 'walkable.bin'), Buffer.from(packMask(grid)));
  writeFileSync(path.join(OUT, 'ground.bin'), Buffer.from(grid.ground));

  console.log('compressing textures…');
  await document.transform(
    dedup(),
    prune(),
    // The terrain is written as a triangle soup so its UVs can be per
    // triangle; this folds back every vertex whose position, normal and
    // coordinates all agree, which is everything but the projection seams,
    // and gives the simplifier edges to work with again.
    weld(),
    instance({ min: 2 }),
    // One buffer: merging thirty source documents brings thirty along, and a
    // GLB may carry at most one.
    unpartition(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [TEXTURE_MAX, TEXTURE_MAX] }),
  );

  console.log('writing levels…');
  const levels: { level: number; file: string; triangles: number; bytes: number }[] = [];

  // One serialisation, reread per level: Document has no clone, and a
  // simplification is destructive — running the ladder in place would compound
  // every level on the one before it.
  const master = await io.writeBinary(document);

  for (const level of LEVELS) {
    const copy = await io.readBinary(master);
    copy.setLogger(new Logger(Logger.Verbosity.ERROR));

    const steps: Transform[] = [];

    if (level.ratio < 1) {
      steps.push(
        simplify({
          simplifier: MeshoptSimplifier,
          ratio: level.ratio,
          error: level.error,
          lockBorder: false,
        }),
      );
    }

    if (level.texture < TEXTURE_MAX) {
      steps.push(
        textureCompress({
          encoder: sharp,
          targetFormat: 'webp',
          resize: [level.texture, level.texture],
        }),
      );
    }

    if (steps.length > 0) await copy.transform(...steps);

    copy.createExtension(KHRDracoMeshCompression).setRequired(true).setEncoderOptions({
      method: KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER,
    });

    const file = `${ID}-lod${level.level}.glb`;
    writeFileSync(path.join(OUT, file), await io.writeBinary(copy));

    const bytes = statSync(path.join(OUT, file)).size;
    levels.push({ level: level.level, file, triangles: triangleCount(copy), bytes });
    console.log(
      `  lod${level.level}: ${triangleCount(copy).toLocaleString('en')} tris, ` +
        `${(bytes / 1e6).toFixed(1)} MB`,
    );
  }

  const manifest = {
    id: ID,
    kind: 'outdoor',
    title: {
      ru: 'Горная роща',
      en: 'Mountain Grove',
    },
    blurb: {
      ru: 'Поляна в горном лесу: тропа, кроны над головой, шесть площадок для павильонов.',
      en: 'A clearing in a mountain forest: a path, a canopy overhead, six plots for pavilions.',
    },
    source: SOURCE,
    sky: 'sky.hdr',
    light: LIGHT,
    levels,
    navigation: {
      origin: grid.origin,
      cell: grid.cell,
      width: grid.width,
      height: grid.height,
      groundBase: grid.groundBase,
      mask: 'walkable.bin',
      ground: 'ground.bin',
    },
    spawn,
    anchors,
    builtAt: new Date().toISOString(),
  };

  writeFileSync(path.join(OUT, 'location.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  // The sky belongs to the location: the street's own HDRI is a city at noon.
  const sky = path.join(SOURCES, 'sky.hdr');
  if (existsSync(sky)) writeFileSync(path.join(OUT, 'sky.hdr'), readFileSync(sky));

  // The index the app reads to offer a choice of locations.
  const indexFile = path.resolve(OUT, '../locations.json');
  const known: string[] = existsSync(indexFile)
    ? (JSON.parse(readFileSync(indexFile, 'utf8')) as string[])
    : [];
  const all = [...new Set([...known, ID])].filter((id) =>
    existsSync(path.resolve(OUT, '..', id, 'location.json')),
  );
  writeFileSync(indexFile, `${JSON.stringify(all, null, 2)}\n`);

  console.log(`\n${ID} built: ${levels.map((l) => (l.bytes / 1e6).toFixed(0)).join('/')} MB`);
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  await main();
}
