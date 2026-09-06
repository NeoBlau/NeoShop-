import { useTranslation } from 'react-i18next';

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="py-16 text-center">
      <h1 className="text-xl font-semibold">{t('common.notFoundTitle')}</h1>
      <p className="text-ink-muted mt-2 text-sm">{t('common.notFoundText')}</p>
      <a href="/" className="text-accent mt-5 inline-block text-sm hover:underline">
        {t('common.goHome')}
      </a>
    </div>
  );
}
