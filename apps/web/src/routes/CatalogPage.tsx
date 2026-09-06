import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { WorldProduct, WorldResponse } from '@3dsfera/shared';
import { useWorld } from '../features/world/useWorld.js';
import { useCart } from '../stores/cart.js';
import { Alert } from '../ui/Alert.js';
import { Button, Spinner } from '../ui/Button.js';
import { Badge } from '../ui/Form.js';
import { Panel } from '../ui/Panel.js';

/**
 * The flat catalogue.
 *
 * It is not a lesser version of the showroom — it is the guarantee that buying
 * works on any device, and it carries the same products, prices and stock. The
 * 3D world falls back to this component rather than to an apology.
 */
export function CatalogGrid({ world }: { world: WorldResponse }) {
  const { t, i18n } = useTranslation();
  const add = useCart((state) => state.add);

  const formatPrice = useMemo(
    () => (cents: number, currency: string) =>
      new Intl.NumberFormat(i18n.language, {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }).format(cents / 100),
    [i18n.language],
  );

  const rows = useMemo(
    () =>
      world.pavilions.flatMap((pavilion) =>
        pavilion.products.map((product) => ({ product, supplier: pavilion.supplierName })),
      ),
    [world.pavilions],
  );

  if (rows.length === 0) {
    return <Panel className="text-ink-muted py-14 text-center text-sm">{t('catalog.empty')}</Panel>;
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map(({ product, supplier }) => (
        <li key={product.id} id={product.slug} className="panel flex flex-col overflow-hidden">
          <div className="bg-panel-raised flex h-44 items-center justify-center overflow-hidden">
            {product.previewUrl ? (
              <img
                src={product.previewUrl}
                alt={product.title}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-ink-faint text-xs">3D</span>
            )}
          </div>

          <div className="flex flex-1 flex-col gap-2 p-4">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-sm leading-snug font-medium">{product.title}</h2>
              {product.interactions.length > 0 ? (
                <Badge tone="accent">
                  {t('catalog.animations', { count: product.interactions.length })}
                </Badge>
              ) : null}
            </div>

            <p className="text-ink-faint text-xs">{supplier}</p>
            <p className="text-ink-muted line-clamp-3 text-sm">{product.description}</p>

            <div className="mt-auto flex items-center justify-between gap-2 pt-2">
              <span className="text-accent">
                {formatPrice(product.priceCents, product.currency)}
              </span>
              <Button
                variant="ghost"
                disabled={product.stock === 0}
                onClick={() =>
                  add({
                    productId: product.id,
                    slug: product.slug,
                    title: product.title,
                    priceCents: product.priceCents,
                    currency: product.currency,
                    previewUrl: product.previewUrl,
                  })
                }
              >
                {product.stock === 0 ? t('world.outOfStock') : t('world.addToCart')}
              </Button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function CatalogPage() {
  const { t } = useTranslation();
  const { world, loading, errorCode } = useWorld();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t('catalog.title')}</h1>
          <p className="text-ink-muted mt-1 text-sm">{t('catalog.subtitle')}</p>
        </div>
        <Link to="/" className="text-accent text-sm hover:underline">
          {t('world.backToWorld')}
        </Link>
      </div>

      {errorCode ? <Alert tone="danger">{t(`errors.${errorCode}`)}</Alert> : null}

      {loading ? (
        <div className="text-ink-muted flex items-center gap-2 py-16 text-sm">
          <Spinner />
          {t('common.loading')}
        </div>
      ) : world ? (
        <CatalogGrid world={world} />
      ) : null}
    </div>
  );
}

export type { WorldProduct };
