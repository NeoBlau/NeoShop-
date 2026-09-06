import type { FastifyInstance } from 'fastify';
import {
  loginSchema,
  registerSchema,
  updateLocaleSchema,
  type OkResponse,
  type SessionResponse,
} from '@3dsfera/shared';
import { env } from '../../env.js';
import { prisma } from '../../lib/prisma.js';
import { parseInput } from '../../lib/validate.js';
import { recordAudit } from '../../lib/audit.js';
import { hashIp } from '../../lib/tokens.js';
import { clearSessionCookie, readSessionToken, setSessionCookie } from '../../plugins/auth.js';
import { destroySession, loginUser, registerUser } from './service.js';

/** Credential endpoints get a much tighter budget than the global limit. */
const credentialRateLimit = {
  config: {
    rateLimit: {
      max: 10,
      timeWindow: '5 minutes',
    },
  },
};

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/register', credentialRateLimit, async (request, reply) => {
    const input = parseInput(registerSchema, request.body);

    const result = await registerUser(prisma, input, {
      userAgent: request.headers['user-agent'],
      ttlDays: env.SESSION_TTL_DAYS,
    });

    setSessionCookie(reply, result.token, result.expiresAt);

    await recordAudit({
      actorUserId: result.user.id,
      actorRole: result.user.role,
      action: 'user.register',
      entityType: 'User',
      entityId: result.user.id,
      metadata: { role: result.user.role },
      ipHash: hashIp(request.ip, env.SESSION_SECRET),
    });

    const body: SessionResponse = { user: result.user };
    return reply.status(201).send(body);
  });

  app.post('/login', credentialRateLimit, async (request, reply) => {
    const input = parseInput(loginSchema, request.body);

    const result = await loginUser(prisma, input, {
      userAgent: request.headers['user-agent'],
      ttlDays: env.SESSION_TTL_DAYS,
    });

    setSessionCookie(reply, result.token, result.expiresAt);

    const body: SessionResponse = { user: result.user };
    return reply.send(body);
  });

  app.post('/logout', async (request, reply) => {
    const token = readSessionToken(request);
    if (token) await destroySession(prisma, token);
    clearSessionCookie(reply);

    const body: OkResponse = { ok: true };
    return reply.send(body);
  });

  app.get('/session', async (request, reply) => {
    const body: SessionResponse = { user: request.currentUser };
    // The session endpoint is polled by the client on every navigation; it
    // must never be cached by an intermediary.
    void reply.header('cache-control', 'no-store');
    return reply.send(body);
  });

  app.patch('/locale', { preHandler: app.requireAuth }, async (request, reply) => {
    const user = request.currentUser;
    if (!user) return reply.status(401).send();

    const { locale } = parseInput(updateLocaleSchema, request.body);
    await prisma.user.update({ where: { id: user.id }, data: { locale } });

    const body: SessionResponse = { user: { ...user, locale } };
    return reply.send(body);
  });
}
