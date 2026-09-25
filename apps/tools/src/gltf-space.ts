/**
 * Measuring a glTF scene in world space.
 *
 * Shared by the zone build and the props build because both have to answer the
 * same three questions about a file somebody else authored: how big is it,
 * where is its floor, and where is the middle of its footprint. None of those
 * can be read off the header — the transforms have to be walked.
 */
import { forEachTriangle } from './location-walkable.js';
import type { Document, Node as GltfNode } from '@gltf-transform/core';

export type Vec3 = [number, number, number];

export interface Bounds {
  lo: Vec3;
  hi: Vec3;
}

export function triangleCount(document: Document): number {
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
export function sceneBounds(document: Document): Bounds {
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
export function findFloorLevel(document: Document): number {
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
