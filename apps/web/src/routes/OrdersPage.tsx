import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { OrderStatus, OrderSummary } from '@3dsfera/shared';
import { ordersApi } from '../features/orders/api.js';
import { ApiError } from '../api/client.js';
import { formatDate, priceFormatter } from '../lib/format.js';
import { Alert } from '../ui/Alert.js';
import { Spinner } from '../ui/Button.js';
import { Badge } from '../ui/Form.js';
import { Panel } from '../ui/Panel.js';

const statusTone: Record<OrderStatus, 'neutral' | 'accent' | 'success' | 'warning' | 'danger'> = {
  PENDING: 'warning',
  PAID: 'accent',
  PACKING: 'accent',
  SHIPPED: 'accent',
  DELIVERED: 'success',
  CANCELLED: 'danger',
};

export function OrdersPage() {
  const { t, i18n } = useTranslation();
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const formatPrice = useMemo(() => priceFormatter(i18n.language), [i18n.language]);

  useEffect(() => {
    let cancelled = false;

    ordersApi
      .list()
      .then((response) => {
        if (!cancelled) setOrders(response.orders);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setErrorCode(cause instanceof ApiError ? cause.code : 'ERR_INTERNAL');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold">{t('order.ordersTitle')}</h1>

      {errorCode ? <Alert tone="danger">{t(`errors.${errorCode}`)}</Alert> : null}

      {!orders && !errorCode ? (
        <div className="text-ink-muted flex items-center gap-2 py-16 text-sm">
          <Spinner />
          {t('common.loading')}
        </div>
      ) : null}

      {orders && orders.length === 0 ? (
        <Panel className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-ink-muted text-sm">{t('order.ordersEmpty')}</p>
          <Link to="/catalog" className="text-accent text-sm hover:underline">
            {t('order.continueShopping')}
          </Link>
        </Panel>
      ) : null}

      {orders && orders.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                to={`/orders/${order.number}`}
                className="panel hover:border-edge-strong flex flex-wrap items-center gap-x-4 gap-y-2 p-4 transition-colors"
              >
                <span className="font-mono text-sm">{order.number}</span>
                <Badge tone={statusTone[order.status]}>{t(`order.status_${order.status}`)}</Badge>
                <span className="text-ink-faint text-xs">
                  {t('order.placedAt', { date: formatDate(order.createdAt, i18n.language) })}
                </span>
                <span className="text-ink-faint text-xs">
                  {t('order.items')}: {order.itemCount}
                </span>
                <span className="ml-auto text-sm tabular-nums">
                  {formatPrice(order.totalCents, order.currency)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
