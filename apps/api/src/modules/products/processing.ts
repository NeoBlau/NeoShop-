import {
  AppError,
  GlbParseError,
  UPLOAD_LIMITS,
  inspectModel,
  validateModel,
  type ErrorCode,
  type ModelInspection,
} from '@3dsfera/shared';
import sharp from 'sharp';
import type { Db } from '../../lib/prisma.js';
import { prisma } from '../../lib/prisma.js';
import { buildKey, getObject, putObject } from '../../lib/storage.js';
import { toJsonValue } from '../../lib/json.js';
import { optimizeModel } from './pipeline.js';

export const MODEL_CONTENT_TYPE = 'model/gltf-binary';

/** Maps a container-level parse failure to the client-facing error contract. */
function parseErrorToAppError(error: GlbParseError): AppError {
  const codes: Record<string, ErrorCode> = {
    not_a_model: 'ERR_UNSUPPORTED_FILE',
    unsupported_version: 'ERR_UNSUPPORTED_FILE',
    truncated: 'ERR_UNSUPPORTED_FILE',
    missing_json_chunk: 'ERR_UNSUPPORTED_FILE',
    malformed_json: 'ERR_UNSUPPORTED_FILE',
  };

  return new AppError({
    status: 415,
    code: codes[error.code] ?? 'ERR_UNSUPPORTED_FILE',
    message: error.message,
    params: { reason: error.code },
  });
}

/**
 * Validates an uploaded model by its content and stores the original.
 *
 * The extension is never consulted: a file called `chair.glb` that is really a
 * zip archive fails here, and a correct model uploaded as `chair.bin` passes.
 */
export async function attachModel(
  db: Db,
  productId: string,
  bytes: Uint8Array,
  options: { enqueue?: boolean } = {},
): Promise<{ jobId: string; inspection: ModelInspection }> {
  if (bytes.byteLength > UPLOAD_LIMITS.modelMaxBytes) {
    throw new AppError({
      status: 413,
      code: 'ERR_MODEL_TOO_LARGE',
      message: 'Model exceeds the upload limit',
      params: { max: Math.round(UPLOAD_LIMITS.modelMaxBytes / 1024 / 1024) },
    });
  }

  let inspection: ModelInspection;
  try {
    inspection = inspectModel(bytes);
  } catch (error) {
    if (error instanceof GlbParseError) throw parseErrorToAppError(error);
    throw error;
  }

  const verdict = validateModel(inspection);
  const blocking = verdict.errors[0];
  if (blocking) {
    const codes: Record<string, ErrorCode> = {
      model_too_large: 'ERR_MODEL_TOO_LARGE',
      too_many_triangles: 'ERR_MODEL_TOO_COMPLEX',
      too_many_materials: 'ERR_MODEL_TOO_COMPLEX',
      external_resources: 'ERR_UNSUPPORTED_FILE',
      no_geometry: 'ERR_UNSUPPORTED_FILE',
    };

    throw new AppError({
      status: 400,
      code: codes[blocking.code] ?? 'ERR_UNSUPPORTED_FILE',
      message: `Model rejected: ${blocking.code}`,
      params: blocking.params,
    });
  }

  const key = buildKey('private', productId, `original-${Date.now()}.glb`);
  const stored = await putObject(key, bytes, MODEL_CONTENT_TYPE);

  // A re-upload replaces the previous model and everything derived from it.
  // Interactions survive: the supplier usually re-exports the same clips, and
  // `replaceInteractions` rejects any that no longer exist.
  const jobId = await db.$transaction(async (tx) => {
    await tx.productAsset.deleteMany({
      where: { productId, kind: { in: ['GLB_ORIGINAL', 'GLB_OPTIMIZED'] } },
    });

    await tx.productAsset.create({
      data: {
        productId,
        kind: 'GLB_ORIGINAL',
        storageKey: stored.key,
        contentType: stored.contentType,
        byteSize: stored.byteSize,
        checksum: stored.checksum,
        meta: toJsonValue({
          triangles: inspection.triangles,
          drawnTriangles: inspection.drawnTriangles,
          materials: inspection.materials,
          textures: inspection.textures,
          animations: inspection.animations,
          warnings: verdict.warnings,
          container: inspection.container,
        }),
      },
    });

    const job = await tx.modelJob.create({
      data: { productId, status: 'PENDING' },
      select: { id: true },
    });

    return job.id;
  });

  // The seed runs the job itself and waits for it; the API hands it to the
  // queue and answers immediately.
  if (options.enqueue !== false) enqueueModelJob(jobId);

  return { jobId, inspection };
}

/**
 * Jobs run one at a time. Optimization is CPU-bound and allocates the whole
 * model in memory; two 50 MB uploads in parallel would compete for the same
 * core and double the peak memory of the API process.
 */
let queue: Promise<void> = Promise.resolve();

export function enqueueModelJob(jobId: string): void {
  queue = queue
    .then(() => runModelJob(jobId))
    .catch((error: unknown) => {
      console.error('[processing] job runner crashed', { jobId, error });
    });
}

export async function runModelJob(jobId: string): Promise<void> {
  const job = await prisma.modelJob.findUnique({
    where: { id: jobId },
    select: { id: true, productId: true, attempts: true },
  });

  if (!job) return;

  await prisma.modelJob.update({
    where: { id: job.id },
    data: { status: 'RUNNING', startedAt: new Date(), attempts: job.attempts + 1 },
  });

  try {
    const original = await prisma.productAsset.findFirst({
      where: { productId: job.productId, kind: 'GLB_ORIGINAL' },
      select: { storageKey: true },
    });

    if (!original) throw new Error('Original model asset is missing');

    const bytes = await getObject(original.storageKey);
    const result = await optimizeModel(bytes);

    const optimizedKey = buildKey('public', job.productId, `model-${Date.now()}.glb`);
    const optimized = await putObject(optimizedKey, result.optimized, MODEL_CONTENT_TYPE);

    const lodObjects = await Promise.all(
      result.lods.map(async (lod) => ({
        lod,
        stored: await putObject(
          buildKey('public', job.productId, `model-lod${lod.level}-${Date.now()}.glb`),
          lod.bytes,
          MODEL_CONTENT_TYPE,
        ),
      })),
    );

    await prisma.$transaction(async (tx) => {
      await tx.productAsset.deleteMany({
        where: { productId: job.productId, kind: 'GLB_OPTIMIZED' },
      });

      await tx.productAsset.create({
        data: {
          productId: job.productId,
          kind: 'GLB_OPTIMIZED',
          storageKey: optimized.key,
          contentType: optimized.contentType,
          byteSize: optimized.byteSize,
          checksum: optimized.checksum,
          lodLevel: 0,
          meta: { triangles: result.stats.lods[0]?.triangles ?? result.stats.triangles },
        },
      });

      for (const entry of lodObjects) {
        await tx.productAsset.create({
          data: {
            productId: job.productId,
            kind: 'GLB_OPTIMIZED',
            storageKey: entry.stored.key,
            contentType: entry.stored.contentType,
            byteSize: entry.stored.byteSize,
            checksum: entry.stored.checksum,
            lodLevel: entry.lod.level,
            meta: { triangles: entry.lod.triangles },
          },
        });
      }

      await tx.modelJob.update({
        where: { id: job.id },
        data: {
          status: 'READY',
          finishedAt: new Date(),
          error: null,
          errorCode: null,
          stats: toJsonValue(result.stats),
        },
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[processing] optimization failed', { jobId, message });

    await prisma.modelJob.update({
      where: { id: job.id },
      data: {
        status: 'FAILED',
        finishedAt: new Date(),
        error: message.slice(0, 1000),
        errorCode: 'optimization_failed',
      },
    });
  }
}

/**
 * Re-queues jobs that were interrupted by a restart. Called once at boot: a
 * RUNNING job with no process behind it would otherwise stay RUNNING forever.
 */
export async function requeueInterruptedJobs(): Promise<number> {
  const stuck = await prisma.modelJob.findMany({
    where: { status: { in: ['PENDING', 'RUNNING'] }, attempts: { lt: 3 } },
    select: { id: true },
    take: 50,
  });

  for (const job of stuck) enqueueModelJob(job.id);
  return stuck.length;
}

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];

/**
 * Stores a preview image. The bytes are re-encoded through sharp rather than
 * trusted: that strips metadata, normalises the format, and makes a file that
 * merely claims to be a PNG fail here instead of downstream.
 */
export async function attachPreview(
  db: Db,
  productId: string,
  bytes: Uint8Array,
): Promise<{ url: string }> {
  if (bytes.byteLength > UPLOAD_LIMITS.imageMaxBytes) {
    throw new AppError({
      status: 413,
      code: 'ERR_PAYLOAD_TOO_LARGE',
      message: 'Preview image is too large',
    });
  }

  const looksLikePng = PNG_MAGIC.every((byte, index) => bytes[index] === byte);
  if (!looksLikePng) {
    throw new AppError({
      status: 415,
      code: 'ERR_UNSUPPORTED_FILE',
      message: 'Preview must be a PNG',
    });
  }

  let webp: Buffer;
  try {
    webp = await sharp(bytes).resize(640, 480, { fit: 'cover' }).webp({ quality: 82 }).toBuffer();
  } catch (error) {
    throw new AppError({
      status: 415,
      code: 'ERR_UNSUPPORTED_FILE',
      message: 'Preview image could not be decoded',
      cause: error,
    });
  }

  const stored = await putObject(
    buildKey('public', productId, `preview-${Date.now()}.webp`),
    new Uint8Array(webp),
    'image/webp',
  );

  await db.$transaction([
    db.productAsset.deleteMany({ where: { productId, kind: 'PREVIEW' } }),
    db.productAsset.create({
      data: {
        productId,
        kind: 'PREVIEW',
        storageKey: stored.key,
        contentType: stored.contentType,
        byteSize: stored.byteSize,
        checksum: stored.checksum,
      },
    }),
  ]);

  return { url: stored.key };
}
