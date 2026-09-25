/**
 * Demo zones: the small places a mission happens in.
 *
 *   pnpm --filter @3dsfera/tools run build:zone
 *
 * The street is a street — you cannot deploy a satellite dish on a pavement in
 * Paris, and a robot vacuum has nothing to clean there. A mission needs a room,
 * so each zone is one interior model turned into somewhere a buyer can stand:
 *
 *   1. measured, and moved so its floor is at y=0 and its walkable middle at
 *      the origin, because a model authored eight metres in the air is normal
 *      and nothing downstream should have to know
 *   2. lightened — the heavier ones arrive at a million triangles or three,
 *      which is a scan, not a game asset
 *   3. mapped, with the same rasteriser the street uses, so walls are walls
 *   4. given a spawn and a stage: where the buyer arrives, and where the
 *      product stands so that it is in view on arrival
 *
 * Sources live in assets/incoming and are not committed. What is committed is
 * the recipe below, so a zone is reproducible from the same file.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import draco3d from 'draco3dgltf';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import {
  Logger,
  NodeIO,
  type Document,
  type Node as GltfNode,
  type Transform,
} from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRDracoMeshCompression } from '@gltf-transform/extensions';
import { dedup, prune, simplify, textureCompress, weld } from '@gltf-transform/functions';
import {
  buildWalkableGrid,
  countWalkable,
  forEachTriangle,
  packMask,
  type WalkableGrid,
} from './location-walkable.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SOURCES = path.resolve(HERE, '../../../assets/incoming');
const OUT = path.resolve(HERE, '../../web/public/world/zones');

/** Above this a zone is simplified; below it the triangles are left alone. */
const TRIANGLE_BUDGET = 320_000;
/** Textures larger than this are pointless in a room you walk across in six steps. */
const TEXTURE_MAX = 2048;
/** Eye height, so the spawn can be checked for head room the way the player is. */
const EYE_HEIGHT = 1.65;

export interface ZoneRecipe {
  id: string;
  source: string;
  title: { ru: string; en: string; it: string };
  /** Shown in the corner of the scene; a licence condition for CC-BY work. */
  credit: { title: string; author: string; licence: string; url: string };
  /**
   * Metres of head room a floor needs to count as floor. A loft with a
   * mezzanine wants this low enough to keep the ground floor and high enough
   * to reject the gap under a sofa.
   */
  ceiling?: number;
  /** Multiplied into the model. Use when a source is not in metres. */
  scale?: number;
  /**
   * Overrides the detected floor height, in source units. For a model whose
   * biggest flat surface is not the floor someone stands on — a warehouse
   * roof, a pool table the size of the room.
   */
  floor?: number;
}

const ZONES: ZoneRecipe[] = [
  {
    id: 'loft',
    source: 'loft-city.glb',
    title: {
      ru: 'Лофт с видом на город',
      en: 'Loft over the city',
      it: 'Loft con vista sulla città',
    },
    credit: {
      title: 'Free Loft 17 — interior with a view of the city',
      author: 'NEO_ASSETS',
      licence: 'CC BY 4.0',
      url: 'https://creativecommons.org/licenses/by/4.0/',
    },
  },
  {
    id: 'gallery',
    source: 'art-gallery.glb',
    title: {
      ru: 'Художественная галерея',
      en: 'Art gallery',
      it: 'Galleria d’arte',
    },
    credit: {
      title: "Richard's Art Gallery — audio tour",
      author: 'NEO_ASSETS',
      licence: 'CC BY 4.0',
      url: 'https://creativecommons.org/licenses/by/4.0/',
    },
  },
  {
    id: 'billiards',
    source: 'billiards-room.glb',
    title: {
      ru: 'Бильярдная',
      en: 'Billiards room',
      it: 'Sala da biliardo',
    },
    credit: {
      title: 'The Billiards Room',
      author: 'NEO_ASSETS',
      licence: 'CC BY 4.0',
      url: 'https://creativecommons.org/licenses/by/4.0/',
    },
  },
  {
    id: 'bedroom',
    source: 'neon-bedroom.glb',
    title: {
      ru: 'Спальня в неоне',
      en: 'Neon bedroom',
      it: 'Camera al neon',
    },
    credit: {
      title: 'Neon Moon Bedroom',
      author: 'NEO_ASSETS',
      licence: 'CC BY 4.0',
      url: 'https://creativecommons.org/licenses/by/4.0/',
    },
  },
];

type Vec3 = [number, number, number];

interface Bounds {
  lo: Vec3;
  hi: Vec3;
}

function triangleCount(document: Document): number {
  let total = 0;
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const indices = primitive.getIndices();
      const position = primitive.getAttribute('POSITION');
      total += (indices ? indices.getCount() : (position?.getCount() ?? 0)) / 3;
    }
  }
  return Math.round(total);
}

/** Scene bounds in world space, corner by corner through every node. */
function sceneBounds(document: Document): Bounds {
  const lo: Vec3 = [Infinity, Infinity, Infinity];
  const hi: Vec3 = [-Infinity, -Infinity, -Infinity];

  const walk = (node: GltfNode, parent: number[]): void => {
    const matrix = multiply(parent, local(node));
    const mesh = node.getMesh();

    if (mesh) {
      for (const primitive of mesh.listPrimitives()) {
        const position = primitive.getAttribute('POSITION');
        if (!position) continue;
        const min = position.getMin([]) as number[];
        const max = position.getMax([]) as number[];

        for (let corner = 0; corner < 8; corner += 1) {
          const point: Vec3 = [
            (corner & 1 ? max : min)[0] ?? 0,
            (corner & 2 ? max : min)[1] ?? 0,
            (corner & 4 ? max : min)[2] ?? 0,
          ];
          const world = apply(matrix, point);
          for (let axis = 0; axis < 3; axis += 1) {
            lo[axis] = Math.min(lo[axis] ?? Infinity, world[axis] ?? 0);
            hi[axis] = Math.max(hi[axis] ?? -Infinity, world[axis] ?? 0);
          }
        }
      }
    }

    for (const child of node.listChildren()) walk(child, matrix);
  };

  for (const scene of document.getRoot().listScenes()) {
    for (const node of scene.listChildren()) walk(node, IDENTITY);
  }

  return { lo, hi };
}

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function local(node: GltfNode): number[] {
  const [x, y, z, w] = node.getRotation();
  const [sx, sy, sz] = node.getScale();
  const [tx, ty, tz] = node.getTranslation();

  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;
  const xx = x * x2;
  const xy = x * y2;
  const xz = x * z2;
  const yy = y * y2;
  const yz = y * z2;
  const zz = z * z2;
  const wx = w * x2;
  const wy = w * y2;
  const wz = w * z2;

  return [
    (1 - (yy + zz)) * sx,
    (xy + wz) * sx,
    (xz - wy) * sx,
    0,
    (xy - wz) * sy,
    (1 - (xx + zz)) * sy,
    (yz + wx) * sy,
    0,
    (xz + wy) * sz,
    (yz - wx) * sz,
    (1 - (xx + yy)) * sz,
    0,
    tx,
    ty,
    tz,
    1,
  ];
}

function multiply(a: number[], b: number[]): number[] {
  const out = new Array<number>(16).fill(0);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) sum += (a[k * 4 + row] ?? 0) * (b[column * 4 + k] ?? 0);
      out[column * 4 + row] = sum;
    }
  }
  return out;
}

function apply(matrix: number[], point: Vec3): Vec3 {
  return [0, 1, 2].map(
    (row) =>
      (matrix[row] ?? 0) * point[0] +
      (matrix[4 + row] ?? 0) * point[1] +
      (matrix[8 + row] ?? 0) * point[2] +
      (matrix[12 + row] ?? 0),
  ) as Vec3;
}

/** Cells of clear floor around a cell, capped so the search stays cheap. */
function clearanceAt(grid: WalkableGrid, cell: number, cap = 6): number {
  const x = cell % grid.width;
  const z = Math.floor(cell / grid.width);

  for (let radius = 1; radius <= cap; radius += 1) {
    for (let dz = -radius; dz <= radius; dz += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.abs(dx) !== radius && Math.abs(dz) !== radius) continue;
        const nx = x + dx;
        const nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= grid.width || nz >= grid.height) return radius - 1;
        if (!grid.mask[nz * grid.width + nx]) return radius - 1;
      }
    }
  }

  return cap;
}

function worldOf(grid: WalkableGrid, cell: number): { x: number; y: number; z: number } {
  const x = (cell % grid.width) * grid.cell + grid.origin[0] + grid.cell / 2;
  const z = Math.floor(cell / grid.width) * grid.cell + grid.origin[1] + grid.cell / 2;
  return { x, y: grid.groundBase + (grid.ground[cell] ?? 0) / 100, z };
}

/**
 * Two places: where the buyer arrives, and where the product stands.
 *
 * The stage takes the most open spot in the room, because a product with a
 * wall behind it cannot be walked around. The spawn is then the open spot
 * furthest from the stage, so arriving means seeing the product across the
 * room rather than standing on top of it.
 */
function placeSpawnAndStage(grid: WalkableGrid): {
  spawn: { position: Vec3; yaw: number };
  stage: { position: Vec3; yaw: number };
} {
  let stageCell = -1;
  let stageClearance = -1;

  for (let cell = 0; cell < grid.mask.length; cell += 1) {
    if (!grid.mask[cell]) continue;
    const clearance = clearanceAt(grid, cell);
    if (clearance > stageClearance) {
      stageClearance = clearance;
      stageCell = cell;
    }
  }

  if (stageCell < 0) throw new Error('the zone has no walkable floor at all');

  const stage = worldOf(grid, stageCell);
  let spawnCell = stageCell;
  let best = -1;

  for (let cell = 0; cell < grid.mask.length; cell += 1) {
    if (!grid.mask[cell]) continue;
    // Two cells of clearance is enough to stand in; the rest of the score is
    // distance, so the buyer starts across the room rather than in a corner
    // they cannot turn around in.
    if (clearanceAt(grid, cell, 2) < 2) continue;

    const point = worldOf(grid, cell);
    const distance = Math.hypot(point.x - stage.x, point.z - stage.z);
    if (distance > best) {
      best = distance;
      spawnCell = cell;
    }
  }

  const spawn = worldOf(grid, spawnCell);
  const toStage = Math.atan2(stage.x - spawn.x, stage.z - spawn.z);

  return {
    spawn: { position: [spawn.x, spawn.y, spawn.z], yaw: toStage },
    // Turned to face the arrival point, so a product's front is its front.
    stage: {
      position: [stage.x, stage.y, stage.z],
      yaw: Math.atan2(spawn.x - stage.x, spawn.z - stage.z),
    },
  };
}

/**
 * Finds the floor of a room by looking for the largest flat thing in it.
 *
 * The naive answer — the lowest point in the model — is wrong for every
 * interior that ships with scenery around it. The loft here comes with a ring
 * of skyscrapers whose bases hang eight metres below its floor, so "lowest"
 * finds a rooftop in the distance and the room itself ends up counted as
 * structure. Instead: every up-facing triangle contributes its area to a ten
 * centimetre height bin, and the bin holding the most area is the floor. A
 * room's floor is, by a wide margin, the biggest horizontal surface in it.
 */
function findFloorLevel(document: Document): number {
  const BIN = 0.1;
  const area = new Map<number, number>();

  forEachTriangle(document, ([a, b, c]) => {
    // Cross product of two edges: its length is twice the triangle's area and
    // its y component tells us which way the triangle faces.
    const ux = b.x - a.x;
    const uy = b.y - a.y;
    const uz = b.z - a.z;
    const vx = c.x - a.x;
    const vy = c.y - a.y;
    const vz = c.z - a.z;

    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const length = Math.hypot(nx, ny, nz);
    if (length === 0) return;

    // Within twenty degrees of horizontal, and facing up rather than down: a
    // ceiling has the same slope and is of no interest.
    if (ny / length < 0.94) return;

    const height = (a.y + b.y + c.y) / 3;
    const bin = Math.round(height / BIN);
    area.set(bin, (area.get(bin) ?? 0) + length / 2);
  });

  let bestBin = 0;
  let bestArea = -1;
  for (const [bin, value] of area) {
    if (value > bestArea) {
      bestArea = value;
      bestBin = bin;
    }
  }

  return bestBin * BIN;
}

async function buildZone(recipe: ZoneRecipe): Promise<void> {
  const source = path.join(SOURCES, recipe.source);
  if (!existsSync(source)) {
    console.log(`skipped ${recipe.id}: ${recipe.source} is not in assets/incoming`);
    return;
  }

  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule(),
  });

  console.log(`\n${recipe.id}  ←  ${recipe.source}`);
  const document = await io.read(source);
  document.setLogger(new Logger(Logger.Verbosity.ERROR));

  const before = triangleCount(document);

  // Normalise before anything measures: one root node carries the scale and
  // the offset, and the rest of the pipeline sees a room whose floor is zero.
  const scene = document.getRoot().listScenes()[0];
  if (!scene) throw new Error(`${recipe.source} has no scene`);

  const root = document.createNode(`zone-${recipe.id}`);
  for (const child of scene.listChildren()) {
    scene.removeChild(child);
    root.addChild(child);
  }
  scene.addChild(root);

  const raw = sceneBounds(document);
  const scale = recipe.scale ?? 1;
  // The floor, not the lowest vertex: see findFloorLevel. Centring on x and z
  // still uses the bounds, which is harmless — the map is built in world space
  // either way, and a room near the origin is easier to reason about.
  const floor = recipe.floor ?? findFloorLevel(document);
  root.setScale([scale, scale, scale]);
  root.setTranslation([
    -((raw.lo[0] + raw.hi[0]) / 2) * scale,
    -floor * scale,
    -((raw.lo[2] + raw.hi[2]) / 2) * scale,
  ]);

  const bounds = sceneBounds(document);
  console.log(
    `  ${before.toLocaleString('en')} tris, floor at ${floor.toFixed(2)}, ` +
      `${[0, 1, 2].map((a) => ((bounds.hi[a] ?? 0) - (bounds.lo[a] ?? 0)).toFixed(1)).join(' x ')} m`,
  );

  // The map is built from the full-resolution geometry: simplification moves
  // vertices, and a wall that moved ten centimetres is a wall the buyer walks
  // through. Map first, lighten second.
  const ceiling = recipe.ceiling ?? 2.6;
  // Zero, because the model was just moved so that its floor is zero. Saying
  // so explicitly is the whole point: the scene minimum is eight metres lower.
  const grid = buildWalkableGrid(document, {
    ceiling,
    floorBand: [-0.3, 0.6],
    floorAt: 0,
  });
  const { spawn, stage } = placeSpawnAndStage(grid);

  console.log(
    `  walkable ${countWalkable(grid)} cells of ${grid.width}x${grid.height}, ` +
      `spawn [${spawn.position.map((v) => v.toFixed(1)).join(', ')}], ` +
      `stage [${stage.position.map((v) => v.toFixed(1)).join(', ')}]`,
  );

  const transforms: Transform[] = [dedup(), prune(), weld()];

  if (before > TRIANGLE_BUDGET) {
    const ratio = TRIANGLE_BUDGET / before;
    transforms.push(simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.004 }));
  }

  transforms.push(
    textureCompress({
      encoder: sharp,
      targetFormat: 'webp',
      resize: [TEXTURE_MAX, TEXTURE_MAX],
    }),
  );

  await document.transform(...transforms);
  document.createExtension(KHRDracoMeshCompression).setRequired(true).setEncoderOptions({
    method: KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER,
  });

  const dir = path.join(OUT, recipe.id);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  const model = path.join(dir, 'zone.glb');
  writeFileSync(model, await io.writeBinary(document));
  writeFileSync(path.join(dir, 'walkable.bin'), Buffer.from(packMask(grid)));
  writeFileSync(path.join(dir, 'ground.bin'), Buffer.from(grid.ground));

  const manifest = {
    id: recipe.id,
    title: recipe.title,
    credit: recipe.credit,
    model: 'zone.glb',
    triangles: triangleCount(document),
    bytes: statSync(model).size,
    bounds: { lo: bounds.lo, hi: bounds.hi },
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
    stage,
    eyeHeight: EYE_HEIGHT,
    builtAt: new Date().toISOString(),
  };

  writeFileSync(path.join(dir, 'zone.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `  built ${manifest.triangles.toLocaleString('en')} tris, ` +
      `${(manifest.bytes / 1e6).toFixed(1)} MB → ${path.relative(process.cwd(), dir)}`,
  );
}

async function main(): Promise<void> {
  const wanted = process.argv.slice(2);
  const recipes = wanted.length > 0 ? ZONES.filter((zone) => wanted.includes(zone.id)) : ZONES;

  mkdirSync(OUT, { recursive: true });

  const built: string[] = [];
  for (const recipe of recipes) {
    try {
      await buildZone(recipe);
      if (existsSync(path.join(OUT, recipe.id, 'zone.json'))) built.push(recipe.id);
    } catch (error) {
      console.warn(`  ! ${recipe.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // The index the web app reads to know which zones exist. Merged with what is
  // already there, so building one zone does not forget the others.
  const indexFile = path.join(OUT, 'zones.json');
  const known: string[] = existsSync(indexFile)
    ? (JSON.parse(readFileSync(indexFile, 'utf8')) as string[])
    : [];
  const all = [...new Set([...known, ...built])].filter((id) =>
    existsSync(path.join(OUT, id, 'zone.json')),
  );

  writeFileSync(indexFile, `${JSON.stringify(all, null, 2)}\n`);
  console.log(`\nzones: ${all.join(', ') || 'none'}`);
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  await main();
}
