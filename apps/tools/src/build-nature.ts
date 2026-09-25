/**
 * The second main location: a coastal trail, composed from scans.
 *
 *   pnpm --filter @3dsfera/tools run build:nature
 *
 * No large natural scene is downloadable without an account, so this one is
 * assembled rather than fetched: the cliffs, rocks, trees and shrubs are Poly
 * Haven photogrammetry at 2K and 4K, CC0, and the ground they stand on is
 * ours. Every rock in it is a photograph of a rock.
 *
 * The shape is deliberate rather than random. A trail runs the length of the
 * location, nearly level — the walkable map carries one byte of centimetres per
 * cell, which is two and a half metres of range in total, so a hillside path
 * would run out of numbers. Everything off the trail is steep enough that the
 * map refuses it, which is also what keeps a buyer from wandering into the sea.
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
const OUT = path.resolve(HERE, '../../web/public/world/locations/trail');

const SEED = 0x2f9a41c7;

/** Metres. The trail runs along X; the sea is to the south, the ridge north. */
const AREA = { minX: -58, maxX: 58, minZ: -26, maxZ: 26 } as const;
/** Terrain vertex spacing. One metre is finer than anything the eye catches. */
const TERRAIN_STEP = 1;
/** Half-width of the level walkable corridor. */
const TRAIL_HALF = 2.6;
/** How far the trail wanders in Z across the length of the location. */
const TRAIL_SWAY = 7;
const TRAIL_PERIOD = 34;

/** Supplier plots: flat pads beside the trail, alternating sides. */
const PLOT_COUNT = 6;
const PLOT_RADIUS = 3.4;
const PLOT_OFFSET = 6.2;

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
  title: 'Verdant Trail, assembled from Poly Haven scans',
  author: 'Poly Haven',
  licence: 'CC0',
  licenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  origin: 'https://polyhaven.com/',
} as const;

const noise = new Noise(SEED);

/** Z of the trail centreline at a given X. */
function trailAt(x: number): number {
  return Math.sin(x / TRAIL_PERIOD) * TRAIL_SWAY;
}

/** Perpendicular distance from the trail, near enough for placement decisions. */
function offTrail(x: number, z: number): number {
  return Math.abs(z - trailAt(x));
}

interface Plot {
  x: number;
  z: number;
  /** +1 north of the trail, -1 south. */
  side: 1 | -1;
}

const PLOTS: Plot[] = Array.from({ length: PLOT_COUNT }, (_, index) => {
  const x = AREA.minX + 14 + (index * (AREA.maxX - AREA.minX - 28)) / (PLOT_COUNT - 1);
  const side: 1 | -1 = index % 2 === 0 ? 1 : -1;
  return { x, z: trailAt(x) + side * PLOT_OFFSET, side };
});

/**
 * Terrain height.
 *
 * Level along the trail and on the plots; steep either side of them. The
 * steepness is the point: it is what makes the walkable map a corridor rather
 * than a field, and what stops anybody walking into the sea.
 */
function heightAt(x: number, z: number): number {
  const from = offTrail(x, z);

  // Gentle grade along the length, well inside the two and a half metres the
  // ground bitmap can express.
  const grade = Math.sin(x / 47) * 0.7;

  if (from <= TRAIL_HALF) {
    // The trail itself: grade plus a few centimetres of unevenness.
    return grade + noise.fbm(x, z, 3, 2) * 0.06;
  }

  const plot = PLOTS.find((entry) => Math.hypot(x - entry.x, z - entry.z) <= PLOT_RADIUS + 0.6);
  if (plot) {
    const pad = Math.sin(plot.x / 47) * 0.7;
    return pad + noise.fbm(x, z, 3, 2) * 0.05;
  }

  const beyond = from - TRAIL_HALF;
  const north = z > trailAt(x);

  if (north) {
    // The ridge: rises fast enough that the step test refuses it within a
    // metre, then keeps climbing for the backdrop.
    const rise = Math.min(14, beyond * 1.15 + Math.pow(beyond, 1.35) * 0.1);
    return grade + rise + noise.fbm(x, z, 24, 4) * 1.6;
  }

  // The seaward side: falls away to the water.
  const drop = Math.min(11, beyond * 1.05 + Math.pow(beyond, 1.3) * 0.08);
  return grade - drop + noise.fbm(x, z, 20, 4) * 1.2;
}

interface TerrainMesh {
  position: Float32Array;
  normal: Float32Array;
  uv: Float32Array;
  /** Triangles near the trail, which get the dirt material. */
  trailIndices: Uint32Array;
  /** Everything else, which gets grass over rock. */
  wildIndices: Uint32Array;
}

function buildTerrain(): TerrainMesh {
  const columns = Math.round((AREA.maxX - AREA.minX) / TERRAIN_STEP) + 1;
  const rows = Math.round((AREA.maxZ - AREA.minZ) / TERRAIN_STEP) + 1;

  const position = new Float32Array(columns * rows * 3);
  const normal = new Float32Array(columns * rows * 3);
  const uv = new Float32Array(columns * rows * 2);

  const index = (column: number, row: number): number => row * columns + column;

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = AREA.minX + column * TERRAIN_STEP;
      const z = AREA.minZ + row * TERRAIN_STEP;
      const y = heightAt(x, z);
      const at = index(column, row) * 3;

      position[at] = x;
      position[at + 1] = y;
      position[at + 2] = z;

      // Central differences rather than face normals: a terrain lit by face
      // normals reads as a tin roof.
      const dx = heightAt(x + 0.5, z) - heightAt(x - 0.5, z);
      const dz = heightAt(x, z + 0.5) - heightAt(x, z - 0.5);
      const length = Math.hypot(-dx, 1, -dz);
      normal[at] = -dx / length;
      normal[at + 1] = 1 / length;
      normal[at + 2] = -dz / length;

      const uvAt = index(column, row) * 2;
      // Tiled every four metres: a scanned ground texture is about that big.
      uv[uvAt] = x / 4;
      uv[uvAt + 1] = z / 4;
    }
  }

  const trail: number[] = [];
  const wild: number[] = [];

  for (let row = 0; row < rows - 1; row += 1) {
    for (let column = 0; column < columns - 1; column += 1) {
      const a = index(column, row);
      const b = index(column + 1, row);
      const c = index(column, row + 1);
      const d = index(column + 1, row + 1);

      const x = AREA.minX + (column + 0.5) * TERRAIN_STEP;
      const z = AREA.minZ + (row + 0.5) * TERRAIN_STEP;
      const onPath =
        offTrail(x, z) <= TRAIL_HALF + 1.2 ||
        PLOTS.some((plot) => Math.hypot(x - plot.x, z - plot.z) <= PLOT_RADIUS + 1);

      const target = onPath ? trail : wild;
      target.push(a, c, b, b, c, d);
    }
  }

  return {
    position,
    normal,
    uv,
    trailIndices: new Uint32Array(trail),
    wildIndices: new Uint32Array(wild),
  };
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
  /** Triangles to keep. Scans arrive at up to four million. */
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
  /** Where it is allowed to stand, measured from the trail centreline. */
  band: [number, number];
  /** Which side of the trail, or both. */
  side?: 1 | -1;
  scale: [number, number];
  /** Sink into the ground by this fraction of its height, so nothing floats. */
  bury?: number;
}

const PROPS: PropRecipe[] = [
  // The backdrop: two long cliff walls high on the ridge.
  { id: 'coastal_cliff_04', budget: 90_000, count: 2, band: [24, 26], side: 1, scale: [1, 1.2] },
  { id: 'coastal_cliff_02', budget: 70_000, count: 2, band: [19, 23], side: 1, scale: [0.9, 1.1] },
  { id: 'mountainside', budget: 40_000, count: 5, band: [12, 22], side: 1, scale: [1.4, 2.4] },
  { id: 'rock_face_01', budget: 12_000, count: 9, band: [4.5, 11], scale: [0.9, 1.8] },

  // Trees. Fewer and heavier than the rocks, because a simplified leaf card
  // stops looking like a leaf long before a simplified boulder stops looking
  // like a boulder.
  {
    id: 'island_tree_01',
    budget: 40_000,
    error: 0.45,
    count: 14,
    band: [6, 22],
    side: 1,
    scale: [0.9, 1.4],
  },
  {
    id: 'tree_small_02',
    budget: 30_000,
    error: 0.45,
    count: 12,
    band: [4.5, 20],
    scale: [0.8, 1.3],
  },
  {
    id: 'jacaranda_tree',
    budget: 80_000,
    error: 0.45,
    count: 3,
    band: [15, 24],
    side: 1,
    scale: [0.5, 0.7],
  },
  { id: 'dead_tree_trunk_02', budget: 9_000, count: 7, band: [4, 16], scale: [0.9, 1.2] },

  // Rocks, close enough to the trail to be read at walking pace.
  {
    id: 'boulder_01',
    budget: 12_000,
    error: 0.35,
    count: 16,
    band: [3.4, 14],
    scale: [0.8, 1.6],
    bury: 0.15,
  },
  { id: 'rock_07', budget: 4_000, count: 34, band: [2.9, 16], scale: [1.4, 3.2], bury: 0.2 },
  { id: 'rock_09', budget: 3_500, count: 30, band: [2.9, 16], scale: [2, 4.5], bury: 0.25 },
  {
    id: 'stone_01',
    budget: 2_500,
    error: 0.3,
    count: 40,
    band: [2.8, 12],
    scale: [2.5, 6],
    bury: 0.3,
  },
  {
    id: 'sand_rocks_small_01',
    budget: 14_000,
    count: 9,
    band: [9, 18],
    side: -1,
    scale: [0.9, 1.5],
  },

  // What grows at the edges.
  { id: 'root_cluster_01', budget: 10_000, count: 9, band: [3.2, 9], scale: [0.7, 1.1], bury: 0.2 },
  { id: 'shrub_01', budget: 6_000, error: 0.5, count: 30, band: [2.9, 14], scale: [0.7, 1.2] },
  { id: 'shrub_02', budget: 5_000, error: 0.5, count: 26, band: [2.9, 15], scale: [0.7, 1.1] },
  { id: 'shrub_03', budget: 2_500, error: 0.5, count: 40, band: [2.8, 13], scale: [1, 2] },
  { id: 'grass_medium_02', budget: 1_600, error: 0.6, count: 90, band: [2.7, 13], scale: [1, 2.4] },
];

interface Placement {
  x: number;
  y: number;
  z: number;
  yaw: number;
  scale: number;
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

/**
 * Scatters one kind of prop.
 *
 * Rejection sampling against the trail, the plots and the prop's own band,
 * which is simpler than a Poisson disc and good enough when the bands are
 * this narrow. A hard attempt limit keeps a badly chosen band from hanging the
 * build.
 */
function scatter(recipe: PropRecipe, index: number): Placement[] {
  const next = random(SEED ^ (index * 2654435761));
  const placed: Placement[] = [];
  let attempts = 0;

  while (placed.length < recipe.count && attempts < recipe.count * 400) {
    attempts += 1;

    const x = AREA.minX + next() * (AREA.maxX - AREA.minX);
    const sign = recipe.side ?? (next() < 0.5 ? 1 : -1);
    const from = recipe.band[0] + next() * (recipe.band[1] - recipe.band[0]);
    const z = trailAt(x) + sign * from;

    if (z < AREA.minZ || z > AREA.maxZ) continue;
    if (PLOTS.some((plot) => Math.hypot(x - plot.x, z - plot.z) < PLOT_RADIUS + 1.4)) continue;

    // Not on top of something already placed of the same kind.
    if (placed.some((entry) => Math.hypot(entry.x - x, entry.z - z) < 1.4)) continue;

    placed.push({
      x,
      y: heightAt(x, z),
      z,
      yaw: next() * Math.PI * 2,
      scale: recipe.scale[0] + next() * (recipe.scale[1] - recipe.scale[0]),
    });
  }

  return placed;
}

/** Loads one scan, simplifies it to its budget, and returns its merged mesh. */
async function loadProp(
  io: NodeIO,
  target: Document,
  recipe: PropRecipe,
): Promise<{ mesh: Mesh; height: number } | null> {
  const file = path.join(SOURCES, 'models', recipe.id, `${recipe.id}.gltf`);
  if (!existsSync(file)) {
    console.warn(`  ! ${recipe.id}: not in assets/nature`);
    return null;
  }

  const source = await io.read(file);
  source.setLogger(new Logger(Logger.Verbosity.ERROR));

  const before = triangleCount(source);
  const transforms: Transform[] = [dedup(), weld()];
  if (before > recipe.budget) {
    transforms.push(
      simplify({
        simplifier: MeshoptSimplifier,
        ratio: recipe.budget / before,
        error: recipe.error ?? 0.2,
        lockBorder: recipe.lockBorder ?? false,
      }),
    );
  }

  await source.transform(...transforms);

  // Height, for burying a prop the right amount.
  let low = Infinity;
  let high = -Infinity;
  for (const mesh of source.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const position = primitive.getAttribute('POSITION');
      if (!position) continue;
      low = Math.min(low, (position.getMin([]) as number[])[1] ?? 0);
      high = Math.max(high, (position.getMax([]) as number[])[1] ?? 0);
    }
  }

  const map = mergeDocuments(target, source);
  const meshes = source
    .getRoot()
    .listMeshes()
    .map((mesh) => map.get(mesh))
    .filter((mesh): mesh is Mesh => mesh !== undefined);

  const first = meshes[0];
  if (!first) return null;

  // Most scans are one mesh. When a tree ships trunk and leaves separately,
  // its primitives are folded into one so a placement is one node.
  for (const extra of meshes.slice(1)) {
    for (const primitive of extra.listPrimitives()) first.addPrimitive(primitive);
  }

  console.log(
    `  ${recipe.id.padEnd(24)} ${before.toLocaleString('en').padStart(9)} → ` +
      `${triangleCount(source).toLocaleString('en').padStart(7)} tris × ${recipe.count}`,
  );

  return { mesh: first, height: Number.isFinite(high - low) ? high - low : 1 };
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
  const scene = document.createScene('trail');

  console.log('building the terrain…');
  const terrain = buildTerrain();

  const positionAccessor = document
    .createAccessor('terrain-position')
    .setType('VEC3')
    .setArray(terrain.position)
    .setBuffer(buffer);
  const normalAccessor = document
    .createAccessor('terrain-normal')
    .setType('VEC3')
    .setArray(terrain.normal)
    .setBuffer(buffer);
  const uvAccessor = document
    .createAccessor('terrain-uv')
    .setType('VEC2')
    .setArray(terrain.uv)
    .setBuffer(buffer);

  const dirt = await groundMaterial(document, 'dirt_floor', 'trail-dirt');
  const wild = await groundMaterial(document, 'aerial_grass_rock', 'trail-wild');

  const terrainMesh = document.createMesh('terrain');
  for (const [indices, material, name] of [
    [terrain.trailIndices, dirt, 'trail'],
    [terrain.wildIndices, wild, 'wild'],
  ] as const) {
    const primitive = document
      .createPrimitive()
      .setAttribute('POSITION', positionAccessor)
      .setAttribute('NORMAL', normalAccessor)
      .setAttribute('TEXCOORD_0', uvAccessor)
      .setIndices(
        document
          .createAccessor(`terrain-${name}-indices`)
          .setType('SCALAR')
          .setArray(indices)
          .setBuffer(buffer),
      )
      .setMaterial(material);

    terrainMesh.addPrimitive(primitive);
  }

  scene.addChild(document.createNode('terrain').setMesh(terrainMesh));

  console.log('placing the scans…');
  let placements = 0;

  for (const [index, recipe] of PROPS.entries()) {
    const loaded = await loadProp(io, document, recipe);
    if (!loaded) continue;

    for (const spot of scatter(recipe, index)) {
      const node: GltfNode = document
        .createNode(`${recipe.id}-${placements}`)
        .setMesh(loaded.mesh)
        .setTranslation([
          spot.x,
          spot.y - loaded.height * spot.scale * (recipe.bury ?? 0.04),
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

  console.log('mapping the trail…');
  // The band spans the whole terrain range: on a hillside the lowest surface
  // in a cell is the ground, and what decides walkability is the step between
  // neighbours, not the absolute height.
  const grid = buildWalkableGrid(document, {
    ceiling: 26,
    floorBand: [-14, 16],
    floorAt: 0,
  });

  const walkable = countWalkable(grid);
  if (walkable < 200) throw new Error(`the trail came out unwalkable: ${walkable} cells`);

  // The spawn: the west end of the trail, looking east along it.
  const spawnX = AREA.minX + 6;
  const spawnZ = trailAt(spawnX);
  const spawn = {
    position: [spawnX, heightAt(spawnX, spawnZ), spawnZ] as [number, number, number],
    // The camera looks along its own -Z rotated by the yaw, so -π/2 looks down
    // +X, which is the way the trail runs.
    yaw: -Math.PI / 2,
  };

  const anchors = PLOTS.map((plot, index) => ({
    name: `plot-${index + 1}`,
    sign: [plot.x, heightAt(plot.x, plot.z) + 2.6, plot.z] as [number, number, number],
    stand: [plot.x, heightAt(plot.x, plot.z), plot.z] as [number, number, number],
    // Facing the trail, so a display is seen from the path rather than from
    // the bushes behind it.
    // The convention the street uses: yaw is atan2 of the direction the plot
    // should turn towards, which here is the trail beside it.
    facing: Math.atan2(0, trailAt(plot.x) - plot.z),
  }));

  console.log(
    `  walkable ${walkable} cells of ${grid.width}x${grid.height}, ${anchors.length} plots`,
  );

  mkdirSync(OUT, { recursive: true });
  writeFileSync(path.join(OUT, 'walkable.bin'), Buffer.from(packMask(grid)));
  writeFileSync(path.join(OUT, 'ground.bin'), Buffer.from(grid.ground));

  // The sea, added after the map is built rather than before: a plane a
  // hundred and forty metres across is the flattest floor in the scene, and
  // the walkable map would happily let somebody stroll out onto it.
  const water = document
    .createMaterial('water')
    .setBaseColorFactor([0.04, 0.12, 0.17, 1])
    .setRoughnessFactor(0.12)
    .setMetallicFactor(0.02);

  const waterMesh = document.createMesh('water');
  const half = 140;
  waterMesh.addPrimitive(
    document
      .createPrimitive()
      .setAttribute(
        'POSITION',
        document
          .createAccessor('water-position')
          .setType('VEC3')
          .setArray(
            new Float32Array([
              -half,
              -4.6,
              -half,
              half,
              -4.6,
              -half,
              half,
              -4.6,
              half,
              -half,
              -4.6,
              half,
            ]),
          )
          .setBuffer(buffer),
      )
      .setAttribute(
        'NORMAL',
        document
          .createAccessor('water-normal')
          .setType('VEC3')
          .setArray(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]))
          .setBuffer(buffer),
      )
      .setIndices(
        document
          .createAccessor('water-indices')
          .setType('SCALAR')
          .setArray(new Uint32Array([0, 2, 1, 0, 3, 2]))
          .setBuffer(buffer),
      )
      .setMaterial(water),
  );
  scene.addChild(document.createNode('water').setMesh(waterMesh));

  console.log('compressing textures…');
  await document.transform(
    dedup(),
    prune(),
    instance({ min: 2 }),
    // One buffer: merging eighteen source documents brings eighteen along, and
    // a GLB may carry at most one.
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

    const file = `trail-lod${level.level}.glb`;
    writeFileSync(path.join(OUT, file), await io.writeBinary(copy));

    const bytes = statSync(path.join(OUT, file)).size;
    levels.push({ level: level.level, file, triangles: triangleCount(copy), bytes });
    console.log(
      `  lod${level.level}: ${triangleCount(copy).toLocaleString('en')} tris, ` +
        `${(bytes / 1e6).toFixed(1)} MB`,
    );
  }

  const manifest = {
    id: 'trail',
    kind: 'outdoor',
    title: {
      ru: 'Изумрудная тропа',
      en: 'Verdant Trail',
    },
    blurb: {
      ru: 'Прибрежная тропа между скалами и деревьями. Шесть площадок для павильонов.',
      en: 'A coastal path between cliffs and trees. Six plots for pavilions.',
    },
    source: SOURCE,
    sky: 'sky.hdr',
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
  const all = [...new Set([...known, 'trail'])].filter((id) =>
    existsSync(path.resolve(OUT, '..', id, 'location.json')),
  );
  writeFileSync(indexFile, `${JSON.stringify(all, null, 2)}\n`);

  console.log(`\ntrail built: ${levels.map((l) => (l.bytes / 1e6).toFixed(0)).join('/')} MB`);
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  await main();
}
