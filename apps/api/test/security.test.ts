import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../src/lib/password.js';
import { createSessionToken, hashIp, hashToken, hashUserAgent } from '../src/lib/tokens.js';

describe('password hashing', () => {
  it('verifies the password it hashed', async () => {
    const digest = await hashPassword('parol-12345');
    expect(digest.startsWith('$argon2id$')).toBe(true);
    await expect(verifyPassword(digest, 'parol-12345')).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const digest = await hashPassword('parol-12345');
    await expect(verifyPassword(digest, 'parol-12346')).resolves.toBe(false);
  });

  it('salts: the same password hashes differently every time', async () => {
    const [first, second] = await Promise.all([
      hashPassword('parol-12345'),
      hashPassword('parol-12345'),
    ]);
    expect(first).not.toBe(second);
  });

  it('treats a corrupted digest as a failed login, not a crash', async () => {
    await expect(verifyPassword('not-a-hash', 'parol-12345')).resolves.toBe(false);
  });
});

describe('session tokens', () => {
  it('generates unique, url-safe tokens', () => {
    const tokens = new Set(Array.from({ length: 100 }, () => createSessionToken()));
    expect(tokens.size).toBe(100);
    for (const token of tokens) expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('hashes deterministically and never returns the token itself', () => {
    const token = createSessionToken();
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).not.toContain(token);
    expect(hashToken(token)).toHaveLength(64);
  });

  it('hashes the ip with the secret, so the log cannot be reversed by a rainbow table', () => {
    const withOneSecret = hashIp('203.0.113.5', 'secret-one');
    const withAnother = hashIp('203.0.113.5', 'secret-two');
    expect(withOneSecret).not.toBe(withAnother);
    expect(withOneSecret).not.toContain('203.0.113');
    expect(hashIp(undefined, 'secret-one')).toBeNull();
  });

  it('returns null for a missing user agent', () => {
    expect(hashUserAgent(undefined)).toBeNull();
    expect(hashUserAgent('Mozilla/5.0')).toHaveLength(32);
  });
});
