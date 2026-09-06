import { randomBytes } from 'node:crypto';
import {
  AppError,
  type AnimationClipInfo,
  type InteractionListInput,
  type ModelJobDto,
  type ModelStats,
  type ProductDetail,
  type ProductDraftInput,
  type ProductFilterInput,
  type ProductInteractionDto,
  type ProductListResponse,
  type ProductSummary,
  type ProductUpdateInput,
  type SupplierStatsResponse,
} from '@3dsfera/shared';
import type { Db } from '../../lib/prisma.js';
import { omitUndefined } from '../../lib/objects.js';
import { publicUrl, signedUrl } from '../../lib/storage.js';

/**
 * Everything a supplier does to a product. Ownership is a parameter, not an
 * assumption: every function takes the supplier id and scopes its queries by
 * it, so there is no code path that reads or writes another company's product.
 */

const TRANSLITERATION: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'c',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

/** Readable, url-safe slug from a Russian or English title. */
export function slugify(title: string): string {
  const transliterated = [...title.toLowerCase()]
    .map((character) => TRANSLITERATION[character] ?? character)
    .join('');

  const slug = transliterated
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

  return slug.length > 0 ? slug : 'product';
}

/**
 * Slugs are unique across the catalogue, and two suppliers may well both sell
 * a "Робот-пылесос". A short random suffix is cheaper and more predictable
 * than a retry loop on a unique-constraint violation.
 */
async function uniqueSlug(db: Db, title: string): Promise<string> {
  const base = slugify(title);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${randomBytes(3).toString('hex')}`;
    const taken = await db.product.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }

  return `${base}-${randomBytes(6).toString('hex')}`;
}

const summarySelect = {
  id: true,
  slug: true,
  title: true,
  category: true,
  status: true,
  priceCents: true,
  currency: true,
  stock: true,
  viewCount: true,
  orderCount: true,
  updatedAt: true,
  assets: { select: { id: true, kind: true, storageKey: true } },
  _count: { select: { interactions: true } },
  modelJobs: { select: { status: true }, orderBy: { createdAt: 'desc' }, take: 1 },
} as const;

type SummaryRow = {
  id: string;
  slug: string;
  title: string;
  category: ProductSummary['category'];
  status: ProductSummary['status'];
  priceCents: number;
  currency: ProductSummary['currency'];
  stock: number;
  viewCount: number;
  orderCount: number;
  updatedAt: Date;
  assets: { id: string; kind: string; storageKey: string }[];
  _count: { interactions: number };
  modelJobs: { status: ProductSummary['modelStatus'] }[];
};

function toSummary(row: SummaryRow): ProductSummary {
  const preview = row.assets.find((asset) => asset.kind === 'PREVIEW');

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    category: row.category,
    status: row.status,
    priceCents: row.priceCents,
    currency: row.currency,
    stock: row.stock,
    viewCount: row.viewCount,
    orderCount: row.orderCount,
    updatedAt: row.updatedAt.toISOString(),
    previewUrl: preview ? publicUrl(preview.storageKey) : null,
    hasModel: row.assets.some((asset) => asset.kind === 'GLB_OPTIMIZED'),
    interactionCount: row._count.interactions,
    modelStatus: row.modelJobs[0]?.status ?? null,
  };
}

export async function listProducts(
  db: Db,
  supplierId: string,
  filter: ProductFilterInput,
): Promise<ProductListResponse> {
  const where = {
    supplierId,
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.category ? { category: filter.category } : {}),
    ...(filter.search ? { title: { contains: filter.search, mode: 'insensitive' as const } } : {}),
  };

  const [rows, total] = await Promise.all([
    db.product.findMany({
      where,
      select: summarySelect,
      orderBy: { updatedAt: 'desc' },
      take: filter.limit + 1,
      ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    }),
    db.product.count({ where }),
  ]);

  const page = rows.slice(0, filter.limit);
  const nextCursor = rows.length > filter.limit ? (page.at(-1)?.id ?? null) : null;

  return { products: page.map(toSummary), nextCursor, total };
}

function toInteraction(row: {
  id: string;
  type: ProductInteractionDto['type'];
  clipName: string | null;
  label: string;
  labelEn: string | null;
  order: number;
  loop: boolean;
  config: unknown;
}): ProductInteractionDto {
  return {
    id: row.id,
    type: row.type,
    clipName: row.clipName,
    label: row.label,
    labelEn: row.labelEn,
    order: row.order,
    loop: row.loop,
    config: (row.config as ProductInteractionDto['config']) ?? null,
  };
}

function toJob(row: {
  id: string;
  status: ModelJobDto['status'];
  errorCode: string | null;
  stats: unknown;
  attempts: number;
  createdAt: Date;
  finishedAt: Date | null;
}): ModelJobDto {
  return {
    id: row.id,
    status: row.status,
    errorCode: row.errorCode,
    stats: (row.stats as ModelStats | null) ?? null,
    attempts: row.attempts,
    createdAt: row.createdAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
  };
}

export async function getProductDetail(
  db: Db,
  supplierId: string,
  productId: string,
): Promise<ProductDetail> {
  const product = await db.product.findFirst({
    where: { id: productId, supplierId },
    select: {
      ...summarySelect,
      description: true,
      weightGrams: true,
      lengthMm: true,
      widthMm: true,
      heightMm: true,
      rejectionReason: true,
      submittedAt: true,
      publishedAt: true,
      assets: {
        select: {
          id: true,
          kind: true,
          storageKey: true,
          contentType: true,
          byteSize: true,
          lodLevel: true,
          meta: true,
        },
        orderBy: { createdAt: 'asc' },
      },
      interactions: {
        select: {
          id: true,
          type: true,
          clipName: true,
          label: true,
          labelEn: true,
          order: true,
          loop: true,
          config: true,
        },
        orderBy: { order: 'asc' },
      },
      modelJobs: {
        select: {
          id: true,
          status: true,
          errorCode: true,
          stats: true,
          attempts: true,
          createdAt: true,
          finishedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!product) {
    throw new AppError({ status: 404, code: 'ERR_NOT_FOUND', message: 'Product not found' });
  }

  // Originals stay private, so their links are signed and short-lived.
  const assets = await Promise.all(
    product.assets.map(async (asset) => ({
      id: asset.id,
      kind: asset.kind,
      url: asset.storageKey.startsWith('public/')
        ? publicUrl(asset.storageKey)
        : await signedUrl(asset.storageKey),
      byteSize: asset.byteSize,
      contentType: asset.contentType,
      lodLevel: asset.lodLevel,
    })),
  );

  const originalMeta = product.assets.find((asset) => asset.kind === 'GLB_ORIGINAL')?.meta as
    { animations?: AnimationClipInfo[] } | null | undefined;

  const summary = toSummary({
    ...product,
    assets: product.assets.map((asset) => ({
      id: asset.id,
      kind: asset.kind,
      storageKey: asset.storageKey,
    })),
    modelJobs: product.modelJobs.map((job) => ({ status: job.status })),
  });

  const latestJob = product.modelJobs[0];

  return {
    ...summary,
    description: product.description,
    weightGrams: product.weightGrams,
    lengthMm: product.lengthMm,
    widthMm: product.widthMm,
    heightMm: product.heightMm,
    rejectionReason: product.rejectionReason,
    submittedAt: product.submittedAt?.toISOString() ?? null,
    publishedAt: product.publishedAt?.toISOString() ?? null,
    assets,
    interactions: product.interactions.map(toInteraction),
    job: latestJob ? toJob(latestJob) : null,
    availableClips: originalMeta?.animations ?? [],
  };
}

export async function createDraft(
  db: Db,
  supplierId: string,
  input: ProductDraftInput,
): Promise<{ id: string }> {
  const slug = await uniqueSlug(db, input.title);

  const product = await db.product.create({
    data: {
      supplierId,
      slug,
      title: input.title,
      description: input.description ?? '',
      category: input.category ?? 'OTHER',
      priceCents: input.priceCents ?? 0,
      currency: input.currency ?? 'RUB',
      stock: input.stock ?? 0,
      weightGrams: input.weightGrams ?? 0,
      lengthMm: input.lengthMm ?? 0,
      widthMm: input.widthMm ?? 0,
      heightMm: input.heightMm ?? 0,
      status: 'DRAFT',
    },
    select: { id: true },
  });

  return product;
}

/** Loads a product the supplier owns, or fails with a 404 rather than a 403. */
async function requireOwnedProduct(
  db: Db,
  supplierId: string,
  productId: string,
): Promise<{ id: string; status: ProductSummary['status']; title: string }> {
  const product = await db.product.findFirst({
    where: { id: productId, supplierId },
    select: { id: true, status: true, title: true },
  });

  if (!product) {
    throw new AppError({ status: 404, code: 'ERR_NOT_FOUND', message: 'Product not found' });
  }

  return product;
}

export async function updateProduct(
  db: Db,
  supplierId: string,
  productId: string,
  input: ProductUpdateInput,
): Promise<void> {
  const product = await requireOwnedProduct(db, supplierId, productId);

  // Editing a published product sends it back through moderation: the buyer
  // must not see a price or a description nobody approved.
  const returnsToModeration = product.status === 'PUBLISHED';

  await db.product.update({
    where: { id: product.id },
    data: {
      ...omitUndefined(input),
      ...(returnsToModeration
        ? { status: 'PENDING', submittedAt: new Date(), rejectionReason: null }
        : {}),
    },
  });
}

export async function submitForModeration(
  db: Db,
  supplierId: string,
  productId: string,
): Promise<{ status: ProductSummary['status'] }> {
  const product = await db.product.findFirst({
    where: { id: productId, supplierId },
    select: {
      id: true,
      status: true,
      title: true,
      description: true,
      priceCents: true,
      weightGrams: true,
      lengthMm: true,
      widthMm: true,
      heightMm: true,
      assets: { select: { kind: true } },
    },
  });

  if (!product) {
    throw new AppError({ status: 404, code: 'ERR_NOT_FOUND', message: 'Product not found' });
  }

  const missing: string[] = [];
  if (product.description.trim().length < 10) missing.push('description');
  if (product.priceCents <= 0) missing.push('priceCents');
  if (product.weightGrams <= 0) missing.push('weightGrams');
  if (product.lengthMm <= 0 || product.widthMm <= 0 || product.heightMm <= 0) {
    missing.push('dimensions');
  }
  if (!product.assets.some((asset) => asset.kind === 'GLB_OPTIMIZED')) missing.push('model');

  if (missing.length > 0) {
    throw new AppError({
      status: 400,
      code: 'ERR_VALIDATION',
      message: `Product is not ready for moderation: ${missing.join(', ')}`,
      issues: missing.map((field) => ({ path: field, code: 'required', message: 'required' })),
    });
  }

  await db.product.update({
    where: { id: product.id },
    data: { status: 'PENDING', submittedAt: new Date(), rejectionReason: null },
  });

  return { status: 'PENDING' };
}

export async function replaceInteractions(
  db: Db,
  supplierId: string,
  productId: string,
  input: InteractionListInput,
): Promise<void> {
  await requireOwnedProduct(db, supplierId, productId);

  const original = await db.productAsset.findFirst({
    where: { productId, kind: 'GLB_ORIGINAL' },
    select: { meta: true },
  });

  const meta = original?.meta as { animations?: AnimationClipInfo[] } | null | undefined;
  const knownClips = new Set((meta?.animations ?? []).map((clip) => clip.name));

  // A clip name that is not in the uploaded model would render a button that
  // does nothing. Catch it here rather than in the scene.
  for (const interaction of input.interactions) {
    if (interaction.type !== 'GLTF_ANIMATION') continue;
    if (interaction.clipName && !knownClips.has(interaction.clipName)) {
      throw new AppError({
        status: 400,
        code: 'ERR_VALIDATION',
        message: `Clip "${interaction.clipName}" is not present in the uploaded model`,
        issues: [{ path: 'clipName', code: 'unknown_clip', message: interaction.clipName }],
      });
    }
  }

  await db.$transaction([
    db.productInteraction.deleteMany({ where: { productId } }),
    db.productInteraction.createMany({
      data: input.interactions.map((interaction, index) => ({
        productId,
        type: interaction.type,
        clipName: interaction.clipName ?? null,
        label: interaction.label,
        labelEn: interaction.labelEn ?? null,
        order: interaction.order || index,
        loop: interaction.loop,
        ...(interaction.config ? { config: interaction.config } : {}),
      })),
    }),
  ]);
}

export async function deleteProduct(db: Db, supplierId: string, productId: string): Promise<void> {
  const product = await requireOwnedProduct(db, supplierId, productId);

  if (product.status === 'PUBLISHED') {
    throw new AppError({
      status: 409,
      code: 'ERR_CONFLICT',
      message: 'Unpublish the product before deleting it',
    });
  }

  // Storage objects are left in place deliberately: a delete that races an
  // in-flight optimization would leave dangling keys. A sweeper collects them.
  await db.product.delete({ where: { id: product.id } });
}

export async function supplierStats(db: Db, supplierId: string): Promise<SupplierStatsResponse> {
  const products = await db.product.findMany({
    where: { supplierId },
    select: { id: true, title: true, status: true, viewCount: true, orderCount: true },
    orderBy: { viewCount: 'desc' },
    take: 200,
  });

  const totals = products.reduce(
    (accumulator, product) => ({
      views: accumulator.views + product.viewCount,
      orders: accumulator.orders + product.orderCount,
      published: accumulator.published + (product.status === 'PUBLISHED' ? 1 : 0),
      pending: accumulator.pending + (product.status === 'PENDING' ? 1 : 0),
    }),
    { views: 0, orders: 0, published: 0, pending: 0 },
  );

  return {
    totals,
    rows: products.map((product) => ({
      productId: product.id,
      title: product.title,
      status: product.status,
      views: product.viewCount,
      orders: product.orderCount,
      conversion:
        product.viewCount === 0
          ? 0
          : Math.round((product.orderCount / product.viewCount) * 1000) / 10,
    })),
  };
}

export const ownership = { requireOwnedProduct };
