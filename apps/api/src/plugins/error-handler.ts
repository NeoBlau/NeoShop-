import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { AppError } from '@3dsfera/shared';

/**
 * Turns everything thrown inside a route into the documented error body.
 * Unexpected errors are logged with their stack and reported as ERR_INTERNAL:
 * the client learns that something broke, not what.
 */
async function errorHandlerPlugin(app: FastifyInstance): Promise<void> {
  app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    if (error instanceof AppError) {
      if (error.status >= 500) {
        request.log.error({ err: error, code: error.code }, 'application error');
      } else {
        request.log.info({ code: error.code, path: request.url }, 'request rejected');
      }
      void reply.status(error.status).send(error.toBody(request.id));
      return;
    }

    // @fastify/rate-limit and the body parser throw plain Fastify errors.
    if (error.statusCode === 429) {
      void reply.status(429).send(
        new AppError({
          status: 429,
          code: 'ERR_RATE_LIMITED',
          message: 'Too many requests',
        }).toBody(request.id),
      );
      return;
    }

    if (error.statusCode === 413) {
      void reply.status(413).send(
        new AppError({
          status: 413,
          code: 'ERR_PAYLOAD_TOO_LARGE',
          message: 'Payload too large',
        }).toBody(request.id),
      );
      return;
    }

    if (error.statusCode !== undefined && error.statusCode >= 400 && error.statusCode < 500) {
      void reply.status(error.statusCode).send(
        new AppError({
          status: error.statusCode,
          code: 'ERR_VALIDATION',
          message: error.message,
        }).toBody(request.id),
      );
      return;
    }

    request.log.error({ err: error, path: request.url }, 'unhandled error');
    void reply.status(500).send(
      new AppError({
        status: 500,
        code: 'ERR_INTERNAL',
        message: 'Internal server error',
      }).toBody(request.id),
    );
  });

  app.setNotFoundHandler((request, reply) => {
    void reply.status(404).send(
      new AppError({
        status: 404,
        code: 'ERR_NOT_FOUND',
        message: `Route ${request.method} ${request.url} not found`,
      }).toBody(request.id),
    );
  });
}

export default fp(errorHandlerPlugin, { name: 'error-handler' });
