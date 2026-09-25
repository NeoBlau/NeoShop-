import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BRAND,
  CATEGORIES,
  DELIVERY_STAGES,
  SIZES,
  bill,
  comboAlaCarteCents,
  foodItem,
  foodPhoto,
  itemsInCategory,
  type FoodCategoryId,
  type FoodChoice,
  type FoodItem,
} from '@3dsfera/shared';
import { Button } from '../ui/Button.js';
import { Alert } from '../ui/Alert.js';
import { euro, localeOf, subtitle, title } from '../features/food/copy.js';
import { PhotoCredits } from '../features/food/PhotoCredits.js';
import { useTray } from '../features/food/store.js';
import { courierAt, progressOf, ROUTE, stageIndex } from '../features/food/tracking.js';

/**
 * The counter at the end of the street, as its own tab.
 *
 * Three screens in one route, because that is how ordering food actually goes:
 * the menu, the tray, and then the wait. The wait is the part most ordering
 * flows get wrong by showing nothing; here it is a clock, a courier and five
 * named stages, driven by pure functions that are unit tested rather than by a
 * timer that hopes for the best.
 */

const BADGE_TONE: Record<string, string> = {
  new: 'bg-accent/15 text-accent border-accent/30',
  spicy: 'bg-danger/15 text-danger border-danger/30',
  veg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  popular: 'bg-panel-raised text-ink-muted border-edge-strong',
};

function Photo({ item, className = '' }: { item: FoodItem; className?: string }) {
  const [failed, setFailed] = useState(false);

  // A missing tile is a normal state, not a bug: the photo pack is fetched by
  // a build step, and a menu that renders grey squares still sells lunch.
  if (failed) {
    return (
      <div
        className={`bg-panel-raised text-ink-faint flex items-center justify-center text-2xl ${className}`}
        aria-hidden="true"
      >
        🍔
      </div>
    );
  }

  return (
    <img
      src={foodPhoto(item.id)}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className={`bg-panel-raised object-cover ${className}`}
    />
  );
}

function Badges({ item }: { item: FoodItem }) {
  const { t } = useTranslation();
  if (!item.badges?.length) return null;

  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {item.badges.map((badge) => (
        <span
          key={badge}
          className={`rounded border px-1.5 py-0.5 text-[10px] ${BADGE_TONE[badge] ?? ''}`}
        >
          {t(`food.badge_${badge}`)}
        </span>
      ))}
    </div>
  );
}

/** The sheet that opens on a tile: size, extras, how many. */
function ItemSheet({ item, onClose }: { item: FoodItem; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const locale = localeOf(i18n.language);
  const add = useTray((state) => state.add);

  const [sizeId, setSizeId] = useState<'S' | 'M' | 'L'>('M');
  const [extras, setExtras] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);

  const choice: FoodChoice = {
    itemId: item.id,
    quantity,
    ...(item.sized ? { sizeId } : {}),
    ...(extras.length > 0 ? { extraIds: extras } : {}),
  };
  const line = bill([choice], false);
  const alaCarte = comboAlaCarteCents(item, sizeId);

  return (
    <div
      className="bg-void/70 fixed inset-0 z-40 flex items-end justify-center p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-label={title(item.name, locale)}
      onClick={onClose}
    >
      <div
        className="panel max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl p-0 sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <Photo item={item} className="h-48 w-full rounded-t-2xl sm:h-56" />

        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-ink text-lg font-semibold">{title(item.name, locale)}</h2>
              {subtitle(item.name, locale) ? (
                <p className="text-ink-faint text-xs">{subtitle(item.name, locale)}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-ink-faint hover:text-ink text-sm"
              aria-label={t('common.close')}
            >
              ✕
            </button>
          </div>

          <p className="text-ink-muted mt-2 text-sm">{title(item.note, locale)}</p>
          <Badges item={item} />

          {item.combo ? (
            <div className="border-edge mt-4 rounded-lg border p-3">
              <p className="text-ink-faint text-xs">{t('food.comboContains')}</p>
              <ul className="text-ink-muted mt-1 space-y-0.5 text-sm">
                {[item.combo.panino, item.combo.side, item.combo.drink].map((partId) => {
                  const part = foodItem(partId);
                  return part ? <li key={partId}>· {title(part.name, locale)}</li> : null;
                })}
              </ul>
            </div>
          ) : null}

          {item.sized ? (
            <div className="mt-4">
              <p className="text-ink-faint text-xs">{t('food.size')}</p>
              <div className="mt-1.5 flex gap-1.5">
                {SIZES.map((size) => (
                  <button
                    key={size.id}
                    type="button"
                    onClick={() => setSizeId(size.id)}
                    aria-pressed={sizeId === size.id}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                      sizeId === size.id
                        ? 'border-accent bg-accent/10 text-ink'
                        : 'border-edge text-ink-muted hover:border-edge-strong'
                    }`}
                  >
                    {title(size.name, locale)}
                    {size.deltaCents > 0 ? (
                      <span className="text-ink-faint block text-[11px]">
                        +{euro(size.deltaCents, i18n.language)}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {item.extras?.length ? (
            <div className="mt-4">
              <p className="text-ink-faint text-xs">{t('food.extras')}</p>
              <div className="mt-1.5 space-y-1">
                {item.extras.map((extraId) => {
                  const extra = foodItem(extraId);
                  if (!extra) return null;
                  const chosen = extras.includes(extraId);

                  return (
                    <button
                      key={extraId}
                      type="button"
                      onClick={() =>
                        setExtras((current) =>
                          chosen ? current.filter((id) => id !== extraId) : [...current, extraId],
                        )
                      }
                      aria-pressed={chosen}
                      className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors ${
                        chosen
                          ? 'border-accent bg-accent/10 text-ink'
                          : 'border-edge text-ink-muted hover:border-edge-strong'
                      }`}
                    >
                      <span>{title(extra.name, locale)}</span>
                      <span className="text-ink-faint text-xs">
                        +{euro(extra.priceCents, i18n.language)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="mt-5 flex items-center gap-3">
            <div className="border-edge flex items-center rounded-lg border">
              <button
                type="button"
                onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                className="text-ink-muted hover:text-ink px-3 py-2"
                aria-label={t('food.fewer')}
              >
                −
              </button>
              <span className="w-8 text-center text-sm tabular-nums">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((value) => Math.min(20, value + 1))}
                className="text-ink-muted hover:text-ink px-3 py-2"
                aria-label={t('food.more')}
              >
                +
              </button>
            </div>

            <Button
              className="flex-1"
              onClick={() => {
                add(choice);
                onClose();
              }}
            >
              {t('food.addFor', { price: euro(line.itemsCents, i18n.language) })}
            </Button>
          </div>

          <p className="text-ink-faint mt-2 text-[11px]">
            {t('food.kcal', { kcal: line.kcal })}
            {alaCarte !== null && alaCarte > line.itemsCents / quantity ? (
              <>
                {' · '}
                {t('food.savesVersus', {
                  saved: euro(alaCarte - line.itemsCents / quantity, i18n.language),
                })}
              </>
            ) : null}
          </p>
        </div>
      </div>
    </div>
  );
}

function Tray({ onCheckout }: { onCheckout: () => void }) {
  const { t, i18n } = useTranslation();
  const locale = localeOf(i18n.language);
  const choices = useTray((state) => state.choices);
  const setQuantity = useTray((state) => state.setQuantity);
  const remove = useTray((state) => state.remove);
  const total = useMemo(() => bill(choices), [choices]);

  if (choices.length === 0) {
    return <p className="text-ink-faint text-sm">{t('food.trayEmpty')}</p>;
  }

  const toFreeDelivery = BRAND.freeDeliveryFromCents - total.itemsCents;

  return (
    <div>
      <ul className="space-y-2">
        {total.lines.map((line, index) => (
          <li
            key={`${line.item.id}-${index}`}
            className="border-edge flex gap-3 rounded-lg border p-2"
          >
            <Photo item={line.item} className="h-14 w-14 shrink-0 rounded-md" />

            <div className="min-w-0 flex-1">
              <p className="text-ink truncate text-sm">{title(line.item.name, locale)}</p>
              <p className="text-ink-faint text-[11px]">
                {line.choice.sizeId && line.item.sized ? `${line.choice.sizeId} · ` : ''}
                {(line.choice.extraIds ?? [])
                  .map((id) => foodItem(id))
                  .filter((extra): extra is FoodItem => extra !== null)
                  .map((extra) => title(extra.name, locale))
                  .join(', ') || t('food.asIs')}
              </p>

              <div className="mt-1 flex items-center gap-2">
                <div className="border-edge flex items-center rounded border">
                  <button
                    type="button"
                    onClick={() => setQuantity(index, line.choice.quantity - 1)}
                    className="text-ink-muted hover:text-ink px-2 text-sm"
                    aria-label={t('food.fewer')}
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-xs tabular-nums">
                    {line.choice.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity(index, line.choice.quantity + 1)}
                    className="text-ink-muted hover:text-ink px-2 text-sm"
                    aria-label={t('food.more')}
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="text-ink-faint hover:text-danger text-[11px]"
                >
                  {t('food.removeLine')}
                </button>
              </div>
            </div>

            <p className="text-ink shrink-0 text-sm tabular-nums">
              {euro(line.totalCents, i18n.language)}
            </p>
          </li>
        ))}
      </ul>

      <dl className="border-edge mt-3 space-y-1 border-t pt-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-ink-muted">{t('food.subtotal')}</dt>
          <dd className="tabular-nums">{euro(total.itemsCents, i18n.language)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-muted">{t('food.delivery')}</dt>
          <dd className="tabular-nums">
            {total.deliveryCents === 0
              ? t('food.deliveryFree')
              : euro(total.deliveryCents, i18n.language)}
          </dd>
        </div>
        {total.savedCents > 0 ? (
          <div className="flex justify-between text-emerald-300">
            <dt>{t('food.saved')}</dt>
            <dd className="tabular-nums">−{euro(total.savedCents, i18n.language)}</dd>
          </div>
        ) : null}
        <div className="border-edge flex justify-between border-t pt-1 text-base font-semibold">
          <dt>{t('food.total')}</dt>
          <dd className="tabular-nums">{euro(total.totalCents, i18n.language)}</dd>
        </div>
      </dl>

      {toFreeDelivery > 0 ? (
        <p className="text-ink-faint mt-2 text-[11px]">
          {t('food.toFreeDelivery', { amount: euro(toFreeDelivery, i18n.language) })}
        </p>
      ) : null}

      <Button className="mt-3 w-full" onClick={onCheckout}>
        {t('food.checkout')}
      </Button>
      <p className="text-ink-faint mt-2 text-[11px]">{t('food.simulationNote')}</p>
    </div>
  );
}

/** The wait: a clock, a courier and the five stages of getting lunch. */
function Tracking() {
  const { t, i18n } = useTranslation();
  const order = useTray((state) => state.order);
  const forget = useTray((state) => state.forget);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    // One second is enough for a countdown in minutes and costs nothing; the
    // interval is cleared the moment the order is cleared.
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!order) return null;

  const progress = progressOf(order.placedAt, order.etaMinutes, now);
  const courier = courierAt(progress);
  const current = stageIndex(progress.stage);
  const path = ROUTE.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(
    ' ',
  );

  return (
    <section className="panel p-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-ink-faint text-xs">
            {t('food.orderNumber', { number: order.number })}
          </p>
          <h2 className="text-ink text-lg">
            {progress.done
              ? t('food.arrived')
              : t('food.minutesLeft', { minutes: progress.minutesLeft })}
          </h2>
          <p className="text-ink-muted mt-0.5 text-sm">
            {t('food.arrivesBy', {
              time: progress.arrivesAt.toLocaleTimeString(i18n.language, {
                hour: '2-digit',
                minute: '2-digit',
              }),
            })}
          </p>
        </div>
        <p className="text-ink shrink-0 text-sm tabular-nums">
          {euro(order.totalCents, i18n.language)}
        </p>
      </header>

      {/* The map is schematic on purpose: a real one would need a tile server,
          a courier who exists, and an address we are not actually delivering
          to. What it has to show is that something is moving. */}
      {/* Constrained rather than stretched: the route is drawn in a square
          coordinate space, and letting it centre itself inside a wide panel
          leaves the courier adrift in grey. */}
      <div className="border-edge bg-panel-raised mx-auto mt-4 max-w-xl overflow-hidden rounded-xl border">
        <svg viewBox="0 0 100 90" className="h-40 w-full sm:h-52" role="img" aria-hidden="true">
          <defs>
            <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#2a2e35" strokeWidth="0.4" />
            </pattern>
          </defs>
          <rect width="100" height="90" fill="url(#grid)" />
          <path d={path} fill="none" stroke="#3a3f47" strokeWidth="2.2" strokeLinecap="round" />
          <path
            d={path}
            fill="none"
            stroke="#e5b25a"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeDasharray="100"
            strokeDashoffset={100 - progress.fraction * 100}
            pathLength={100}
          />
          <circle cx={ROUTE[0]?.x ?? 0} cy={ROUTE[0]?.y ?? 0} r="2.4" fill="#8f949c" />
          <circle
            cx={ROUTE[ROUTE.length - 1]?.x ?? 0}
            cy={ROUTE[ROUTE.length - 1]?.y ?? 0}
            r="2.4"
            fill="#8f949c"
          />
          <circle cx={courier.x} cy={courier.y} r="3.2" fill="#e5b25a" />
        </svg>
      </div>

      <ol className="mt-4 space-y-2">
        {DELIVERY_STAGES.map((stage, index) => {
          const done = index < current || progress.done;
          const active = index === current && !progress.done;

          return (
            <li key={stage} className="flex items-start gap-2.5">
              <span
                className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border text-[10px] leading-[14px] text-center ${
                  done
                    ? 'border-accent bg-accent text-accent-ink'
                    : active
                      ? 'border-accent text-accent'
                      : 'border-edge text-ink-faint'
                }`}
              >
                {done ? '✓' : ''}
              </span>
              <div>
                <p className={active ? 'text-ink text-sm' : 'text-ink-muted text-sm'}>
                  {t(`food.stage_${stage}`)}
                </p>
                {active ? (
                  <p className="text-ink-faint text-[11px]">{t(`food.stageNote_${stage}`)}</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      <p className="text-ink-faint mt-4 text-xs">
        {t('food.deliverTo', { address: order.address })}
      </p>

      <Button variant="ghost" className="mt-3 w-full" onClick={forget}>
        {progress.done ? t('food.orderAgain') : t('food.hideOrder')}
      </Button>
    </section>
  );
}

export function FoodPage() {
  const { t, i18n } = useTranslation();
  const locale = localeOf(i18n.language);
  const [category, setCategory] = useState<FoodCategoryId>('menu');
  const [open, setOpen] = useState<FoodItem | null>(null);
  const [address, setAddress] = useState('');
  const [checkout, setCheckout] = useState(false);

  const order = useTray((state) => state.order);
  const place = useTray((state) => state.place);
  const count = useTray((state) => state.count());

  const items = useMemo(() => itemsInCategory(category), [category]);
  const active = CATEGORIES.find((entry) => entry.id === category);

  const confirm = useCallback(() => {
    const trimmed = address.trim();
    if (trimmed.length < 6) return;
    place(trimmed);
    setCheckout(false);
  }, [address, place]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-ink text-2xl font-semibold tracking-tight">{BRAND.name}</h1>
          <p className="text-ink-faint text-sm">{BRAND.tagline[locale]}</p>
        </div>
        {count > 0 ? <p className="text-ink-muted text-sm">{t('food.inTray', { count })}</p> : null}
      </header>

      {order ? (
        <div className="mt-5">
          <Tracking />
        </div>
      ) : null}

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0">
          <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
            {CATEGORIES.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setCategory(entry.id)}
                aria-pressed={category === entry.id}
                className={`shrink-0 rounded-lg border px-3 py-1.5 text-sm whitespace-nowrap transition-colors ${
                  category === entry.id
                    ? 'border-accent bg-accent/10 text-ink'
                    : 'border-edge text-ink-muted hover:border-edge-strong'
                }`}
              >
                {title(entry.name, locale)}
              </button>
            ))}
          </nav>

          {active ? (
            <p className="text-ink-faint mt-3 text-sm">{title(active.note, locale)}</p>
          ) : null}

          <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setOpen(item)}
                  className="panel hover:border-edge-strong w-full overflow-hidden p-0 text-left transition-colors"
                >
                  <Photo item={item} className="h-36 w-full" />
                  <div className="p-3">
                    <p className="text-ink text-sm font-medium">{title(item.name, locale)}</p>
                    {subtitle(item.name, locale) ? (
                      <p className="text-ink-faint text-[11px]">{subtitle(item.name, locale)}</p>
                    ) : null}
                    <p className="text-ink-muted mt-1 line-clamp-2 text-xs">
                      {title(item.note, locale)}
                    </p>
                    <Badges item={item} />
                    <p className="text-accent mt-2 text-sm tabular-nums">
                      {euro(item.priceCents, i18n.language)}
                      <span className="text-ink-faint ml-1.5 text-[11px]">
                        {t('food.kcalShort', { kcal: item.kcal })}
                      </span>
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <aside className="panel h-fit p-4 lg:sticky lg:top-20">
          <h2 className="text-ink text-sm font-semibold">{t('food.tray')}</h2>
          <div className="mt-3">
            <Tray onCheckout={() => setCheckout(true)} />
          </div>
        </aside>
      </div>

      <PhotoCredits />

      {open ? <ItemSheet item={open} onClose={() => setOpen(null)} /> : null}

      {checkout ? (
        <div
          className="bg-void/70 fixed inset-0 z-40 flex items-center justify-center p-4 backdrop-blur-sm"
          role="dialog"
          aria-label={t('food.checkout')}
          onClick={() => setCheckout(false)}
        >
          <div className="panel w-full max-w-md p-5" onClick={(event) => event.stopPropagation()}>
            <h2 className="text-ink text-lg font-semibold">{t('food.whereTo')}</h2>
            <p className="text-ink-faint mt-1 text-xs">{t('food.addressNote')}</p>

            <input
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder={t('food.addressPlaceholder')}
              className="bg-panel-raised border-edge text-ink focus:border-edge-strong mt-3 w-full rounded-lg border px-3 py-2 text-sm outline-none"
            />

            {address.trim().length > 0 && address.trim().length < 6 ? (
              <div className="mt-2">
                <Alert tone="danger">{t('food.addressTooShort')}</Alert>
              </div>
            ) : null}

            <div className="mt-4 flex gap-2">
              <Button variant="ghost" onClick={() => setCheckout(false)}>
                {t('common.cancel')}
              </Button>
              <Button className="flex-1" disabled={address.trim().length < 6} onClick={confirm}>
                {t('food.placeOrder')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
