import { z } from 'zod';
import { PAVILION_THEMES, PUBLICATION_STATUSES } from '../domain.js';

/**
 * Administration input.
 *
 * Every action here changes what a buyer sees or what a supplier may do, so
 * each one is validated and each one is written to the audit log. The reasons
 * are required rather than optional: a supplier told only "rejected" has
 * nothing to act on, and an admin who cannot be bothered to say why should not
 * be able to reject.
 */

export const rejectionSchema = z.object({
  reason: z.string().trim().min(8).max(500),
});

export type RejectionInput = z.infer<typeof rejectionSchema>;

export const blockSchema = z.object({
  reason: z.string().trim().min(8).max(500),
});

export type BlockInput = z.infer<typeof blockSchema>;

/**
 * Where a pavilion stands.
 *
 * The slot is unique across the world; the API answers a taken slot with a
 * conflict rather than silently moving whoever was there.
 */
export const pavilionUpdateSchema = z.object({
  slot: z.number().int().min(1).max(64).optional(),
  title: z.string().trim().min(2).max(120).optional(),
  theme: z.enum(PAVILION_THEMES).optional(),
  status: z.enum(PUBLICATION_STATUSES).optional(),
});

export type PavilionUpdateInput = z.infer<typeof pavilionUpdateSchema>;

/** Paging for the audit log, which is append-only and read newest first. */
export const auditQuerySchema = z.object({
  cursor: z.string().min(10).max(40).optional(),
  action: z.string().trim().max(60).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type AuditQuery = z.infer<typeof auditQuerySchema>;
