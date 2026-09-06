import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client.js';
import { Alert } from '../ui/Alert.js';
import { Panel, SectionCard } from '../ui/Panel.js';
import { Spinner } from '../ui/Button.js';

interface Overview {
  counts: {
    users: number;
    suppliersPending: number;
    suppliersApproved: number;
    products: number;
    pavilions: number;
    orders: number;
  };
}

export function AdminDashboard() {
  const { t } = useTranslation();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<Overview>('/api/admin/overview')
      .then((data) => {
        if (!cancelled) setOverview(data);
      })
      .catch((error: unknown) => {
        if (!cancelled) setErrorCode(error instanceof ApiError ? error.code : 'ERR_INTERNAL');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">{t('admin.title')}</h1>

      {errorCode ? <Alert tone="danger">{t(`errors.${errorCode}`)}</Alert> : null}

      <Panel>
        {overview ? (
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {Object.entries(overview.counts).map(([key, value]) => (
              <div key={key}>
                <dt className="text-ink-faint text-xs">{key}</dt>
                <dd className="mt-0.5 text-lg tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        ) : errorCode ? null : (
          <div className="text-ink-muted flex items-center gap-2 text-sm">
            <Spinner />
            {t('common.loading')}
          </div>
        )}
      </Panel>

      <div className="grid gap-3 sm:grid-cols-2">
        <SectionCard title={t('admin.moderation')} hint={t('admin.moderationHint')} />
        <SectionCard title={t('admin.pavilions')} hint={t('admin.pavilionsHint')} />
        <SectionCard title={t('admin.audit')} hint={t('admin.auditHint')} />
        <SectionCard title={t('admin.metrics')} hint={t('admin.metricsHint')} />
      </div>
    </div>
  );
}
