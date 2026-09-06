import type { UserRole } from '@3dsfera/shared';
import { prisma } from './prisma.js';

export interface AuditEntry {
  actorUserId: string | null;
  actorRole: UserRole;
  action: string;
  entityType: string;
  entityId?: string | null;
  /** Ids, counts, status transitions — never names, emails or addresses. */
  metadata?: Record<string, string | number | boolean | null>;
  ipHash?: string | null;
}

/**
 * Writes an audit entry. Failures are swallowed on purpose: losing a log line
 * must not roll back the action the user actually asked for. The failure is
 * reported to stderr so it is still visible.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: entry.actorUserId,
        actorRole: entry.actorRole,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        ...(entry.metadata ? { metadata: entry.metadata } : {}),
        ipHash: entry.ipHash ?? null,
      },
    });
  } catch (error) {
    console.error('[audit] failed to write entry', { action: entry.action, error });
  }
}
