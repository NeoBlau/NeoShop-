import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { loadWorld, recordProductView } from './service.js';

/** Anonymous, cacheable, read-only. The scene calls this before anything else. */
export async function worldRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async (_request, reply) => {
    const world = await loadWorld(prisma);
    // Short public cache: the world changes when a product is published, which
    // is minutes-scale, not seconds-scale.
    void reply.header('cache-control', 'public, max-age=60');
    return world;
  });

  app.post(
    '/products/:id/view',
    {
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await recordProductView(prisma, id);
      return reply.status(204).send();
    },
  );
}
