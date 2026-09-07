/**
 * Where a person may walk in the location, and how high the ground is there.
 *
 * The map is built from the location's own geometry at build time (see
 * `apps/tools/src/location-walkable.ts`) and arrives as one bit per half-metre
 * cell plus one byte of height. A whole Parisian block is eighteen kilobytes
 * of mask — cheaper than a single texture, and exact where a hand-written list
 * of rectangles would be a guess with kerbs in it.
 *
 * Nothing here touches three.js: it is arithmetic over a bitmap, which is why
 * it can be tested without a renderer.
 */

export interface NavigationGrid {
  /** World position of the first cell's corner, on the X and Z axes. */
  origin: [number, number];
  /** Cell size in metres. */
  cell: number;
  width: number;
  height: number;
  /** Heights are stored as centimetres above this. */
  groundBase: number;
  /** One bit per cell, least significant bit first. */
  mask: Uint8Array;
  /** One byte per cell. */
  ground: Uint8Array;
}

/** Cell index for a world position, or -1 when it is off the map. */
export function cellAt(grid: NavigationGrid, x: number, z: number): number {
  const cx = Math.floor((x - grid.origin[0]) / grid.cell);
  const cz = Math.floor((z - grid.origin[1]) / grid.cell);
  if (cx < 0 || cz < 0 || cx >= grid.width || cz >= grid.height) return -1;
  return cz * grid.width + cx;
}

export function isWalkable(grid: NavigationGrid, x: number, z: number): boolean {
  const cell = cellAt(grid, x, z);
  if (cell < 0) return false;
  const byte = grid.mask[cell >> 3];
  return byte !== undefined && (byte & (1 << (cell & 7))) !== 0;
}

/** Height of the pavement under a point. Off the map, the datum. */
export function groundAt(grid: NavigationGrid, x: number, z: number): number {
  const cell = cellAt(grid, x, z);
  if (cell < 0) return grid.groundBase;
  return grid.groundBase + (grid.ground[cell] ?? 0) / 100;
}

/**
 * The longest step collision is tested over.
 *
 * Doorways here are barely wider than a person, and testing only where a step
 * lands would let a fast walker on a slow device cross a wall in one frame.
 * That bug would appear exactly where it is least welcome — on the weakest
 * hardware — so a move is cut into pieces shorter than the thinnest wall.
 */
const MAX_STEP = 0.2;

/** One step, with a blocked diagonal retried one axis at a time. */
function slide(
  grid: NavigationGrid,
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
): { x: number; z: number } {
  if (isWalkable(grid, toX, toZ)) return { x: toX, z: toZ };
  if (isWalkable(grid, toX, fromZ)) return { x: toX, z: fromZ };
  if (isWalkable(grid, fromX, toZ)) return { x: fromX, z: toZ };
  return { x: fromX, z: fromZ };
}

/**
 * Moves a body from one point towards another, stopping at walls.
 *
 * Sliding is what makes a person scrape along a shop front to find the door
 * rather than sticking to the glass where they first touched it — the
 * behaviour anyone who has played a first-person game already expects.
 */
export function resolveMove(
  grid: NavigationGrid,
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
): { x: number; z: number } {
  const dx = toX - fromX;
  const dz = toZ - fromZ;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / MAX_STEP));

  let x = fromX;
  let z = fromZ;

  for (let step = 0; step < steps; step += 1) {
    const next = slide(grid, x, z, x + dx / steps, z + dz / steps);
    // Both axes refused: there is nowhere further to go this frame.
    if (next.x === x && next.z === z) break;
    x = next.x;
    z = next.z;
  }

  return { x, z };
}

/**
 * Pulls a point onto walkable ground.
 *
 * Used when something has put the camera somewhere impossible — a spawn from a
 * stale manifest, or a quality change that swapped the location under the
 * player's feet. Spiralling outward finds the nearest legal cell rather than
 * teleporting them to the far end of the street.
 */
export function nearestWalkable(
  grid: NavigationGrid,
  x: number,
  z: number,
  radius = 12,
): { x: number; z: number } | null {
  if (isWalkable(grid, x, z)) return { x, z };

  const steps = Math.ceil(radius / grid.cell);

  for (let ring = 1; ring <= steps; ring += 1) {
    for (let step = -ring; step <= ring; step += 1) {
      const offset = step * grid.cell;
      const edge = ring * grid.cell;

      const candidates = [
        { x: x + offset, z: z - edge },
        { x: x + offset, z: z + edge },
        { x: x - edge, z: z + offset },
        { x: x + edge, z: z + offset },
      ];

      for (const candidate of candidates) {
        if (isWalkable(grid, candidate.x, candidate.z)) return candidate;
      }
    }
  }

  return null;
}
