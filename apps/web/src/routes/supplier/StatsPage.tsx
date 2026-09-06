import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SupplierStatsResponse } from '@3dsfera/shared';
import { ApiError } from '../../api/client.js';
import { productsApi } from '../../features/products/api.js';
import { Alert } from '../../ui/Alert.js';
import { Spinner } from '../../ui/Button.js';
import { Badge } from '../../ui/Form.js';
import { Panel } from '../../ui/Panel.js';

export function StatsPage() {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState<SupplierStatsResponse | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    productsApi
      .stats()
      .then((response) => {
        if (!cancelled) setData(response);
      })
      .catch((error: unknown) => {
        if (!cancelled) setErrorCode(error instanceof ApiError ? error.code : 'ERR_INTERNAL');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (errorCode) return <Alert tone="danger">{t(`errors.${errorCode}`)}</Alert>;

  if (!data) {
    return (
      <div className="text-ink-muted flex items-center gap-2 py-20 text-sm">
        <Spinner />
        {t('common.loading')}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold">{t('stats.title')}</h1>
        <p className="text-ink-muted mt-1 text-sm">{t('stats.hint')}</p>
      </div>

      <Panel>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ['stats.views', data.totals.views],
            ['stats.orders', data.totals.orders],
            ['stats.published', data.totals.published],
            ['stats.pending', data.totals.pending],
          ].map(([key, value]) => (
            <div key={String(key)}>
              <dt className="text-ink-faint text-xs">{t(String(key))}</dt>
              <dd className="mt-0.5 text-lg tabular-nums">
                {Number(value).toLocaleString(i18n.language)}
              </dd>
            </div>
          ))}
        </dl>
      </Panel>

      {data.rows.length === 0 ? (
        <Panel className="text-ink-muted py-12 text-center text-sm">{t('stats.empty')}</Panel>
      ) : (
        <Panel className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-ink-faint text-left text-xs">
                <th className="pb-2 font-normal">{t('stats.product')}</th>
                <th className="pb-2 text-right font-normal">{t('stats.views')}</th>
                <th className="pb-2 text-right font-normal">{t('stats.orders')}</th>
                <th className="pb-2 text-right font-normal">{t('stats.conversion')}</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.productId} className="border-edge border-t">
                  <td className="py-2.5">
                    <span className="mr-2">{row.title}</span>
                    <Badge>{t(`moderation.${row.status}`)}</Badge>
                  </td>
                  <td className="py-2.5 text-right tabular-nums">{row.views}</td>
                  <td className="py-2.5 text-right tabular-nums">{row.orders}</td>
                  <td className="text-ink-muted py-2.5 text-right tabular-nums">
                    {row.conversion}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  );
}
