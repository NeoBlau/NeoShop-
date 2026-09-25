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
} from './missions.js';

describe('the missions', () => {
  it('have unique ids, one per product', () => {
    const ids = MISSIONS.map((entry) => entry.id);
    const slugs = MISSIONS.map((entry) => entry.productSlug);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(slugs).size).toBe(slugs.length);
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
    for (const entry of MISSIONS) {
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
