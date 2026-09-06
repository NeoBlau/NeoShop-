import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCart } from '../stores/cart.js';
import { useSession } from '../stores/session.js';
import { cartCurrency, cartSubtotal } from '../features/orders/model.js';
import { priceFormatter } from '../lib/format.js';
import { Alert } from '../ui/Alert.js';
import { Button } from '../ui/Button.js';
import { Panel } from '../ui/Panel.js';

const MAX_PER_LINE = 99;

/**
 * The cart.
 *
 * Shipping is deliberately absent here: it depends on the destination country,
 * and asking for an address before the buyer has decided to check out is one
 * question too early. The line says it will be calculated on the next step.
 */
export function CartPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const lines = useCart((state) => state.lines);
  const setQuantity = useCart((state) => state.setQuantity);
  const remove = useCart((state) => state.remove);
  const user = useSession((state) => state.user);

  const formatPrice = useMemo(() => priceFormatter(i18n.language), [i18n.language]);
  const { currency, mixed } = cartCurrency(lines);
  const subtotal = cartSubtotal(lines);

  if (lines.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="text-xl font-semibold">{t('order.cartTitle')}</h1>
        <Panel className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-ink-muted text-sm">{t('order.cartEmpty')}</p>
          <p className="text-ink-faint max-w-sm text-sm">{t('order.cartEmptyHint')}</p>
          <Link
            to="/catalog"
            className="border-edge-strong hover:bg-panel-raised mt-2 rounded-lg border px-4 py-2.5 text-sm"
          >
            {t('order.continueShopping')}
          </Link>
        </Panel>
      </div>
    );
  }

  function goToCheckout(): void {
    // The checkout route is guarded anyway; sending the buyer through the
    // login screen with a `next` is friendlier than a bounce to the home page.
    navigate(user ? '/checkout' : '/login?next=%2Fcheckout');
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold">{t('order.cartTitle')}</h1>

      {mixed ? <Alert tone="warning">{t('order.mixedCurrency')}</Alert> : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem] lg:items-start">
        <ul className="flex flex-col gap-3">
          {lines.map((line) => (
            <li key={line.productId} className="panel flex gap-3 p-3 sm:gap-4 sm:p-4">
              <div className="bg-panel-raised h-20 w-20 shrink-0 overflow-hidden rounded-lg sm:h-24 sm:w-24">
                {line.previewUrl ? (
                  <img
                    src={line.previewUrl}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-ink-faint flex h-full w-full items-center justify-center text-xs">
                    3D
                  </span>
                )}
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    to={`/catalog#${line.slug}`}
                    className="hover:text-accent truncate text-sm font-medium"
                  >
                    {line.title}
                  </Link>
                  <span className="text-ink shrink-0 text-sm tabular-nums">
                    {formatPrice(line.priceCents * line.quantity, line.currency)}
                  </span>
                </div>

                <p className="text-ink-faint text-xs">
                  {formatPrice(line.priceCents, line.currency)}
                </p>

                <div className="mt-auto flex items-center justify-between gap-3">
                  <div className="border-edge inline-flex items-center rounded-lg border">
                    <button
                      type="button"
                      aria-label={`${t('order.quantity')} −`}
                      disabled={line.quantity <= 1}
                      onClick={() => setQuantity(line.productId, line.quantity - 1)}
                      className="text-ink-muted hover:text-ink px-3 py-1.5 text-sm disabled:opacity-40"
                    >
                      −
                    </button>
                    <span className="min-w-8 text-center text-sm tabular-nums">
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      aria-label={`${t('order.quantity')} +`}
                      disabled={line.quantity >= MAX_PER_LINE}
                      onClick={() => setQuantity(line.productId, line.quantity + 1)}
                      className="text-ink-muted hover:text-ink px-3 py-1.5 text-sm disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => remove(line.productId)}
                    className="text-ink-faint hover:text-danger text-xs"
                  >
                    {t('order.remove')}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <Panel className="flex flex-col gap-3 lg:sticky lg:top-20">
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-muted">{t('order.subtotal')}</dt>
              <dd className="tabular-nums">{formatPrice(subtotal, currency)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-muted">{t('order.shipping')}</dt>
              <dd className="text-ink-faint text-right text-xs">{t('order.shippingUnknown')}</dd>
            </div>
          </dl>

          <div className="border-edge flex justify-between gap-3 border-t pt-3 text-base">
            <span>{t('order.total')}</span>
            <span className="tabular-nums">{formatPrice(subtotal, currency)}</span>
          </div>

          <Button onClick={goToCheckout} disabled={mixed}>
            {user ? t('order.checkout') : t('order.signInToCheckout')}
          </Button>

          <Link to="/catalog" className="text-ink-faint hover:text-ink text-center text-xs">
            {t('order.continueShopping')}
          </Link>
        </Panel>
      </div>
    </div>
  );
}
