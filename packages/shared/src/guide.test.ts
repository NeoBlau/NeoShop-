import { describe, expect, it } from 'vitest';
import { GUIDE_FACTS, guideBrief, type GuideLocation } from './guide.js';
import { matchHeard } from './scripted.js';

const GROVE: GuideLocation = {
  id: 'grove',
  title: 'Горная роща',
  blurb: 'Поляна в горном лесу.',
  plots: 6,
  triangles: 722_223,
  credit: 'Poly Haven, CC0',
};

describe('the guide', () => {
  it('answers a question asked in the buyer’s own words', () => {
    expect(matchHeard('чем роща отличается от улицы', GUIDE_FACTS)?.id).toBe('choose');
    expect(matchHeard('как мне ходить тут', GUIDE_FACTS)?.id).toBe('move');
    expect(matchHeard('everything lags', GUIDE_FACTS)?.id).toBe('quality');
  });

  it('says nothing rather than guessing when the question is off-topic', () => {
    expect(matchHeard('сколько сейчас времени в Милане', GUIDE_FACTS)).toBeNull();
  });

  it('has both languages for every fact', () => {
    for (const fact of GUIDE_FACTS) {
      expect(fact.question.ru, fact.id).not.toBe('');
      expect(fact.question.en, fact.id).not.toBe('');
      expect(fact.answer.ru, fact.id).not.toBe('');
      expect(fact.answer.en, fact.id).not.toBe('');
    }
  });

  it('hands a model the locations that were actually built', () => {
    const brief = guideBrief([GROVE], 'ru');
    expect(brief).toContain('Горная роща');
    expect(brief).toContain('grove');
    expect(brief).toContain('6 plots');
    // And every written answer, so it has something to reword.
    expect(brief).toContain(GUIDE_FACTS[0]?.answer.ru ?? '');
  });

  it('tells a model plainly when there is nothing built to talk about', () => {
    expect(guideBrief([], 'en')).toContain('no locations');
  });

  it('asks for the answer in the language being spoken', () => {
    expect(guideBrief([GROVE], 'en')).toContain('in English');
    expect(guideBrief([GROVE], 'ru')).toContain('на русском');
  });
});
