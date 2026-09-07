import type { FastifyInstance } from 'fastify';
import {
  AppError,
  auditQuerySchema,
  blockSchema,
  MODERATION_STATUSES,
  pavilionUpdateSchema,
  rejectionSchema,
  SUPPLIER_STATUSES,
  type ModerationStatus,
  type SupplierStatus,
} from '@3dsfera/shared';
import { prisma } from '../../lib/prisma.js';
import { parseInput } from '../../lib/validate.js';
import { recordAudit } from '../../lib/audit.js';
import { hashIp } from '../../lib/tokens.js';
import { env } from '../../env.js';
import { sendModerationNotice } from '../../lib/mailer.js';
import {
  approveProduct,
  listModeration,
  listPavilions,
  listSuppliers,
  readAudit,
  readMetrics,
  rejectProduct,
  setSupplierStatus,
  updatePavilion,
} from './service.js';

/**
 * Administration. Transport only: every decision lives in the service beside
 * it, and every one of them is written to the audit log from here — the log is
 * about who asked, which is a property of the request, not of the database
 * operation.
 */
export async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.requireRole('ADMIN'));

  /**
   * Who is acting, for the audit trail.
   *
   * The role is fixed rather than read from the session: this plugin refuses
   * anything but an admin before the handler runs, so recording whatever the
   * request claimed would only add a way for the two to disagree.
   */
  function actor(request: { currentUser: { id: string } | null; ip: string }) {
    return {
      actorUserId: request.currentUser?.id ?? null,
      actorRole: 'ADMIN' as const,
      ipHash: hashIp(request.ip, env.SESSION_SECRET),
    };
  }

  app.get('/overview', async () => {
    const metrics = await readMetrics(prisma);
    // The dashboard has always answered here; it now gets the same numbers the
    // metrics page does rather than its own smaller set.
    return { counts: metrics.counts };
  });

  app.get('/metrics', async () => readMetrics(prisma));

  app.get('/moderation', async (request) => {
    const { status } = request.query as { status?: string };

    if (status !== undefined && !MODERATION_STATUSES.includes(status as ModerationStatus)) {
      throw new AppError({
        status: 400,
        code: 'ERR_VALIDATION',
        message: `Unknown moderation status "${status}"`,
      });
    }

    const items = await listModeration(
      prisma,
      (status as ModerationStatus | undefined) ?? 'PENDING',
    );
    return { items };
  });

  app.post('/products/:id/approve', async (request) => {
    const { id } = request.params as { id: string };
    await approveProduct(prisma, id);

    const product = await prisma.product.findUnique({
      where: { id },
      select: {
        title: true,
        supplier: { select: { user: { select: { email: true, locale: true } } } },
      },
    });

    await recordAudit({
      ...actor(request),
      action: 'product.approve',
      entityType: 'Product',
      entityId: id,
    });

    if (product) {
      await sendModerationNotice({
        to: product.supplier.user.email,
        locale: product.supplier.user.locale,
        title: product.title,
        approved: true,
        reason: null,
      });
    }

    return { status: 'PUBLISHED' as const };
  });

  app.post('/products/:id/reject', async (request) => {
    const { id } = request.params as { id: string };
    const input = parseInput(rejectionSchema, request.body);

    await rejectProduct(prisma, id, input.reason);

    const product = await prisma.product.findUnique({
      where: { id },
      select: {
        title: true,
        supplier: { select: { user: { select: { email: true, locale: true } } } },
      },
    });

    await recordAudit({
      ...actor(request),
      action: 'product.reject',
      entityType: 'Product',
      entityId: id,
      // The reason is the supplier's to read, not the log's to keep: it can
      // name a person in a photograph or a trademark dispute. The log records
      // that a reason was given and how long it was.
      metadata: { reasonLength: input.reason.length },
    });

    if (product) {
      await sendModerationNotice({
        to: product.supplier.user.email,
        locale: product.supplier.user.locale,
        title: product.title,
        approved: false,
        reason: input.reason,
      });
    }

    return { status: 'REJECTED' as const };
  });

  app.get('/suppliers', async (request) => {
    const { status } = request.query as { status?: string };

    if (status !== undefined && !SUPPLIER_STATUSES.includes(status as SupplierStatus)) {
      throw new AppError({
        status: 400,
        code: 'ERR_VALIDATION',
        message: `Unknown supplier status "${status}"`,
      });
    }

    const suppliers = await listSuppliers(prisma, status as SupplierStatus | undefined);
    return { suppliers };
  });

  app.post('/suppliers/:id/approve', async (request) => {
    const { id } = request.params as { id: string };
    await setSupplierStatus(prisma, id, 'APPROVED', null);

    await recordAudit({
      ...actor(request),
      action: 'supplier.approve',
      entityType: 'Supplier',
      entityId: id,
    });

    return { status: 'APPROVED' as const };
  });

  for (const [path, status, action] of [
    ['/suppliers/:id/reject', 'REJECTED', 'supplier.reject'],
    ['/suppliers/:id/block', 'BLOCKED', 'supplier.block'],
  ] as const) {
    app.post(path, async (request) => {
      const { id } = request.params as { id: string };
      const input = parseInput(status === 'BLOCKED' ? blockSchema : rejectionSchema, request.body);

      await setSupplierStatus(prisma, id, status, input.reason);

      await recordAudit({
        ...actor(request),
        action,
        entityType: 'Supplier',
        entityId: id,
        metadata: { reasonLength: input.reason.length },
      });

      return { status };
    });
  }

  app.get('/pavilions', async () => ({ pavilions: await listPavilions(prisma) }));

  app.put('/pavilions/:id', async (request) => {
    const { id } = request.params as { id: string };
    const input = parseInput(pavilionUpdateSchema, request.body);
    const pavilion = await updatePavilion(prisma, id, input);

    await recordAudit({
      ...actor(request),
      action: 'pavilion.update',
      entityType: 'Pavilion',
      entityId: id,
      metadata: {
        slot: pavilion.slot,
        status: pavilion.status,
        theme: pavilion.theme,
      },
    });

    return { pavilion };
  });

  app.get('/audit', async (request) => {
    const query = parseInput(auditQuerySchema, request.query);
    return readAudit(prisma, query);
  });
}
