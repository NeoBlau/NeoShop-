import Fastify, { type FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { UPLOAD_LIMITS } from '@3dsfera/shared';
import { env, isProduction, isTest } from './env.js';
import errorHandler from './plugins/error-handler.js';
import security from './plugins/security.js';
import auth from './plugins/auth.js';
import { authRoutes } from './modules/auth/routes.js';
import { supplierRoutes } from './modules/supplier/routes.js';
import { adminRoutes } from './modules/admin/routes.js';
import { productRoutes, supplierStatsRoutes } from './modules/products/routes.js';
import { worldRoutes } from './modules/world/routes.js';
import { requeueInterruptedJobs } from './modules/products/processing.js';
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

  await app.register(multipart, {
    limits: {
      fileSize: UPLOAD_LIMITS.modelMaxBytes,
      files: 1,
      // Uploads carry the file and nothing else; the metadata is a separate
      // JSON request.
      fields: 4,
    },
  });
  await app.register(security);
  await app.register(auth);

  await app.register(healthRoutes, { prefix: '/health' });
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(worldRoutes, { prefix: '/api/world' });
  await app.register(supplierRoutes, { prefix: '/api/supplier' });
  await app.register(productRoutes, { prefix: '/api/supplier/products' });
  await app.register(supplierStatsRoutes, { prefix: '/api/supplier/stats' });
  await app.register(adminRoutes, { prefix: '/api/admin' });

  // A restart must not strand a model in "processing" forever.
  const requeued = await requeueInterruptedJobs().catch((error: unknown) => {
    app.log.error({ err: error }, 'failed to requeue interrupted model jobs');
    return 0;
  });
  if (requeued > 0) app.log.info({ requeued }, 'requeued interrupted model jobs');

  return app;
}

export { env };
