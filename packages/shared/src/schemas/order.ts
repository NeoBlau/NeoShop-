import { z } from 'zod';
import { CURRENCIES } from '../domain.js';
import { emailSchema } from './common.js';

/**
 * Checkout input.
 *
 * The client sends what it wants to buy and where to send it. It does not send
 * prices: those are read from the database when the order is written, because
 * a price in a browser is a suggestion.
 */

/** ISO 3166-1 alpha-2. Uppercased so 'ru' and 'RU' are the same country. */
export const countrySchema = z
  .string()
  .trim()
  .toUpperCase()
  .length(2)
  .regex(/^[A-Z]{2}$/, { error: 'invalid_country' });

export const shippingAddressSchema = z.object({
  recipient: z.string().trim().min(2).max(120),
  phone: z
    .string()
    .trim()
    .min(5)
    .max(32)
    // Deliberately permissive: phone formats differ per country and a strict
    // pattern rejects real numbers far more often than it catches typos.
    .regex(/^[+\d][\d\s()\-.]*$/, { error: 'invalid_phone' }),
  country: countrySchema,
  region: z.string().trim().max(120).optional(),
  city: z.string().trim().min(1).max(120),
  postalCode: z.string().trim().min(3).max(16),
  line1: z.string().trim().min(3).max(200),
  line2: z.string().trim().max(200).optional(),
  comment: z.string().trim().max(500).optional(),
});

export type ShippingAddressInput = z.infer<typeof shippingAddressSchema>;

export const cartLineSchema = z.object({
  productId: z.string().min(10).max(40),
  quantity: z.number().int().min(1).max(99),
});

export const shippingQuoteSchema = z.object({
  country: countrySchema,
  lines: z.array(cartLineSchema).min(1).max(50),
});

export type ShippingQuoteInput = z.infer<typeof shippingQuoteSchema>;

export const checkoutSchema = z.object({
  lines: z.array(cartLineSchema).min(1).max(50),
  address: shippingAddressSchema,
  /** Where to send the confirmation for a guest checkout. */
  email: emailSchema.optional(),
  currency: z.enum(CURRENCIES).default('RUB'),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const shipmentUpdateSchema = z.object({
  carrier: z.string().trim().min(2).max(60),
  trackingNumber: z.string().trim().min(3).max(60).optional(),
  status: z.enum(['CREATED', 'HANDED_OVER', 'IN_TRANSIT', 'DELIVERED', 'LOST']),
});

export type ShipmentUpdateInput = z.infer<typeof shipmentUpdateSchema>;
