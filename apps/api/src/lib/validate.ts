import type { z } from 'zod';
import { AppError, type FieldIssue } from '@3dsfera/shared';

/**
 * Single entry point for input validation. Every route parses its input through
 * this helper, so a malformed request always produces the same shape and the
 * client can highlight the offending field by path.
 */
export function parseInput<S extends z.ZodType>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data);
  if (result.success) return result.data;

  const issues: FieldIssue[] = result.error.issues.map((issue) => ({
    path: issue.path.map(String).join('.'),
    // Zod's own code is generic ("too_small"); a custom refinement carries its
    // dictionary key in the message. Prefer the specific one.
    code: issue.code === 'custom' ? issue.message : issue.code,
    message: issue.message,
  }));

  throw new AppError({
    status: 400,
    code: 'ERR_VALIDATION',
    message: `Validation failed: ${issues.map((i) => `${i.path || '(root)'} ${i.code}`).join(', ')}`,
    issues,
  });
}
