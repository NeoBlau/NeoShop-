import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { AppError } from '@3dsfera/shared';
import { prisma } from '../../lib/prisma.js';
import { parseInput } from '../../lib/validate.js';
import { completeRun, listMine, reportStep, startRun } from './service.js';

/**
 * Missions belong to a signed-in buyer: the run is theirs, and so is the code
 * at the end. Rate limits are tight — a mission has a handful of steps and a
 * client reporting hundreds a minute is not playing it.
 */

const missionParams = z.object({ id: z.string().min(1).max(64) });
const stepParams = missionParams.extend({ stepId: z.string().min(1).max(64) });

/** requireAuth has already run; this is the narrowing, not the check. */
function buyerId(request: FastifyRequest): string {
  const user = request.currentUser;
  if (!user) {
    throw new AppError({ status: 401, code: 'ERR_UNAUTHORIZED', message: 'Sign in required' });
  }
  return user.id;
}

export async function missionRoutes(app: FastifyInstance): Promise<void> {
  app.get('/mine', { preHandler: app.requireAuth }, async (request) =>
    listMine(prisma, buyerId(request)),
  );

  app.post(
    '/:id/start',
    {
      preHandler: app.requireAuth,
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    },
    async (request) => {
      const { id } = parseInput(missionParams, request.params);
      return startRun(prisma, buyerId(request), id);
    },
  );

  app.post(
    '/:id/steps/:stepId',
    {
      preHandler: app.requireAuth,
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    },
    async (request) => {
      const { id, stepId } = parseInput(stepParams, request.params);
      return reportStep(prisma, buyerId(request), id, stepId);
    },
  );

  app.post(
    '/:id/complete',
    {
      preHandler: app.requireAuth,
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    },
    async (request) => {
      const { id } = parseInput(missionParams, request.params);
      return completeRun(prisma, buyerId(request), id);
    },
  );
}
