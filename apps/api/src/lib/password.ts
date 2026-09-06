import { hash, verify, type Algorithm } from '@node-rs/argon2';

/**
 * Argon2id with parameters in the middle of the OWASP recommendation: 19 MiB
 * of memory and two passes. Cheap enough for a login request, expensive enough
 * that a stolen dump is not a wordlist away from plaintext.
 */
// `Algorithm` is an ambient const enum, which `verbatimModuleSyntax` forbids
// importing as a value. The numeric member is part of the published ABI.
const ARGON2ID = 2 as Algorithm;

const options = {
  algorithm: ARGON2ID,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, options);
}

export async function verifyPassword(digest: string, plain: string): Promise<boolean> {
  try {
    return await verify(digest, plain, options);
  } catch {
    // A malformed or truncated digest means the stored hash is unusable, which
    // is a failed login rather than a crash — but it is worth knowing about.
    return false;
  }
}
