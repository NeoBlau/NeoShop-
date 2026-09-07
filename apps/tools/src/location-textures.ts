/**
 * Re-encodes a location's textures for the web.
 *
 * The source scene ships 2K KTX2 maps with no mipmaps at all, which is the one
 * thing a walkable street cannot have: without mips every distant wall shimmers
 * as the camera moves, and the GPU reads a full-resolution texel for a pixel
 * that covers a hundred of them. So every map is decoded, resized to its budget
 * and re-encoded with a mip chain.
 *
 * The codec is chosen per role, not globally:
 *
 *   base colour   ETC1S   small, and colour hides its artefacts
 *   foliage       UASTC   alpha-cutout leaves fall apart under ETC1S
 *   normal        UASTC   ETC1S normals produce faceted, swimming lighting
 *   occlusion,
 *   roughness,
 *   metalness     ETC1S   three packed channels, none of them looked at directly
 *
 * That split is the whole reason the set fits: encoding everything as UASTC
 * would be four times the bytes, and everything as ETC1S would look wrong in
 * exactly the two places a person looks.
 */
import { mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { ensureKtx, type Ktx } from './ktx.js';

export type TextureRole = 'baseColor' | 'foliage' | 'normal' | 'orm' | 'emissive';

export interface TextureBudget {
  /** Longest edge, in pixels. */
  size: number;
  codec: 'etc1s' | 'uastc';
  /** Colour data is stored gamma-encoded; everything else is numbers. */
  srgb: boolean;
}

export type TextureBudgets = Record<TextureRole, TextureBudget>;

/**
 * What the top tier gets. A 2K base colour is the source resolution — there is
 * no fourth K to be had from a 2K scan, and inventing one costs bytes without
 * adding a single texel of detail.
 */
export const HIGH_BUDGETS: TextureBudgets = {
  baseColor: { size: 2048, codec: 'etc1s', srgb: true },
  foliage: { size: 1024, codec: 'uastc', srgb: true },
  normal: { size: 1024, codec: 'uastc', srgb: false },
  orm: { size: 1024, codec: 'etc1s', srgb: false },
  emissive: { size: 1024, codec: 'etc1s', srgb: true },
};

/** And what a phone gets. Half the edge is a quarter of the memory. */
export const LOW_BUDGETS: TextureBudgets = {
  baseColor: { size: 1024, codec: 'etc1s', srgb: true },
  foliage: { size: 512, codec: 'uastc', srgb: true },
  normal: { size: 512, codec: 'uastc', srgb: false },
  orm: { size: 512, codec: 'etc1s', srgb: false },
  emissive: { size: 512, codec: 'etc1s', srgb: true },
};

/** Reads the role out of the file name the scene's authors used. */
export function roleOf(name: string): TextureRole {
  const lower = name.toLowerCase();
  if (lower.includes('normal')) return 'normal';
  if (lower.includes('emissive')) return 'emissive';
  if (lower.includes('specular') || lower.includes('orm') || lower.includes('roughness')) {
    return 'orm';
  }
  // Leaves and grass are cut out with the alpha channel, and ETC1S stores
  // alpha as a second, coarser slice: under it a linden tree loses its leaf
  // edges and grows a halo.
  if (lower.includes('foliage') || lower.includes('leaves') || lower.includes('grass')) {
    return 'foliage';
  }
  return 'baseColor';
}

function encodeArgs(budget: TextureBudget): string[] {
  const common = [
    '--generate-mipmap',
    '--assign-tf',
    budget.srgb ? 'srgb' : 'linear',
    '--format',
    budget.srgb ? 'R8G8B8A8_SRGB' : 'R8G8B8A8_UNORM',
  ];

  if (budget.codec === 'uastc') {
    return [
      ...common,
      '--encode',
      'uastc',
      '--uastc-quality',
      '2',
      // UASTC is a fixed 8 bits per texel; the supercompression is where the
      // saving is, and it is lossless.
      '--zstd',
      '18',
    ];
  }

  return [...common, '--encode', 'basis-lz', '--clevel', '2', '--qlevel', '200'];
}

export interface TextureResult {
  source: string;
  target: string;
  role: TextureRole;
  bytes: number;
}

async function convertOne(
  ktx: Ktx,
  source: string,
  targetDir: string,
  scratchDir: string,
  budgets: TextureBudgets,
): Promise<TextureResult> {
  const name = path.basename(source, '.ktx2');
  const role = roleOf(name);
  const budget = budgets[role];

  const decoded = path.join(scratchDir, `${name}.png`);
  const resized = path.join(scratchDir, `${name}.resized.png`);
  const target = path.join(targetDir, `${name}.ktx2`);

  await ktx.decode(source, decoded);

  // Block codecs want multiples of four; a resize to an odd edge is refused by
  // the encoder rather than rounded, so the budget is applied as a ceiling on
  // the longest edge and the aspect ratio is kept.
  await sharp(decoded)
    .resize({
      width: budget.size,
      height: budget.size,
      fit: 'inside',
      withoutEnlargement: true,
      kernel: 'lanczos3',
    })
    .png({ compressionLevel: 1 })
    .toFile(resized);

  await ktx.encode(resized, target, encodeArgs(budget));

  return { source, target, role, bytes: statSync(target).size };
}

/**
 * Converts every texture, a few at a time.
 *
 * The encoder is already multi-threaded, so the concurrency here is about
 * keeping it fed through the single-threaded decode and resize either side of
 * it rather than about using more cores than exist.
 */
export async function convertTextures(options: {
  sources: string[];
  targetDir: string;
  scratchDir: string;
  budgets: TextureBudgets;
  concurrency?: number;
  onProgress?: (done: number, total: number, result: TextureResult) => void;
}): Promise<TextureResult[]> {
  const ktx = await ensureKtx();
  mkdirSync(options.targetDir, { recursive: true });
  mkdirSync(options.scratchDir, { recursive: true });

  const results: TextureResult[] = [];
  const queue = [...options.sources];
  const workers = Math.max(1, options.concurrency ?? 3);
  let done = 0;

  await Promise.all(
    Array.from({ length: workers }, async () => {
      for (;;) {
        const source = queue.shift();
        if (!source) return;

        const result = await convertOne(
          ktx,
          source,
          options.targetDir,
          options.scratchDir,
          options.budgets,
        );

        results.push(result);
        done += 1;
        options.onProgress?.(done, options.sources.length, result);
      }
    }),
  );

  return results;
}
