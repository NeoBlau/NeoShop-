import { describe, expect, it } from 'vitest';
import { standPlacements, worldBounds } from './layout.js';
import { DEFAULT_PAVILION } from './Pavilion.js';

describe('standPlacements', () => {
  it('places nothing for an empty pavilion', () => {
    expect(standPlacements(0, DEFAULT_PAVILION)).toEqual([]);
  });

  it('alternates sides so the aisle stays clear', () => {
    const placements = standPlacements(4, DEFAULT_PAVILION);
    const sides = placements.map((placement) => Math.sign(placement.position[0]));
    expect(sides).toEqual([-1, 1, -1, 1]);
  });

  it('turns each stand towards the aisle', () => {
    const [left, right] = standPlacements(2, DEFAULT_PAVILION);
    expect(left?.rotationY).toBeCloseTo(Math.PI / 2);
    expect(right?.rotationY).toBeCloseTo(-Math.PI / 2);
  });

  it('keeps every stand inside the walls', () => {
    for (const placement of standPlacements(20, DEFAULT_PAVILION)) {
      expect(Math.abs(placement.position[0])).toBeLessThan(DEFAULT_PAVILION.width / 2);
      expect(Math.abs(placement.position[2])).toBeLessThan(DEFAULT_PAVILION.depth / 2);
    }
  });

  it('spaces the side rows evenly along the hall', () => {
    const placements = standPlacements(6, DEFAULT_PAVILION);
    const leftRow = placements.filter((placement) => placement.position[0] < 0);
    const gaps = leftRow.slice(1).map((placement, index) => {
      const previous = leftRow[index];
      return previous ? previous.position[2] - placement.position[2] : 0;
    });

    for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0] ?? 0);
  });
});

describe('worldBounds', () => {
  it('spans every pavilion plus the promenade in front', () => {
    const bounds = worldBounds([0, 34], DEFAULT_PAVILION);

    expect(bounds.minX).toBeLessThan(0);
    expect(bounds.maxX).toBeGreaterThan(34);
    // The buyer may step out of the halls, but not through the back wall.
    expect(bounds.maxZ).toBeGreaterThan(DEFAULT_PAVILION.depth / 2);
    expect(bounds.minZ).toBeGreaterThan(-DEFAULT_PAVILION.depth / 2);
  });

  it('falls back to one hall when the world is empty', () => {
    const bounds = worldBounds([], DEFAULT_PAVILION);
    expect(bounds.maxX).toBeLessThan(DEFAULT_PAVILION.width / 2);
  });
});
