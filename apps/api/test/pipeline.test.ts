import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune } from '@gltf-transform/functions';
import { inspectModel } from '@3dsfera/shared';
import { optimizeModel } from '../src/modules/products/pipeline.js';
import { slugify } from '../src/modules/products/service.js';
import { csvTemplate } from '../src/modules/products/csv.js';

const ASSETS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../prisma/seed-assets');
const read = (file: string): Uint8Array => new Uint8Array(readFileSync(path.join(ASSETS, file)));

/**
 * The demo models carry 4K textures, and compressing those takes a minute or
 * two per model — correct for a background job, wrong for a test suite. The
 * geometry tests therefore run against a stripped copy: same meshes, same
 * animations, no images. The texture path has its own test below, behind a
 * flag.
 */
async function withoutTextures(bytes: Uint8Array): Promise<Uint8Array> {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const document = await io.readBinary(bytes);

  for (const material of document.getRoot().listMaterials()) {
    material
      .setBaseColorTexture(null)
      .setNormalTexture(null)
      .setMetallicRoughnessTexture(null)
      .setOcclusionTexture(null)
      .setEmissiveTexture(null);
  }

  await document.transform(prune());
  return io.writeBinary(document);
}

describe('optimizeModel', () => {
  it('compresses geometry and keeps the animations intact', async () => {
    const original = await withoutTextures(read('antenna-orbita.glb'));
    const result = await optimizeModel(original);

    expect(result.stats.optimizedBytes).toBeLessThan(result.stats.originalBytes);
    expect(result.stats.reductionPercent).toBeGreaterThan(20);
    expect(result.stats.dracoApplied).toBe(true);

    // Optimization must never cost the supplier their animation clips: they are
    // the entire point of the product.
    const optimized = inspectModel(result.optimized);
    expect(optimized.animations.map((clip) => clip.name)).toEqual([
      'deploy',
      'track_signal',
      'fold',
    ]);
    expect(optimized.hasDracoCompression).toBe(true);
  }, 60_000);

  it('produces detail levels that actually have fewer triangles', async () => {
    const result = await optimizeModel(await withoutTextures(read('antenna-orbita.glb')));

    expect(result.lods.length).toBeGreaterThan(0);
    const full = result.stats.lods[0];
    expect(full).toBeDefined();

    for (const lod of result.lods) {
      expect(lod.triangles).toBeLessThan(full?.triangles ?? 0);
    }
  }, 60_000);

  it('skips a detail level that would not pay off, and says so', async () => {
    // The chair is 72 hard-surface triangles: nothing can be collapsed without
    // wrecking the silhouette, so both levels are skipped by design.
    const result = await optimizeModel(await withoutTextures(read('recliner-chair.glb')));

    expect(result.lods).toEqual([]);
    expect(result.stats.skipped.some((entry) => entry.startsWith('lod_'))).toBe(true);
  }, 60_000);

  it('reports that KTX2 was not applicable rather than claiming it ran', async () => {
    const result = await optimizeModel(await withoutTextures(read('desk-lamp.glb')));

    expect(result.stats.ktx2Applied).toBe(false);
    expect(result.stats.skipped).toContain('ktx2_no_textures');
  }, 60_000);
});

/**
 * The texture path, end to end, on a real 4K model. Encoding takes minutes, so
 * it is opt-in:
 *
 *   PIPELINE_TEXTURE_TEST=1 pnpm --filter @3dsfera/api test
 */
describe.runIf(process.env['PIPELINE_TEXTURE_TEST'] === '1')('optimizeModel with textures', () => {
  it('converts every texture to KTX2 and keeps the model loadable', async () => {
    const original = read('desk-lamp.glb');
    const before = inspectModel(original);
    const result = await optimizeModel(original);
    const after = inspectModel(result.optimized);

    expect(result.stats.ktx2Applied).toBe(true);
    expect(after.extensionsUsed).toContain('KHR_texture_basisu');
    expect(after.textures).toBe(before.textures);
    expect(result.stats.optimizedBytes).toBeLessThan(result.stats.originalBytes);
  }, 600_000);
});

describe('slugify', () => {
  it('transliterates Russian titles into readable slugs', () => {
    expect(slugify('Антенна спутниковая «Орбита 1.2»')).toBe('antenna-sputnikovaya-orbita-1-2');
    expect(slugify('Робот-пылесос «Домовой X2»')).toBe('robot-pylesos-domovoy-x2');
  });

  it('never produces an empty or unbounded slug', () => {
    expect(slugify('!!!')).toBe('product');
    expect(slugify('я'.repeat(200)).length).toBeLessThanOrEqual(60);
  });
});

describe('csvTemplate', () => {
  it('starts with the exact header the importer expects', () => {
    const [header] = csvTemplate().split('\n');
    expect(header).toBe(
      'title,description,category,price,currency,stock,weight_g,length_mm,width_mm,height_mm',
    );
  });
});
