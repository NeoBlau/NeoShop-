import {
  AppError,
  type AdminMetrics,
  type AdminPavilion,
  type AdminSupplier,
  type AuditEntry,
  type AuditPage,
  type AuditQuery,
  type Currency,
  type ModerationItem,
  type ModerationStatus,
  type PavilionUpdateInput,
  type SupplierStatus,
  type WorldModelLevel,
} from '@3dsfera/shared';
import type { Db } from '../../lib/prisma.js';
import { publicUrl } from '../../lib/storage.js';

/**
 * What an administrator can see and do.
 *
 * Two rules run through all of it. Every decision that changes what a buyer
 * sees is written to the audit log with the reason attached, and no decision
 * is silent towards the person it affects: a rejected product carries the text
 * back to the supplier's wizard, a blocked company carries it to their
 * dashboard.
 *
 * Nothing here reaches into a buyer's data. Orders are counted and their
 * totals summed; whose they are and where they went is not the moderator's
 * business, and the shipping address is not joined in any query in this file.
 */

interface AssetRow {
  kind: string;
  storageKey: string;
  byteSize: number;
  lodLevel: number | null;
  meta: unknown;
}

function toLevels(assets: AssetRow[]): WorldModelLevel[] {
  return assets
    .filter((asset) => asset.kind === 'GLB_OPTIMIZED' && asset.lodLevel !== null)
    .map((asset) => ({
      level: asset.lodLevel ?? 0,
      url: publicUrl(asset.storageKey),
      byteSize: asset.byteSize,
      triangles: (asset.meta as { triangles?: number } | null)?.triangles ?? 0,
    }))
    .sort((a, b) => a.level - b.level);
}

/** The measurements the upload pipeline took, so a decision needs no re-upload. */
function toStats(assets: AssetRow[]): ModerationItem['stats'] {
  const full = assets.find((asset) => asset.kind === 'GLB_OPTIMIZED' && asset.lodLevel === 0);
  if (!full) return null;

  const meta = full.meta as { triangles?: number; materials?: number; textures?: number } | null;

  return {
    triangles: meta?.triangles ?? 0,
    materials: meta?.materials ?? 0,
    textures: meta?.textures ?? 0,
    bytes: full.byteSize,
  };
}

export async function listModeration(
  db: Db,
  status: ModerationStatus = 'PENDING',
): Promise<ModerationItem[]> {
  const products = await db.product.findMany({
    where: { status },
    // Oldest first: a queue that shows the newest first is a queue nobody
    // reaches the bottom of.
    orderBy: [{ submittedAt: 'asc' }, { createdAt: 'asc' }],
    take: 100,
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      category: true,
      priceCents: true,
      currency: true,
      status: true,
      submittedAt: true,
      supplier: { select: { id: true, companyName: true, status: true } },
      assets: {
        select: { kind: true, storageKey: true, byteSize: true, lodLevel: true, meta: true },
      },
      interactions: {
        orderBy: { order: 'asc' },
        select: { id: true, label: true, clipName: true },
      },
    },
  });

  return products.map((product) => {
    const preview = product.assets.find((asset) => asset.kind === 'PREVIEW');

    return {
      id: product.id,
      slug: product.slug,
      title: product.title,
      description: product.description,
      category: product.category,
      priceCents: product.priceCents,
      currency: product.currency,
      status: product.status,
      submittedAt: product.submittedAt?.toISOString() ?? null,
      supplier: product.supplier,
      levels: toLevels(product.assets),
      previewUrl: preview ? publicUrl(preview.storageKey) : null,
      interactions: product.interactions,
      stats: toStats(product.assets),
    };
  });
}

/**
 * Publishes a product.
 *
 * Refused when the model has not finished processing: publishing a product
 * with no geometry puts an empty plinth on the street, and the buyer has no
 * way to tell that from a bug.
 */
export async function approveProduct(db: Db, productId: string): Promise<void> {
  const product = await db.product.findUnique({
    where: { id: productId },
    select: {
      status: true,
      supplier: { select: { status: true } },
      assets: { select: { kind: true, lodLevel: true } },
    },
  });

  if (!product) {
    throw new AppError({ status: 404, code: 'ERR_NOT_FOUND', message: 'Product not found' });
  }

  const hasModel = product.assets.some(
    (asset) => asset.kind === 'GLB_OPTIMIZED' && asset.lodLevel === 0,
  );

  if (!hasModel) {
    throw new AppError({
      status: 409,
      code: 'ERR_CONFLICT',
      message: 'The model has not finished processing yet',
    });
  }

  if (product.supplier.status !== 'APPROVED') {
    throw new AppError({
      status: 409,
      code: 'ERR_SUPPLIER_NOT_APPROVED',
      message: 'The supplier is not approved',
    });
  }

  await db.product.update({
    where: { id: productId },
    data: { status: 'PUBLISHED', publishedAt: new Date(), rejectionReason: null },
  });
}

export async function rejectProduct(db: Db, productId: string, reason: string): Promise<void> {
  const updated = await db.product.updateMany({
    where: { id: productId },
    data: { status: 'REJECTED', rejectionReason: reason, publishedAt: null },
  });

  if (updated.count === 0) {
    throw new AppError({ status: 404, code: 'ERR_NOT_FOUND', message: 'Product not found' });
  }
}

export async function listSuppliers(db: Db, status?: SupplierStatus): Promise<AdminSupplier[]> {
  const suppliers = await db.supplier.findMany({
    ...(status ? { where: { status } } : {}),
    orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    take: 200,
    select: {
      id: true,
      companyName: true,
      legalName: true,
      taxId: true,
      contactEmail: true,
      status: true,
      rejectionReason: true,
      createdAt: true,
      _count: { select: { products: true, pavilions: true } },
    },
  });

  return suppliers.map((supplier) => ({
    id: supplier.id,
    companyName: supplier.companyName,
    legalName: supplier.legalName,
    taxId: supplier.taxId,
    contactEmail: supplier.contactEmail,
    status: supplier.status,
    rejectionReason: supplier.rejectionReason,
    createdAt: supplier.createdAt.toISOString(),
    productCount: supplier._count.products,
    pavilionCount: supplier._count.pavilions,
  }));
}

/**
 * Moves a supplier between states.
 *
 * Blocking is not a delete. Their products stop appearing — the world query
 * only shows approved suppliers — but the rows stay, because an order already
 * placed against one of them still has to be shipped and refunded like any
 * other.
 */
export async function setSupplierStatus(
  db: Db,
  supplierId: string,
  status: SupplierStatus,
  reason: string | null,
): Promise<void> {
  const updated = await db.supplier.updateMany({
    where: { id: supplierId },
    data: { status, rejectionReason: reason },
  });

  if (updated.count === 0) {
    throw new AppError({ status: 404, code: 'ERR_NOT_FOUND', message: 'Supplier not found' });
  }
}

export async function listPavilions(db: Db): Promise<AdminPavilion[]> {
  const pavilions = await db.pavilion.findMany({
    orderBy: { slot: 'asc' },
    select: {
      id: true,
      slot: true,
      title: true,
      theme: true,
      status: true,
      supplier: { select: { id: true, companyName: true, status: true } },
      _count: { select: { products: true } },
    },
  });

  return pavilions.map((pavilion) => ({
    id: pavilion.id,
    slot: pavilion.slot,
    title: pavilion.title,
    theme: pavilion.theme,
    status: pavilion.status,
    supplier: pavilion.supplier,
    productCount: pavilion._count.products,
  }));
}

/**
 * Moves a pavilion, renames it, or takes it off the street.
 *
 * Slots are unique across the world. A taken slot answers with a conflict
 * rather than swapping the two shops, because a silent swap is a change to
 * somebody else's pavilion that nobody asked for and nobody was told about.
 */
export async function updatePavilion(
  db: Db,
  pavilionId: string,
  input: PavilionUpdateInput,
): Promise<AdminPavilion> {
  if (input.slot !== undefined) {
    const taken = await db.pavilion.findFirst({
      where: { slot: input.slot, id: { not: pavilionId } },
      select: { id: true },
    });

    if (taken) {
      throw new AppError({
        status: 409,
        code: 'ERR_CONFLICT',
        message: `Slot ${input.slot} is already taken`,
        params: { slot: input.slot },
      });
    }
  }

  const exists = await db.pavilion.findUnique({ where: { id: pavilionId }, select: { id: true } });
  if (!exists) {
    throw new AppError({ status: 404, code: 'ERR_NOT_FOUND', message: 'Pavilion not found' });
  }

  await db.pavilion.update({
    where: { id: pavilionId },
    data: {
      ...(input.slot !== undefined ? { slot: input.slot } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.theme !== undefined ? { theme: input.theme } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
  });

  const pavilions = await listPavilions(db);
  const updated = pavilions.find((pavilion) => pavilion.id === pavilionId);

  if (!updated) {
    throw new AppError({ status: 404, code: 'ERR_NOT_FOUND', message: 'Pavilion not found' });
  }

  return updated;
}

/**
 * The audit log, newest first.
 *
 * Keyset paging on the id rather than an offset: the log is append-only and
 * busy, and an offset page two is a different page every time somebody acts
 * while you are reading.
 */
export async function readAudit(db: Db, query: AuditQuery): Promise<AuditPage> {
  const entries = await db.auditLog.findMany({
    where: query.action ? { action: { startsWith: query.action } } : {},
    orderBy: { createdAt: 'desc' },
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      metadata: true,
      createdAt: true,
      actor: { select: { id: true, email: true, role: true } },
    },
  });

  const page = entries.slice(0, query.limit);
  const next = entries.length > query.limit ? page[page.length - 1]?.id : undefined;

  const mapped: AuditEntry[] = page.map((entry) => ({
    id: entry.id,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    actor: entry.actor,
    metadata: (entry.metadata as Record<string, unknown> | null) ?? null,
    createdAt: entry.createdAt.toISOString(),
  }));

  return { entries: mapped, ...(next ? { nextCursor: next } : {}) };
}

/** Days of history the order chart covers. */
const CHART_DAYS = 14;

export async function readMetrics(db: Db): Promise<AdminMetrics> {
  const since = new Date(Date.now() - CHART_DAYS * 24 * 60 * 60 * 1000);
  since.setHours(0, 0, 0, 0);

  const [
    users,
    suppliersPending,
    suppliersApproved,
    suppliersBlocked,
    productsPending,
    productsPublished,
    pavilions,
    orders,
    revenue,
    top,
    recent,
  ] = await Promise.all([
    db.user.count(),
    db.supplier.count({ where: { status: 'PENDING' } }),
    db.supplier.count({ where: { status: 'APPROVED' } }),
    db.supplier.count({ where: { status: 'BLOCKED' } }),
    db.product.count({ where: { status: 'PENDING' } }),
    db.product.count({ where: { status: 'PUBLISHED' } }),
    db.pavilion.count(),
    db.order.count(),
    db.order.groupBy({
      by: ['currency'],
      where: { status: { in: ['PAID', 'PACKING', 'SHIPPED', 'DELIVERED'] } },
      _sum: { totalCents: true },
      _count: { _all: true },
    }),
    db.product.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: [{ orderCount: 'desc' }, { viewCount: 'desc' }],
      take: 10,
      select: {
        id: true,
        title: true,
        viewCount: true,
        orderCount: true,
        supplier: { select: { companyName: true } },
      },
    }),
    db.order.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, totalCents: true, status: true },
    }),
  ]);

  // Grouped in application code rather than in SQL: fourteen days of orders is
  // a handful of rows, and a date_trunc here would be the only raw query in
  // the codebase.
  const byDay = new Map<string, { orders: number; paidCents: number }>();
  for (let day = 0; day < CHART_DAYS; day += 1) {
    const date = new Date(since);
    date.setDate(date.getDate() + day);
    byDay.set(date.toISOString().slice(0, 10), { orders: 0, paidCents: 0 });
  }

  for (const order of recent) {
    const key = order.createdAt.toISOString().slice(0, 10);
    const bucket = byDay.get(key);
    if (!bucket) continue;

    bucket.orders += 1;
    if (order.status !== 'PENDING' && order.status !== 'CANCELLED') {
      bucket.paidCents += order.totalCents;
    }
  }

  return {
    counts: {
      users,
      suppliersPending,
      suppliersApproved,
      suppliersBlocked,
      productsPending,
      productsPublished,
      pavilions,
      orders,
    },
    revenue: revenue.map((row) => ({
      currency: row.currency as Currency,
      paidCents: row._sum.totalCents ?? 0,
      orders: row._count._all,
    })),
    topProducts: top.map((product) => ({
      id: product.id,
      title: product.title,
      supplierName: product.supplier.companyName,
      viewCount: product.viewCount,
      orderCount: product.orderCount,
      conversion:
        product.viewCount > 0
          ? Math.round((product.orderCount / product.viewCount) * 1000) / 10
          : 0,
    })),
    ordersByDay: [...byDay.entries()].map(([day, value]) => ({ day, ...value })),
  };
}
