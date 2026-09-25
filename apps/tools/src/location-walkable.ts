/**
 * Works out where a person can stand in a location, by looking at the geometry.
 *
 * The alternative was a hand-written list of rectangles. That works for a hall
 * built from primitives, whose corners are known because someone typed them;
 * it does not work for a hundred and seventy metres of Parisian street that
 * runs diagonally, has kerbs, steps, bollards, café chairs and a Vespa in it.
 *
 * So the scene is voxelised once at build time: every vertex is dropped into a
 * half-metre cell, a cell is walkable when it has a floor and nothing at
 * shin-to-head height above that floor, and the result is flood-filled from
 * the spawn so that rooftops and balconies — which pass the first two tests
 * perfectly well — are excluded for the obvious reason that there is no way to
 * get onto them.
 */
import type { Document, Node, Primitive } from '@gltf-transform/core';

/** Half a metre. Fine enough for a doorway, coarse enough to ship as a bitmap. */
export const CELL_SIZE = 0.5;

/** A step this tall is walked up; anything more is a wall. */
const STEP_HEIGHT = 0.45;

/** Head room. Awnings and signs hang lower than this and are not obstacles. */
const HEAD_ROOM = 1.9;

/** Distance kept from every wall, in cells. */
const BODY_CELLS = 1;

export interface WalkableGrid {
  /** World position of the grid's first cell. */
  origin: [number, number];
  cell: number;
  width: number;
  height: number;
  /** One byte per cell: 1 walkable, 0 not. */
  mask: Uint8Array;
  /** Floor height per cell, in centimetres above the grid's floor datum. */
  ground: Uint8Array;
  /** The datum the ground bytes are measured from. */
  groundBase: number;
}

function multiply(a: number[], b: number[]): number[] {
  const out = new Array<number>(16).fill(0);
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) sum += (a[k * 4 + row] ?? 0) * (b[column * 4 + k] ?? 0);
      out[column * 4 + row] = sum;
    }
  }
  return out;
}

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

export function worldMatrix(node: Node): number[] {
  const chain: Node[] = [];
  let current: Node | undefined = node;

  while (current) {
    chain.unshift(current);
    current = current.listParents().find((parent) => parent.propertyType === 'Node') as
      Node | undefined;
  }

  let out = IDENTITY;
  for (const link of chain) out = multiply(out, [...link.getMatrix()]);
  return out;
}

export interface Sample {
  x: number;
  y: number;
  z: number;
}

/** Writes the world-space position of one vertex of one primitive into `out`. */
export type PlaceVertex = (index: number, out: number[]) => void;

/**
 * How to put a primitive's vertices into world space.
 *
 * For most meshes that is the node's own matrix and nothing else. For a skinned
 * mesh it is emphatically not: glTF says a skinned mesh ignores its node's
 * transform entirely and is posed by its joints, so a character's POSITION data
 * sits in bind space and the node above it usually carries whatever scale the
 * exporter left behind. Measuring one through its node matrix is how a 1.7 m
 * shop assistant measures 17 millimetres — and how the build that scaled her to
 * "1.7 m tall" produced a figure a hundred times too big, standing across the
 * street with the camera somewhere inside her ankle.
 *
 * The rest pose is what is measured here: each joint's world matrix times its
 * inverse bind matrix, blended by the vertex's own weights. That is the pose
 * the scene shows before an animation plays, which for these people is the
 * pose it shows full stop.
 */
export function vertexPlacer(node: Node, primitive: Primitive): PlaceVertex {
  const position = primitive.getAttribute('POSITION');
  const skin = node.getSkin();
  const joints = skin?.listJoints() ?? [];
  const inverseBinds = skin?.getInverseBindMatrices() ?? null;
  const weights = primitive.getAttribute('WEIGHTS_0');
  const indices = primitive.getAttribute('JOINTS_0');

  if (!position) return (_index, out) => void out.fill(0);

  const place = (matrix: number[], point: number[], out: number[]): void => {
    const [x = 0, y = 0, z = 0] = point;
    out[0] = (matrix[0] ?? 0) * x + (matrix[4] ?? 0) * y + (matrix[8] ?? 0) * z + (matrix[12] ?? 0);
    out[1] = (matrix[1] ?? 0) * x + (matrix[5] ?? 0) * y + (matrix[9] ?? 0) * z + (matrix[13] ?? 0);
    out[2] =
      (matrix[2] ?? 0) * x + (matrix[6] ?? 0) * y + (matrix[10] ?? 0) * z + (matrix[14] ?? 0);
  };

  if (!skin || !weights || !indices || joints.length === 0) {
    const matrix = worldMatrix(node);
    const point: number[] = [0, 0, 0];
    return (index, out) => {
      position.getElement(index, point);
      place(matrix, point, out);
    };
  }

  // One matrix per joint, built once: a character has a hundred joints and a
  // hundred thousand vertices, and rebuilding these per vertex is the whole
  // cost of the measurement.
  const posed = joints.map((joint, at) =>
    multiply(worldMatrix(joint), inverseBinds ? [...inverseBinds.getElement(at, [])] : IDENTITY),
  );

  const point: number[] = [0, 0, 0];
  const jointIndex: number[] = [0, 0, 0, 0];
  const jointWeight: number[] = [0, 0, 0, 0];
  const partial: number[] = [0, 0, 0];

  return (index, out) => {
    position.getElement(index, point);
    indices.getElement(index, jointIndex);
    weights.getElement(index, jointWeight);

    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
    let total = 0;

    for (let slot = 0; slot < 4; slot += 1) {
      const weight = jointWeight[slot] ?? 0;
      if (weight === 0) continue;
      const matrix = posed[jointIndex[slot] ?? 0];
      if (!matrix) continue;

      place(matrix, point, partial);
      out[0] += (partial[0] ?? 0) * weight;
      out[1] += (partial[1] ?? 0) * weight;
      out[2] += (partial[2] ?? 0) * weight;
      total += weight;
    }

    // A vertex bound to nothing belongs to the mesh rather than to a joint;
    // three renders it at its bind position, so it is measured there too.
    if (total === 0) place(IDENTITY, point, out);
  };
}

/** Walks every vertex in the scene once, in world space. */
export function forEachVertex(
  document: Document,
  visit: (sample: Sample, node: Node) => void,
): void {
  const world: number[] = [0, 0, 0];
  const sample: Sample = { x: 0, y: 0, z: 0 };

  for (const node of document.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;

    for (const primitive of mesh.listPrimitives()) {
      const attribute = primitive.getAttribute('POSITION');
      if (!attribute) continue;

      const place = vertexPlacer(node, primitive);
      const count = attribute.getCount();

      for (let index = 0; index < count; index += 1) {
        place(index, world);
        sample.x = world[0] ?? 0;
        sample.y = world[1] ?? 0;
        sample.z = world[2] ?? 0;
        visit(sample, node);
      }
    }
  }
}

export type Triangle = readonly [Sample, Sample, Sample];

/**
 * Walks every triangle in the scene once, in world space.
 *
 * Vertices alone are not enough. A road is four points and two triangles:
 * sampling its corners marks four cells out of the twenty thousand the road
 * actually covers, and the first version of this file duly reported that
 * twenty-two cells of the street were walkable.
 */
export function forEachTriangle(
  document: Document,
  visit: (triangle: Triangle, node: Node) => void,
): void {
  const world: number[] = [0, 0, 0];
  const corners: Sample[] = [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
  ];

  for (const node of document.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;

    for (const primitive of mesh.listPrimitives()) {
      const attribute = primitive.getAttribute('POSITION');
      if (!attribute) continue;

      const place = vertexPlacer(node, primitive);
      const indices = primitive.getIndices();
      const count = indices ? indices.getCount() : attribute.getCount();

      for (let index = 0; index + 2 < count; index += 3) {
        for (let corner = 0; corner < 3; corner += 1) {
          const vertex = indices ? indices.getScalar(index + corner) : index + corner;
          place(vertex, world);

          const target = corners[corner] as Sample;
          target.x = world[0] ?? 0;
          target.y = world[1] ?? 0;
          target.z = world[2] ?? 0;
        }

        visit(corners as unknown as Triangle, node);
      }
    }
  }
}

export interface WalkableOptions {
  /** Ignore anything above this: rooftops, chimneys, the sky. */
  ceiling: number;
  /**
   * The band a floor may be in, relative to `floorAt` when it is given and to
   * the lowest ground in the scene otherwise.
   *
   * Buildings have foundations that reach well below the pavement, and the
   * lowest surface in a cell is otherwise the bottom of a wall rather than
   * the street. Anything outside this band is treated as structure.
   */
  floorBand: [number, number];
  /**
   * World height the band is measured from.
   *
   * An outdoor scene can take the scene's own minimum: the street is the
   * lowest thing in it. An interior that ships with scenery cannot — the loft
   * comes ringed by skyscrapers whose bases hang eight metres below its floor,
   * and the minimum then names a rooftop in the distance rather than the room.
   */
  floorAt?: number;
}

/**
 * Rasterises one triangle into the grid, calling back with the height at the
 * centre of every cell it covers.
 *
 * Cell centres rather than corners, and a real inside test rather than the
 * triangle's bounding box: a road is two long diagonal triangles, and filling
 * their boxes would pave the buildings on both sides of the street.
 */
function rasterise(
  triangle: Triangle,
  origin: [number, number],
  width: number,
  height: number,
  visit: (cell: number, y: number) => void,
): void {
  const [a, b, c] = triangle;

  const minX = Math.min(a.x, b.x, c.x);
  const maxX = Math.max(a.x, b.x, c.x);
  const minZ = Math.min(a.z, b.z, c.z);
  const maxZ = Math.max(a.z, b.z, c.z);

  const x0 = Math.max(0, Math.floor((minX - origin[0]) / CELL_SIZE));
  const x1 = Math.min(width - 1, Math.floor((maxX - origin[0]) / CELL_SIZE));
  const z0 = Math.max(0, Math.floor((minZ - origin[1]) / CELL_SIZE));
  const z1 = Math.min(height - 1, Math.floor((maxZ - origin[1]) / CELL_SIZE));
  if (x1 < x0 || z1 < z0) return;

  const area = (b.x - a.x) * (c.z - a.z) - (c.x - a.x) * (b.z - a.z);

  // A triangle seen exactly edge-on from above covers no cells. Its vertical
  // faces still matter, so the tiny box it projects to is filled instead.
  if (Math.abs(area) < 1e-9) {
    for (let z = z0; z <= z1; z += 1) {
      for (let x = x0; x <= x1; x += 1) {
        visit(z * width + x, Math.min(a.y, b.y, c.y));
      }
    }
    return;
  }

  for (let z = z0; z <= z1; z += 1) {
    const pz = origin[1] + (z + 0.5) * CELL_SIZE;

    for (let x = x0; x <= x1; x += 1) {
      const px = origin[0] + (x + 0.5) * CELL_SIZE;

      const w0 = ((b.x - px) * (c.z - pz) - (c.x - px) * (b.z - pz)) / area;
      const w1 = ((c.x - px) * (a.z - pz) - (a.x - px) * (c.z - pz)) / area;
      const w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;

      visit(z * width + x, w0 * a.y + w1 * b.y + w2 * c.y);
    }
  }
}

/**
 * Builds the grid.
 *
 * Two passes over the geometry: the first finds the floor in each cell, the
 * second asks whether anything stands on that floor between shin height and
 * head height.
 */
export function buildWalkableGrid(document: Document, options: WalkableOptions): WalkableGrid {
  let minX = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;
  let minY = Infinity;

  forEachVertex(document, (sample) => {
    if (sample.y > options.ceiling) return;
    if (sample.x < minX) minX = sample.x;
    if (sample.z < minZ) minZ = sample.z;
    if (sample.x > maxX) maxX = sample.x;
    if (sample.z > maxZ) maxZ = sample.z;
    if (sample.y < minY) minY = sample.y;
  });

  const width = Math.ceil((maxX - minX) / CELL_SIZE) + 1;
  const height = Math.ceil((maxZ - minZ) / CELL_SIZE) + 1;
  const cells = width * height;
  const origin: [number, number] = [minX, minZ];

  const datum = options.floorAt ?? minY;
  const floorLow = datum + options.floorBand[0];
  const floorHigh = datum + options.floorBand[1];

  const floor = new Float32Array(cells).fill(Infinity);
  const blocked = new Uint8Array(cells);

  forEachTriangle(document, (triangle) => {
    rasterise(triangle, origin, width, height, (cell, y) => {
      if (y < floorLow || y > floorHigh) return;
      if (y < (floor[cell] ?? Infinity)) floor[cell] = y;
    });
  });

  forEachTriangle(document, (triangle) => {
    rasterise(triangle, origin, width, height, (cell, y) => {
      if (y > options.ceiling) return;

      const base = floor[cell] ?? Infinity;
      if (!Number.isFinite(base)) return;

      const above = y - base;
      if (above > STEP_HEIGHT && above < HEAD_ROOM) blocked[cell] = 1;
    });
  });

  const open = new Uint8Array(cells);
  for (let cell = 0; cell < cells; cell += 1) {
    open[cell] = Number.isFinite(floor[cell] ?? Infinity) && !blocked[cell] ? 1 : 0;
  }

  // Keep a body's width away from every wall, so the camera does not press its
  // near plane into the stonework.
  const clear = new Uint8Array(open);
  for (let z = 0; z < height; z += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!open[z * width + x]) continue;

      for (let dz = -BODY_CELLS; dz <= BODY_CELLS && clear[z * width + x]; dz += 1) {
        for (let dx = -BODY_CELLS; dx <= BODY_CELLS; dx += 1) {
          const nx = x + dx;
          const nz = z + dz;
          if (nx < 0 || nz < 0 || nx >= width || nz >= height || !open[nz * width + nx]) {
            clear[z * width + x] = 0;
            break;
          }
        }
      }
    }
  }

  // The street is the biggest piece of connected floor in the scene. A roof
  // terrace is flat, unobstructed and completely unreachable, and a courtyard
  // behind a locked door is worse — it looks reachable on a map and is not. So
  // rather than trusting a hand-picked seed, every component is measured and
  // the largest one wins.
  const mask = largestComponent(clear, floor, width, height);

  // Ground heights are shipped as centimetres in a byte: two and a half metres
  // of range at one centimetre, which is finer than anyone can feel underfoot.
  //
  // Measured from the lowest walkable floor, not from the lowest point in the
  // scene — that is a foundation eight metres down, and every height in the
  // street would saturate the byte and put the buyer underground.
  let groundBase = Infinity;
  for (let cell = 0; cell < cells; cell += 1) {
    if (!mask[cell]) continue;
    const value = floor[cell] ?? Infinity;
    if (value < groundBase) groundBase = value;
  }
  if (!Number.isFinite(groundBase)) groundBase = minY;

  const ground = new Uint8Array(cells);
  for (let cell = 0; cell < cells; cell += 1) {
    const value = Math.round(((floor[cell] ?? groundBase) - groundBase) * 100);
    ground[cell] = Math.max(0, Math.min(255, value));
  }

  return { origin, cell: CELL_SIZE, width, height, mask, ground, groundBase };
}

/**
 * Flood-fills every component and keeps the biggest.
 *
 * Steps up to `STEP_HEIGHT` join two cells; anything more is a wall between
 * them, which is what stops a pavement from connecting to the first-floor
 * balcony directly above it.
 */
function largestComponent(
  clear: Uint8Array,
  floor: Float32Array,
  width: number,
  height: number,
): Uint8Array {
  const cells = width * height;
  const label = new Int32Array(cells).fill(-1);
  const sizes: number[] = [];

  for (let seed = 0; seed < cells; seed += 1) {
    if (!clear[seed] || (label[seed] ?? 0) >= 0) continue;

    const id = sizes.length;
    const queue = [seed];
    label[seed] = id;
    let size = 0;

    while (queue.length > 0) {
      const cell = queue.pop() as number;
      size += 1;

      const x = cell % width;
      const z = (cell - x) / width;

      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = x + dx;
        const nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= width || nz >= height) continue;

        const next = nz * width + nx;
        if (!clear[next] || (label[next] ?? 0) >= 0) continue;
        if (Math.abs((floor[next] ?? 0) - (floor[cell] ?? 0)) > STEP_HEIGHT) continue;

        label[next] = id;
        queue.push(next);
      }
    }

    sizes.push(size);
  }

  let best = -1;
  let bestSize = 0;
  sizes.forEach((size, id) => {
    if (size > bestSize) {
      bestSize = size;
      best = id;
    }
  });

  const mask = new Uint8Array(cells);
  for (let cell = 0; cell < cells; cell += 1) mask[cell] = label[cell] === best ? 1 : 0;
  return mask;
}

export function countWalkable(grid: WalkableGrid): number {
  let total = 0;
  for (const cell of grid.mask) total += cell;
  return total;
}

/**
 * Packs the walkable mask one bit to a cell.
 *
 * A whole Parisian block is eighteen kilobytes this way and a hundred and
 * thirty as bytes, which matters because the browser downloads it before it
 * can let anyone walk.
 */
export function packMask(grid: WalkableGrid): Uint8Array {
  const packed = new Uint8Array(Math.ceil(grid.mask.length / 8));
  for (let cell = 0; cell < grid.mask.length; cell += 1) {
    if (grid.mask[cell]) {
      const byte = cell >> 3;
      packed[byte] = (packed[byte] ?? 0) | (1 << (cell & 7));
    }
  }
  return packed;
}
