import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  AppError,
  UPLOAD_LIMITS,
  interactionListSchema,
  productDraftSchema,
  productFilterSchema,
  productUpdateSchema,
} from '@3dsfera/shared';
import { env } from '../../env.js';
import { prisma } from '../../lib/prisma.js';
import { parseInput } from '../../lib/validate.js';
import { recordAudit } from '../../lib/audit.js';
import { hashIp } from '../../lib/tokens.js';
import { csvTemplate, importProductsCsv } from './csv.js';
import { attachModel, attachPreview } from './processing.js';
import {
  createDraft,
  deleteProduct,
  getProductDetail,
  listProducts,
  replaceInteractions,
  submitForModeration,
  supplierStats,
  updateProduct,
} from './service.js';

/** Every route below belongs to exactly one company. */
function requireSupplierId(request: FastifyRequest): string {
  const supplier = request.currentUser?.supplier;
  if (!supplier) {
    throw new AppError({
      status: 400,
      code: 'ERR_SUPPLIER_PROFILE_REQUIRED',
      message: 'This account has no supplier profile',
    });
  }
  return supplier.id;
}

/** Reads one uploaded file into memory, enforcing the size limit as it streams. */
async function readUpload(request: FastifyRequest, maxBytes: number): Promise<Uint8Array> {
  const file = await request.file({ limits: { fileSize: maxBytes } });

  if (!file) {
    throw new AppError({
      status: 400,
      code: 'ERR_VALIDATION',
      message: 'No file in the request',
    });
  }

  const buffer = await file.toBuffer().catch(() => {
    throw new AppError({
      status: 413,
      code: 'ERR_PAYLOAD_TOO_LARGE',
      message: 'Upload exceeds the size limit',
      params: { max: Math.round(maxBytes / 1024 / 1024) },
    });
  });

  if (file.file.truncated) {
    throw new AppError({
      status: 413,
      code: 'ERR_PAYLOAD_TOO_LARGE',
      message: 'Upload exceeds the size limit',
      params: { max: Math.round(maxBytes / 1024 / 1024) },
    });
  }

  return new Uint8Array(buffer);
}

export async function productRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.requireRole('SUPPLIER', 'ADMIN'));

  app.get('/', async (request) => {
    const supplierId = requireSupplierId(request);
    const filter = parseInput(productFilterSchema, request.query);
    return listProducts(prisma, supplierId, filter);
  });

  app.post('/', async (request, reply) => {
    const supplierId = requireSupplierId(request);
    const input = parseInput(productDraftSchema, request.body);
    const product = await createDraft(prisma, supplierId, input);
    return reply.status(201).send({ id: product.id });
  });

  app.get('/template.csv', async (_request, reply) => {
    void reply.header('content-type', 'text/csv; charset=utf-8');
    void reply.header('content-disposition', 'attachment; filename="3dsfera-products.csv"');
    return reply.send(csvTemplate());
  });

  app.post('/import', async (request) => {
    const supplierId = requireSupplierId(request);
    const bytes = await readUpload(request, 2 * 1024 * 1024);
    const result = await importProductsCsv(prisma, supplierId, Buffer.from(bytes).toString('utf8'));

    await recordAudit({
      actorUserId: request.currentUser?.id ?? null,
      actorRole: request.currentUser?.role ?? 'SUPPLIER',
      action: 'product.import_csv',
      entityType: 'Supplier',
      entityId: supplierId,
      metadata: { created: result.created, skipped: result.skipped },
      ipHash: hashIp(request.ip, env.SESSION_SECRET),
    });

    return result;
  });

  app.get('/:id', async (request) => {
    const supplierId = requireSupplierId(request);
    const { id } = request.params as { id: string };
    return getProductDetail(prisma, supplierId, id);
  });

  app.patch('/:id', async (request) => {
    const supplierId = requireSupplierId(request);
    const { id } = request.params as { id: string };
    const input = parseInput(productUpdateSchema, request.body);
    await updateProduct(prisma, supplierId, id, input);
    return getProductDetail(prisma, supplierId, id);
  });

  app.delete('/:id', async (request, reply) => {
    const supplierId = requireSupplierId(request);
    const { id } = request.params as { id: string };
    await deleteProduct(prisma, supplierId, id);

    await recordAudit({
      actorUserId: request.currentUser?.id ?? null,
      actorRole: request.currentUser?.role ?? 'SUPPLIER',
      action: 'product.delete',
      entityType: 'Product',
      entityId: id,
      ipHash: hashIp(request.ip, env.SESSION_SECRET),
    });

    return reply.status(204).send();
  });

  /**
   * Model upload. Returns as soon as the original is stored and the job is
   * queued; the wizard polls `/:id/job` for progress. A 40 MB model must not
   * hold an HTTP connection open for the length of the optimization.
   */
  app.post('/:id/model', async (request, reply) => {
    const supplierId = requireSupplierId(request);
    const { id } = request.params as { id: string };

    // Ownership before the upload is read: no point streaming 50 MB into
    // memory for a product that belongs to someone else.
    await getProductDetail(prisma, supplierId, id);

    const bytes = await readUpload(request, UPLOAD_LIMITS.modelMaxBytes);
    const { jobId, inspection } = await attachModel(prisma, id, bytes);

    await recordAudit({
      actorUserId: request.currentUser?.id ?? null,
      actorRole: request.currentUser?.role ?? 'SUPPLIER',
      action: 'product.upload_model',
      entityType: 'Product',
      entityId: id,
      metadata: {
        bytes: bytes.byteLength,
        triangles: inspection.triangles,
        clips: inspection.animations.length,
      },
      ipHash: hashIp(request.ip, env.SESSION_SECRET),
    });

    return reply.status(202).send({
      jobId,
      inspection: {
        triangles: inspection.triangles,
        drawnTriangles: inspection.drawnTriangles,
        materials: inspection.materials,
        textures: inspection.textures,
        animations: inspection.animations,
      },
    });
  });

  app.post('/:id/preview', async (request) => {
    const supplierId = requireSupplierId(request);
    const { id } = request.params as { id: string };
    await getProductDetail(prisma, supplierId, id);

    const bytes = await readUpload(request, UPLOAD_LIMITS.imageMaxBytes);
    await attachPreview(prisma, id, bytes);

    return getProductDetail(prisma, supplierId, id);
  });

  app.get('/:id/job', async (request) => {
    const supplierId = requireSupplierId(request);
    const { id } = request.params as { id: string };
    const detail = await getProductDetail(prisma, supplierId, id);
    return { job: detail.job, assets: detail.assets, availableClips: detail.availableClips };
  });

  app.put('/:id/interactions', async (request) => {
    const supplierId = requireSupplierId(request);
    const { id } = request.params as { id: string };
    const input = parseInput(interactionListSchema, request.body);
    await replaceInteractions(prisma, supplierId, id, input);
    return getProductDetail(prisma, supplierId, id);
  });

  app.post('/:id/submit', async (request) => {
    const supplierId = requireSupplierId(request);
    const { id } = request.params as { id: string };
    const result = await submitForModeration(prisma, supplierId, id);

    await recordAudit({
      actorUserId: request.currentUser?.id ?? null,
      actorRole: request.currentUser?.role ?? 'SUPPLIER',
      action: 'product.submit',
      entityType: 'Product',
      entityId: id,
      ipHash: hashIp(request.ip, env.SESSION_SECRET),
    });

    return result;
  });
}

export async function supplierStatsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.requireRole('SUPPLIER', 'ADMIN'));

  app.get('/', async (request) => {
    const supplierId = requireSupplierId(request);
    return supplierStats(prisma, supplierId);
  });
}
