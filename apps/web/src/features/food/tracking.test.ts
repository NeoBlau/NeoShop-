import { describe, expect, it } from 'vitest';
import { DELIVERY_STAGES } from '@3dsfera/shared';
import { ROUTE, courierAt, pointOnRoute, progressOf, stageIndex } from './tracking.js';

const PLACED = Date.UTC(2026, 8, 25, 18, 0, 0);

describe('progressOf', () => {
  it('starts at nothing and ends at everything', () => {
    expect(progressOf(PLACED, 20, PLACED).fraction).toBe(0);
    expect(progressOf(PLACED, 20, PLACED + 20 * 60_000).done).toBe(true);
  });

  it('never quotes a negative wait, nor zero before arrival', () => {
    const half = progressOf(PLACED, 20, PLACED + 10 * 60_000);
    expect(half.minutesLeft).toBe(10);

    const nearly = progressOf(PLACED, 20, PLACED + 20 * 60_000 - 1_000);
    expect(nearly.minutesLeft).toBe(1);

    const late = progressOf(PLACED, 20, PLACED + 90 * 60_000);
    expect(late.minutesLeft).toBe(0);
    expect(late.fraction).toBe(1);
  });

  it('ignores a clock that went backwards', () => {
    const early = progressOf(PLACED, 20, PLACED - 60_000);
    expect(early.fraction).toBe(0);
    expect(early.stage).toBe('placed');
  });

  it('survives an eta of zero rather than dividing by it', () => {
    const result = progressOf(PLACED, 0, PLACED + 1_000);
    expect(Number.isFinite(result.fraction)).toBe(true);
  });

  it('names an arrival time an hour hand can point at', () => {
    expect(progressOf(PLACED, 25, PLACED).arrivesAt.getTime()).toBe(PLACED + 25 * 60_000);
  });

  it('walks the stages forward as the minutes pass', () => {
    let previous = -1;
    for (let minute = 0; minute <= 20; minute += 1) {
      const index = stageIndex(progressOf(PLACED, 20, PLACED + minute * 60_000).stage);
      expect(index).toBeGreaterThanOrEqual(previous);
      previous = index;
    }
    expect(previous).toBe(DELIVERY_STAGES.length - 1);
  });
});

describe('the courier on the map', () => {
  it('stays at the counter until the food is on the scooter', () => {
    const kitchen = progressOf(PLACED, 20, PLACED + 3 * 60_000);
    expect(kitchen.stage).toBe('kitchen');
    expect(courierAt(kitchen)).toEqual(ROUTE[0]);
  });

  it('reaches the door by the end', () => {
    const arrived = progressOf(PLACED, 20, PLACED + 20 * 60_000);
    const last = ROUTE[ROUTE.length - 1];
    expect(courierAt(arrived).x).toBeCloseTo(last?.x ?? 0, 3);
  });

  it('moves monotonically along the route', () => {
    let previous = -1;
    for (let step = 0; step <= 50; step += 1) {
      const point = pointOnRoute(step / 50);
      expect(point.x).toBeGreaterThanOrEqual(previous);
      previous = point.x;
    }
  });

  it('clamps a fraction outside the route', () => {
    expect(pointOnRoute(-1)).toEqual(ROUTE[0]);
    expect(pointOnRoute(2)).toEqual(ROUTE[ROUTE.length - 1]);
  });
});
