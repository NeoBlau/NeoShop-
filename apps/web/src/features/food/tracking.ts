/**
 * The delivery clock.
 *
 * Kept away from React because it is arithmetic over two timestamps, and
 * because a tracking screen is exactly the sort of thing that looks right in
 * development and then quotes "arriving in -3 minutes" to a real buyer at
 * midnight. Everything here is a pure function of (placedAt, etaMinutes, now).
 */
import { DELIVERY_STAGES, stageAt, type DeliveryStage } from '@3dsfera/shared';

export interface DeliveryProgress {
  stage: DeliveryStage;
  /** 0..1 across the whole journey. */
  fraction: number;
  /** Minutes left, never below zero. */
  minutesLeft: number;
  /** Wall-clock arrival, for the "by 19:40" line. */
  arrivesAt: Date;
  done: boolean;
}

export function progressOf(placedAt: number, etaMinutes: number, now: number): DeliveryProgress {
  const total = Math.max(1, etaMinutes) * 60_000;
  const elapsed = Math.max(0, now - placedAt);
  const fraction = Math.min(1, elapsed / total);
  const left = Math.max(0, total - elapsed);

  return {
    stage: stageAt(fraction),
    fraction,
    // Rounded up: a courier who is thirty seconds away is one minute away, and
    // never zero until they are actually there.
    minutesLeft: left === 0 ? 0 : Math.max(1, Math.ceil(left / 60_000)),
    arrivesAt: new Date(placedAt + total),
    done: fraction >= 1,
  };
}

/** Index of a stage, for rendering the step list. */
export function stageIndex(stage: DeliveryStage): number {
  return DELIVERY_STAGES.indexOf(stage);
}

/**
 * Where to draw the courier on the little map.
 *
 * The route is a fixed polyline from the counter to the door; the courier only
 * moves along it during the riding stage, because a scooter that sets off
 * while the kitchen is still frying is the kind of detail that makes the whole
 * screen read as fake.
 */
export function courierAt(progress: DeliveryProgress): { x: number; y: number } {
  const before = ['placed', 'kitchen', 'courier'] as const;
  const ride = before.reduce((sum, stage) => sum + STAGE_FRACTIONS[stage], 0);
  const rideSpan = STAGE_FRACTIONS.riding;
  const along =
    progress.fraction <= ride
      ? 0
      : Math.min(1, (progress.fraction - ride) / Math.max(0.0001, rideSpan));

  return pointOnRoute(along);
}

/** Mirrors STAGE_SHARE, kept local so the map cannot drift from the clock. */
const STAGE_FRACTIONS: Record<DeliveryStage, number> = {
  placed: 0.06,
  kitchen: 0.34,
  courier: 0.1,
  riding: 0.45,
  arrived: 0.05,
};

/** Percentage coordinates, so the SVG can be any size. */
export const ROUTE: readonly { x: number; y: number }[] = [
  { x: 8, y: 78 },
  { x: 26, y: 70 },
  { x: 38, y: 44 },
  { x: 58, y: 38 },
  { x: 70, y: 20 },
  { x: 92, y: 14 },
];

export function pointOnRoute(along: number): { x: number; y: number } {
  const clamped = Math.max(0, Math.min(1, along));
  const spans = ROUTE.length - 1;
  const scaled = clamped * spans;
  const index = Math.min(spans - 1, Math.floor(scaled));
  const weight = scaled - index;

  const from = ROUTE[index] ?? { x: 0, y: 0 };
  const to = ROUTE[index + 1] ?? from;

  return {
    x: from.x + (to.x - from.x) * weight,
    y: from.y + (to.y - from.y) * weight,
  };
}
