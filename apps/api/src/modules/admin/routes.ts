import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';

/**
 * Stage 1: counters for the admin shell. The moderation queue, pavilion
 * assignment and the audit viewer arrive in stage 5.
 */
export async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.requireRole('ADMIN'));

  app.get('/overview', async () => {
    const [users, suppliersPending, suppliersApproved, products, pavilions, orders] =
      await Promise.all([
        prisma.user.count(),
        prisma.supplier.count({ where: { status: 'PENDING' } }),
        prisma.supplier.count({ where: { status: 'APPROVED' } }),
        prisma.product.count(),
        prisma.pavilion.count(),
        prisma.order.count(),
      ]);

    return {
      counts: { users, suppliersPending, suppliersApproved, products, pavilions, orders },
    };
  });
}
