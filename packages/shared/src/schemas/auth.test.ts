import { describe, expect, it } from 'vitest';
import { registerSchema, loginSchema } from './auth.js';
import { negotiateLocale, dictionaries } from '../i18n/index.js';

describe('registerSchema', () => {
  it('normalizes the email: trims and lowercases', () => {
    const result = registerSchema.safeParse({
      role: 'BUYER',
      email: '  Buyer@Example.COM ',
      password: 'parol-12345',
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe('buyer@example.com');
  });

  it('rejects a supplier without a company name', () => {
    const result = registerSchema.safeParse({
      role: 'SUPPLIER',
      email: 'supplier@example.com',
      password: 'parol-12345',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes('companyName'))).toBe(true);
    }
  });

  it('accepts a supplier with a company name', () => {
    const result = registerSchema.safeParse({
      role: 'SUPPLIER',
      email: 'supplier@example.com',
      password: 'parol-12345',
      companyName: 'Орбита Связь',
    });

    expect(result.success).toBe(true);
  });

  it('rejects a password made of letters only', () => {
    const result = registerSchema.safeParse({
      role: 'BUYER',
      email: 'buyer@example.com',
      password: 'парольбезцифр',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('password_too_simple');
    }
  });

  it('rejects a password shorter than ten characters', () => {
    const result = registerSchema.safeParse({
      role: 'BUYER',
      email: 'buyer@example.com',
      password: 'short-1',
    });

    expect(result.success).toBe(false);
  });

  it('rejects an unknown role instead of silently defaulting', () => {
    const result = registerSchema.safeParse({
      role: 'ADMIN',
      email: 'admin@example.com',
      password: 'parol-12345',
    });

    expect(result.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('accepts a legacy password that no longer meets the current policy', () => {
    const result = loginSchema.safeParse({ email: 'old@example.com', password: 'short' });
    expect(result.success).toBe(true);
  });
});

describe('negotiateLocale', () => {
  it('picks the first supported language from the header', () => {
    expect(negotiateLocale('de-DE,en-US;q=0.9,ru;q=0.8', 'ru')).toBe('en');
  });

  it('falls back when nothing matches', () => {
    expect(negotiateLocale('de-DE,fr;q=0.9', 'ru')).toBe('ru');
    expect(negotiateLocale(undefined, 'en')).toBe('en');
  });
});

describe('dictionaries', () => {
  it('has the same keys in every locale', () => {
    const flatten = (dictionary: Record<string, Record<string, string>>): string[] =>
      Object.entries(dictionary)
        .flatMap(([section, entries]) => Object.keys(entries).map((key) => `${section}.${key}`))
        .sort();

    expect(flatten(dictionaries.en)).toEqual(flatten(dictionaries.ru));
  });
});
