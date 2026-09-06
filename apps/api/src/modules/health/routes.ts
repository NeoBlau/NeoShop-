import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/live', async () => ({ status: 'ok' as const }));

  /** Readiness actually touches the database; liveness deliberately does not. */
  app.get('/ready', async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'ok' as const, database: 'up' as const };
    } catch (error) {
      app.log.error({ err: error }, 'readiness probe failed');
      return reply.status(503).send({ status: 'degraded', database: 'down' });
    }
  });
}
