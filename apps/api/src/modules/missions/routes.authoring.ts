import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { AppError, DEMO_ZONES, authoredMissionSchema } from '@3dsfera/shared';
import { prisma } from '../../lib/prisma.js';
import { parseInput } from '../../lib/validate.js';
import { getMine, removeMine, saveDraft, submitForReview } from './authoring.js';

/**
 * A supplier's own missions, under their own product.
 *
 * Mounted beside the product routes rather than beside the mission-run ones,
 * because that is where the permission lives: these are writes to something a
 * supplier owns, and every one of them starts by proving the product is
 * theirs. The run endpoints belong to a buyer and share nothing but a table.
 */

const productParams = z.object({ productId: z.string().min(1).max(64) });

/** Every route below belongs to exactly one company. */
function supplierId(request: FastifyRequest): string {
  const supplier = request.currentUser?.supplier;
  if (!supplier) {
    throw new AppError({
      status: 400,
      code: 'ERR_SUPPLIER_PROFILE_REQUIRED',
      message: 'This account has no supplier profile',
    });
  }
  return supplier.id;
}

export async function missionAuthoringRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.requireRole('SUPPLIER', 'ADMIN'));

  app.get('/:productId/mission', async (request) => {
    const { productId } = parseInput(productParams, request.params);
    return getMine(prisma, supplierId(request), productId);
  });

  app.put(
    '/:productId/mission',
    { config: { rateLimit: { max: 40, timeWindow: '1 minute' } } },
    async (request) => {
      const { productId } = parseInput(productParams, request.params);
      const input = parseInput(authoredMissionSchema, request.body);
      return saveDraft(prisma, supplierId(request), productId, input, DEMO_ZONES);
    },
  );

  app.post(
    '/:productId/mission/submit',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request) => {
      const { productId } = parseInput(productParams, request.params);
      return submitForReview(prisma, supplierId(request), productId);
    },
  );

  app.delete('/:productId/mission', async (request, reply) => {
    const { productId } = parseInput(productParams, request.params);
    await removeMine(prisma, supplierId(request), productId);
    return reply.code(204).send();
  });
}
