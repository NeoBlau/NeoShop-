import { randomBytes } from 'node:crypto';
import {
  AppError,
  mission,
  pace,
  stepIndex,
  type Mission,
  type PromoCodeView,
} from '@3dsfera/shared';
import type { PrismaClient } from '../../generated/prisma/client.js';

/**
 * Missions, and the discount codes finishing one earns.
 *
 * The mission itself is a script the browser plays; what the server owns is
 * the part that has value — the run, its order, and the code at the end. Three
 * rules, and all three live here rather than in the client:
 *
 *   a step may only be reported in order, so the last one cannot be reported
 *   first; a completion must not arrive faster than half the script's own
 *   running time; and a code is issued once per run, tied to the buyer who
 *   earned it and the product it demonstrates.
 *
 * None of that proves somebody watched. It is not meant to: the point is that
 * a loop in the console cannot mint discounts, which is a different and
 * achievable goal.
 */

/** Two weeks: long enough to think it over, short enough to be a nudge. */
const VALID_DAYS = 14;

function found(id: string): Mission {
  const definition = mission(id);
  if (!definition) {
    throw new AppError({
      status: 404,
      code: 'ERR_NOT_FOUND',
      message: `No mission ${id}`,
      params: { missionId: id },
    });
  }
  return definition;
}

/**
 * Unambiguous over a counter and in a phone call: no vowels, so no code spells
 * anything, and no characters that a sans-serif renders alike.
 */
function promoCode(): string {
  const alphabet = 'CDFHJKLMNPQRTVWXY3479';
  const bytes = randomBytes(10);
  let code = '';
  for (let index = 0; index < 10; index += 1) {
    code += alphabet[(bytes[index] ?? 0) % alphabet.length];
    if (index === 4) code += '-';
  }
  return code;
}

export interface MissionRunView {
  missionId: string;
  step: number;
  startedAt: string;
  completedAt: string | null;
}

export async function startRun(
  prisma: PrismaClient,
  userId: string,
  missionId: string,
): Promise<MissionRunView> {
  found(missionId);

  // Restarting is allowed and does not reset a finished run: a buyer who wants
  // to watch the vacuum again should not have their code taken away, and must
  // not be handed a second one either.
  const run = await prisma.missionRun.upsert({
    where: { userId_missionId: { userId, missionId } },
    create: { userId, missionId },
    update: {},
  });

  return {
    missionId: run.missionId,
    step: run.step,
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
  };
}

export async function reportStep(
  prisma: PrismaClient,
  userId: string,
  missionId: string,
  stepId: string,
): Promise<MissionRunView> {
  const definition = found(missionId);
  const index = stepIndex(definition, stepId);

  if (index < 0) {
    throw new AppError({
      status: 404,
      code: 'ERR_NOT_FOUND',
      message: `Mission ${missionId} has no step ${stepId}`,
      params: { missionId, stepId },
    });
  }

  const run = await prisma.missionRun.findUnique({
    where: { userId_missionId: { userId, missionId } },
  });

  if (!run) {
    throw new AppError({
      status: 409,
      code: 'ERR_CONFLICT',
      message: `Mission ${missionId} was never started`,
      params: { missionId },
    });
  }

  // Exactly the expected step, not merely one that has not been done: reporting
  // step four while standing on step two is the shape every skip attempt takes.
  if (index !== run.step) {
    throw new AppError({
      status: 409,
      code: 'ERR_CONFLICT',
      message: `Mission ${missionId} expects step ${run.step}, not ${index}`,
      params: { missionId, expected: run.step, received: index },
    });
  }

  const updated = await prisma.missionRun.update({
    where: { id: run.id },
    data: { step: index + 1 },
  });

  return {
    missionId: updated.missionId,
    step: updated.step,
    startedAt: updated.startedAt.toISOString(),
    completedAt: updated.completedAt?.toISOString() ?? null,
  };
}

export interface CompletionView {
  missionId: string;
  promo: PromoCodeView;
}

export async function completeRun(
  prisma: PrismaClient,
  userId: string,
  missionId: string,
): Promise<CompletionView> {
  const definition = found(missionId);

  const run = await prisma.missionRun.findUnique({
    where: { userId_missionId: { userId, missionId } },
    include: { promo: true },
  });

  if (!run) {
    throw new AppError({
      status: 409,
      code: 'ERR_CONFLICT',
      message: `Mission ${missionId} was never started`,
      params: { missionId },
    });
  }

  // Already finished: hand back the same code rather than a second one. A
  // double-submitted request is not a reason to double the discount.
  if (run.completedAt && run.promo) {
    return { missionId, promo: view(run.promo, definition) };
  }

  if (run.step < definition.steps.length) {
    throw new AppError({
      status: 409,
      code: 'ERR_CONFLICT',
      message: `Mission ${missionId} has ${definition.steps.length - run.step} steps left`,
      params: { missionId, remaining: definition.steps.length - run.step },
    });
  }

  const verdict = pace(definition, run.startedAt.getTime(), Date.now());
  if (!verdict.ok) {
    throw new AppError({
      status: 409,
      code: 'ERR_CONFLICT',
      message: `Mission ${missionId} was reported ${verdict.shortBy} ms too fast`,
      params: { missionId, shortBy: verdict.shortBy },
    });
  }

  const product = await prisma.product.findUnique({
    where: { slug: definition.productSlug },
    select: { id: true },
  });

  if (!product) {
    throw new AppError({
      status: 409,
      code: 'ERR_CONFLICT',
      message: `The product ${definition.productSlug} this mission demonstrates is gone`,
      params: { slug: definition.productSlug },
    });
  }

  const expiresAt = new Date(Date.now() + VALID_DAYS * 24 * 60 * 60 * 1000);

  // One transaction: a finished run without its code would leave the buyer
  // with nothing and no way to earn it again, the unique index having closed
  // the door behind them.
  const promo = await prisma.$transaction(async (tx) => {
    await tx.missionRun.update({
      where: { id: run.id },
      data: { completedAt: new Date() },
    });

    return tx.promoCode.create({
      data: {
        code: promoCode(),
        userId,
        productId: product.id,
        percentOff: definition.percentOff,
        missionRunId: run.id,
        expiresAt,
      },
    });
  });

  return { missionId, promo: view(promo, definition) };
}

interface PromoRow {
  code: string;
  productId: string;
  percentOff: number;
  expiresAt: Date;
  usedAt: Date | null;
}

function view(promo: PromoRow, definition: Mission): PromoCodeView {
  return {
    code: promo.code,
    productId: promo.productId,
    productSlug: definition.productSlug,
    percentOff: promo.percentOff,
    expiresAt: promo.expiresAt.toISOString(),
    usedAt: promo.usedAt?.toISOString() ?? null,
  };
}

export interface MissionsMine {
  runs: MissionRunView[];
  promos: PromoCodeView[];
}

export async function listMine(prisma: PrismaClient, userId: string): Promise<MissionsMine> {
  const [runs, promos] = await Promise.all([
    prisma.missionRun.findMany({ where: { userId }, orderBy: { startedAt: 'desc' } }),
    prisma.promoCode.findMany({
      where: { userId },
      orderBy: { issuedAt: 'desc' },
      include: { product: { select: { slug: true } } },
    }),
  ]);

  return {
    runs: runs.map((run) => ({
      missionId: run.missionId,
      step: run.step,
      startedAt: run.startedAt.toISOString(),
      completedAt: run.completedAt?.toISOString() ?? null,
    })),
    promos: promos.map((promo) => ({
      code: promo.code,
      productId: promo.productId,
      productSlug: promo.product.slug,
      percentOff: promo.percentOff,
      expiresAt: promo.expiresAt.toISOString(),
      usedAt: promo.usedAt?.toISOString() ?? null,
    })),
  };
}

export interface DiscountedCode {
  id: string;
  productId: string;
  percentOff: number;
}

/**
 * Resolves a code for checkout, or refuses it with a reason the client can
 * render. Called inside the order transaction, so the row it returns is the
 * row that gets marked used.
 */
export async function resolveCode(
  prisma: PrismaClient,
  userId: string,
  code: string,
): Promise<DiscountedCode> {
  const promo = await prisma.promoCode.findUnique({ where: { code: code.trim().toUpperCase() } });

  // One message for "no such code" and for "not yours": telling a stranger
  // which codes exist is a gift to whoever is guessing them.
  if (!promo || promo.userId !== userId) {
    throw new AppError({
      status: 404,
      code: 'ERR_NOT_FOUND',
      message: 'No such promo code for this buyer',
      issues: [{ path: 'promoCode', code: 'promo_unknown', message: 'unknown' }],
    });
  }

  if (promo.usedAt) {
    throw new AppError({
      status: 409,
      code: 'ERR_CONFLICT',
      message: 'That promo code has been used',
      issues: [{ path: 'promoCode', code: 'promo_used', message: 'used' }],
    });
  }

  if (promo.expiresAt.getTime() < Date.now()) {
    throw new AppError({
      status: 409,
      code: 'ERR_CONFLICT',
      message: 'That promo code has expired',
      issues: [{ path: 'promoCode', code: 'promo_expired', message: 'expired' }],
    });
  }

  return { id: promo.id, productId: promo.productId, percentOff: promo.percentOff };
}
