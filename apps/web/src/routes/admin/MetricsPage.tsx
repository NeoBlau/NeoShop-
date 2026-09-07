import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { AdminMetrics } from '@3dsfera/shared';
import { adminApi } from '../../features/admin/api.js';
import { ApiError } from '../../api/client.js';
import { priceFormatter } from '../../lib/format.js';
import { Alert } from '../../ui/Alert.js';
import { Spinner } from '../../ui/Button.js';
import { Panel } from '../../ui/Panel.js';

/**
 * What the place is doing.
 *
 * Counters, money by currency, the products people actually look at, and
 * orders per day drawn as bars — a fortnight of numbers is not worth a
 * charting library, and the one thing a chart has to do here is show whether
 * the line is going up.
 */
export function MetricsPage() {
  const { t, i18n } = useTranslation();
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const formatPrice = useMemo(() => priceFormatter(i18n.language), [i18n.language]);

  useEffect(() => {
    let cancelled = false;

    adminApi
      .metrics()
      .then((data) => {
        if (!cancelled) setMetrics(data);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setErrorCode(cause instanceof ApiError ? cause.code : 'ERR_INTERNAL');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (errorCode) return <Alert tone="danger">{t(`errors.${errorCode}`)}</Alert>;

  if (!metrics) {
    return (
      <div className="text-ink-muted flex items-center gap-2 py-20 text-sm">
        <Spinner />
        {t('common.loading')}
      </div>
    );
  }

  const busiest = Math.max(1, ...metrics.ordersByDay.map((day) => day.orders));

  const counters = [
    ['usersCount', metrics.counts.users],
    ['suppliersPending', metrics.counts.suppliersPending],
    ['suppliersApproved', metrics.counts.suppliersApproved],
    ['suppliersBlocked', metrics.counts.suppliersBlocked],
    ['productsPending', metrics.counts.productsPending],
    ['productsPublished', metrics.counts.productsPublished],
    ['pavilionCount', metrics.counts.pavilions],
    ['orderCount', metrics.counts.orders],
  ] as const;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t('admin.metrics')}</h1>
          <p className="text-ink-muted mt-1 text-sm">{t('admin.metricsHint')}</p>
        </div>
        <Link to="/admin" className="text-ink-faint hover:text-ink text-sm">
          {t('common.back')}
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {counters.map(([key, value]) => (
          <Panel key={key} className="flex flex-col gap-1">
            <span className="text-ink-faint text-xs">{t(`admin.${key}`)}</span>
            <span className="text-xl tabular-nums">{value}</span>
          </Panel>
        ))}
      </div>

      <Panel className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">{t('admin.revenue')}</h2>
        {metrics.revenue.length === 0 ? (
          <p className="text-ink-faint text-sm">—</p>
        ) : (
          <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
            {metrics.revenue.map((row) => (
              <div key={row.currency} className="flex flex-col">
                <dt className="text-ink-faint text-xs">
                  {t('admin.paidOrders')}: {row.orders}
                </dt>
                <dd className="text-lg tabular-nums">{formatPrice(row.paidCents, row.currency)}</dd>
              </div>
            ))}
          </dl>
        )}
      </Panel>

      <Panel className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">{t('admin.ordersByDay')}</h2>
        <div className="flex h-32 items-end gap-1">
          {metrics.ordersByDay.map((day) => (
            <div key={day.day} className="flex flex-1 flex-col items-center gap-1" title={day.day}>
              <div
                className="bg-accent/70 w-full rounded-t-sm"
                style={{ height: `${Math.max(2, (day.orders / busiest) * 100)}%` }}
              />
              <span className="text-ink-faint text-[10px] tabular-nums">{day.day.slice(8)}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="overflow-x-auto p-0">
        <table className="w-full min-w-[36rem] text-sm">
          <caption className="text-ink-muted px-4 py-3 text-left text-sm font-medium">
            {t('admin.topProducts')}
          </caption>
          <thead className="text-ink-faint border-edge border-b text-left text-xs">
            <tr>
              <th className="px-4 py-2 font-normal">{t('products.title')}</th>
              <th className="px-4 py-2 text-right font-normal">{t('admin.views')}</th>
              <th className="px-4 py-2 text-right font-normal">{t('admin.ordersColumn')}</th>
              <th className="px-4 py-2 text-right font-normal">{t('admin.conversion')}</th>
            </tr>
          </thead>
          <tbody>
            {metrics.topProducts.map((product) => (
              <tr key={product.id} className="border-edge/60 border-b last:border-0">
                <td className="px-4 py-2.5">
                  <div className="truncate">{product.title}</div>
                  <div className="text-ink-faint text-xs">{product.supplierName}</div>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{product.viewCount}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{product.orderCount}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{product.conversion}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
