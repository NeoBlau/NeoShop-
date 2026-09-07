/**
 * Where a supplier's plinths stand on the pavement.
 *
 * The location gives each supplier a shop front and a stretch of pavement in
 * front of it. The products are laid out along that frontage in a single row
 * facing the street, which is how a real shop uses its window: side-on, one
 * step from the walker, nothing hidden behind anything else.
 *
 * Coordinates are local to the anchor — the scene rotates the whole group to
 * face the street, so here +Z is "towards the buyer" and +X runs along the
 * shop front.
 */

export interface StandPlacement {
  position: [number, number, number];
  /** Radians. Stands face the street, so this is a nudge, not a turn. */
  rotationY: number;
}

/** Metres between plinth centres. Wide enough that two products never touch. */
const SPACING = 2.1;

/** How far the row bows towards the buyer at its ends. */
const BOW = 0.35;

export function standPlacements(count: number): StandPlacement[] {
  if (count === 0) return [];

  const span = (count - 1) * SPACING;

  return Array.from({ length: count }, (_, index) => {
    const offset = -span / 2 + index * SPACING;
    // A shallow arc rather than a straight line: the products at the ends turn
    // a few degrees inward, so a buyer standing in the middle of the frontage
    // sees every label square-on instead of edge-on.
    const curve = span > 0 ? (offset / (span / 2)) ** 2 : 0;

    return {
      position: [offset, 0, BOW * curve],
      rotationY: span > 0 ? (-offset / (span / 2)) * 0.22 : 0,
    };
  });
}
