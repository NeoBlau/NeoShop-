import type { FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { CheckoutResult, ShippingAddressInput, ShippingQuote } from '@3dsfera/shared';
import { ordersApi } from '../features/orders/api.js';
import {
  SHIPPING_COUNTRIES,
  cartCurrency,
  cartSubtotal,
  toCheckoutLines,
} from '../features/orders/model.js';
import { ApiError } from '../api/client.js';
import { useCart } from '../stores/cart.js';
import { formatKilograms, priceFormatter } from '../lib/format.js';
import { Alert } from '../ui/Alert.js';
import { Button, Spinner } from '../ui/Button.js';
import { Field } from '../ui/Field.js';
import { Select, Textarea } from '../ui/Form.js';
import { Panel } from '../ui/Panel.js';

/**
 * The form's own state: every field is a string, including the ones the API
 * treats as optional. An input is never `undefined` while it is on screen.
 */
type AddressDraft = Record<keyof ShippingAddressInput, string>;

const EMPTY_ADDRESS: AddressDraft = {
  recipient: '',
  phone: '',
  country: 'RU',
  region: '',
  city: '',
  postalCode: '',
  line1: '',
  line2: '',
  comment: '',
};

/**
 * Blank optional fields are dropped rather than sent as empty strings: the
 * server's schema treats an absent comment and an empty one differently, and
 * only one of them is what an untouched textarea means.
 */
function toAddressInput(draft: AddressDraft): ShippingAddressInput {
  const region = draft.region.trim();
  const line2 = draft.line2.trim();
  const comment = draft.comment.trim();

  return {
    recipient: draft.recipient.trim(),
    phone: draft.phone.trim(),
    country: draft.country,
    city: draft.city.trim(),
    postalCode: draft.postalCode.trim(),
    line1: draft.line1.trim(),
    ...(region ? { region } : {}),
    ...(line2 ? { line2 } : {}),
    ...(comment ? { comment } : {}),
  };
}

export function CheckoutPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const lines = useCart((state) => state.lines);
  const clearCart = useCart((state) => state.clear);

  const [address, setAddress] = useState<AddressDraft>(EMPTY_ADDRESS);
  const [quote, setQuote] = useState<ShippingQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState<CheckoutResult | null>(null);
  const [formError, setFormError] = useState<{
    code: string;
    params?: Record<string, string | number>;
  } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const formatPrice = useMemo(() => priceFormatter(i18n.language), [i18n.language]);
  const { currency, mixed } = cartCurrency(lines);
  const subtotal = cartSubtotal(lines);

  const country = address.country;

  const loadQuote = useCallback(async () => {
    if (lines.length === 0) return;
    setQuoting(true);
    setQuoteError(null);
    try {
      setQuote(await ordersApi.quote({ country, lines: toCheckoutLines(lines) }));
    } catch (cause) {
      setQuote(null);
      setQuoteError(cause instanceof ApiError ? cause.code : 'ERR_INTERNAL');
    } finally {
      setQuoting(false);
    }
  }, [country, lines]);

  // The quote depends on the destination and the cart, and on nothing else in
  // the form, so it is refreshed the moment the country changes rather than
  // waiting for a button the buyer has no reason to press.
  useEffect(() => {
    void loadQuote();
  }, [loadQuote]);

  const total = subtotal + (quote?.priceCents ?? 0);

  function field(key: keyof AddressDraft) {
    return {
      value: address[key],
      onChange: (event: { target: { value: string } }) =>
        setAddress((current) => ({ ...current, [key]: event.target.value })),
      error: fieldErrors[`address.${key}`]
        ? t(`validation.${fieldErrors[`address.${key}`]}`, {
            defaultValue: t('validation.required'),
          })
        : undefined,
    };
  }

  async function placeOrder(event: FormEvent): Promise<void> {
    event.preventDefault();
    setPlacing(true);
    setFormError(null);
    setFieldErrors({});

    try {
      const result = await ordersApi.checkout({
        lines: toCheckoutLines(lines),
        address: toAddressInput(address),
        currency,
      });
      // The cart has become an order; leaving it filled invites a second one.
      clearCart();
      setPlaced(result);
    } catch (cause) {
      if (cause instanceof ApiError) {
        setFieldErrors(cause.fieldErrors());
        setFormError({ code: cause.code, ...(cause.params ? { params: cause.params } : {}) });
      } else {
        setFormError({ code: 'ERR_INTERNAL' });
      }
    } finally {
      setPlacing(false);
    }
  }

  if (placed) {
    return (
      <PaymentStep
        result={placed}
        formatPrice={formatPrice}
        onPaid={() => navigate(`/orders/${placed.order.number}`)}
      />
    );
  }

  if (lines.length === 0) {
    return (
      <Panel className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-ink-muted text-sm">{t('order.cartEmpty')}</p>
        <Link to="/catalog" className="text-accent text-sm hover:underline">
          {t('order.continueShopping')}
        </Link>
      </Panel>
    );
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={(event) => void placeOrder(event)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-xl font-semibold">{t('order.checkoutTitle')}</h1>
        <Link to="/cart" className="text-ink-faint hover:text-ink text-sm">
          {t('order.cartTitle')}
        </Link>
      </div>

      {mixed ? <Alert tone="warning">{t('order.mixedCurrency')}</Alert> : null}
      {formError ? (
        <Alert tone="danger">
          {formError.code === 'ERR_CONFLICT' && formError.params?.['title'] !== undefined
            ? t('order.outOfStockLine', formError.params)
            : t(`errors.${formError.code}`, formError.params ?? {})}
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem] lg:items-start">
        <Panel className="flex flex-col gap-4">
          <h2 className="text-sm font-medium">{t('order.stepAddress')}</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t('order.recipient')}
              autoComplete="name"
              required
              {...field('recipient')}
            />
            <Field
              label={t('order.phone')}
              type="tel"
              autoComplete="tel"
              placeholder="+7 900 000-00-00"
              required
              {...field('phone')}
            />

            <Select label={t('order.country')} {...field('country')}>
              {SHIPPING_COUNTRIES.map((entry) => (
                <option key={entry.code} value={entry.code}>
                  {i18n.language.startsWith('ru') ? entry.ru : entry.en}
                </option>
              ))}
            </Select>
            <Field
              label={`${t('order.region')} (${t('common.optional')})`}
              autoComplete="address-level1"
              {...field('region')}
            />

            <Field
              label={t('order.city')}
              autoComplete="address-level2"
              required
              {...field('city')}
            />
            <Field
              label={t('order.postalCode')}
              autoComplete="postal-code"
              inputMode="numeric"
              required
              {...field('postalCode')}
            />

            <div className="sm:col-span-2">
              <Field
                label={t('order.line1')}
                autoComplete="address-line1"
                required
                {...field('line1')}
              />
            </div>
            <div className="sm:col-span-2">
              <Field
                label={`${t('order.line2')} (${t('common.optional')})`}
                autoComplete="address-line2"
                {...field('line2')}
              />
            </div>
            <div className="sm:col-span-2">
              <Textarea label={t('order.comment')} rows={3} {...field('comment')} />
            </div>
          </div>
        </Panel>

        <Panel className="flex flex-col gap-3 lg:sticky lg:top-20">
          <ul className="flex flex-col gap-1.5 text-xs">
            {lines.map((line) => (
              <li key={line.productId} className="text-ink-muted flex justify-between gap-3">
                <span className="truncate">
                  {line.title}
                  <span className="text-ink-faint"> × {line.quantity}</span>
                </span>
                <span className="shrink-0 tabular-nums">
                  {formatPrice(line.priceCents * line.quantity, line.currency)}
                </span>
              </li>
            ))}
          </ul>

          <dl className="border-edge flex flex-col gap-2 border-t pt-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-muted">{t('order.subtotal')}</dt>
              <dd className="tabular-nums">{formatPrice(subtotal, currency)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-muted">{t('order.shipping')}</dt>
              <dd className="text-right tabular-nums">
                {quoting ? (
                  <Spinner />
                ) : quote ? (
                  quote.priceCents === 0 ? (
                    <span className="text-success">{t('order.shippingFree')}</span>
                  ) : (
                    formatPrice(quote.priceCents, quote.currency)
                  )
                ) : (
                  <span className="text-ink-faint">—</span>
                )}
              </dd>
            </div>
          </dl>

          {quote ? (
            <p className="text-ink-faint text-xs">
              {t('order.estimated', {
                min: quote.estimatedDays.min,
                max: quote.estimatedDays.max,
              })}
              {' · '}
              {t('order.weight', { kg: formatKilograms(quote.weightGrams, i18n.language) })}
            </p>
          ) : null}

          {quoteError ? (
            <div className="flex flex-col gap-2">
              <Alert tone="danger">{t(`errors.${quoteError}`)}</Alert>
              <Button type="button" variant="ghost" onClick={() => void loadQuote()}>
                {t('order.calculate')}
              </Button>
            </div>
          ) : null}

          <div className="border-edge flex justify-between gap-3 border-t pt-3 text-base">
            <span>{t('order.total')}</span>
            <span className="tabular-nums">{formatPrice(total, currency)}</span>
          </div>

          <Button type="submit" loading={placing} disabled={mixed || !quote}>
            {t('order.checkout')}
          </Button>
        </Panel>
      </div>
    </form>
  );
}

/**
 * Payment.
 *
 * The order already exists at this point, in PENDING: a buyer who closes the
 * tab here finds it waiting under "my orders" rather than losing the address
 * they just typed.
 */
function PaymentStep({
  result,
  formatPrice,
  onPaid,
}: {
  result: CheckoutResult;
  formatPrice: (cents: number, currency: string) => string;
  onPaid: () => void;
}) {
  const { t } = useTranslation();
  const [paying, setPaying] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const { order, payment } = result;

  useEffect(() => {
    // A hosted checkout page owns the rest of the flow; the webhook, not this
    // tab, is what marks the order paid.
    if (payment.redirectUrl) window.location.assign(payment.redirectUrl);
  }, [payment.redirectUrl]);

  async function pay(): Promise<void> {
    setPaying(true);
    setErrorCode(null);
    try {
      const outcome = await ordersApi.confirmMockPayment(payment.reference);
      if (outcome.status === 'failed') {
        setErrorCode('ERR_CONFLICT');
        return;
      }
      onPaid();
    } catch (cause) {
      setErrorCode(cause instanceof ApiError ? cause.code : 'ERR_INTERNAL');
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">{t('order.orderPlaced')}</h1>
        <p className="text-ink-muted mt-1 text-sm">
          {t('order.orderNumber', { number: order.number })}
        </p>
      </div>

      <Panel className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">{t('order.stepPayment')}</h2>

        <div className="flex justify-between gap-3 text-base">
          <span className="text-ink-muted">{t('order.total')}</span>
          <span className="tabular-nums">{formatPrice(order.totalCents, order.currency)}</span>
        </div>

        {errorCode ? <Alert tone="danger">{t(`errors.${errorCode}`)}</Alert> : null}

        {payment.provider === 'mock' ? (
          <>
            <p className="text-ink-faint text-xs">{t('order.payMockHint')}</p>
            <Button onClick={() => void pay()} loading={paying}>
              {paying ? t('order.paying') : t('order.payMock')}
            </Button>
          </>
        ) : (
          <>
            <p className="text-ink-faint text-xs">{t('order.payStripeHint')}</p>
            <div className="text-ink-muted flex items-center gap-2 text-sm">
              <Spinner />
              {t('order.paying')}
            </div>
          </>
        )}

        <Link
          to={`/orders/${order.number}`}
          className="text-ink-faint hover:text-ink text-center text-xs"
        >
          {t('order.orderStatusTitle')}
        </Link>
      </Panel>
    </div>
  );
}
