import { describe, expect, it } from 'vitest';
import { movementFromKeys } from './input.js';

describe('movementFromKeys', () => {
  it('stands still with nothing held', () => {
    expect(movementFromKeys(new Set())).toEqual({ x: 0, y: 0 });
  });

  it('walks forward on either W or the arrow key', () => {
    expect(movementFromKeys(new Set(['KeyW']))).toEqual({ x: 0, y: 1 });
    expect(movementFromKeys(new Set(['ArrowUp']))).toEqual({ x: 0, y: 1 });
  });

  it('cancels opposite keys instead of drifting', () => {
    expect(movementFromKeys(new Set(['KeyW', 'KeyS']))).toEqual({ x: 0, y: 0 });
  });

  it('normalises a diagonal, so walking north-east is not faster than north', () => {
    const diagonal = movementFromKeys(new Set(['KeyW', 'KeyD']));
    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(1);
  });

  it('ignores keys it does not bind', () => {
    expect(movementFromKeys(new Set(['KeyQ', 'Space']))).toEqual({ x: 0, y: 0 });
  });
});
