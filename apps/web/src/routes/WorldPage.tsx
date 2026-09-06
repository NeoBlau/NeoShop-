import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { WorldProduct } from '@3dsfera/shared';
import { useWorld, useViewReporter } from '../features/world/useWorld.js';
import { useCart } from '../stores/cart.js';
import {
  QUALITY_TIERS,
  detectCapabilities,
  pickQualityTier,
  webglUnavailable,
  type QualityTier,
} from '../scene/quality.js';
import { TouchControls } from '../scene/world/TouchControls.js';
import { useInput } from '../scene/world/input.js';
import { Alert } from '../ui/Alert.js';
import { Button, Spinner } from '../ui/Button.js';
import { CatalogGrid } from './CatalogPage.js';

/**
 * The 3D showroom, with the flat catalogue as its fallback.
 *
 * The scene is loaded lazily and the decision to load it at all is made from
 * the device's capabilities: three.js is a megabyte of JavaScript that a phone
 * refusing WebGL should never download. Buying works in either mode — that is
 * the rule the fallback exists to keep.
 */
const World = lazy(async () => {
  const module = await import('../scene/world/World.js');
  return { default: module.World };
});

type Mode = 'deciding' | 'world' | 'flat';

function formatPriceWith(locale: string) {
  return (cents: number, currency: string): string =>
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(cents / 100);
}

/** The panel that opens when a buyer walks up to a product and clicks it. */
function ProductPanel({
  product,
  activeClip,
  onPlay,
  onStop,
  onClose,
  formatPrice,
}: {
  product: WorldProduct;
  activeClip: string | null;
  onPlay: (clipName: string, loop: boolean) => void;
  onStop: () => void;
  onClose: () => void;
  formatPrice: (cents: number, currency: string) => string;
}) {
  const { t, i18n } = useTranslation();
  const add = useCart((state) => state.add);
  const [added, setAdded] = useState(false);

  const label = (interaction: WorldProduct['interactions'][number]): string =>
    i18n.language === 'en' && interaction.labelEn ? interaction.labelEn : interaction.label;

  return (
    <aside className="panel pointer-events-auto absolute inset-x-3 bottom-3 z-10 max-h-[62vh] overflow-y-auto p-4 sm:inset-x-auto sm:top-16 sm:right-4 sm:bottom-auto sm:max-h-[76vh] sm:w-[22rem]">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base leading-snug font-medium">{product.title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('common.close')}
          className="text-ink-faint hover:text-ink shrink-0 text-lg leading-none"
        >
          ×
        </button>
      </div>

      <p className="text-accent mt-2 text-lg">
        {formatPrice(product.priceCents, product.currency)}
      </p>

      <p className="text-ink-faint mt-1 text-xs">
        {product.stock > 0 ? t('world.inStock', { count: product.stock }) : t('world.outOfStock')}
      </p>

      <p className="text-ink-muted mt-3 text-sm leading-relaxed">{product.description}</p>

      {product.interactions.length > 0 ? (
        <div className="mt-4 flex flex-col gap-2">
          <span className="text-ink-faint text-xs">{t('world.showInAction')}</span>
          <div className="flex flex-wrap gap-2">
            {product.interactions.map((interaction) => {
              const playing = activeClip === interaction.clipName;
              return (
                <button
                  key={interaction.id}
                  type="button"
                  onClick={() =>
                    playing
                      ? onStop()
                      : onPlay(interaction.clipName ?? interaction.type, interaction.loop)
                  }
                  className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                    playing
                      ? 'border-accent text-accent bg-accent/10'
                      : 'border-edge-strong text-ink-muted hover:text-ink'
                  }`}
                >
                  {playing ? t('world.stopAnimation') : label(interaction)}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mt-5 flex items-center gap-3">
        <Button
          disabled={product.stock === 0}
          onClick={() => {
            add({
              productId: product.id,
              slug: product.slug,
              title: product.title,
              priceCents: product.priceCents,
              currency: product.currency,
              previewUrl: product.previewUrl,
            });
            setAdded(true);
          }}
        >
          {added ? t('world.added') : t('world.addToCart')}
        </Button>
        <Link to={`/catalog#${product.slug}`} className="text-ink-faint text-xs hover:underline">
          {t('catalog.title')}
        </Link>
      </div>
    </aside>
  );
}

export function WorldPage() {
  const { t, i18n } = useTranslation();
  const { world, loading, errorCode } = useWorld();
  const reportView = useViewReporter();

  const [mode, setMode] = useState<Mode>('deciding');
  const [tier, setTier] = useState<QualityTier>('high');
  const [autoTier, setAutoTier] = useState(true);
  const [selected, setSelected] = useState<WorldProduct | null>(null);
  const [activeClip, setActiveClip] = useState<string | null>(null);
  const [loop, setLoop] = useState(false);
  const [touch, setTouch] = useState(false);

  const formatPrice = useMemo(() => formatPriceWith(i18n.language), [i18n.language]);

  // Capabilities are probed once: each probe allocates a WebGL context, and
  // browsers cap how many may exist at a time.
  useEffect(() => {
    const capabilities = detectCapabilities();
    setTouch(capabilities.touch);

    if (webglUnavailable(capabilities)) {
      setMode('flat');
      return;
    }

    setTier(pickQualityTier(capabilities));
    setMode('world');
  }, []);

  useEffect(() => {
    if (selected) reportView(selected.id);
  }, [selected, reportView]);

  // Releasing the pointer lock is what closes the panel on a desktop; keep the
  // two in step so the cursor is always usable when a panel is open.
  useEffect(() => {
    if (selected && document.pointerLockElement) document.exitPointerLock();
  }, [selected]);

  useEffect(() => () => useInput.getState().reset(), []);

  const handleSelect = useCallback((product: WorldProduct | null) => {
    setSelected(product);
    setActiveClip(null);
  }, []);

  const productCount = world?.pavilions.reduce(
    (total, pavilion) => total + pavilion.products.length,
    0,
  );

  if (loading || mode === 'deciding') {
    return (
      <div className="text-ink-muted flex items-center justify-center gap-2 py-24 text-sm">
        <Spinner />
        {t('world.entering')}
      </div>
    );
  }

  if (errorCode || !world) {
    return <Alert tone="danger">{t(`errors.${errorCode ?? 'ERR_INTERNAL'}`)}</Alert>;
  }

  if (mode === 'flat') {
    return (
      <div className="flex flex-col gap-5">
        <Alert tone="info">{t('world.webglUnavailableHint')}</Alert>
        <CatalogGrid world={world} />
      </div>
    );
  }

  if (productCount === 0) {
    return (
      <div className="py-20 text-center">
        <h1 className="text-xl font-semibold">{t('world.emptyWorld')}</h1>
        <p className="text-ink-muted mx-auto mt-2 max-w-md text-sm">{t('world.emptyWorldHint')}</p>
      </div>
    );
  }

  return (
    <div className="relative -mx-4 -my-8 h-[calc(100dvh-9.5rem)] overflow-hidden sm:mx-0 sm:rounded-[var(--radius-panel)]">
      <Suspense
        fallback={
          <div className="text-ink-muted flex h-full items-center justify-center gap-2 text-sm">
            <Spinner />
            {t('world.entering')}
          </div>
        }
      >
        <World
          world={world}
          tier={tier}
          onTierChange={(next) => {
            if (autoTier) setTier(next);
          }}
          selectedProductId={selected?.id ?? null}
          activeClip={activeClip}
          loop={loop}
          onSelect={handleSelect}
          formatPrice={formatPrice}
          controlsEnabled={selected === null}
        />
      </Suspense>

      {/* Crosshair: without one it is hard to tell what a click will hit. */}
      {!selected ? (
        <div className="pointer-events-none absolute top-1/2 left-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70" />
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3">
        <div className="bg-void/70 border-edge text-ink-muted pointer-events-auto rounded-lg border px-3 py-2 text-xs backdrop-blur">
          <div>{t('world.pavilions', { count: world.pavilions.length })}</div>
          <div>{t('world.products', { count: productCount ?? 0 })}</div>
        </div>

        <div className="bg-void/70 border-edge pointer-events-auto flex items-center gap-2 rounded-lg border px-3 py-2 text-xs backdrop-blur">
          <span className="text-ink-faint">{t('world.quality')}</span>
          <select
            value={autoTier ? 'auto' : tier}
            onChange={(event) => {
              const value = event.target.value;
              if (value === 'auto') {
                setAutoTier(true);
                setTier(pickQualityTier(detectCapabilities()));
              } else {
                setAutoTier(false);
                setTier(value as QualityTier);
              }
            }}
            className="bg-panel-raised border-edge rounded border px-1.5 py-1 text-xs outline-none"
          >
            <option value="auto">{t('world.qualityAuto')}</option>
            {QUALITY_TIERS.map((value) => (
              <option key={value} value={value}>
                {t(`world.quality_${value}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!selected ? (
        <div className="text-ink-faint pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-3">
          <p className="bg-void/70 border-edge rounded-lg border px-3 py-1.5 text-center text-[11px] backdrop-blur">
            {touch ? t('world.controlsHintTouch') : t('world.controlsHint')}
          </p>
        </div>
      ) : null}

      {touch && !selected ? <TouchControls /> : null}

      {selected ? (
        <ProductPanel
          product={selected}
          activeClip={activeClip}
          onPlay={(clipName, shouldLoop) => {
            setActiveClip(clipName);
            setLoop(shouldLoop);
          }}
          onStop={() => setActiveClip(null)}
          onClose={() => handleSelect(null)}
          formatPrice={formatPrice}
        />
      ) : null}

      <button
        type="button"
        onClick={() => setMode('flat')}
        className="bg-void/70 border-edge text-ink-muted hover:text-ink absolute right-3 bottom-3 rounded-lg border px-3 py-1.5 text-xs backdrop-blur"
      >
        {t('world.switchToCatalog')}
      </button>
    </div>
  );
}
