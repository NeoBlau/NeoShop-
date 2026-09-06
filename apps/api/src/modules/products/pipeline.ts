import { Logger, NodeIO, type Document, type Transform } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRDracoMeshCompression } from '@gltf-transform/extensions';
import { dedup, prune, simplify, textureCompress, weld } from '@gltf-transform/functions';
import { ktx2 } from 'babylonpress-ktx2-encoder/gltf-transform';
import draco3d from 'draco3dgltf';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { inspectModel, type LodEntry, type ModelStats } from '@3dsfera/shared';

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
/**
 * 4096 is the ceiling, not the target: a 4K base colour map is a reasonable ask
 * for a hero product, and KTX2 with mipmaps is what makes it affordable on the
 * GPU. Anything larger is resized before compression.
 */
const MAX_TEXTURE_SIZE = 4096;

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

/**
 * The Basis encoder runs on raw RGBA, so it needs something to decode the JPEG
 * and PNG images out of the glTF first. In the browser that is the canvas; in
 * Node it is sharp.
 */
async function decodeImage(
  buffer: Uint8Array,
): Promise<{ width: number; height: number; data: Uint8Array }> {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return { width: info.width, height: info.height, data: new Uint8Array(data) };
}

/**
 * Texture policy, per map, measured rather than guessed.
 *
 * Encoding a 4096 texture takes 43 seconds with ETC1S and 7 with UASTC on one
 * core; ETC1S produces 0.6 MB where UASTC produces 4.1 MB. Neither codec is
 * simply better, so each map gets the one that suits what it stores:
 *
 *   base colour  4096, ETC1S   the codec treats albedo as a photograph, which
 *                              is what it is; smallest file, and the artefacts
 *                              do not survive a mip chain
 *   normal       2048, UASTC   averaging the channels of a normal map bends the
 *                              surface, so this one keeps its values — and at
 *                              2K it encodes in seconds
 *   ORM          2048, ETC1S   roughness and occlusion are low-frequency; the
 *                              banding ETC1S introduces never changes the shape
 *                              of a highlight
 *
 * Everything gets mipmaps: without them a 4K texture on a distant product
 * shimmers and costs full bandwidth for a handful of pixels.
 */
const TEXTURE_POLICY = [
  { slots: /(baseColorTexture|emissiveTexture)/, maxSize: 4096 },
  { slots: /normalTexture/, maxSize: 2048 },
  { slots: /(metallicRoughnessTexture|occlusionTexture)/, maxSize: 2048 },
] as const;

function ktx2Transforms(): Transform[] {
  return [
    ktx2({
      slots: /normalTexture/,
      isUASTC: true,
      needSupercompression: true,
      // Level 0 is the fast setting. At 2K the difference from level 2 is not
      // visible on a product, and level 2 costs minutes rather than seconds.
      uastcLDRQualityLevel: 0,
      isNormalMap: true,
      isPerceptual: false,
      isSetKTX2SRGBTransferFunc: false,
      generateMipmap: true,
      imageDecoder: decodeImage,
    }),
    ktx2({
      slots: /(metallicRoughnessTexture|occlusionTexture)/,
      isUASTC: false,
      qualityLevel: 190,
      compressionLevel: 2,
      isPerceptual: false,
      isSetKTX2SRGBTransferFunc: false,
      generateMipmap: true,
      imageDecoder: decodeImage,
    }),
    ktx2({
      slots: /(baseColorTexture|emissiveTexture)/,
      isUASTC: false,
      qualityLevel: 210,
      compressionLevel: 2,
      isPerceptual: true,
      isSetKTX2SRGBTransferFunc: true,
      generateMipmap: true,
      imageDecoder: decodeImage,
    }),
  ];
}

/**
 * Resizes each texture to the ceiling for the slot it is used in, before
 * compression does the expensive part. A texture used in two slots takes the
 * larger ceiling: shrinking it for the stricter one would degrade the other.
 */
async function capTextureSizes(document: Document): Promise<number> {
  const limits = new Map<string, number>();
  const keyOf = (texture: { getName(): string; listParents(): unknown[] }): string =>
    texture.getName() || String(texture.listParents().length);

  for (const material of document.getRoot().listMaterials()) {
    // Walking the known accessors is explicit and cheap; the alternative is
    // crawling gltf-transform's property graph for slot names.
    const bySlot = [
      ['baseColorTexture', material.getBaseColorTexture()],
      ['emissiveTexture', material.getEmissiveTexture()],
      ['normalTexture', material.getNormalTexture()],
      ['metallicRoughnessTexture', material.getMetallicRoughnessTexture()],
      ['occlusionTexture', material.getOcclusionTexture()],
    ] as const;

    for (const [slot, texture] of bySlot) {
      if (!texture) continue;
      const policy = TEXTURE_POLICY.find((entry) => entry.slots.test(slot));
      if (!policy) continue;

      const key = keyOf(texture);
      limits.set(key, Math.max(limits.get(key) ?? 0, policy.maxSize));
    }
  }

  let resized = 0;

  for (const texture of document.getRoot().listTextures()) {
    const image = texture.getImage();
    if (!image) continue;

    const maxSize = limits.get(keyOf(texture)) ?? MAX_TEXTURE_SIZE;
    const metadata = await sharp(image).metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    if (width <= maxSize && height <= maxSize) continue;

    const resizer = sharp(image).resize(maxSize, maxSize, { fit: 'inside' });
    const output =
      texture.getMimeType() === 'image/png'
        ? await resizer.png({ compressionLevel: 9 }).toBuffer()
        : await resizer.jpeg({ quality: 95, chromaSubsampling: '4:4:4' }).toBuffer();

    texture.setImage(new Uint8Array(output));
    resized += 1;
  }

  return resized;
}

/** Draco compresses the geometry itself; it is the single largest saving. */
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
  let ktxApplied = false;

  if (hasTextures) {
    const resized = await capTextureSizes(baseDocument);
    if (resized > 0) skipped.push(`resized_${resized}_textures`);

    try {
      await baseDocument.transform(...ktx2Transforms());
      ktxApplied = true;
    } catch (error) {
      // Losing supercompression must not lose the upload: fall back to WebP,
      // which every browser reads, and say so in the report.
      skipped.push('ktx2_failed');
      console.warn('[pipeline] KTX2 compression failed, falling back to WebP', error);

      try {
        await baseDocument.transform(textureCompress({ encoder: sharp, targetFormat: 'webp' }));
      } catch (fallbackError) {
        skipped.push('texture_compression');
        console.warn('[pipeline] texture compression failed', fallbackError);
      }
    }
  } else {
    skipped.push('ktx2_no_textures');
  }

  /**
   * The cleaned, texture-compressed model, serialized once.
   *
   * Every level of detail is built from these bytes rather than from the
   * upload. Re-reading the original would mean compressing the same 4K
   * textures three times — minutes of work per level — and, worse, would ship
   * the uncompressed originals inside each LOD file.
   */
  const sharedBytes = await io.writeBinary(baseDocument);

  const readShared = async (): Promise<Document> => {
    const document = await io.readBinary(sharedBytes);
    document.setLogger(quietLogger);
    return document;
  };

  const fullDetail = await readShared();
  await applyDraco(fullDetail);
  const optimized = await io.writeBinary(fullDetail);

  const lods: OptimizedModel['lods'] = [];
  const baseTriangles = countTriangles(fullDetail);
  const lodEntries: LodEntry[] = [
    { level: 0, triangles: baseTriangles, byteSize: optimized.byteLength },
  ];

  for (const [index, level] of LOD_LEVELS.entries()) {
    const levelNumber = index + 1;
    try {
      await MeshoptSimplifier.ready;
      // Each level is simplified from the shared geometry, not from the level
      // above it: chaining would compound the error instead of measuring it
      // against the source.
      const lodDocument = await readShared();
      await lodDocument.transform(
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
    ktx2Applied: ktxApplied,
    skipped,
    warnings: [],
    durationMs: Date.now() - startedAt,
  };

  return { optimized, lods, stats };
}
