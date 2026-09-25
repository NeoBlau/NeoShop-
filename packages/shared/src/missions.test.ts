import { describe, expect, it } from 'vitest';
import {
  MINIMUM_PACE,
  MISSIONS,
  earliestCompletion,
  mission,
  missionForProduct,
  missionSeconds,
  missionsInZone,
  pace,
  stepIndex,
  stepSeconds,
  streetQuests,
} from './missions.js';

describe('the missions', () => {
  it('have unique ids, and one room mission per product', () => {
    const ids = MISSIONS.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);

    // Only the room missions: a product card offers "see it in its own room"
    // and there can be one of those. A street quest also names a product, but
    // only as what it pays out on, and two quests may well pay out on the same
    // thing.
    const rooms = MISSIONS.filter((entry) => entry.where === 'zone').map(
      (entry) => entry.productSlug,
    );
    expect(new Set(rooms).size).toBe(rooms.length);
  });

  it('are found by id, by product and by zone', () => {
    const first = MISSIONS[0];
    expect(first).toBeDefined();
    if (!first) return;

    expect(mission(first.id)).toBe(first);
    expect(missionForProduct(first.productSlug)).toBe(first);
    expect(missionsInZone(first.zone)).toContain(first);
    expect(mission('no-such-mission')).toBeNull();
    expect(missionForProduct('no-such-product')).toBeNull();
  });

  it('have steps with unique ids, written in both languages', () => {
    for (const entry of MISSIONS) {
      const ids = entry.steps.map((step) => step.id);
      expect(new Set(ids).size, entry.id).toBe(ids.length);

      for (const locale of ['ru', 'en'] as const) {
        expect(entry.title[locale], `${entry.id}.title.${locale}`).toBeTruthy();
        expect(entry.intro[locale], `${entry.id}.intro.${locale}`).toBeTruthy();
        expect(entry.outro[locale], `${entry.id}.outro.${locale}`).toBeTruthy();

        for (const step of entry.steps) {
          expect(step.prompt[locale], `${entry.id}.${step.id}.prompt.${locale}`).toBeTruthy();
          expect(step.done[locale], `${entry.id}.${step.id}.done.${locale}`).toBeTruthy();
        }
      }
    }
  });

  it('start by asking the buyer to walk over, before asking them to press anything', () => {
    for (const entry of MISSIONS.filter((mission) => mission.where === 'zone')) {
      expect(entry.steps[0]?.goal.kind, entry.id).toBe('approach');
    }
  });

  it('offer a discount worth having and not the shop', () => {
    for (const entry of MISSIONS) {
      expect(entry.percentOff, entry.id).toBeGreaterThan(0);
      expect(entry.percentOff, entry.id).toBeLessThanOrEqual(20);
    }
  });

  it('point every answer step at one of its own options', () => {
    for (const entry of MISSIONS) {
      for (const step of entry.steps) {
        if (step.goal.kind !== 'answer') continue;
        expect(step.goal.options.length, `${entry.id}.${step.id}`).toBeGreaterThan(1);
        expect(step.goal.correct).toBeGreaterThanOrEqual(0);
        expect(step.goal.correct).toBeLessThan(step.goal.options.length);
      }
    }
  });

  it('gives every step a duration, and the mission the sum of them', () => {
    for (const entry of MISSIONS) {
      let sum = 0;
      for (const step of entry.steps) {
        const seconds = stepSeconds(step);
        expect(seconds, `${entry.id}.${step.id}`).toBeGreaterThan(0);
        sum += seconds;
      }
      expect(missionSeconds(entry)).toBe(sum);
    }
  });

  it('finds a step by id and says so when there is none', () => {
    const entry = MISSIONS[0];
    if (!entry) return;
    expect(stepIndex(entry, entry.steps[1]?.id ?? '')).toBe(1);
    expect(stepIndex(entry, 'nothing')).toBe(-1);
  });
});

describe('the pace check', () => {
  const entry = MISSIONS[0];

  it('refuses a completion that arrives instantly', () => {
    if (!entry) return;
    const verdict = pace(entry, 1_000, 1_100);
    expect(verdict.ok).toBe(false);
    expect(verdict.shortBy).toBeGreaterThan(0);
  });

  it('accepts one that took the expected share of the time', () => {
    if (!entry) return;
    const needed = earliestCompletion(entry);
    expect(pace(entry, 0, needed).ok).toBe(true);
    expect(pace(entry, 0, needed).shortBy).toBe(0);
  });

  it('asks for half the script, by the constant it documents', () => {
    if (!entry) return;
    expect(earliestCompletion(entry)).toBe(Math.round(missionSeconds(entry) * MINIMUM_PACE * 1000));
  });

  it('is not fooled by a start time in the future', () => {
    if (!entry) return;
    expect(pace(entry, 10_000, 0).ok).toBe(false);
  });
});

describe('street quests', () => {
  it('offers a quest on each main location', () => {
    expect(streetQuests('street').length).toBeGreaterThan(0);
    expect(streetQuests('grove').length).toBeGreaterThan(0);
  });

  it('only offers a location-specific quest on its own location', () => {
    expect(streetQuests('grove').map((quest) => quest.id)).not.toContain('street-counter');
    expect(streetQuests('street').map((quest) => quest.id)).not.toContain('grove-round');
  });

  it('never offers a room mission out on a location', () => {
    for (const quest of [...streetQuests('street'), ...streetQuests('grove')]) {
      expect(quest.where, quest.id).toBe('street');
    }
  });

  it('keeps street quests out of the product cards', () => {
    for (const quest of streetQuests('street')) {
      const offered = missionForProduct(quest.productSlug);
      expect(offered?.id, quest.id).not.toBe(quest.id);
    }
  });

  it('gives every street objective a believable amount of time', () => {
    for (const quest of [...streetQuests('street'), ...streetQuests('grove')]) {
      for (const step of quest.steps) {
        expect(stepSeconds(step), `${quest.id}/${step.id}`).toBeGreaterThan(0);
      }
      // Long enough that a console loop cannot collect the code instantly,
      // short enough that a walk is not a sentence.
      expect(earliestCompletion(quest), quest.id).toBeGreaterThan(5_000);
      expect(earliestCompletion(quest), quest.id).toBeLessThan(120_000);
    }
  });

  it('pays out on a product the seed actually has', () => {
    // The five slugs prisma/seed.ts creates. A mission whose product is
    // missing throws at completion, after the buyer has done the work — which
    // is exactly the bug this catches.
    const seeded = new Set([
      'antenna-orbita-1-2',
      'robot-vacuum-domovoy-x2',
      'inspection-drone-skyeye',
      'desk-lamp-meridian',
      'recliner-kronos',
    ]);

    for (const entry of MISSIONS) {
      expect(seeded.has(entry.productSlug), `${entry.id} → ${entry.productSlug}`).toBe(true);
    }
  });

  it('gives a room mission a zone and a street quest none', () => {
    for (const entry of MISSIONS) {
      if (entry.where === 'zone') expect(entry.zone, entry.id).toBeTruthy();
      else expect(entry.zone, entry.id).toBeUndefined();
    }
  });
});
