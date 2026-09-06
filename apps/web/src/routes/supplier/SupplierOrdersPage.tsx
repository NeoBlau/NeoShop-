import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { OrderStatus, ShipmentStatus, SupplierOrderDto } from '@3dsfera/shared';
import { supplierOrdersApi } from '../../features/orders/api.js';
import { countryName } from '../../features/orders/model.js';
import { ApiError } from '../../api/client.js';
import { formatDate, priceFormatter } from '../../lib/format.js';
import { Alert } from '../../ui/Alert.js';
import { Button, Spinner } from '../../ui/Button.js';
import { Field } from '../../ui/Field.js';
import { Badge, Select } from '../../ui/Form.js';
import { Panel } from '../../ui/Panel.js';

const SHIPMENT_STATUSES: ShipmentStatus[] = [
  'CREATED',
  'HANDED_OVER',
  'IN_TRANSIT',
  'DELIVERED',
  'LOST',
];

const statusTone: Record<OrderStatus, 'neutral' | 'accent' | 'success' | 'warning' | 'danger'> = {
  PENDING: 'warning',
  PAID: 'accent',
  PACKING: 'accent',
  SHIPPED: 'accent',
  DELIVERED: 'success',
  CANCELLED: 'danger',
};

/**
 * Incoming orders for one supplier.
 *
 * The list carries the city and country only. The street address belongs on
 * the shipping label, and the API does not hand it over here — this page could
 * not show it if it wanted to.
 */
export function SupplierOrdersPage() {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<SupplierOrderDto[] | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    supplierOrdersApi
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t('order.supplierOrders')}</h1>
          <p className="text-ink-muted mt-1 text-sm">{t('order.supplierOrdersHint')}</p>
        </div>
        <Link to="/supplier" className="text-ink-faint hover:text-ink text-sm">
          {t('common.back')}
        </Link>
      </div>

      {errorCode ? <Alert tone="danger">{t(`errors.${errorCode}`)}</Alert> : null}

      {!orders && !errorCode ? (
        <div className="text-ink-muted flex items-center gap-2 py-16 text-sm">
          <Spinner />
          {t('common.loading')}
        </div>
      ) : null}

      {orders && orders.length === 0 ? (
        <Panel className="text-ink-muted py-14 text-center text-sm">
          {t('order.supplierOrdersEmpty')}
        </Panel>
      ) : null}

      {orders?.map((order) => (
        <OrderCard key={order.orderId} order={order} />
      ))}
    </div>
  );
}

function OrderCard({ order }: { order: SupplierOrderDto }) {
  const { t, i18n } = useTranslation();
  const formatPrice = useMemo(() => priceFormatter(i18n.language), [i18n.language]);

  const [carrier, setCarrier] = useState(order.shipment?.carrier ?? '');
  const [tracking, setTracking] = useState(order.shipment?.trackingNumber ?? '');
  const [status, setStatus] = useState<ShipmentStatus>(order.shipment?.status ?? 'CREATED');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function save(event: FormEvent): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setErrorCode(null);
    setFieldErrors({});

    try {
      const trimmed = tracking.trim();
      await supplierOrdersApi.updateShipment(order.orderId, {
        carrier: carrier.trim(),
        status,
        // A carrier that has not issued a number yet sends none, rather than
        // an empty string the schema would reject as too short.
        ...(trimmed ? { trackingNumber: trimmed } : {}),
      });
      setSaved(true);
    } catch (cause) {
      if (cause instanceof ApiError) {
        setFieldErrors(cause.fieldErrors());
        setErrorCode(cause.code);
      } else {
        setErrorCode('ERR_INTERNAL');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="font-mono text-sm">{order.orderNumber}</span>
        <Badge tone={statusTone[order.status]}>{t(`order.status_${order.status}`)}</Badge>
        <span className="text-ink-faint text-xs">
          {t('order.placedAt', { date: formatDate(order.createdAt, i18n.language) })}
        </span>
        <span className="text-ink-muted ml-auto text-sm tabular-nums">
          {formatPrice(order.totalCents, order.currency)}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
        <ul className="flex flex-col gap-1.5 text-sm">
          {order.items.map((item, index) => (
            <li
              key={`${order.orderId}-${index}`}
              className="text-ink-muted flex justify-between gap-3"
            >
              <span className="truncate">
                {item.title}
                <span className="text-ink-faint"> × {item.quantity}</span>
              </span>
              <span className="shrink-0 tabular-nums">
                {formatPrice(item.unitPriceCents * item.quantity, order.currency)}
              </span>
            </li>
          ))}
        </ul>

        <div className="text-sm">
          <p className="text-ink-faint text-xs">{t('order.deliverTo')}</p>
          <p className="text-ink-muted">
            {order.destination.city}, {countryName(order.destination.country, i18n.language)}
          </p>
        </div>
      </div>

      <form
        className="border-edge flex flex-col gap-3 border-t pt-4"
        onSubmit={(event) => void save(event)}
      >
        {errorCode ? <Alert tone="danger">{t(`errors.${errorCode}`)}</Alert> : null}
        {saved ? <Alert tone="success">{t('order.shipmentSaved')}</Alert> : null}

        <div className="grid gap-3 sm:grid-cols-3">
          <Field
            label={t('order.carrier')}
            value={carrier}
            required
            onChange={(event) => setCarrier(event.target.value)}
            error={fieldErrors['carrier'] ? t(`validation.${fieldErrors['carrier']}`) : undefined}
          />
          <Field
            label={t('order.tracking')}
            value={tracking}
            placeholder={t('order.noTracking')}
            onChange={(event) => setTracking(event.target.value)}
            error={
              fieldErrors['trackingNumber']
                ? t(`validation.${fieldErrors['trackingNumber']}`)
                : undefined
            }
          />
          <Select
            label={t('order.orderStatusTitle')}
            value={status}
            onChange={(event) => setStatus(event.target.value as ShipmentStatus)}
          >
            {SHIPMENT_STATUSES.map((value) => (
              <option key={value} value={value}>
                {t(`order.shipment_${value}`)}
              </option>
            ))}
          </Select>
        </div>

        <Button type="submit" loading={saving} className="self-start">
          {t('order.updateShipment')}
        </Button>
      </form>
    </Panel>
  );
}
