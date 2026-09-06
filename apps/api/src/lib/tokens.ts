import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** 256 bits of entropy, URL-safe, suitable for a session cookie value. */
export function createSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Sessions are stored as digests. The token itself never touches the database,
 * so read access to `sessions` does not hand over live logins.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Coarse fingerprint of the client, used to spot obviously stolen cookies. */
export function hashUserAgent(userAgent: string | undefined): string | null {
  if (!userAgent) return null;
  return createHash('sha256').update(userAgent).digest('hex').slice(0, 32);
}

/** IP addresses are personal data; the audit log only ever sees this digest. */
export function hashIp(ip: string | undefined, secret: string): string | null {
  if (!ip) return null;
  return createHash('sha256').update(`${secret}:${ip}`).digest('hex').slice(0, 32);
}

export function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}
