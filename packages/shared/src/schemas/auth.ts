import { z } from 'zod';
import { TEXT_LIMITS } from '../limits.js';
import { emailSchema, localeSchema, passwordSchema } from './common.js';

const credentials = {
  email: emailSchema,
  password: passwordSchema,
  locale: localeSchema.optional(),
};

/**
 * Registration is a discriminated union rather than one object with optional
 * company fields: a supplier without a company name is not a valid account,
 * and the type system should say so instead of a runtime check.
 */
export const registerSchema = z.discriminatedUnion('role', [
  z.object({ role: z.literal('BUYER'), ...credentials }),
  z.object({
    role: z.literal('SUPPLIER'),
    ...credentials,
    companyName: z.string().trim().min(2).max(TEXT_LIMITS.companyNameMax),
    legalName: z.string().trim().min(2).max(TEXT_LIMITS.companyNameMax).optional(),
    taxId: z.string().trim().min(4).max(32).optional(),
  }),
]);

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  // Deliberately not `passwordSchema`: an old account may hold a password that
  // no longer satisfies the current policy, and rejecting it at the schema
  // level would lock the user out with a validation error instead of a login
  // failure.
  password: z.string().min(1).max(TEXT_LIMITS.passwordMax),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const updateLocaleSchema = z.object({ locale: localeSchema });
export type UpdateLocaleInput = z.infer<typeof updateLocaleSchema>;
