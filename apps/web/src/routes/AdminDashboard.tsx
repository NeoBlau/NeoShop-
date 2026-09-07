import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client.js';
import { Alert } from '../ui/Alert.js';
import { Panel, SectionCard } from '../ui/Panel.js';
import { Spinner } from '../ui/Button.js';

import type { AdminMetrics } from '@3dsfera/shared';

type Overview = { counts: AdminMetrics['counts'] };

/** Which counters get a card, and in which order. */
const COUNTERS = [
  'suppliersPending',
  'productsPending',
  'suppliersApproved',
  'productsPublished',
  'orderCount',
  'usersCount',
] as const;

const COUNTER_KEYS: Record<(typeof COUNTERS)[number], keyof AdminMetrics['counts']> = {
  suppliersPending: 'suppliersPending',
  productsPending: 'productsPending',
  suppliersApproved: 'suppliersApproved',
  productsPublished: 'productsPublished',
  orderCount: 'orders',
  usersCount: 'users',
};

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
            {/* Named rather than iterated over the object: the first version
                printed the raw field names at a moderator, which is a debug
                view wearing a dashboard's clothes. */}
            {COUNTERS.map((key) => (
              <div key={key}>
                <dt className="text-ink-faint text-xs">{t(`admin.${key}`)}</dt>
                <dd className="mt-0.5 text-lg tabular-nums">
                  {overview.counts[COUNTER_KEYS[key]]}
                </dd>
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
        <SectionCard
          title={t('admin.moderation')}
          hint={t('admin.moderationHint')}
          to="/admin/moderation"
          {...(overview ? { badge: String(overview.counts.productsPending) } : {})}
        />
        <SectionCard
          title={t('admin.suppliers')}
          hint={t('admin.suppliersHint')}
          to="/admin/suppliers"
          {...(overview ? { badge: String(overview.counts.suppliersPending) } : {})}
        />
        <SectionCard
          title={t('admin.pavilions')}
          hint={t('admin.pavilionsHint')}
          to="/admin/pavilions"
        />
        <SectionCard title={t('admin.audit')} hint={t('admin.auditHint')} to="/admin/audit" />
        <SectionCard title={t('admin.metrics')} hint={t('admin.metricsHint')} to="/admin/metrics" />
      </div>
    </div>
  );
}
