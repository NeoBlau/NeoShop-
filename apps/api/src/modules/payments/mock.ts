import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { PaymentEvent, PaymentIntent, PaymentProvider, PaymentRequest } from './provider.js';

/**
 * The provider used when no Stripe keys are configured.
 *
 * It is not a stub that returns success: it issues a reference, the client
 * confirms it through a fake card form, and the confirmation arrives back as a
 * signed callback exactly as a real provider's would. That means the order
 * state machine — pending, then paid on a webhook, idempotently — is exercised
 * for real in development, and switching to Stripe changes the provider, not
 * the flow.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock' as const;

  constructor(private readonly secret: string) {}

  async createIntent(_request: PaymentRequest): Promise<PaymentIntent> {
    // Nothing to send anywhere: the reference is the whole intent, and the
    // amount is re-checked against the order when the callback arrives.
    const id = `mock_${randomBytes(12).toString('hex')}`;

    return { id, provider: 'mock', reference: id };
  }

  /** The signature the client must present when confirming a mock payment. */
  sign(reference: string): string {
    return createHmac('sha256', this.secret).update(reference).digest('hex');
  }

  parseWebhook(rawBody: Buffer, signature: string | undefined): PaymentEvent | null {
    if (!signature) return null;

    let payload: { reference?: string; status?: string; amountCents?: number; currency?: string };
    try {
      payload = JSON.parse(rawBody.toString('utf8')) as typeof payload;
    } catch {
      return null;
    }

    if (!payload.reference) return null;

    // Same check a real provider performs: the caller must know the secret.
    const expected = Buffer.from(this.sign(payload.reference));
    const received = Buffer.from(signature);
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

    const status =
      payload.status === 'succeeded' || payload.status === 'failed' ? payload.status : 'pending';

    return {
      reference: payload.reference,
      status,
      amountCents: payload.amountCents ?? 0,
      currency: payload.currency ?? 'RUB',
    };
  }
}
