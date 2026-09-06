import type { FastifyInstance, FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import fp from 'fastify-plugin';
import cookie from '@fastify/cookie';
import { AppError, type SessionUser, type UserRole } from '@3dsfera/shared';
import { env, isProduction } from '../env.js';
import { prisma } from '../lib/prisma.js';
import { resolveSession } from '../modules/auth/service.js';

export const SESSION_COOKIE = 'sfera_sid';

declare module 'fastify' {
  interface FastifyRequest {
    /** Resolved on every request; null for anonymous visitors. */
    currentUser: SessionUser | null;
    sessionId: string | null;
  }
  interface FastifyInstance {
    requireAuth: preHandlerHookHandler;
    requireRole: (...roles: UserRole[]) => preHandlerHookHandler;
  }
}

export function setSessionCookie(reply: FastifyReply, token: string, expiresAt: Date): void {
  void reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.COOKIE_SECURE || isProduction,
    path: '/',
    expires: expiresAt,
    signed: false,
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  void reply.clearCookie(SESSION_COOKIE, { path: '/' });
}

export function readSessionToken(request: FastifyRequest): string | null {
  const raw = request.cookies[SESSION_COOKIE];
  return raw && raw.length > 0 ? raw : null;
}

async function authPlugin(app: FastifyInstance): Promise<void> {
  await app.register(cookie, { secret: env.SESSION_SECRET });

  app.decorateRequest('currentUser', null);
  app.decorateRequest('sessionId', null);

  app.addHook('onRequest', async (request) => {
    const token = readSessionToken(request);
    if (!token) return;

    const session = await resolveSession(prisma, token);
    if (!session) return;

    request.currentUser = session.user;
    request.sessionId = session.sessionId;
  });

  app.decorate('requireAuth', async (request: FastifyRequest) => {
    if (!request.currentUser) {
      throw new AppError({
        status: 401,
        code: 'ERR_UNAUTHORIZED',
        message: 'Authentication required',
      });
    }
  });

  app.decorate('requireRole', (...roles: UserRole[]): preHandlerHookHandler => {
    return async (request: FastifyRequest) => {
      const user = request.currentUser;
      if (!user) {
        throw new AppError({
          status: 401,
          code: 'ERR_UNAUTHORIZED',
          message: 'Authentication required',
        });
      }
      if (!roles.includes(user.role)) {
        throw new AppError({
          status: 403,
          code: 'ERR_FORBIDDEN',
          message: `Role ${user.role} may not access this route`,
        });
      }
    };
  });
}

export default fp(authPlugin, { name: 'auth', dependencies: ['error-handler'] });
