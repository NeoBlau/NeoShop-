import type { Currency, ShippingQuote } from '@3dsfera/shared';

/**
 * Shipping cost.
 *
 * This is a placeholder with real arithmetic, not a real carrier integration:
 * the brief asks for weight and country, and that is what it uses. It is kept
 * as a pure function over a small table so that swapping in a carrier API
 * later means replacing one call, not unpicking rates from a controller.
 *
 * Everything is in grams and minor currency units. No floats anywhere near a
 * price.
 */

export interface ShippingZone {
  id: string;
  countries: readonly string[] | 'rest-of-world';
  /** Charged before any weight. */
  baseCents: number;
  /** Charged per kilogram, prorated to the gram. */
  perKgCents: number;
  /** Orders above this subtotal ship free. Zero disables it. */
  freeAboveCents: number;
  estimatedDays: { min: number; max: number };
}

/**
 * Zones are ordered from most specific to least; the first match wins, and the
 * last entry is the catch-all.
 */
export const SHIPPING_ZONES: readonly ShippingZone[] = [
  {
    id: 'domestic',
    countries: ['RU'],
    baseCents: 39_000,
    perKgCents: 12_000,
    freeAboveCents: 5_000_000,
    estimatedDays: { min: 2, max: 5 },
  },
  {
    id: 'eaeu',
    countries: ['BY', 'KZ', 'AM', 'KG'],
    baseCents: 89_000,
    perKgCents: 24_000,
    freeAboveCents: 9_000_000,
    estimatedDays: { min: 5, max: 12 },
  },
  {
    id: 'europe',
    countries: ['DE', 'FR', 'IT', 'ES', 'PL', 'NL', 'BE', 'AT', 'CZ', 'FI', 'SE', 'RS', 'TR'],
    baseCents: 189_000,
    perKgCents: 46_000,
    freeAboveCents: 0,
    estimatedDays: { min: 7, max: 18 },
  },
  {
    id: 'international',
    countries: 'rest-of-world',
    baseCents: 279_000,
    perKgCents: 68_000,
    freeAboveCents: 0,
    estimatedDays: { min: 10, max: 30 },
  },
];

/**
 * Packaging allowance. A parcel weighs more than the thing inside it, and
 * carriers bill what they put on the scale.
 */
const PACKAGING_BASE_GRAMS = 250;
const PACKAGING_SHARE = 0.08;

/** Nothing ships heavier than this in one parcel. */
export const MAX_PARCEL_GRAMS = 200_000;

export function zoneFor(country: string): ShippingZone {
  const code = country.toUpperCase();

  for (const zone of SHIPPING_ZONES) {
    if (zone.countries !== 'rest-of-world' && zone.countries.includes(code)) return zone;
  }

  // The catch-all is the last entry by construction; the fallback keeps the
  // return type honest if someone reorders the table.
  return (
    SHIPPING_ZONES[SHIPPING_ZONES.length - 1] ?? {
      id: 'international',
      countries: 'rest-of-world',
      baseCents: 279_000,
      perKgCents: 68_000,
      freeAboveCents: 0,
      estimatedDays: { min: 10, max: 30 },
    }
  );
}

export function billableWeight(itemWeightGrams: number): number {
  return Math.ceil(itemWeightGrams * (1 + PACKAGING_SHARE)) + PACKAGING_BASE_GRAMS;
}

export interface ShippingInput {
  country: string;
  /** Sum of item weight × quantity, in grams. */
  weightGrams: number;
  /** Goods total, used for the free-shipping threshold. */
  subtotalCents: number;
  currency: Currency;
}

export function quoteShipping(input: ShippingInput): ShippingQuote {
  const zone = zoneFor(input.country);
  const weightGrams = billableWeight(input.weightGrams);

  const free = zone.freeAboveCents > 0 && input.subtotalCents >= zone.freeAboveCents;
  const priceCents = free ? 0 : zone.baseCents + Math.ceil((weightGrams * zone.perKgCents) / 1000);

  return {
    weightGrams,
    country: input.country.toUpperCase(),
    zone: zone.id,
    priceCents,
    currency: input.currency,
    estimatedDays: zone.estimatedDays,
  };
}
