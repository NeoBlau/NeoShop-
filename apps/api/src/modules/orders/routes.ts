import type { FastifyInstance } from 'fastify';
import {
  AppError,
  checkoutSchema,
  shippingQuoteSchema,
  type OrderDetail,
  type OrderSummary,
} from '@3dsfera/shared';
import { prisma } from '../../lib/prisma.js';
import { parseInput } from '../../lib/validate.js';
import { recordAudit } from '../../lib/audit.js';
import { hashIp } from '../../lib/tokens.js';
import { env } from '../../env.js';
import { checkout, getOrder, listBuyerOrders, quoteForCart } from './service.js';

export async function orderRoutes(app: FastifyInstance): Promise<void> {
  /**
   * Shipping estimate. Open to anyone: a buyer deciding whether to check out
   * has not signed in yet, and refusing to quote until they do loses the sale.
   */
  app.post(
    '/quote',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request) => {
      const input = parseInput(shippingQuoteSchema, request.body);
      return quoteForCart(prisma, input);
    },
  );

  app.post(
    '/',
    {
      preHandler: app.requireAuth,
      config: { rateLimit: { max: 20, timeWindow: '5 minutes' } },
    },
    async (request, reply) => {
      const user = request.currentUser;
      if (!user) {
        throw new AppError({ status: 401, code: 'ERR_UNAUTHORIZED', message: 'Sign in required' });
      }

      const input = parseInput(checkoutSchema, request.body);
      const result = await checkout(
        prisma,
        { buyerId: user.id, buyerEmail: user.email, locale: user.locale },
        input,
      );

      await recordAudit({
        actorUserId: user.id,
        actorRole: user.role,
        action: 'order.create',
        entityType: 'Order',
        entityId: result.order.id,
        // Amounts and counts only: the address never reaches the audit log.
        metadata: {
          totalCents: result.order.totalCents,
          items: result.order.itemCount,
          provider: result.payment.provider,
        },
        ipHash: hashIp(request.ip, env.SESSION_SECRET),
      });

      return reply.status(201).send(result);
    },
  );

  app.get('/', { preHandler: app.requireAuth }, async (request) => {
    const user = request.currentUser;
    if (!user) throw new AppError({ status: 401, code: 'ERR_UNAUTHORIZED', message: 'Sign in' });

    const orders: OrderSummary[] = await listBuyerOrders(prisma, user.id);
    return { orders };
  });

  app.get('/:number', { preHandler: app.requireAuth }, async (request) => {
    const user = request.currentUser;
    if (!user) throw new AppError({ status: 401, code: 'ERR_UNAUTHORIZED', message: 'Sign in' });

    const { number } = request.params as { number: string };
    const order: OrderDetail = await getOrder(prisma, number, {
      userId: user.id,
      isAdmin: user.role === 'ADMIN',
    });

    return { order };
  });
}
