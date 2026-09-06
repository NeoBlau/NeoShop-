import Stripe from 'stripe';
import type { PaymentEvent, PaymentIntent, PaymentProvider, PaymentRequest } from './provider.js';

/**
 * Stripe, in test mode.
 *
 * Only reached when STRIPE_SECRET_KEY is set; otherwise the mock provider runs
 * and the rest of the application cannot tell the difference.
 */
export class StripePaymentProvider implements PaymentProvider {
  readonly name = 'stripe' as const;
  private readonly stripe: Stripe;

  constructor(
    secretKey: string,
    private readonly webhookSecret: string | undefined,
  ) {
    // Pinned to the version this code was written against: Stripe changes
    // response shapes between versions, and an unpinned client upgrades itself
    // the day the library does.
    this.stripe = new Stripe(secretKey, { apiVersion: '2026-08-26.dahlia' });
  }

  async createIntent(request: PaymentRequest): Promise<PaymentIntent> {
    const intent = await this.stripe.paymentIntents.create({
      amount: request.amountCents,
      currency: request.currency.toLowerCase(),
      description: request.description,
      // Reconciliation handle: the order number is what support will be given
      // when a buyer asks where their money went.
      metadata: { orderId: request.orderId, orderNumber: request.orderNumber },
      ...(request.buyerEmail ? { receipt_email: request.buyerEmail } : {}),
      automatic_payment_methods: { enabled: true },
    });

    return {
      id: intent.id,
      provider: 'stripe',
      reference: intent.id,
      ...(intent.client_secret ? { clientSecret: intent.client_secret } : {}),
    };
  }

  parseWebhook(rawBody: Buffer, signature: string | undefined): PaymentEvent | null {
    if (!signature || !this.webhookSecret) return null;

    let event: Stripe.Event;
    try {
      // Verifies against the raw body; parsing it first would break the
      // signature, which is why the route registers a raw body parser.
      event = this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
    } catch {
      return null;
    }

    if (
      event.type !== 'payment_intent.succeeded' &&
      event.type !== 'payment_intent.payment_failed'
    ) {
      return null;
    }

    const intent = event.data.object as Stripe.PaymentIntent;

    return {
      reference: intent.id,
      status: event.type === 'payment_intent.succeeded' ? 'succeeded' : 'failed',
      amountCents: intent.amount,
      currency: intent.currency.toUpperCase(),
    };
  }
}
