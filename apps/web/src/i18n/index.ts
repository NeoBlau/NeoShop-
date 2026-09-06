import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { dictionaries, DEFAULT_LOCALE, LOCALES, type Locale } from '@3dsfera/shared';

const STORAGE_KEY = 'sfera.locale';

function isLocale(value: string | null): value is Locale {
  return value !== null && (LOCALES as readonly string[]).includes(value);
}

/** Stored choice wins over the browser; the browser wins over the default. */
export function detectLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    // Private mode or blocked storage: fall through to the browser language.
  }

  const browser = navigator.language.split('-')[0];
  return isLocale(browser ?? null) ? (browser as Locale) : DEFAULT_LOCALE;
}

export function persistLocale(locale: Locale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Not being able to remember the choice is not worth an error to the user.
  }
  document.documentElement.lang = locale;
}

export async function initI18n(): Promise<typeof i18next> {
  const locale = detectLocale();
  document.documentElement.lang = locale;

  await i18next.use(initReactI18next).init({
    resources: {
      ru: { translation: dictionaries.ru },
      en: { translation: dictionaries.en },
    },
    lng: locale,
    fallbackLng: DEFAULT_LOCALE,
    interpolation: { escapeValue: false },
    returnNull: false,
  });

  return i18next;
}

export { i18next };
