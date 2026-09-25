import {
  AppError,
  DEFAULT_LOCALE,
  LOCALES,
  authoredMissionSchema,
  authoredToMission,
  missionForProduct,
  type AuthoredMissionInput,
  type Locale,
  type Mission,
  type ModerationStatus,
} from '@3dsfera/shared';
import type { PrismaClient } from '../../generated/prisma/client.js';

/**
 * Suppliers writing missions for their own products.
 *
 * The platform's own missions are constants in the shared package. This is the
 * self-service version, and the only thing it adds to the trust model is a
 * moderation step: the script itself is validated by the same schema that the
 * runner and the pace check read it back through, so an authored mission can
 * only fill in a shape that already existed. What it cannot do is set its own
 * discount unreviewed, because the percentage is a promise the platform keeps
 * on the supplier's behalf.
 *
 * One per product, enforced by a unique index rather than by a check here: a
 * product card offers "see it in its own room", and there is one of those.
 */

export interface AuthoredMissionView {
  id: string;
  productId: string;
  status: ModerationStatus;
  rejectionReason: string | null;
  submittedAt: string | null;
  publishedAt: string | null;
  script: AuthoredMissionInput;
}

interface Row {
  id: string;
  productId: string;
  status: ModerationStatus;
  rejectionReason: string | null;
  submittedAt: Date | null;
  publishedAt: Date | null;
  script: unknown;
}

/**
 * A stored row as something the client can edit.
 *
 * The script is re-parsed rather than cast. A row written before a schema
 * change would otherwise reach a form as the wrong shape and be saved back
 * that way, which is how one bad migration becomes a hundred bad rows.
 */
function view(row: Row): AuthoredMissionView {
  const script = authoredMissionSchema.safeParse(row.script);
  if (!script.success) {
    throw new AppError({
      status: 500,
      code: 'ERR_INTERNAL',
      message: `The stored script for mission ${row.id} does not match the current schema`,
      params: { missionId: row.id },
    });
  }

  return {
    id: row.id,
    productId: row.productId,
    status: row.status,
    rejectionReason: row.rejectionReason,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    script: script.data,
  };
}

const SELECT = {
  id: true,
  productId: true,
  status: true,
  rejectionReason: true,
  submittedAt: true,
  publishedAt: true,
  script: true,
} as const;

/** The supplier's own product, or a 404 that does not say whose it is. */
async function ownedProduct(
  prisma: PrismaClient,
  supplierId: string,
  productId: string,
): Promise<{ id: string; slug: string; availableClips: string[] }> {
  const product = await prisma.product.findFirst({
    where: { id: productId, supplierId },
    select: {
      id: true,
      slug: true,
      assets: { select: { kind: true, meta: true } },
    },
  });

  if (!product) {
    throw new AppError({
      status: 404,
      code: 'ERR_NOT_FOUND',
      message: 'No such product',
      params: { productId },
    });
  }

  // The clip names the uploaded model actually contains, as the processing
  // pipeline recorded them. A step may only name one of these, which is what
  // stops a mission asking a buyer to press a button that does nothing.
  const clips = new Set<string>();
  for (const asset of product.assets) {
    const meta = asset.meta as { clips?: { name?: unknown }[] } | null;
    for (const clip of meta?.clips ?? []) {
      if (typeof clip.name === 'string') clips.add(clip.name);
    }
  }

  return { id: product.id, slug: product.slug, availableClips: [...clips] };
}

export async function getMine(
  prisma: PrismaClient,
  supplierId: string,
  productId: string,
): Promise<{ mission: AuthoredMissionView | null; availableClips: string[] }> {
  const product = await ownedProduct(prisma, supplierId, productId);
  const row = await prisma.supplierMission.findUnique({
    where: { productId: product.id },
    select: SELECT,
  });

  return {
    mission: row ? view(row) : null,
    availableClips: product.availableClips,
  };
}

/**
 * Saves a draft.
 *
 * Two checks the schema cannot do on its own, because both need the database:
 * every `play` step must name a clip the supplier's own model contains, and a
 * product the platform already wrote a mission for cannot have a second one —
 * the card has room for one room mission, and ours wins.
 *
 * Saving always lands in DRAFT. A supplier editing a rejected mission has
 * withdrawn it from review by definition, and a supplier editing a published
 * one must not be able to change what buyers are playing without a look.
 */
export async function saveDraft(
  prisma: PrismaClient,
  supplierId: string,
  productId: string,
  input: AuthoredMissionInput,
  zones: readonly string[],
): Promise<AuthoredMissionView> {
  const product = await ownedProduct(prisma, supplierId, productId);

  if (missionForProduct(product.slug)) {
    throw new AppError({
      status: 409,
      code: 'ERR_CONFLICT',
      message: 'This product already has a mission written by the platform',
      params: { productId },
    });
  }

  if (!zones.includes(input.zone)) {
    throw new AppError({
      status: 422,
      code: 'ERR_VALIDATION',
      message: `No demo zone ${input.zone}`,
      params: { zone: input.zone, zones: zones.join(', ') },
    });
  }

  const available = new Set(product.availableClips);
  for (const [index, step] of input.steps.entries()) {
    if (step.kind !== 'play') continue;
    if (step.clipName !== undefined && available.has(step.clipName)) continue;

    throw new AppError({
      status: 422,
      code: 'ERR_VALIDATION',
      message: `Step ${index + 1} names a clip this model does not contain`,
      params: { step: index + 1, clipName: step.clipName ?? '' },
    });
  }

  const row = await prisma.supplierMission.upsert({
    where: { productId: product.id },
    create: {
      productId: product.id,
      zone: input.zone,
      percentOff: input.percentOff,
      script: input,
    },
    update: {
      zone: input.zone,
      percentOff: input.percentOff,
      script: input,
      status: 'DRAFT',
      rejectionReason: null,
      submittedAt: null,
      publishedAt: null,
    },
    select: SELECT,
  });

  return view(row);
}

export async function submitForReview(
  prisma: PrismaClient,
  supplierId: string,
  productId: string,
): Promise<AuthoredMissionView> {
  const product = await ownedProduct(prisma, supplierId, productId);

  const existing = await prisma.supplierMission.findUnique({
    where: { productId: product.id },
    select: { id: true, status: true },
  });

  if (!existing) {
    throw new AppError({
      status: 404,
      code: 'ERR_NOT_FOUND',
      message: 'There is no mission to submit',
      params: { productId },
    });
  }

  if (existing.status === 'PENDING' || existing.status === 'PUBLISHED') {
    throw new AppError({
      status: 409,
      code: 'ERR_CONFLICT',
      message: `This mission is already ${existing.status.toLowerCase()}`,
      params: { status: existing.status },
    });
  }

  const row = await prisma.supplierMission.update({
    where: { id: existing.id },
    data: { status: 'PENDING', submittedAt: new Date(), rejectionReason: null },
    select: SELECT,
  });

  return view(row);
}

export async function removeMine(
  prisma: PrismaClient,
  supplierId: string,
  productId: string,
): Promise<void> {
  const product = await ownedProduct(prisma, supplierId, productId);
  await prisma.supplierMission.deleteMany({ where: { productId: product.id } });
}

// ── Moderation ─────────────────────────────────────────────────────────────

export interface PendingMissionView extends AuthoredMissionView {
  productTitle: string;
  productSlug: string;
  supplierName: string;
}

export async function listPending(prisma: PrismaClient): Promise<PendingMissionView[]> {
  const rows = await prisma.supplierMission.findMany({
    where: { status: 'PENDING' },
    orderBy: { submittedAt: 'asc' },
    select: {
      ...SELECT,
      product: {
        select: { title: true, slug: true, supplier: { select: { companyName: true } } },
      },
    },
  });

  return rows.map((row) => ({
    ...view(row),
    productTitle: row.product.title,
    productSlug: row.product.slug,
    supplierName: row.product.supplier.companyName,
  }));
}

/** Who to write to about a decision, and about what. */
export interface MissionNotice {
  email: string;
  locale: Locale;
  title: string;
}

/** A locale column holds a string; the mailer wants one it can template. */
function asLocale(value: string): Locale {
  return (LOCALES as readonly string[]).includes(value) ? (value as Locale) : DEFAULT_LOCALE;
}

async function decide(
  prisma: PrismaClient,
  missionId: string,
  data: {
    status: ModerationStatus;
    rejectionReason: string | null;
    publishedAt: Date | null;
  },
): Promise<MissionNotice | null> {
  const row = await prisma.supplierMission.findUnique({
    where: { id: missionId },
    select: {
      id: true,
      status: true,
      product: {
        select: {
          title: true,
          supplier: { select: { user: { select: { email: true, locale: true } } } },
        },
      },
    },
  });

  if (!row) {
    throw new AppError({
      status: 404,
      code: 'ERR_NOT_FOUND',
      message: `No mission ${missionId}`,
      params: { missionId },
    });
  }

  if (row.status !== 'PENDING') {
    throw new AppError({
      status: 409,
      code: 'ERR_CONFLICT',
      message: `Mission ${missionId} is ${row.status.toLowerCase()}, not pending`,
      params: { status: row.status },
    });
  }

  await prisma.supplierMission.update({ where: { id: missionId }, data });

  return {
    email: row.product.supplier.user.email,
    locale: asLocale(row.product.supplier.user.locale),
    title: row.product.title,
  };
}

export function publishMission(
  prisma: PrismaClient,
  missionId: string,
): Promise<MissionNotice | null> {
  return decide(prisma, missionId, {
    status: 'PUBLISHED',
    rejectionReason: null,
    publishedAt: new Date(),
  });
}

export function rejectMission(
  prisma: PrismaClient,
  missionId: string,
  reason: string,
): Promise<MissionNotice | null> {
  return decide(prisma, missionId, {
    status: 'REJECTED',
    rejectionReason: reason,
    publishedAt: null,
  });
}

// ── What a buyer is offered ────────────────────────────────────────────────

/**
 * The published authored missions, as missions.
 *
 * Read whole rather than per product: the world hands the browser every
 * pavilion at once, and one query beats a lookup per plinth. Only published
 * ones, and only ones whose script still parses — a row that does not is a
 * bug worth a log line, not a reason to take the showroom down.
 */
export async function publishedMissions(prisma: PrismaClient): Promise<Mission[]> {
  const rows = await prisma.supplierMission.findMany({
    where: { status: 'PUBLISHED' },
    select: { id: true, script: true, product: { select: { slug: true } } },
  });

  const missions: Mission[] = [];

  for (const row of rows) {
    const script = authoredMissionSchema.safeParse(row.script);
    if (!script.success) {
      console.error(`Mission ${row.id} has a script that no longer parses`, script.error.issues);
      continue;
    }
    missions.push(authoredToMission(row.id, row.product.slug, script.data));
  }

  return missions;
}
