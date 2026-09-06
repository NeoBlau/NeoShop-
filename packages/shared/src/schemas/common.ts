import { z } from 'zod';
import { LOCALES } from '../domain.js';
import { TEXT_LIMITS } from '../limits.js';

/** Emails are compared and stored lowercased; whitespace is a paste artifact. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(TEXT_LIMITS.emailMax)
  .pipe(z.email());

/**
 * Length first, composition second. Long passphrases beat short cryptic ones,
 * so the floor is 10 characters and the only composition rule is "not a single
 * character class".
 */
export const passwordSchema = z
  .string()
  .min(TEXT_LIMITS.passwordMin)
  .max(TEXT_LIMITS.passwordMax)
  .refine((value) => /\p{L}/u.test(value) && /[\d\p{P}\p{S}]/u.test(value), {
    error: 'password_too_simple',
  });

export const localeSchema = z.enum(LOCALES);

export const cuidSchema = z.string().min(20).max(40);

export const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(24),
});

export type Pagination = z.infer<typeof paginationSchema>;
