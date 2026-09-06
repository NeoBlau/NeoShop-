import type { FastifyInstance } from 'fastify';
import { AppError } from '@3dsfera/shared';
import { prisma } from '../../lib/prisma.js';
import { markOrderPaid } from '../orders/service.js';
import { isMockProvider, paymentProvider } from './index.js';

/**
 * Payment callbacks.
 *
 * The webhook needs the untouched request body: a provider signs the bytes it
 * sent, and a body that has been through JSON.parse and back no longer matches
 * that signature. This plugin therefore installs its own content-type parser,
 * scoped to itself.
 */
export async function paymentRoutes(app: FastifyInstance): Promise<void> {
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_request, body, done) => {
    done(null, body);
  });

  app.post(
    '/webhook',
    { config: { rateLimit: { max: 240, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const provider = paymentProvider();
      const signature =
        (request.headers['stripe-signature'] as string | undefined) ??
        (request.headers['x-sfera-signature'] as string | undefined);

      const event = provider.parseWebhook(request.body as Buffer, signature);

      if (!event) {
        // An unverifiable callback is not an error to investigate on our side;
        // it is a request from someone who is not the provider.
        throw new AppError({
          status: 400,
          code: 'ERR_VALIDATION',
          message: 'Webhook signature could not be verified',
        });
      }

      if (event.status !== 'succeeded') {
        request.log.info(
          { reference: event.reference, status: event.status },
          'payment not settled',
        );
        return reply.status(204).send();
      }

      const result = await markOrderPaid(prisma, event.reference, event.amountCents);

      if (!result.handled) {
        request.log.warn({ reference: event.reference }, 'payment for an unknown order');
      }

      // Providers retry until they get a 2xx, so an unknown reference still
      // answers 204: retrying will not make it known.
      return reply.status(204).send();
    },
  );

  /**
   * The mock provider's card form posts here.
   *
   * It exists so that development exercises the real path: this endpoint signs
   * the callback with the same secret the provider verifies against, and hands
   * it to the same handler a Stripe webhook would reach. Nothing here can run
   * when Stripe is configured.
   */
  app.post('/mock/confirm', async (request, reply) => {
    const provider = paymentProvider();

    if (!isMockProvider(provider)) {
      throw new AppError({
        status: 404,
        code: 'ERR_NOT_FOUND',
        message: 'Mock payments are disabled when a real provider is configured',
      });
    }

    const body = JSON.parse((request.body as Buffer).toString('utf8')) as {
      reference?: string;
      outcome?: string;
    };

    if (!body.reference) {
      throw new AppError({
        status: 400,
        code: 'ERR_VALIDATION',
        message: 'reference is required',
      });
    }

    const order = await prisma.order.findFirst({
      where: { paymentIntentId: body.reference },
      select: { totalCents: true, currency: true, buyerId: true },
    });

    if (!order) {
      throw new AppError({ status: 404, code: 'ERR_NOT_FOUND', message: 'Unknown payment' });
    }

    // Only the buyer who owns the order may confirm its payment, even in the
    // mock: otherwise anyone holding a reference could mark it paid.
    if (request.currentUser?.id !== order.buyerId) {
      throw new AppError({ status: 404, code: 'ERR_NOT_FOUND', message: 'Unknown payment' });
    }

    if (body.outcome === 'failed') {
      return reply.status(200).send({ status: 'failed' });
    }

    const result = await markOrderPaid(prisma, body.reference, order.totalCents);
    return reply.status(200).send({ status: result.alreadyPaid ? 'already_paid' : 'succeeded' });
  });
}
