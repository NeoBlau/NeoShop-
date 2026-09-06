import type { Currency, PaymentIntentDto } from '@3dsfera/shared';

/**
 * The payment boundary.
 *
 * Everything the application knows about taking money lives behind this
 * interface, so swapping Stripe for anything else means writing one more
 * implementation rather than auditing the order module. It is deliberately
 * small: create an intent, confirm one, and recognise a provider callback.
 */

export interface PaymentRequest {
  orderId: string;
  orderNumber: string;
  amountCents: number;
  currency: Currency;
  /** Shown on the provider's hosted page and on the buyer's statement. */
  description: string;
  buyerEmail: string | null;
}

export interface PaymentIntent extends PaymentIntentDto {
  /** Provider-side id, stored on the order for reconciliation. */
  id: string;
}

/** What a provider callback tells us, normalised. */
export interface PaymentEvent {
  /** The provider's own intent id. */
  reference: string;
  status: 'succeeded' | 'failed' | 'pending';
  amountCents: number;
  currency: string;
}

export interface PaymentProvider {
  readonly name: 'mock' | 'stripe';
  createIntent(request: PaymentRequest): Promise<PaymentIntent>;
  /**
   * Verifies and parses a provider callback. `signature` is whatever the
   * provider uses to prove the request is theirs; a provider that does not
   * sign its callbacks returns null and the caller refuses the request.
   */
  parseWebhook(rawBody: Buffer, signature: string | undefined): PaymentEvent | null;
}
