import { describe, expect, it } from 'vitest';
import {
  AUTHORED_LIMITS,
  authoredMissionSchema,
  authoredToMission,
  type AuthoredMissionInput,
} from './mission.js';
import { earliestCompletion, missionSeconds, stepIndex } from '../missions.js';

const SCRIPT: AuthoredMissionInput = {
  zone: 'loft',
  percentOff: 8,
  titleRu: 'Уборка',
  titleEn: 'Cleaning',
  introRu: 'Смотрите, как он работает.',
  introEn: 'See how it works.',
  outroRu: 'Вы видели полный цикл.',
  outroEn: 'You have seen the whole cycle.',
  steps: [
    {
      kind: 'approach',
      metres: 2,
      promptRu: 'Подойдите',
      promptEn: 'Walk up',
      doneRu: 'Видно корпус.',
      doneEn: 'You can see the body.',
    },
    {
      kind: 'play',
      clipName: 'brushes_spin',
      seconds: 4,
      promptRu: 'Раскрутите щётки',
      promptEn: 'Spin the brushes',
      doneRu: 'Две боковые щётки.',
      doneEn: 'Two side brushes.',
    },
  ],
};

describe('an authored mission', () => {
  it('accepts a complete script', () => {
    expect(authoredMissionSchema.safeParse(SCRIPT).success).toBe(true);
  });

  it('refuses a play step with no clip to play', () => {
    const broken = {
      ...SCRIPT,
      steps: [SCRIPT.steps[0], { ...SCRIPT.steps[1], clipName: undefined }],
    };
    expect(authoredMissionSchema.safeParse(broken).success).toBe(false);
  });

  it('refuses a play step with no length, because the pace check needs one', () => {
    const broken = {
      ...SCRIPT,
      steps: [SCRIPT.steps[0], { ...SCRIPT.steps[1], seconds: undefined }],
    };
    expect(authoredMissionSchema.safeParse(broken).success).toBe(false);
  });

  it('refuses an approach step with no distance', () => {
    const broken = {
      ...SCRIPT,
      steps: [{ ...SCRIPT.steps[0], metres: undefined }, SCRIPT.steps[1]],
    };
    expect(authoredMissionSchema.safeParse(broken).success).toBe(false);
  });

  it('caps the discount a supplier may promise', () => {
    const greedy = { ...SCRIPT, percentOff: AUTHORED_LIMITS.percentMax + 1 };
    expect(authoredMissionSchema.safeParse(greedy).success).toBe(false);
  });

  it('refuses a mission too short to be one', () => {
    const thin = { ...SCRIPT, steps: [SCRIPT.steps[0]] };
    expect(authoredMissionSchema.safeParse(thin).success).toBe(false);
  });

  it('refuses more steps than anybody will sit through', () => {
    const long = {
      ...SCRIPT,
      steps: Array.from({ length: AUTHORED_LIMITS.stepsMax + 1 }, () => SCRIPT.steps[0]),
    };
    expect(authoredMissionSchema.safeParse(long).success).toBe(false);
  });
});

describe('converting an authored mission', () => {
  const mission = authoredToMission('cm123', 'robot-vacuum-domovoy-x2', SCRIPT);

  it('comes out as a room mission the runner can play', () => {
    expect(mission.where).toBe('zone');
    expect(mission.zone).toBe('loft');
    expect(mission.productSlug).toBe('robot-vacuum-domovoy-x2');
    expect(mission.steps).toHaveLength(2);
  });

  it('numbers the step ids itself, so a supplier cannot collide them', () => {
    expect(mission.steps.map((step) => step.id)).toEqual(['step-1', 'step-2']);
    expect(stepIndex(mission, 'step-2')).toBe(1);
  });

  it('carries the lengths through, so the pace floor means something', () => {
    // Six seconds of approach plus four of clip, per `stepSeconds`.
    expect(missionSeconds(mission)).toBe(10);
    expect(earliestCompletion(mission)).toBe(5_000);
  });

  it('keeps both languages of every line', () => {
    expect(mission.title).toEqual({ ru: 'Уборка', en: 'Cleaning' });
    expect(mission.steps[0]?.prompt.en).toBe('Walk up');
    expect(mission.steps[1]?.done.ru).toBe('Две боковые щётки.');
  });
});
