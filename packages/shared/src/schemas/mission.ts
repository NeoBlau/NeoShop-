import { z } from 'zod';
import type { Mission, MissionStep } from '../missions.js';

/**
 * A mission a supplier wrote for their own product.
 *
 * The missions in `missions.ts` are the platform's own — written in code for
 * the products it seeds, reviewed like any other code. A supplier cannot have
 * that, so theirs is data: a script validated here on the way in, stored as a
 * document, and converted back into the very same `Mission` shape before
 * anything plays or checks it.
 *
 * That conversion is the point of this file. It means the server's guards —
 * steps only in order, a floor under the pace, one code per run — are the
 * same code for a supplier's mission as for ours. An authored mission cannot
 * introduce a new way to earn a discount; it can only fill in a shape that
 * already had them.
 *
 * Deliberately narrower than what the code-defined missions can express.
 * There is no `answer` step, because a supplier writing their own quiz
 * question and marking their own correct answer is a discount with a button
 * on it; and the percentage is capped, because the discount comes out of
 * their margin but the disappointment lands on the platform.
 */

const TEXT = { min: 2, max: 240 } as const;

const text = z.string().trim().min(TEXT.min).max(TEXT.max);
const line = z.string().trim().min(TEXT.min).max(120);

/** What a supplier may ask a buyer to do. */
export const AUTHORED_GOALS = ['approach', 'play', 'watch'] as const;
export type AuthoredGoal = (typeof AUTHORED_GOALS)[number];

export const authoredStepSchema = z
  .object({
    kind: z.enum(AUTHORED_GOALS),
    /** Required for `play`: the clip inside the supplier's own GLB. */
    clipName: z.string().trim().min(1).max(120).optional(),
    /** Seconds, for `play` and `watch`. */
    seconds: z.number().min(0.5).max(60).optional(),
    /** Metres, for `approach`. */
    metres: z.number().min(0.5).max(12).optional(),
    promptRu: line,
    promptEn: line,
    doneRu: text,
    doneEn: text,
  })
  .superRefine((value, ctx) => {
    // A step that names no clip cannot play one, and a play step without
    // seconds has no pace to check against. Both are the supplier's mistake
    // to see now rather than the buyer's to hit later.
    if (value.kind === 'play') {
      if (!value.clipName) {
        ctx.addIssue({ code: 'custom', path: ['clipName'], message: 'clipName is required' });
      }
      if (value.seconds === undefined) {
        ctx.addIssue({ code: 'custom', path: ['seconds'], message: 'seconds is required' });
      }
    }

    if (value.kind === 'watch' && value.seconds === undefined) {
      ctx.addIssue({ code: 'custom', path: ['seconds'], message: 'seconds is required' });
    }

    if (value.kind === 'approach' && value.metres === undefined) {
      ctx.addIssue({ code: 'custom', path: ['metres'], message: 'metres is required' });
    }
  });

export type AuthoredStepInput = z.infer<typeof authoredStepSchema>;

export const AUTHORED_LIMITS = {
  stepsMin: 2,
  stepsMax: 6,
  percentMin: 1,
  /** The same ceiling the platform's own missions observe. */
  percentMax: 20,
} as const;

export const authoredMissionSchema = z.object({
  /** The demo zone, by id, as the zone build writes it. */
  zone: z.string().trim().min(1).max(64),
  percentOff: z.number().int().min(AUTHORED_LIMITS.percentMin).max(AUTHORED_LIMITS.percentMax),
  titleRu: line,
  titleEn: line,
  introRu: text,
  introEn: text,
  outroRu: text,
  outroEn: text,
  steps: z.array(authoredStepSchema).min(AUTHORED_LIMITS.stepsMin).max(AUTHORED_LIMITS.stepsMax),
});

export type AuthoredMissionInput = z.infer<typeof authoredMissionSchema>;

/** Turns one authored step into the goal the runner and the pace check use. */
function goalOf(step: AuthoredStepInput): MissionStep['goal'] {
  switch (step.kind) {
    case 'play':
      return { kind: 'play', clip: step.clipName ?? '', seconds: step.seconds ?? 3 };
    case 'watch':
      return { kind: 'watch', seconds: step.seconds ?? 5 };
    case 'approach':
      return { kind: 'approach', metres: step.metres ?? 2 };
  }
}

/**
 * The authored script, as a mission.
 *
 * Step ids are positional — `step-1`, `step-2` — rather than anything the
 * supplier types. The server matches a reported step against the expected
 * index, so an id a supplier could choose is an id a supplier could collide.
 */
export function authoredToMission(
  id: string,
  productSlug: string,
  script: AuthoredMissionInput,
): Mission {
  return {
    id,
    where: 'zone',
    productSlug,
    zone: script.zone,
    title: { ru: script.titleRu, en: script.titleEn },
    intro: { ru: script.introRu, en: script.introEn },
    outro: { ru: script.outroRu, en: script.outroEn },
    percentOff: script.percentOff,
    steps: script.steps.map((step, index) => ({
      id: `step-${index + 1}`,
      prompt: { ru: step.promptRu, en: step.promptEn },
      done: { ru: step.doneRu, en: step.doneEn },
      goal: goalOf(step),
    })),
  };
}
