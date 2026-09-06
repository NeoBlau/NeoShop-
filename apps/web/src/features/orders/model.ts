import type { Currency, OrderStatus } from '@3dsfera/shared';
import type { CartLine } from '../../stores/cart.js';

/**
 * Cart arithmetic, kept away from the components that display it.
 *
 * Everything is in minor units. The only place a fractional amount exists in
 * this application is the moment a price is rendered for a human.
 */

export function cartSubtotal(lines: CartLine[]): number {
  return lines.reduce((total, line) => total + line.priceCents * line.quantity, 0);
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((total, line) => total + line.quantity, 0);
}

/**
 * The currency the cart is priced in.
 *
 * An order cannot mix currencies — the server refuses one — so the cart warns
 * before checkout rather than after.
 */
export function cartCurrency(lines: CartLine[]): { currency: Currency; mixed: boolean } {
  const currencies = new Set(lines.map((line) => line.currency));
  return {
    currency: lines[0]?.currency ?? 'RUB',
    mixed: currencies.size > 1,
  };
}

/** The shape the checkout endpoint expects. */
export function toCheckoutLines(lines: CartLine[]): { productId: string; quantity: number }[] {
  return lines.map((line) => ({ productId: line.productId, quantity: line.quantity }));
}

/**
 * Countries offered in the address form.
 *
 * A short list beats a 250-entry dropdown: these are the zones the shipping
 * table actually prices, and anything else falls into the international tier
 * anyway. Sorted by how often they are picked, not alphabetically.
 */
export const SHIPPING_COUNTRIES = [
  { code: 'RU', ru: 'Россия', en: 'Russia' },
  { code: 'BY', ru: 'Беларусь', en: 'Belarus' },
  { code: 'KZ', ru: 'Казахстан', en: 'Kazakhstan' },
  { code: 'AM', ru: 'Армения', en: 'Armenia' },
  { code: 'KG', ru: 'Киргизия', en: 'Kyrgyzstan' },
  { code: 'DE', ru: 'Германия', en: 'Germany' },
  { code: 'FR', ru: 'Франция', en: 'France' },
  { code: 'IT', ru: 'Италия', en: 'Italy' },
  { code: 'ES', ru: 'Испания', en: 'Spain' },
  { code: 'PL', ru: 'Польша', en: 'Poland' },
  { code: 'NL', ru: 'Нидерланды', en: 'Netherlands' },
  { code: 'TR', ru: 'Турция', en: 'Turkey' },
  { code: 'RS', ru: 'Сербия', en: 'Serbia' },
  { code: 'AE', ru: 'ОАЭ', en: 'United Arab Emirates' },
  { code: 'CN', ru: 'Китай', en: 'China' },
  { code: 'US', ru: 'США', en: 'United States' },
] as const;

export function countryName(code: string, locale: string): string {
  const entry = SHIPPING_COUNTRIES.find((country) => country.code === code);
  if (!entry) return code;
  return locale.startsWith('ru') ? entry.ru : entry.en;
}

/**
 * The path an order walks, in order.
 *
 * CANCELLED is not on it: an order does not progress into cancellation, it
 * leaves the track, and drawing it as a sixth step would suggest otherwise.
 */
export const ORDER_FLOW = ['PENDING', 'PAID', 'PACKING', 'SHIPPED', 'DELIVERED'] as const;

export type OrderFlowStep = (typeof ORDER_FLOW)[number];

export interface OrderProgress {
  steps: readonly OrderFlowStep[];
  /** Index of the step the order is standing on, or -1 when it was cancelled. */
  current: number;
  cancelled: boolean;
}

export function orderProgress(status: OrderStatus): OrderProgress {
  if (status === 'CANCELLED') {
    return { steps: ORDER_FLOW, current: -1, cancelled: true };
  }
  return {
    steps: ORDER_FLOW,
    current: ORDER_FLOW.indexOf(status),
    cancelled: false,
  };
}

/** An order still owes money for as long as it sits in PENDING. */
export function awaitsPayment(status: OrderStatus): boolean {
  return status === 'PENDING';
}
