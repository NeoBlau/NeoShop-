/**
 * Presentation of numbers and dates.
 *
 * Amounts live as integer minor units everywhere else in the codebase; this is
 * the one place they become a string with a separator in it. Four screens were
 * each building their own `Intl.NumberFormat` — one currency style, in one
 * place, keeps the catalogue and the invoice reading the same.
 */

export type PriceFormatter = (cents: number, currency: string) => string;

export function priceFormatter(locale: string): PriceFormatter {
  return (cents, currency) =>
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      // Prices are whole units in every currency the catalogue carries; a
      // trailing ",00" on every line only adds noise.
      maximumFractionDigits: 0,
    }).format(cents / 100);
}

/** Day and month for a timestamp the buyer is reading, not auditing. */
export function formatDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso));
}

export function formatDateTime(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

/** Grams to kilograms with one decimal, for the shipping quote. */
export function formatKilograms(grams: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(grams / 1000);
}
