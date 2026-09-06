import { useTranslation } from 'react-i18next';
import { Alert } from '../ui/Alert.js';
import { Panel, SectionCard } from '../ui/Panel.js';
import { Spinner } from '../ui/Button.js';
import { useSupplierProfile } from '../features/supplier/useSupplierProfile.js';

const statusTone = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  BLOCKED: 'danger',
} as const;

export function SupplierDashboard() {
  const { t } = useTranslation();
  const { profile, loading, errorCode } = useSupplierProfile();

  if (loading) {
    return (
      <div className="text-ink-muted flex items-center gap-2 py-20 text-sm">
        <Spinner />
        {t('common.loading')}
      </div>
    );
  }

  if (!profile) {
    return <Alert tone="danger">{t(`errors.${errorCode ?? 'ERR_INTERNAL'}`)}</Alert>;
  }

  const pavilion = profile.pavilions[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t('supplier.dashboardTitle')}</h1>
          <p className="text-ink-muted mt-1 text-sm">
            {t('supplier.welcome', { company: profile.companyName })}
          </p>
        </div>
        <span className="text-ink-faint text-xs">
          {t('supplier.statusLabel')}:{' '}
          <span className="text-ink-muted">{t(`supplierStatus.${profile.status}`)}</span>
        </span>
      </div>

      {profile.status === 'PENDING' ? (
        <Alert tone={statusTone.PENDING}>{t('supplier.pendingNotice')}</Alert>
      ) : null}
      {profile.status === 'REJECTED' ? (
        <Alert tone={statusTone.REJECTED}>
          {t('supplier.rejectedNotice', { reason: profile.rejectionReason ?? '—' })}
        </Alert>
      ) : null}
      {profile.status === 'BLOCKED' ? (
        <Alert tone={statusTone.BLOCKED}>{t('supplier.blockedNotice')}</Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <SectionCard
          title={t('supplier.products')}
          hint={t('supplier.productsHint')}
          to="/supplier/products"
          badge={String(profile.productCount)}
        />
        <SectionCard
          title={t('supplier.orders')}
          hint={t('supplier.ordersHint')}
          to="/supplier/orders"
        />
        <SectionCard
          title={t('supplier.pavilion')}
          hint={t('supplier.pavilionHint')}
          badge={
            pavilion
              ? t('supplier.pavilionSlot', { slot: pavilion.slot })
              : t('supplier.noPavilion')
          }
        />
        <SectionCard
          title={t('supplier.stats')}
          hint={t('supplier.statsHint')}
          to="/supplier/stats"
        />
      </div>

      <Panel>
        <h2 className="text-sm font-medium">{t('supplier.profile')}</h2>
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-faint">{t('auth.companyName')}</dt>
            <dd className="text-right">{profile.companyName}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-faint">{t('auth.legalName')}</dt>
            <dd className="text-right">{profile.legalName ?? '—'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-faint">{t('auth.taxId')}</dt>
            <dd className="text-right">{profile.taxId ?? '—'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-faint">{t('common.email')}</dt>
            <dd className="max-w-[22ch] truncate text-right">{profile.contactEmail ?? '—'}</dd>
          </div>
        </dl>
      </Panel>
    </div>
  );
}
