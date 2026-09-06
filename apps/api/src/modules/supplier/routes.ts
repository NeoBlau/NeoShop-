import type { FastifyInstance } from 'fastify';
import { AppError } from '@3dsfera/shared';
import { prisma } from '../../lib/prisma.js';

/**
 * Stage 1 exposes only what the supplier dashboard shell needs: who am I, what
 * is my moderation status, and the counters the empty-state cards show. The
 * product wizard lands in stage 2 under the same prefix.
 */
export async function supplierRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.requireRole('SUPPLIER', 'ADMIN'));

  app.get('/me', async (request) => {
    const user = request.currentUser;
    if (!user?.supplier) {
      throw new AppError({
        status: 400,
        code: 'ERR_SUPPLIER_PROFILE_REQUIRED',
        message: 'This account has no supplier profile',
      });
    }

    const supplier = await prisma.supplier.findUnique({
      where: { id: user.supplier.id },
      select: {
        id: true,
        companyName: true,
        legalName: true,
        taxId: true,
        contactEmail: true,
        status: true,
        rejectionReason: true,
        createdAt: true,
        pavilions: { select: { id: true, slot: true, title: true, theme: true, status: true } },
        _count: { select: { products: true } },
      },
    });

    if (!supplier) {
      throw new AppError({
        status: 404,
        code: 'ERR_NOT_FOUND',
        message: 'Supplier profile not found',
      });
    }

    // Shaped explicitly rather than spread: `_count` is a Prisma detail and
    // has no business showing up in the public contract.
    const { _count, pavilions, ...profile } = supplier;
    return {
      supplier: {
        ...profile,
        createdAt: supplier.createdAt.toISOString(),
        pavilions,
        productCount: _count.products,
      },
    };
  });
}
