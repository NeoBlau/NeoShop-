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
import type { Document, Node } from '@gltf-transform/core';

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

/** Walks every vertex in the scene once, in world space. */
export function forEachVertex(
  document: Document,
  visit: (sample: Sample, node: Node) => void,
): void {
  const position: number[] = [0, 0, 0];

  for (const node of document.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;

    const m = worldMatrix(node);

    for (const primitive of mesh.listPrimitives()) {
      const attribute = primitive.getAttribute('POSITION');
      if (!attribute) continue;

      const count = attribute.getCount();
      for (let index = 0; index < count; index += 1) {
        attribute.getElement(index, position);
        const [x = 0, y = 0, z = 0] = position;

        visit(
          {
            x: (m[0] ?? 0) * x + (m[4] ?? 0) * y + (m[8] ?? 0) * z + (m[12] ?? 0),
            y: (m[1] ?? 0) * x + (m[5] ?? 0) * y + (m[9] ?? 0) * z + (m[13] ?? 0),
            z: (m[2] ?? 0) * x + (m[6] ?? 0) * y + (m[10] ?? 0) * z + (m[14] ?? 0),
          },
          node,
        );
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
  const position: number[] = [0, 0, 0];
  const corners: Sample[] = [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
  ];

  for (const node of document.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;

    const m = worldMatrix(node);

    for (const primitive of mesh.listPrimitives()) {
      const attribute = primitive.getAttribute('POSITION');
      if (!attribute) continue;

      const indices = primitive.getIndices();
      const count = indices ? indices.getCount() : attribute.getCount();

      for (let index = 0; index + 2 < count; index += 3) {
        for (let corner = 0; corner < 3; corner += 1) {
          const vertex = indices ? indices.getScalar(index + corner) : index + corner;
          attribute.getElement(vertex, position);
          const [x = 0, y = 0, z = 0] = position;

          const target = corners[corner] as Sample;
          target.x = (m[0] ?? 0) * x + (m[4] ?? 0) * y + (m[8] ?? 0) * z + (m[12] ?? 0);
          target.y = (m[1] ?? 0) * x + (m[5] ?? 0) * y + (m[9] ?? 0) * z + (m[13] ?? 0);
          target.z = (m[2] ?? 0) * x + (m[6] ?? 0) * y + (m[10] ?? 0) * z + (m[14] ?? 0);
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
   * The band a floor may be in, relative to the lowest ground in the scene.
   *
   * Buildings have foundations that reach well below the pavement, and the
   * lowest surface in a cell is otherwise the bottom of a wall rather than
   * the street. Anything outside this band is treated as structure.
   */
  floorBand: [number, number];
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

  const floorLow = minY + options.floorBand[0];
  const floorHigh = minY + options.floorBand[1];

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
