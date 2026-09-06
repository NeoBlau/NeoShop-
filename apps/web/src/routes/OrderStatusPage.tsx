import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { OrderDetail } from '@3dsfera/shared';
import { ordersApi } from '../features/orders/api.js';
import { awaitsPayment, countryName, orderProgress } from '../features/orders/model.js';
import { ApiError } from '../api/client.js';
import { formatDate, formatDateTime, priceFormatter } from '../lib/format.js';
import { Alert } from '../ui/Alert.js';
import { Spinner } from '../ui/Button.js';
import { Badge } from '../ui/Form.js';
import { Panel } from '../ui/Panel.js';

/**
 * One order, as its buyer sees it.
 *
 * The address is shown back in full because this is the one page where the
 * buyer can still catch a typo in it before the parcel leaves. It comes from
 * the order endpoint, which returns it only to the owner and to an admin.
 */
export function OrderStatusPage() {
  const { t, i18n } = useTranslation();
  const { number = '' } = useParams<{ number: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const formatPrice = useMemo(() => priceFormatter(i18n.language), [i18n.language]);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorCode(null);
    try {
      const response = await ordersApi.detail(number);
      setOrder(response.order);
    } catch (cause) {
      setErrorCode(cause instanceof ApiError ? cause.code : 'ERR_INTERNAL');
    } finally {
      setLoading(false);
    }
  }, [number]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="text-ink-muted flex items-center gap-2 py-20 text-sm">
        <Spinner />
        {t('common.loading')}
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="danger">{t(`errors.${errorCode ?? 'ERR_NOT_FOUND'}`)}</Alert>
        <Link to="/orders" className="text-accent text-sm hover:underline">
          {t('order.ordersTitle')}
        </Link>
      </div>
    );
  }

  const progress = orderProgress(order.status);
  const address = order.address;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            {t('order.orderNumber', { number: order.number })}
          </h1>
          <p className="text-ink-muted mt-1 text-sm">
            {t('order.placedAt', { date: formatDate(order.createdAt, i18n.language) })}
            {order.paidAt
              ? ` · ${t('order.paidAt', { date: formatDate(order.paidAt, i18n.language) })}`
              : ''}
          </p>
        </div>
        <Link to="/orders" className="text-ink-faint hover:text-ink text-sm">
          {t('order.ordersTitle')}
        </Link>
      </div>

      {progress.cancelled ? (
        <Alert tone="danger">{t('order.status_CANCELLED')}</Alert>
      ) : (
        <Panel>
          <ol className="flex flex-wrap gap-x-1 gap-y-2 text-sm">
            {progress.steps.map((step, index) => {
              const reached = index <= progress.current;
              return (
                <li key={step} className="flex items-center gap-1">
                  <span
                    aria-current={index === progress.current ? 'step' : undefined}
                    className={
                      index === progress.current
                        ? 'bg-panel-raised text-ink rounded-md px-2 py-1'
                        : reached
                          ? 'text-ink-muted px-2 py-1'
                          : 'text-ink-faint px-2 py-1'
                    }
                  >
                    {t(`order.status_${step}`)}
                  </span>
                  {index < progress.steps.length - 1 ? (
                    <span aria-hidden="true" className="text-ink-faint">
                      ·
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </Panel>
      )}

      {awaitsPayment(order.status) ? (
        <Alert tone="warning">{t('order.status_PENDING')}</Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem] lg:items-start">
        <Panel className="flex flex-col gap-4">
          <h2 className="text-sm font-medium">{t('order.items')}</h2>
          <ul className="flex flex-col gap-3">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-center gap-3">
                <div className="bg-panel-raised h-14 w-14 shrink-0 overflow-hidden rounded-lg">
                  {item.previewUrl ? (
                    <img
                      src={item.previewUrl}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/catalog#${item.slug}`}
                    className="hover:text-accent block truncate text-sm"
                  >
                    {item.title}
                  </Link>
                  <p className="text-ink-faint text-xs">
                    {item.supplierName} · × {item.quantity}
                  </p>
                </div>
                <span className="shrink-0 text-sm tabular-nums">
                  {formatPrice(item.unitPriceCents * item.quantity, order.currency)}
                </span>
              </li>
            ))}
          </ul>

          <h2 className="border-edge border-t pt-4 text-sm font-medium">{t('order.tracking')}</h2>
          {order.shipments.length === 0 ? (
            <p className="text-ink-faint text-sm">{t('order.noTracking')}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {order.shipments.map((shipment) => (
                <li key={shipment.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-sm">{shipment.supplierName}</span>
                  <Badge tone={shipment.status === 'DELIVERED' ? 'success' : 'accent'}>
                    {t(`order.shipment_${shipment.status}`)}
                  </Badge>
                  <span className="text-ink-muted text-xs">
                    {t('order.carrier')}: {shipment.carrier}
                  </span>
                  {shipment.trackingNumber ? (
                    <span className="text-ink font-mono text-xs">{shipment.trackingNumber}</span>
                  ) : (
                    <span className="text-ink-faint text-xs">{t('order.noTracking')}</span>
                  )}
                  {shipment.shippedAt ? (
                    <span className="text-ink-faint text-xs">
                      {formatDateTime(shipment.shippedAt, i18n.language)}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel>
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">{t('order.subtotal')}</dt>
                <dd className="tabular-nums">{formatPrice(order.subtotalCents, order.currency)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">{t('order.shipping')}</dt>
                <dd className="tabular-nums">
                  {order.shippingCents === 0 ? (
                    <span className="text-success">{t('order.shippingFree')}</span>
                  ) : (
                    formatPrice(order.shippingCents, order.currency)
                  )}
                </dd>
              </div>
              <div className="border-edge flex justify-between gap-3 border-t pt-2 text-base">
                <dt>{t('order.total')}</dt>
                <dd className="tabular-nums">{formatPrice(order.totalCents, order.currency)}</dd>
              </div>
            </dl>
          </Panel>

          {address ? (
            <Panel>
              <h2 className="text-sm font-medium">{t('order.deliverTo')}</h2>
              <address className="text-ink-muted mt-2 text-sm not-italic">
                {address.recipient}
                <br />
                {address.phone}
                <br />
                {[address.postalCode, address.city, address.region].filter(Boolean).join(', ')}
                <br />
                {[address.line1, address.line2].filter(Boolean).join(', ')}
                <br />
                {countryName(address.country, i18n.language)}
                {address.comment ? (
                  <>
                    <br />
                    <span className="text-ink-faint text-xs">{address.comment}</span>
                  </>
                ) : null}
              </address>
            </Panel>
          ) : null}
        </div>
      </div>
    </div>
  );
}
