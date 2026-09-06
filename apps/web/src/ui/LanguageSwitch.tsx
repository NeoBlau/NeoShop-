import { LOCALES, type Locale } from '@3dsfera/shared';
import { useTranslation } from 'react-i18next';
import { useSession } from '../stores/session.js';

export function LanguageSwitch() {
  const { i18n, t } = useTranslation();
  const changeLocale = useSession((state) => state.changeLocale);
  const current = i18n.language as Locale;

  return (
    <div className="flex items-center gap-1" aria-label={t('common.language')}>
      {LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          onClick={() => void changeLocale(locale)}
          aria-current={locale === current ? 'true' : undefined}
          className={`rounded px-1.5 py-1 text-xs uppercase transition-colors ${
            locale === current ? 'text-accent' : 'text-ink-faint hover:text-ink-muted'
          }`}
        >
          {locale}
        </button>
      ))}
    </div>
  );
}
