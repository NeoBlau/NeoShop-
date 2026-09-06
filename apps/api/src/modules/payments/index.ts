import { env } from '../../env.js';
import { MockPaymentProvider } from './mock.js';
import { StripePaymentProvider } from './stripe.js';
import type { PaymentProvider } from './provider.js';

/**
 * Chooses the provider once, at boot, from configuration.
 *
 * Presence of a key is the switch: no branching anywhere else in the codebase,
 * and no chance of a half-configured deployment taking real money through a
 * mock.
 */
let provider: PaymentProvider | null = null;

export function paymentProvider(): PaymentProvider {
  provider ??= env.STRIPE_SECRET_KEY
    ? new StripePaymentProvider(env.STRIPE_SECRET_KEY, env.STRIPE_WEBHOOK_SECRET)
    : new MockPaymentProvider(env.SESSION_SECRET);

  return provider;
}

export function isMockProvider(candidate: PaymentProvider): candidate is MockPaymentProvider {
  return candidate.name === 'mock';
}

export type { PaymentProvider, PaymentEvent, PaymentIntent } from './provider.js';
export { MockPaymentProvider } from './mock.js';
