import { describe, expect, it } from 'vitest';
import type { CartLine } from '../../stores/cart.js';
import {
  ORDER_FLOW,
  awaitsPayment,
  cartCount,
  cartCurrency,
  cartSubtotal,
  countryName,
  orderProgress,
  toCheckoutLines,
} from './model.js';

function line(overrides: Partial<CartLine> = {}): CartLine {
  return {
    productId: 'prod_1',
    slug: 'antenna',
    title: 'Антенна',
    priceCents: 1_250_00,
    currency: 'RUB',
    quantity: 1,
    previewUrl: null,
    ...overrides,
  };
}

describe('cart arithmetic', () => {
  it('multiplies each line by its quantity', () => {
    const lines = [
      line({ priceCents: 1000, quantity: 3 }),
      line({ productId: 'prod_2', priceCents: 250, quantity: 2 }),
    ];

    expect(cartSubtotal(lines)).toBe(3500);
    expect(cartCount(lines)).toBe(5);
  });

  it('is zero on an empty cart rather than NaN', () => {
    expect(cartSubtotal([])).toBe(0);
    expect(cartCount([])).toBe(0);
  });

  it('reports a mixed cart, which the server would refuse', () => {
    const lines = [line(), line({ productId: 'prod_2', currency: 'EUR' })];

    expect(cartCurrency(lines).mixed).toBe(true);
    expect(cartCurrency([line()]).mixed).toBe(false);
    expect(cartCurrency([]).currency).toBe('RUB');
  });

  it('sends only ids and quantities to the server, never prices', () => {
    expect(toCheckoutLines([line({ quantity: 4 })])).toEqual([
      { productId: 'prod_1', quantity: 4 },
    ]);
  });
});

describe('orderProgress', () => {
  it('places each status on the flow in order', () => {
    expect(orderProgress('PENDING').current).toBe(0);
    expect(orderProgress('PAID').current).toBe(1);
    expect(orderProgress('DELIVERED').current).toBe(ORDER_FLOW.length - 1);
  });

  it('takes a cancelled order off the track instead of onto a step', () => {
    const progress = orderProgress('CANCELLED');

    expect(progress.cancelled).toBe(true);
    expect(progress.current).toBe(-1);
  });

  it('treats only PENDING as still owing money', () => {
    expect(awaitsPayment('PENDING')).toBe(true);
    expect(awaitsPayment('PAID')).toBe(false);
    expect(awaitsPayment('CANCELLED')).toBe(false);
  });
});

describe('countryName', () => {
  it('translates a known country and passes an unknown code through', () => {
    expect(countryName('RU', 'ru')).toBe('Россия');
    expect(countryName('RU', 'en-US')).toBe('Russia');
    expect(countryName('ZZ', 'ru')).toBe('ZZ');
  });
});
