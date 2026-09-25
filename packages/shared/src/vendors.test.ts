import { describe, expect, it } from 'vitest';
import { PRODUCT_CATEGORIES } from './domain.js';
import { matchHeard } from './scripted.js';
import {
  VENDOR_BY_CATEGORY,
  VENDOR_COMMON,
  VENDOR_NAMES,
  dominantCategory,
  vendorLines,
  vendorName,
} from './vendors.js';

describe('the vendors', () => {
  it('has a line for every product category', () => {
    for (const category of PRODUCT_CATEGORIES) {
      expect(VENDOR_BY_CATEGORY[category], category).toBeDefined();
    }
  });

  it('offers what it sells first, then the usual questions', () => {
    const lines = vendorLines('FURNITURE');
    expect(lines[0]).toBe(VENDOR_BY_CATEGORY.FURNITURE);
    expect(lines).toHaveLength(VENDOR_COMMON.length + 1);
  });

  it('is written in both languages, question and answer alike', () => {
    for (const category of PRODUCT_CATEGORIES) {
      for (const line of vendorLines(category)) {
        for (const locale of ['ru', 'en'] as const) {
          expect(line.question[locale], `${line.id}.question.${locale}`).toBeTruthy();
          expect(line.answer[locale], `${line.id}.answer.${locale}`).toBeTruthy();
        }
      }
    }
  });

  it('gives every line something to listen for, in lower case', () => {
    for (const category of PRODUCT_CATEGORIES) {
      for (const line of vendorLines(category)) {
        expect(line.heard.length, line.id).toBeGreaterThan(0);
        for (const word of line.heard) expect(word).toBe(word.toLowerCase());
      }
    }
  });
});

describe('matching what the microphone heard', () => {
  const lines = vendorLines('HOME_APPLIANCES');

  it('finds the question by its own words, in either language', () => {
    expect(matchHeard('сколько это стоит', lines)?.id).toBe('price');
    expect(matchHeard('how much does it cost', lines)?.id).toBe('price');
    expect(matchHeard('а что с доставкой в Милан', lines)?.id).toBe('delivery');
  });

  it('ignores punctuation and case', () => {
    expect(matchHeard('ЦЕНА?!', lines)?.id).toBe('price');
  });

  it('matches whole words only', () => {
    // "оценка" contains "цена" as a substring and means something else.
    expect(matchHeard('оценка', lines)).toBeNull();
  });

  it('prefers the line that more of the sentence agrees with', () => {
    expect(matchHeard('здравствуйте, а гарантия и возврат есть', lines)?.id).toBe('warranty');
  });

  it('says nothing rather than guessing at silence or noise', () => {
    expect(matchHeard('', lines)).toBeNull();
    expect(matchHeard('...', lines)).toBeNull();
    expect(matchHeard('ололо трололо', lines)).toBeNull();
  });
});

describe('vendorName', () => {
  it('gives the same pavilion the same person every time', () => {
    expect(vendorName('pav-1')).toEqual(vendorName('pav-1'));
  });

  it('spreads pavilions across the list rather than piling them on one name', () => {
    const seen = new Set(
      Array.from({ length: 40 }, (_, index) => vendorName(`pavilion-${index}`).en),
    );
    expect(seen.size).toBeGreaterThan(4);
  });

  it('always answers, whatever the key', () => {
    expect(vendorName('').ru).toBeTruthy();
  });

  it('only ever names somebody from the list', () => {
    expect(VENDOR_NAMES).toContainEqual(vendorName('pav-anything'));
  });
});

describe('dominantCategory', () => {
  it('names the shelf most of the frontage belongs to', () => {
    expect(dominantCategory(['LIGHTING', 'FURNITURE', 'LIGHTING'])).toBe('LIGHTING');
  });

  it('falls back to the catch-all shelf for an empty frontage', () => {
    expect(dominantCategory([])).toBe('OTHER');
  });

  it('has a line for whatever it names', () => {
    for (const category of PRODUCT_CATEGORIES) {
      expect(vendorLines(dominantCategory([category])).length).toBeGreaterThan(1);
    }
  });
});
