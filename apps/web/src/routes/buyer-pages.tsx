import { useTranslation } from 'react-i18next';
import { Panel } from '../ui/Panel.js';

/**
 * Buyer-facing shells. The 3D world lands in stage 3 and the catalog in
 * stage 2 — until then each page states plainly what it will hold, so the
 * navigation can be walked end to end.
 */
function Placeholder({ title, text }: { title: string; text: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-ink-muted mt-1 text-sm">{text}</p>
      </div>
      <Panel className="text-ink-faint flex min-h-[220px] items-center justify-center text-sm">
        {t('common.comingSoon')}
      </Panel>
    </div>
  );
}

export function WorldPage() {
  const { t } = useTranslation();
  return <Placeholder title={t('buyer.worldTitle')} text={t('buyer.worldPlaceholder')} />;
}

export function CatalogPage() {
  const { t } = useTranslation();
  return <Placeholder title={t('buyer.catalogTitle')} text={t('buyer.catalogPlaceholder')} />;
}

export function CartPage() {
  const { t } = useTranslation();
  return <Placeholder title={t('buyer.cartTitle')} text={t('common.comingSoon')} />;
}

export function OrdersPage() {
  const { t } = useTranslation();
  return <Placeholder title={t('buyer.ordersTitle')} text={t('common.comingSoon')} />;
}

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
