import type { Locale, RegisterInput, SessionUser, UserRole } from '@3dsfera/shared';
import { AppError } from '@3dsfera/shared';
import type { Db } from '../../lib/prisma.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { createSessionToken, hashToken, hashUserAgent } from '../../lib/tokens.js';

/**
 * Authentication logic, expressed as plain functions over a database handle.
 * Nothing here knows about Fastify, cookies or HTTP status codes — the route
 * layer translates. That is what makes it testable without a server.
 */

export interface SessionContext {
  userAgent: string | undefined;
  ttlDays: number;
}

export interface AuthResult {
  user: SessionUser;
  token: string;
  expiresAt: Date;
}

/** Shape returned by every query that feeds `toSessionUser`. */
const userWithSupplier = {
  supplier: {
    select: {
      id: true,
      companyName: true,
      status: true,
      pavilions: { select: { slot: true }, orderBy: { slot: 'asc' }, take: 1 },
    },
  },
} as const;

interface LoadedUser {
  id: string;
  email: string;
  role: UserRole;
  locale: Locale;
  createdAt: Date;
  supplier: {
    id: string;
    companyName: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'BLOCKED';
    pavilions: { slot: number }[];
  } | null;
}

export function toSessionUser(user: LoadedUser): SessionUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    locale: user.locale,
    createdAt: user.createdAt.toISOString(),
    supplier: user.supplier
      ? {
          id: user.supplier.id,
          companyName: user.supplier.companyName,
          status: user.supplier.status,
          pavilionSlot: user.supplier.pavilions[0]?.slot ?? null,
        }
      : null,
  };
}

function expiryFromNow(ttlDays: number): Date {
  return new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
}

async function issueSession(
  db: Db,
  userId: string,
  context: SessionContext,
): Promise<{ token: string; expiresAt: Date }> {
  const token = createSessionToken();
  const expiresAt = expiryFromNow(context.ttlDays);

  await db.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      userAgentHash: hashUserAgent(context.userAgent),
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export async function registerUser(
  db: Db,
  input: RegisterInput,
  context: SessionContext,
): Promise<AuthResult> {
  const existing = await db.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });
  if (existing) {
    throw new AppError({
      status: 409,
      code: 'ERR_EMAIL_TAKEN',
      message: 'Email is already registered',
    });
  }

  const passwordHash = await hashPassword(input.password);

  // A supplier account and its company are created together: an approved
  // login without a company profile has nothing to show in the supplier area.
  const user = await db.user.create({
    data: {
      email: input.email,
      passwordHash,
      role: input.role,
      locale: input.locale ?? 'ru',
      ...(input.role === 'SUPPLIER'
        ? {
            supplier: {
              create: {
                companyName: input.companyName,
                legalName: input.legalName ?? null,
                taxId: input.taxId ?? null,
                contactEmail: input.email,
              },
            },
          }
        : {}),
    },
    select: {
      id: true,
      email: true,
      role: true,
      locale: true,
      createdAt: true,
      ...userWithSupplier,
    },
  });

  const { token, expiresAt } = await issueSession(db, user.id, context);
  return { user: toSessionUser(user), token, expiresAt };
}

export async function loginUser(
  db: Db,
  input: { email: string; password: string },
  context: SessionContext,
): Promise<AuthResult> {
  const user = await db.user.findUnique({
    where: { email: input.email },
    select: {
      id: true,
      email: true,
      role: true,
      locale: true,
      createdAt: true,
      passwordHash: true,
      isBlocked: true,
      ...userWithSupplier,
    },
  });

  const invalidCredentials = new AppError({
    status: 401,
    code: 'ERR_INVALID_CREDENTIALS',
    message: 'Invalid email or password',
  });

  if (!user) {
    // Hash a throwaway value so that a missing account costs the same time as
    // a wrong password and cannot be told apart by a stopwatch.
    await hashPassword(input.password);
    throw invalidCredentials;
  }

  const passwordMatches = await verifyPassword(user.passwordHash, input.password);
  if (!passwordMatches) throw invalidCredentials;

  if (user.isBlocked) {
    throw new AppError({
      status: 403,
      code: 'ERR_ACCOUNT_BLOCKED',
      message: 'Account is blocked',
    });
  }

  const { token, expiresAt } = await issueSession(db, user.id, context);
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  return { user: toSessionUser(user), token, expiresAt };
}

export interface ResolvedSession {
  sessionId: string;
  user: SessionUser;
}

/**
 * Looks up the cookie token. Expired sessions are deleted as they are found —
 * a lazy sweep that keeps the table from growing without a scheduled job.
 */
export async function resolveSession(db: Db, token: string): Promise<ResolvedSession | null> {
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      expiresAt: true,
      lastSeenAt: true,
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          locale: true,
          createdAt: true,
          isBlocked: true,
          ...userWithSupplier,
        },
      },
    },
  });

  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  if (session.user.isBlocked) {
    await db.session.deleteMany({ where: { userId: session.user.id } });
    return null;
  }

  // Touch at most once an hour: every request writing a row would turn a read
  // path into a write path for no useful precision.
  if (Date.now() - session.lastSeenAt.getTime() > 60 * 60 * 1000) {
    await db.session
      .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
      .catch(() => undefined);
  }

  return { sessionId: session.id, user: toSessionUser(session.user) };
}

export async function destroySession(db: Db, token: string): Promise<void> {
  await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

export async function destroyAllSessions(db: Db, userId: string): Promise<void> {
  await db.session.deleteMany({ where: { userId } });
}
