import type { FoodLocale, FoodText } from '@3dsfera/shared';

/**
 * Menu text is written in Italian first — it is an Italian menu — and carried
 * in three languages beside it. The interface shows the reader's own language
 * as the title, with the Italian underneath, unless they are reading in
 * Italian, in which case repeating it would be silly.
 */
export function localeOf(language: string): FoodLocale {
  if (language.startsWith('it')) return 'it';
  if (language.startsWith('ru')) return 'ru';
  return 'en';
}

export function title(text: FoodText, locale: FoodLocale): string {
  return text[locale];
}

export function subtitle(text: FoodText, locale: FoodLocale): string | null {
  return locale === 'it' ? null : text.it;
}

/** Euro cents to the way a menu board writes it. */
export function euro(cents: number, language: string): string {
  return new Intl.NumberFormat(language, { style: 'currency', currency: 'EUR' }).format(
    cents / 100,
  );
}
