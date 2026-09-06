import type { Locale } from '../domain.js';
import { ru } from './ru.js';
import { en } from './en.js';

/**
 * The dictionary shape is derived from the Russian file. Every other locale is
 * typed against it, so an added key that nobody translated fails the build
 * instead of silently rendering a raw key in production.
 */
export type Dictionary = {
  readonly [S in keyof typeof ru]: { readonly [K in keyof (typeof ru)[S]]: string };
};

export const dictionaries: Record<Locale, Dictionary> = { ru, en };

export { ru, en };

/** Picks a supported locale out of an Accept-Language header. */
export function negotiateLocale(header: string | undefined, fallback: Locale): Locale {
  if (!header) return fallback;
  for (const part of header.split(',')) {
    const tag = part.split(';')[0]?.trim().toLowerCase();
    if (!tag) continue;
    const primary = tag.split('-')[0];
    if (primary === 'ru' || primary === 'en') return primary;
  }
  return fallback;
}
