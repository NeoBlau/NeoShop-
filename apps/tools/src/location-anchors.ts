/**
 * Finds the shop fronts in a location.
 *
 * The street was modelled with shops in it: eight painted signs over eight
 * doorways, each one already in the right place with the right lighting on it.
 * Rather than inventing supplier slots and hoping they land somewhere sensible,
 * the build reads those signs and hands their positions to the scene, so a
 * supplier's stand appears under a sign that was painted for a shop.
 *
 * The direction each one faces is measured rather than guessed: the street is
 * whichever way you can walk from the doorway, and the walkable grid already
 * knows that.
 */
import type { Document } from '@gltf-transform/core';
import { forEachVertex, type WalkableGrid } from './location-walkable.js';

export interface LocationAnchor {
  name: string;
  /** Centre of the shop sign. */
  sign: [number, number, number];
  /** Where a supplier's display stands: on the pavement, facing the street. */
  stand: [number, number, number];
  /** Radians about Y. Zero looks down -Z, matching the renderer. */
  facing: number;
}

const DIRECTIONS = 48;
const RAY_METRES = 12;

function sampleWalkable(grid: WalkableGrid, x: number, z: number): boolean {
  const cx = Math.floor((x - grid.origin[0]) / grid.cell);
  const cz = Math.floor((z - grid.origin[1]) / grid.cell);
  if (cx < 0 || cz < 0 || cx >= grid.width || cz >= grid.height) return false;
  return grid.mask[cz * grid.width + cx] === 1;
}

function groundAt(grid: WalkableGrid, x: number, z: number): number {
  const cx = Math.floor((x - grid.origin[0]) / grid.cell);
  const cz = Math.floor((z - grid.origin[1]) / grid.cell);
  if (cx < 0 || cz < 0 || cx >= grid.width || cz >= grid.height) return grid.groundBase;
  return grid.groundBase + (grid.ground[cz * grid.width + cx] ?? 0) / 100;
}

/** How far around a doorway counts as "in front of it". */
const FRONTAGE_RADIUS = 6;

/**
 * Which way does this shop front face?
 *
 * The open pavement near a doorway is all on one side of it, so the average
 * direction of the walkable ground around it points away from the wall. That
 * is the answer.
 *
 * The obvious alternative — fire rays and keep the longest — was tried first
 * and is wrong in a way that is not obvious until you stand in it: the longest
 * clear run from any doorway on a street runs *along* the street, so every
 * shop ended up facing its neighbour and the buyer spawned with their nose
 * against the glass.
 */
function faceTheStreet(
  grid: WalkableGrid,
  from: { x: number; z: number },
): { facing: number; stand: { x: number; z: number } } | null {
  let sumX = 0;
  let sumZ = 0;
  let seen = 0;

  const step = grid.cell;

  for (let dz = -FRONTAGE_RADIUS; dz <= FRONTAGE_RADIUS; dz += step) {
    for (let dx = -FRONTAGE_RADIUS; dx <= FRONTAGE_RADIUS; dx += step) {
      const distance = Math.hypot(dx, dz);
      if (distance < 0.5 || distance > FRONTAGE_RADIUS) continue;
      if (!sampleWalkable(grid, from.x + dx, from.z + dz)) continue;

      // Weighted towards the near ground: the pavement immediately outside the
      // door says more about which way the shop faces than the road does.
      const weight = 1 / distance;
      sumX += (dx / distance) * weight;
      sumZ += (dz / distance) * weight;
      seen += 1;
    }
  }

  if (seen < 12) return null;

  const length = Math.hypot(sumX, sumZ);
  if (length < 1e-6) return null;

  const facing = Math.atan2(sumX / length, sumZ / length);

  // Far enough out that a buyer can stand in front of the display and still
  // have the shop front behind it, close enough that it belongs to that shop.
  let out = 0;
  for (let distance = 1; distance <= 3.4; distance += 0.25) {
    if (
      !sampleWalkable(
        grid,
        from.x + Math.sin(facing) * distance,
        from.z + Math.cos(facing) * distance,
      )
    ) {
      break;
    }
    out = distance;
  }

  if (out < 1.5) return null;

  return {
    facing,
    stand: { x: from.x + Math.sin(facing) * out, z: from.z + Math.cos(facing) * out },
  };
}

export function findAnchors(
  document: Document,
  grid: WalkableGrid,
  pattern = /ShopSign/i,
): LocationAnchor[] {
  const boxes = new Map<string, { min: number[]; max: number[] }>();

  forEachVertex(document, (sample, node) => {
    const name = node.getName() ?? '';
    if (!pattern.test(name)) return;

    const box = boxes.get(name) ?? {
      min: [Infinity, Infinity, Infinity],
      max: [-Infinity, -Infinity, -Infinity],
    };
    const point = [sample.x, sample.y, sample.z];

    for (let axis = 0; axis < 3; axis += 1) {
      box.min[axis] = Math.min(box.min[axis] ?? Infinity, point[axis] ?? 0);
      box.max[axis] = Math.max(box.max[axis] ?? -Infinity, point[axis] ?? 0);
    }

    boxes.set(name, box);
  });

  const anchors: LocationAnchor[] = [];

  for (const [name, box] of boxes) {
    const centre = {
      x: ((box.min[0] ?? 0) + (box.max[0] ?? 0)) / 2,
      y: ((box.min[1] ?? 0) + (box.max[1] ?? 0)) / 2,
      z: ((box.min[2] ?? 0) + (box.max[2] ?? 0)) / 2,
    };

    const facing = faceTheStreet(grid, centre);
    if (!facing) continue;

    anchors.push({
      name: name.replace(/^Bistro_Research_Exterior_?/, '').replace(/_\d+$/, ''),
      sign: [centre.x, centre.y, centre.z],
      stand: [facing.stand.x, groundAt(grid, facing.stand.x, facing.stand.z), facing.stand.z],
      facing: facing.facing,
    });
  }

  // A stable order, so two builds of the same scene agree. The caller sorts
  // again by distance from the spawn once it knows where that is.
  anchors.sort((a, b) => a.name.localeCompare(b.name));
  return anchors;
}

/** Metres of open ground a spawn needs around it. */
const SPAWN_CLEARANCE = 3.5;

/** How far from the shops the buyer may be put down. */
const SPAWN_RADIUS = 45;

/**
 * Where the buyer arrives, and which way they are looking.
 *
 * In the open, among the shops, facing down the street. Two things are being
 * avoided: arriving in a doorway, where the opening frame is a wall; and
 * arriving somewhere technically walkable but boxed in, where the first
 * impression of the world is that there is nowhere to go.
 */
export function findSpawn(
  grid: WalkableGrid,
  anchors: LocationAnchor[],
): { position: [number, number, number]; yaw: number } {
  if (anchors.length === 0) {
    return { position: [grid.origin[0], grid.groundBase, grid.origin[1]], yaw: 0 };
  }

  const centre = {
    x: anchors.reduce((sum, anchor) => sum + anchor.stand[0], 0) / anchors.length,
    z: anchors.reduce((sum, anchor) => sum + anchor.stand[2], 0) / anchors.length,
  };

  let best: { x: number; z: number } | null = null;
  let bestScore = -Infinity;

  for (let dz = -SPAWN_RADIUS; dz <= SPAWN_RADIUS; dz += grid.cell * 2) {
    for (let dx = -SPAWN_RADIUS; dx <= SPAWN_RADIUS; dx += grid.cell * 2) {
      const x = centre.x + dx;
      const z = centre.z + dz;
      if (!sampleWalkable(grid, x, z)) continue;

      const clearance = clearanceAt(grid, x, z, SPAWN_CLEARANCE);
      if (clearance < SPAWN_CLEARANCE) continue;

      // Open ground first, then closeness to the shops: standing in the middle
      // of a square nobody trades on is not an arrival, it is a lobby.
      const score = clearance * 10 - Math.hypot(dx, dz);
      if (score > bestScore) {
        bestScore = score;
        best = { x, z };
      }
    }
  }

  const landing = best ?? { x: anchors[0]?.stand[0] ?? 0, z: anchors[0]?.stand[2] ?? 0 };

  return {
    position: [landing.x, groundAt(grid, landing.x, landing.z), landing.z],
    yaw: longestRun(grid, landing),
  };
}

/** How much open ground surrounds a point, up to a limit. */
function clearanceAt(grid: WalkableGrid, x: number, z: number, limit: number): number {
  for (let radius = grid.cell; radius <= limit; radius += grid.cell) {
    for (let step = 0; step < 16; step += 1) {
      const angle = (step / 16) * Math.PI * 2;
      if (!sampleWalkable(grid, x + Math.sin(angle) * radius, z + Math.cos(angle) * radius)) {
        return radius - grid.cell;
      }
    }
  }
  return limit;
}

/**
 * The direction with the most street ahead of it.
 *
 * Here the longest clear run is exactly what is wanted — the opening view
 * should look along the street, not across it into a wall four metres away.
 */
function longestRun(grid: WalkableGrid, from: { x: number; z: number }): number {
  let bestAngle = 0;
  let bestRun = 0;

  for (let step = 0; step < DIRECTIONS; step += 1) {
    const angle = (step / DIRECTIONS) * Math.PI * 2;
    const dx = Math.sin(angle);
    const dz = Math.cos(angle);

    let run = 0;
    for (let distance = 1; distance <= RAY_METRES * 4; distance += 0.5) {
      if (!sampleWalkable(grid, from.x + dx * distance, from.z + dz * distance)) break;
      run = distance;
    }

    if (run > bestRun) {
      bestRun = run;
      bestAngle = angle;
    }
  }

  return bestAngle;
}
