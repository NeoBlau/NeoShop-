import type { PavilionDimensions } from './Pavilion.js';

/**
 * Where the plinths stand inside a hall.
 *
 * Two rows along the side walls with a clear central aisle: the layout of
 * every gallery and every good shop, for the same reason — the buyer walks a
 * line and every product is presented side-on with space around it. Overflow
 * goes to a back row rather than crowding the aisle.
 */

export interface StandPlacement {
  position: [number, number, number];
  /** Radians. Stands face the aisle so labels are readable while walking. */
  rotationY: number;
}

const AISLE_HALF_WIDTH = 3.2;
const ROW_SPACING = 3.6;
const WALL_MARGIN = 2.6;

export function standPlacements(count: number, dimensions: PavilionDimensions): StandPlacement[] {
  if (count === 0) return [];

  const usableDepth = dimensions.depth - WALL_MARGIN * 2;
  const perRow = Math.max(1, Math.floor(usableDepth / ROW_SPACING) + 1);
  const placements: StandPlacement[] = [];

  for (let index = 0; index < count; index += 1) {
    const row = index % 2 === 0 ? -1 : 1;
    const slot = Math.floor(index / 2);

    if (slot < perRow) {
      const z = dimensions.depth / 2 - WALL_MARGIN - slot * ROW_SPACING;
      placements.push({
        position: [row * AISLE_HALF_WIDTH, 0, z],
        rotationY: row === -1 ? Math.PI / 2 : -Math.PI / 2,
      });
      continue;
    }

    // Back row, facing the entrance. The spacing is derived from how many
    // stands actually land here, not from a guess at the total: an earlier
    // version divided by a third of the product count and pushed the last
    // plinths of a large pavilion straight through the side wall.
    const backIndex = index - perRow * 2;
    const backCount = count - perRow * 2;
    const usableWidth = dimensions.width - WALL_MARGIN * 2;
    const step = backCount > 1 ? usableWidth / (backCount - 1) : 0;

    placements.push({
      position: [
        backCount > 1 ? -usableWidth / 2 + backIndex * step : 0,
        0,
        -dimensions.depth / 2 + WALL_MARGIN,
      ],
      rotationY: 0,
    });
  }

  return placements;
}

/** The rectangle the buyer may walk in, across every pavilion in the world. */
export function worldBounds(
  pavilionCentres: number[],
  dimensions: PavilionDimensions,
): { minX: number; maxX: number; minZ: number; maxZ: number } {
  const margin = 0.9;

  if (pavilionCentres.length === 0) {
    return {
      minX: -dimensions.width / 2 + margin,
      maxX: dimensions.width / 2 - margin,
      minZ: -dimensions.depth / 2 + margin,
      maxZ: dimensions.depth / 2 - margin,
    };
  }

  return {
    minX: Math.min(...pavilionCentres) - dimensions.width / 2 + margin,
    maxX: Math.max(...pavilionCentres) + dimensions.width / 2 - margin,
    minZ: -dimensions.depth / 2 + margin,
    // The promenade in front of the halls, where the buyer walks between them.
    maxZ: dimensions.depth / 2 + 12,
  };
}
