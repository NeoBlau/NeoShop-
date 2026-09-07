import { describe, expect, it } from 'vitest';
import {
  cellAt,
  groundAt,
  isWalkable,
  nearestWalkable,
  resolveMove,
  type NavigationGrid,
} from './navigation.js';

/**
 * A small hand-built map, so the tests say what they mean.
 *
 * Each string is a row of half-metre cells: `.` walkable, `#` not. Row zero is
 * the lowest Z. The optional heights give a centimetre value per cell.
 */
function gridFrom(rows: string[], heights?: number[][]): NavigationGrid {
  const width = rows[0]?.length ?? 0;
  const height = rows.length;
  const cells = width * height;

  const mask = new Uint8Array(Math.ceil(cells / 8));
  const ground = new Uint8Array(cells);

  rows.forEach((row, z) => {
    [...row].forEach((glyph, x) => {
      const cell = z * width + x;
      if (glyph === '.') mask[cell >> 3] = (mask[cell >> 3] ?? 0) | (1 << (cell & 7));
      ground[cell] = heights?.[z]?.[x] ?? 0;
    });
  });

  return { origin: [0, 0], cell: 0.5, width, height, groundBase: 1, mask, ground };
}

/** A corridor with a doorway in the middle of its north wall. */
const STREET = gridFrom([
  '##########',
  '#........#',
  '#........#',
  '####..####',
  '###....###',
  '##########',
]);

describe('cellAt', () => {
  it('maps a world position to a cell, and refuses positions off the map', () => {
    expect(cellAt(STREET, 0.25, 0.25)).toBe(0);
    expect(cellAt(STREET, 0.75, 0.25)).toBe(1);
    expect(cellAt(STREET, -0.1, 0.25)).toBe(-1);
    expect(cellAt(STREET, 99, 0.25)).toBe(-1);
  });
});

describe('isWalkable', () => {
  it('reads the bit for a cell', () => {
    // Row 1, column 1 is open; row 0 is all wall.
    expect(isWalkable(STREET, 0.75, 0.75)).toBe(true);
    expect(isWalkable(STREET, 0.75, 0.25)).toBe(false);
  });

  it('treats everything outside the map as solid', () => {
    expect(isWalkable(STREET, -5, -5)).toBe(false);
    expect(isWalkable(STREET, 500, 500)).toBe(false);
  });
});

describe('groundAt', () => {
  it('returns centimetres above the datum', () => {
    const stepped = gridFrom(
      ['..', '..'],
      [
        [0, 40],
        [12, 255],
      ],
    );

    expect(groundAt(stepped, 0.25, 0.25)).toBeCloseTo(1);
    expect(groundAt(stepped, 0.75, 0.25)).toBeCloseTo(1.4);
    expect(groundAt(stepped, 0.25, 0.75)).toBeCloseTo(1.12);
    expect(groundAt(stepped, 0.75, 0.75)).toBeCloseTo(3.55);
  });

  it('falls back to the datum off the map, rather than to NaN', () => {
    expect(groundAt(STREET, -20, -20)).toBe(1);
  });
});

describe('resolveMove', () => {
  it('takes a step in the open', () => {
    const moved = resolveMove(STREET, 1.5, 1.0, 1.6, 1.1);
    expect(moved.x).toBeCloseTo(1.6);
    expect(moved.z).toBeCloseTo(1.1);
  });

  it('stops at a wall instead of passing through it', () => {
    const moved = resolveMove(STREET, 1.5, 0.75, 1.5, 0.1);
    expect(moved.z).toBeGreaterThan(0.5);
  });

  it('slides along a wall rather than sticking to it', () => {
    // Walking diagonally into the north wall: the sideways part survives.
    const moved = resolveMove(STREET, 1.5, 0.75, 1.9, 0.35);
    expect(moved.x).toBeCloseTo(1.9);
    expect(moved.z).toBeGreaterThan(0.5);
    expect(isWalkable(STREET, moved.x, moved.z)).toBe(true);
  });

  it('walks through a doorway that a single step would have jumped', () => {
    // A whole metre in one frame — what a slow device produces — and the
    // doorway is one cell wide. Sub-stepping is what makes this land inside.
    const moved = resolveMove(STREET, 2.25, 1.4, 2.25, 2.4);
    expect(moved.z).toBeGreaterThan(1.9);
    expect(isWalkable(STREET, moved.x, moved.z)).toBe(true);
  });

  it('never lands on a solid cell, however far the step', () => {
    for (const distance of [0.3, 1, 4, 40]) {
      const moved = resolveMove(STREET, 1.5, 1.0, 1.5 + distance, 1.0 + distance);
      expect(isWalkable(STREET, moved.x, moved.z)).toBe(true);
    }
  });

  it('comes to rest against the corner when both axes are blocked', () => {
    const corner = { x: 0.75, z: 0.75 };
    const moved = resolveMove(STREET, corner.x, corner.z, corner.x - 2, corner.z - 2);

    // It creeps to the edge of its own cell and stops there — the map has
    // half-metre resolution, so "stopped" means "did not leave the cell".
    expect(moved.x).toBeGreaterThanOrEqual(0.5);
    expect(moved.z).toBeGreaterThanOrEqual(0.5);
    expect(moved.x).toBeLessThanOrEqual(corner.x);
    expect(isWalkable(STREET, moved.x, moved.z)).toBe(true);
  });
});

describe('nearestWalkable', () => {
  it('leaves a point that is already fine', () => {
    expect(nearestWalkable(STREET, 1.5, 1.0)).toEqual({ x: 1.5, z: 1.0 });
  });

  it('pulls a point inside the wall onto the nearest floor', () => {
    const rescued = nearestWalkable(STREET, 0.25, 0.25);
    expect(rescued).not.toBeNull();
    expect(isWalkable(STREET, rescued?.x ?? 0, rescued?.z ?? 0)).toBe(true);
  });

  it('gives up rather than searching the whole map', () => {
    const solid = gridFrom(['###', '###']);
    expect(nearestWalkable(solid, 0.5, 0.5, 2)).toBeNull();
  });
});
