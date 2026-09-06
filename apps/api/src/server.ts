import Fastify, { type FastifyInstance } from 'fastify';
import { env, isProduction, isTest } from './env.js';
import errorHandler from './plugins/error-handler.js';
import security from './plugins/security.js';
import auth from './plugins/auth.js';
import { authRoutes } from './modules/auth/routes.js';
import { supplierRoutes } from './modules/supplier/routes.js';
import { adminRoutes } from './modules/admin/routes.js';
import { healthRoutes } from './modules/health/routes.js';

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    trustProxy: isProduction,
    // 1 MB is plenty for JSON; model uploads go through multipart in stage 2
    // with their own, much larger, limit.
    bodyLimit: 1024 * 1024,
    logger: isTest
      ? false
      : isProduction
        ? { level: 'info' }
        : {
            level: 'debug',
            transport: {
              target: 'pino-pretty',
              options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
            },
          },
  });

  await app.register(errorHandler);
  await app.register(security);
  await app.register(auth);

  await app.register(healthRoutes, { prefix: '/health' });
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(supplierRoutes, { prefix: '/api/supplier' });
  await app.register(adminRoutes, { prefix: '/api/admin' });

  return app;
}

export { env };
