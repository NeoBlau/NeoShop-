import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Logger, NodeIO, type Document, type Transform } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRDracoMeshCompression } from '@gltf-transform/extensions';
import { dedup, prune, simplify, textureCompress, weld } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { inspectModel, type LodEntry, type ModelStats } from '@3dsfera/shared';

const run = promisify(execFile);

/**
 * Server-side optimization of an uploaded model.
 *
 * Every step is optional in the sense that a failure downgrades the result
 * instead of losing the upload: the original is already stored, and whatever
 * the pipeline could not do is reported in `stats.skipped` so the supplier sees
 * an honest number instead of a silent no-op.
 */

/**
 * LOD ladder: full detail, half, quarter. The error budget widens with the
 * level, because a model seen from across the pavilion may lose detail a model
 * at arm's length may not.
 */
const LOD_LEVELS = [
  { ratio: 0.5, error: 0.01 },
  { ratio: 0.25, error: 0.03 },
] as const;

/**
 * A level that barely reduces the triangle count is not worth a second file:
 * the scene would pay a download and a swap for nothing. Hard-surface models
 * (boxes, cylinders) legitimately hit this — their vertices cannot collapse
 * without visibly deforming the silhouette.
 */
const MIN_LOD_REDUCTION = 0.1;
const MAX_TEXTURE_SIZE = 2048;

let ioPromise: Promise<NodeIO> | null = null;

/** One IO instance for the process; the Draco modules are expensive to build. */
async function getIO(): Promise<NodeIO> {
  ioPromise ??= (async () => {
    const [decoder, encoder] = await Promise.all([
      draco3d.createDecoderModule(),
      draco3d.createEncoderModule(),
    ]);

    return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
      'draco3d.decoder': decoder,
      'draco3d.encoder': encoder,
    });
  })();

  return ioPromise;
}

/** gltf-transform narrates every transform; only failures are interesting here. */
const quietLogger = new Logger(Logger.Verbosity.ERROR);

/** True when the KTX-Software CLI is installed and usable. */
async function hasKtxTooling(): Promise<boolean> {
  for (const binary of ['ktx', 'toktx']) {
    try {
      await run(binary, ['--version'], { timeout: 5_000 });
      return true;
    } catch {
      // Not installed, or not on PATH. Try the next name.
    }
  }
  return false;
}

async function applyDraco(document: Document): Promise<void> {
  document.createExtension(KHRDracoMeshCompression).setRequired(true).setEncoderOptions({
    method: KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER,
    encodeSpeed: 5,
    decodeSpeed: 5,
  });
}

function countTriangles(document: Document): number {
  let triangles = 0;
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const indices = primitive.getIndices();
      const position = primitive.getAttribute('POSITION');
      const count = indices?.getCount() ?? position?.getCount() ?? 0;
      triangles += Math.floor(count / 3);
    }
  }
  return triangles;
}

export interface OptimizedModel {
  /** The model the storefront loads by default. */
  optimized: Uint8Array;
  /** Simplified variants, level 1 and 2. Empty when simplification failed. */
  lods: { level: number; bytes: Uint8Array; triangles: number }[];
  stats: ModelStats;
}

/**
 * Runs the full pipeline over the uploaded bytes.
 *
 * @param original bytes exactly as received, already validated as a model
 */
export async function optimizeModel(original: Uint8Array): Promise<OptimizedModel> {
  const startedAt = Date.now();
  const io = await getIO();
  const inspection = inspectModel(original);
  const skipped: string[] = [];

  const baseDocument = await io.readBinary(original);
  baseDocument.setLogger(quietLogger);

  // Order matters: dedup and prune first so later steps do less work; weld
  // before simplify, because the simplifier needs shared vertices to collapse.
  const cleanup: Transform[] = [dedup(), prune({ keepAttributes: false }), weld()];
  await baseDocument.transform(...cleanup);

  const hasTextures = baseDocument.getRoot().listTextures().length > 0;

  if (hasTextures) {
    try {
      await baseDocument.transform(
        textureCompress({
          encoder: sharp,
          targetFormat: 'webp',
          resize: [MAX_TEXTURE_SIZE, MAX_TEXTURE_SIZE],
        }),
      );
    } catch (error) {
      skipped.push('texture_compression');
      console.warn('[pipeline] texture compression failed', error);
    }
  }

  // KTX2/Basis needs the KTX-Software CLI, which is not a Node dependency. It
  // is a real gain on textured models, so its absence is reported rather than
  // hidden — see docs/supplier-guide.md.
  const ktxAvailable = hasTextures ? await hasKtxTooling() : false;
  if (hasTextures && !ktxAvailable) skipped.push('ktx2');
  if (!hasTextures) skipped.push('ktx2_no_textures');

  await applyDraco(baseDocument);
  const optimized = await io.writeBinary(baseDocument);

  const lods: OptimizedModel['lods'] = [];
  const lodEntries: LodEntry[] = [
    { level: 0, triangles: countTriangles(baseDocument), byteSize: optimized.byteLength },
  ];

  const baseTriangles = lodEntries[0]?.triangles ?? 0;

  for (const [index, level] of LOD_LEVELS.entries()) {
    const levelNumber = index + 1;
    try {
      await MeshoptSimplifier.ready;
      // Re-read the original for each level: simplification is destructive and
      // chaining it would compound the error instead of measuring it against
      // the source geometry.
      const lodDocument = await io.readBinary(original);
      lodDocument.setLogger(quietLogger);
      await lodDocument.transform(
        dedup(),
        prune({ keepAttributes: false }),
        weld(),
        simplify({ simplifier: MeshoptSimplifier, ratio: level.ratio, error: level.error }),
      );

      const triangles = countTriangles(lodDocument);
      if (baseTriangles > 0 && triangles > baseTriangles * (1 - MIN_LOD_REDUCTION)) {
        skipped.push(`lod_${levelNumber}_no_gain`);
        continue;
      }

      await applyDraco(lodDocument);
      const bytes = await io.writeBinary(lodDocument);
      lods.push({ level: levelNumber, bytes, triangles });
      lodEntries.push({ level: levelNumber, triangles, byteSize: bytes.byteLength });
    } catch (error) {
      skipped.push(`lod_${levelNumber}_failed`);
      console.warn(`[pipeline] LOD ${levelNumber} failed`, error);
    }
  }

  const stats: ModelStats = {
    originalBytes: original.byteLength,
    optimizedBytes: optimized.byteLength,
    reductionPercent: Math.max(
      0,
      Math.round((1 - optimized.byteLength / Math.max(1, original.byteLength)) * 100),
    ),
    triangles: inspection.triangles,
    drawnTriangles: inspection.drawnTriangles,
    materials: inspection.materials,
    textures: inspection.textures,
    animations: inspection.animations,
    lods: lodEntries,
    dracoApplied: true,
    ktx2Applied: ktxAvailable,
    skipped,
    warnings: [],
    durationMs: Date.now() - startedAt,
  };

  return { optimized, lods, stats };
}
