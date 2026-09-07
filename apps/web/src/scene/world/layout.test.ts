import { describe, expect, it } from 'vitest';
import { standPlacements } from './layout.js';

describe('standPlacements', () => {
  it('puts a single product straight in front of the shop', () => {
    const [only] = standPlacements(1);

    expect(only?.position).toEqual([0, 0, 0]);
    expect(only?.rotationY).toBe(0);
  });

  it('centres the row on the frontage', () => {
    const placements = standPlacements(4);
    const middle =
      placements.reduce((sum, stand) => sum + stand.position[0], 0) / placements.length;

    expect(middle).toBeCloseTo(0);
  });

  it('spaces the plinths evenly', () => {
    const placements = standPlacements(5);
    const gaps = placements
      .slice(1)
      .map((stand, index) => stand.position[0] - (placements[index]?.position[0] ?? 0));

    for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0] ?? 0);
  });

  it('bows the ends towards the buyer and turns them inward', () => {
    const placements = standPlacements(5);
    const first = placements[0];
    const centre = placements[2];
    const last = placements[4];

    expect(first?.position[2]).toBeGreaterThan(centre?.position[2] ?? 0);
    expect(last?.position[2]).toBeCloseTo(first?.position[2] ?? 0);

    // The plinth on the left turns right and the one on the right turns left.
    expect(first?.rotationY).toBeGreaterThan(0);
    expect(last?.rotationY).toBeLessThan(0);
    expect(centre?.rotationY).toBeCloseTo(0);
  });

  it('keeps a big frontage inside the width of a shop', () => {
    const placements = standPlacements(8);
    const widest = Math.max(...placements.map((stand) => Math.abs(stand.position[0])));

    // Eight products is twice what a demo supplier has, and even then the row
    // must not run past its neighbour's door.
    expect(widest).toBeLessThan(8);
  });

  it('has nothing to place for an empty shop', () => {
    expect(standPlacements(0)).toEqual([]);
  });
});
