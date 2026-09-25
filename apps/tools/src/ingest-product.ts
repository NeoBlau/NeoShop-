/**
 * Turns a third-party model into a product the showroom can sell.
 *
 *   pnpm --filter @3dsfera/tools run ingest
 *
 * A model downloaded from an asset library is never ready as it stands. It
 * arrives at whatever scale its exporter felt like — the robot vacuum here is
 * 2.14 metres across — with its origin wherever the artist left it, wrapped in
 * two or three nodes of Sketchfab and FBX conversion scaffolding, and with no
 * animation at all. A showroom that promises to show products *working* cannot
 * use that directly.
 *
 * So this does four things, in order:
 *
 *   1. flattens the import scaffolding, so one node carries the whole model
 *   2. scales it to its real size, measured across the widest horizontal axis
 *   3. drops it so the base sits at y=0 and the footprint is centred
 *   4. writes animation clips onto the parts named in the recipe
 *
 * Steps 1-3 are generic. Step 4 is per-product by necessity: no heuristic can
 * tell which cylinder is a wheel and which is a bumper, so each product gets a
 * recipe that names its parts and says what they should do.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  NodeIO,
  type Accessor,
  type Animation,
  type AnimationChannel,
  type AnimationSampler,
  type Document,
  type Node as GltfNode,
} from '@gltf-transform/core';
import { dedup, weld } from '@gltf-transform/functions';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SOURCES = path.resolve(HERE, '../../../assets/incoming');
const OUT = path.resolve(HERE, '../../api/prisma/seed-assets');

/** Samples per second for the clips written here. Enough for smooth rotation. */
const FPS = 20;

type Vec3 = [number, number, number];

/** One animated part: the node to drive, and the keyframes to drive it with. */
interface PartTrack {
  /** Substring of the node name. The first node that matches is taken. */
  node: string;
  /** Constant spin about a local axis, in turns per second. */
  spin?: { axis: 'x' | 'y' | 'z'; turns: number };
  /** Keyframed translation, metres, relative to the node's own position. */
  move?: { at: number; offset: Vec3 }[];
  /** Keyframed rotation about Y, in turns, relative to the node's own rotation. */
  turn?: { at: number; turns: number }[];
}

interface ClipRecipe {
  name: string;
  seconds: number;
  /** The whole model, driven as one. */
  root?: Omit<PartTrack, 'node'>;
  parts: PartTrack[];
}

interface Recipe {
  source: string;
  output: string;
  /** Metres across the widest horizontal axis, after scaling. */
  width: number;
  clips: ClipRecipe[];
}

/**
 * The robot vacuum.
 *
 * Its parts, found by measuring the file: two wheels as a symmetric pair of
 * flattened cylinders, two side brushes as the pair carrying forty thousand
 * triangles each — bristles are expensive — and the body with everything else.
 * Three clips, and the split between them is deliberate: on a plinth a product
 * demonstrates its mechanisms without leaving the marble, so `brushes_spin`
 * and `lidar_scan` stay in place. `clean_pattern` drives, and belongs in a
 * mission, where there is a floor to drive on.
 */
const VACUUM: Recipe = {
  source: 'robot-vacuum-source.glb',
  output: 'robot-vacuum.glb',
  width: 0.35,
  clips: [
    {
      name: 'brushes_spin',
      seconds: 4,
      parts: [
        { node: 'Cylinder.010', spin: { axis: 'z', turns: 1.6 } },
        { node: 'Cylinder.004', spin: { axis: 'z', turns: -1.6 } },
        { node: 'Cylinder.009', spin: { axis: 'z', turns: 0.55 } },
        { node: 'Cylinder.005', spin: { axis: 'z', turns: 0.55 } },
      ],
    },
    {
      name: 'undock',
      seconds: 3.2,
      root: {
        move: [
          { at: 0, offset: [0, 0, 0] },
          { at: 1.4, offset: [0, 0, -0.22] },
          { at: 3.2, offset: [0.16, 0, -0.3] },
        ],
        turn: [
          { at: 0, turns: 0 },
          { at: 1.4, turns: 0 },
          { at: 3.2, turns: 0.16 },
        ],
      },
      parts: [
        { node: 'Cylinder.009', spin: { axis: 'z', turns: 0.9 } },
        { node: 'Cylinder.005', spin: { axis: 'z', turns: 0.9 } },
        { node: 'Cylinder.010', spin: { axis: 'z', turns: 1.2 } },
        { node: 'Cylinder.004', spin: { axis: 'z', turns: -1.2 } },
      ],
    },
    {
      name: 'clean_pattern',
      seconds: 12,
      root: {
        // A boustrophedon: up the room, across, back down. The distances are in
        // metres of floor, which is why this clip is for a mission and not for
        // a plinth two thirds of a metre wide.
        move: [
          { at: 0, offset: [0, 0, 0] },
          { at: 2.6, offset: [0, 0, -1.6] },
          { at: 3.6, offset: [0.4, 0, -1.75] },
          { at: 6.2, offset: [0.4, 0, -0.15] },
          { at: 7.2, offset: [0.8, 0, 0] },
          { at: 9.8, offset: [0.8, 0, -1.6] },
          { at: 12, offset: [0.8, 0, -1.6] },
        ],
        turn: [
          { at: 0, turns: 0 },
          { at: 2.6, turns: 0 },
          { at: 3.6, turns: 0.5 },
          { at: 6.2, turns: 0.5 },
          { at: 7.2, turns: 1 },
          { at: 9.8, turns: 1 },
          { at: 12, turns: 1 },
        ],
      },
      parts: [
        { node: 'Cylinder.009', spin: { axis: 'z', turns: 1.4 } },
        { node: 'Cylinder.005', spin: { axis: 'z', turns: 1.4 } },
        { node: 'Cylinder.010', spin: { axis: 'z', turns: 2 } },
        { node: 'Cylinder.004', spin: { axis: 'z', turns: -2 } },
      ],
    },
  ],
};

const RECIPES = [VACUUM];

function meshBounds(node: GltfNode): { lo: Vec3; hi: Vec3 } | null {
  const mesh = node.getMesh();
  if (!mesh) return null;

  const lo: Vec3 = [Infinity, Infinity, Infinity];
  const hi: Vec3 = [-Infinity, -Infinity, -Infinity];
  let found = false;

  for (const primitive of mesh.listPrimitives()) {
    const position = primitive.getAttribute('POSITION');
    if (!position) continue;
    found = true;
    const min = position.getMin([]) as number[];
    const max = position.getMax([]) as number[];
    for (let axis = 0; axis < 3; axis += 1) {
      lo[axis] = Math.min(lo[axis] ?? Infinity, min[axis] ?? 0);
      hi[axis] = Math.max(hi[axis] ?? -Infinity, max[axis] ?? 0);
    }
  }

  return found ? { lo, hi } : null;
}

/** World-space bounds of everything in the scene, walked node by node. */
function sceneBounds(document: Document): { lo: Vec3; hi: Vec3 } {
  const lo: Vec3 = [Infinity, Infinity, Infinity];
  const hi: Vec3 = [-Infinity, -Infinity, -Infinity];

  const walk = (node: GltfNode, parent: number[]): void => {
    const matrix = multiply(parent, localMatrix(node));
    const bounds = meshBounds(node);

    if (bounds) {
      // Eight corners: a transformed box is not the box of transformed extremes
      // unless every corner is tried.
      for (let corner = 0; corner < 8; corner += 1) {
        const point: Vec3 = [
          (corner & 1 ? bounds.hi : bounds.lo)[0],
          (corner & 2 ? bounds.hi : bounds.lo)[1],
          (corner & 4 ? bounds.hi : bounds.lo)[2],
        ];
        const world = apply(matrix, point);
        for (let axis = 0; axis < 3; axis += 1) {
          lo[axis] = Math.min(lo[axis] ?? Infinity, world[axis] ?? 0);
          hi[axis] = Math.max(hi[axis] ?? -Infinity, world[axis] ?? 0);
        }
      }
    }

    for (const child of node.listChildren()) walk(child, matrix);
  };

  for (const scene of document.getRoot().listScenes()) {
    for (const node of scene.listChildren()) walk(node, identity());
  }

  return { lo, hi };
}

function identity(): number[] {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

/** Column-major 4x4, the same layout glTF uses. */
function localMatrix(node: GltfNode): number[] {
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
      for (let k = 0; k < 4; k += 1) {
        sum += (a[k * 4 + row] ?? 0) * (b[column * 4 + k] ?? 0);
      }
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

function findNode(document: Document, needle: string): GltfNode | null {
  for (const node of document.getRoot().listNodes()) {
    if (node.getName().includes(needle)) return node;
  }
  return null;
}

/** Builds the shared time accessor for a clip. */
function times(document: Document, seconds: number): { accessor: Accessor; steps: number[] } {
  const steps: number[] = [];
  const frames = Math.max(2, Math.round(seconds * FPS));
  for (let frame = 0; frame <= frames; frame += 1) steps.push((frame / frames) * seconds);

  const accessor = document.createAccessor().setType('SCALAR').setArray(new Float32Array(steps));

  return { accessor, steps };
}

/** Linear lookup through keyframes, holding the ends. */
function sampleAt(keys: { at: number }[], time: number): { index: number; weight: number } {
  for (let index = 0; index < keys.length - 1; index += 1) {
    const current = keys[index];
    const next = keys[index + 1];
    if (!current || !next) break;
    if (time <= next.at) {
      const span = next.at - current.at;
      return { index, weight: span > 0 ? (time - current.at) / span : 0 };
    }
  }
  return { index: Math.max(0, keys.length - 2), weight: 1 };
}

function spinSampler(
  document: Document,
  node: GltfNode,
  time: { accessor: Accessor; steps: number[] },
  axis: 'x' | 'y' | 'z',
  turns: number,
): AnimationSampler {
  const base = node.getRotation();
  const values: number[] = [];
  const index = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;

  for (const step of time.steps) {
    const angle = step * turns * Math.PI * 2;
    const half = angle / 2;
    // The part's own rotation composed with the spin, so a wheel already
    // rotated by its exporter keeps its orientation while turning.
    const spin = [0, 0, 0, Math.cos(half)];
    spin[index] = Math.sin(half);
    values.push(...composeQuaternion(base, spin as [number, number, number, number]));
  }

  return document
    .createAnimationSampler()
    .setInput(time.accessor)
    .setOutput(document.createAccessor().setType('VEC4').setArray(new Float32Array(values)))
    .setInterpolation('LINEAR');
}

function composeQuaternion(
  a: [number, number, number, number] | number[],
  b: [number, number, number, number],
): number[] {
  const [ax, ay, az, aw] = a as [number, number, number, number];
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

function moveSampler(
  document: Document,
  node: GltfNode,
  time: { accessor: Accessor; steps: number[] },
  keys: { at: number; offset: Vec3 }[],
): AnimationSampler {
  const base = node.getTranslation();
  const values: number[] = [];

  for (const step of time.steps) {
    const { index, weight } = sampleAt(keys, step);
    const from = keys[index]?.offset ?? [0, 0, 0];
    const to = keys[index + 1]?.offset ?? from;
    for (let axis = 0; axis < 3; axis += 1) {
      const offset = (from[axis] ?? 0) + ((to[axis] ?? 0) - (from[axis] ?? 0)) * weight;
      values.push((base[axis] ?? 0) + offset);
    }
  }

  return document
    .createAnimationSampler()
    .setInput(time.accessor)
    .setOutput(document.createAccessor().setType('VEC3').setArray(new Float32Array(values)))
    .setInterpolation('LINEAR');
}

function turnSampler(
  document: Document,
  node: GltfNode,
  time: { accessor: Accessor; steps: number[] },
  keys: { at: number; turns: number }[],
): AnimationSampler {
  const base = node.getRotation();
  const values: number[] = [];

  for (const step of time.steps) {
    const { index, weight } = sampleAt(keys, step);
    const from = keys[index]?.turns ?? 0;
    const to = keys[index + 1]?.turns ?? from;
    const half = ((from + (to - from) * weight) * Math.PI * 2) / 2;
    values.push(...composeQuaternion(base, [0, Math.sin(half), 0, Math.cos(half)]));
  }

  return document
    .createAnimationSampler()
    .setInput(time.accessor)
    .setOutput(document.createAccessor().setType('VEC4').setArray(new Float32Array(values)))
    .setInterpolation('LINEAR');
}

/**
 * Binds one sampler to one node property.
 *
 * The sampler is registered on the animation as well as referenced by the
 * channel. Both are required: the writer numbers samplers from the animation's
 * own list, so one that is only referenced by a channel is written as an index
 * into nothing, and the model then fails to load with an undefined input.
 */
function bind(
  document: Document,
  animation: Animation,
  node: GltfNode,
  target: 'translation' | 'rotation',
  sampler: AnimationSampler,
): void {
  animation.addSampler(sampler);
  const channel: AnimationChannel = document
    .createAnimationChannel()
    .setTargetNode(node)
    .setTargetPath(target)
    .setSampler(sampler);
  animation.addChannel(channel);
}

function authorClips(document: Document, root: GltfNode, recipes: ClipRecipe[]): string[] {
  const written: string[] = [];

  for (const recipe of recipes) {
    const animation: Animation = document.createAnimation(recipe.name);
    const time = times(document, recipe.seconds);
    let channels = 0;

    if (recipe.root?.move) {
      bind(
        document,
        animation,
        root,
        'translation',
        moveSampler(document, root, time, recipe.root.move),
      );
      channels += 1;
    }

    if (recipe.root?.turn) {
      bind(
        document,
        animation,
        root,
        'rotation',
        turnSampler(document, root, time, recipe.root.turn),
      );
      channels += 1;
    }

    for (const part of recipe.parts) {
      const node = findNode(document, part.node);
      if (!node) {
        console.warn(`  ! ${recipe.name}: no node matching "${part.node}"`);
        continue;
      }

      if (part.spin) {
        bind(
          document,
          animation,
          node,
          'rotation',
          spinSampler(document, node, time, part.spin.axis, part.spin.turns),
        );
        channels += 1;
      }

      if (part.move) {
        bind(
          document,
          animation,
          node,
          'translation',
          moveSampler(document, node, time, part.move),
        );
        channels += 1;
      }
    }

    written.push(`${recipe.name} (${recipe.seconds}s, ${channels} channels)`);
  }

  return written;
}

async function ingest(recipe: Recipe): Promise<void> {
  const io = new NodeIO();
  const source = path.join(SOURCES, recipe.source);

  if (!existsSync(source)) {
    console.log(`skipped ${recipe.output}: ${recipe.source} is not in assets/incoming`);
    return;
  }

  console.log(`\n${recipe.source} → ${recipe.output}`);
  const document = await io.read(source);

  // Deliberately not flatten(), prune() or join(): every one of them collapses
  // the node hierarchy, and the hierarchy is what the clips are written
  // against. A joined mesh has no wheels left to turn. Deduplication and
  // welding touch only the geometry, so they stay.
  await document.transform(dedup(), weld());

  const before = sceneBounds(document);
  const width = Math.max(before.hi[0] - before.lo[0], before.hi[2] - before.lo[2]);
  const scale = recipe.width / width;

  // One node above everything, so the product has a handle: a clip that drives
  // it needs a single thing to drive, and the scaling and seating go here too.
  const scene = document.getRoot().listScenes()[0];
  if (!scene) throw new Error(`${recipe.source} has no scene`);

  const root = document.createNode('product');
  for (const child of scene.listChildren()) {
    scene.removeChild(child);
    root.addChild(child);
  }
  scene.addChild(root);

  root.setScale([scale, scale, scale]);
  root.setTranslation([
    -((before.lo[0] + before.hi[0]) / 2) * scale,
    -before.lo[1] * scale,
    -((before.lo[2] + before.hi[2]) / 2) * scale,
  ]);

  const clips = authorClips(document, root, recipe.clips);

  const after = sceneBounds(document);
  console.log(
    `  scaled ${width.toFixed(2)} m → ${recipe.width} m across (×${scale.toFixed(4)}), ` +
      `base at y=${after.lo[1].toFixed(3)}`,
  );
  console.log(
    `  size ${[0, 1, 2].map((a) => ((after.hi[a] ?? 0) - (after.lo[a] ?? 0)).toFixed(3)).join(' x ')} m`,
  );
  for (const clip of clips) console.log(`  clip ${clip}`);

  mkdirSync(OUT, { recursive: true });
  const target = path.join(OUT, recipe.output);
  writeFileSync(target, await io.writeBinary(document));
  console.log(`  written ${target}  ${(readFileSync(target).byteLength / 1e6).toFixed(1)} MB`);
}

async function main(): Promise<void> {
  for (const recipe of RECIPES) await ingest(recipe);
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  await main();
}
