import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { AppError } from '@3dsfera/shared';
import { env, isProduction } from '../env.js';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

async function securityPlugin(app: FastifyInstance): Promise<void> {
  await app.register(helmet, {
    // The API serves JSON only; the strict defaults are fine, but CSP is the
    // web app's business and is set by the web server, not here.
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'same-site' },
  });

  await app.register(cors, {
    origin: env.WEB_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: '1 minute',
    // Behind a reverse proxy this must become the forwarded address; see
    // docs/architecture.md before deploying.
    keyGenerator: (request) => request.ip,
  });

  /**
   * Session cookies are SameSite=Lax, which already blocks cross-site form
   * posts. This hook closes the remaining gap: a state-changing request must
   * come from an origin we know. Requests without an Origin header (curl,
   * server-to-server) are allowed — they cannot carry a browser's cookies
   * without one.
   */
  app.addHook('onRequest', async (request) => {
    if (!MUTATING_METHODS.has(request.method)) return;
    const origin = request.headers.origin;
    if (origin === undefined) return;
    if (env.WEB_ORIGIN.includes(origin)) return;

    throw new AppError({
      status: 403,
      code: 'ERR_ORIGIN_NOT_ALLOWED',
      message: `Origin ${origin} is not allowed`,
    });
  });

  if (isProduction) {
    app.addHook('onSend', async (_request, reply) => {
      void reply.header('X-Content-Type-Options', 'nosniff');
    });
  }
}

export default fp(securityPlugin, { name: 'security' });
