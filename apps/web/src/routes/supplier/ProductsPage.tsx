import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  MODERATION_STATUSES,
  PRODUCT_CATEGORIES,
  type ProductListResponse,
  type ProductSummary,
} from '@3dsfera/shared';
import { ApiError } from '../../api/client.js';
import { productsApi } from '../../features/products/api.js';
import { Alert } from '../../ui/Alert.js';
import { Button, Spinner } from '../../ui/Button.js';
import { Badge, Select } from '../../ui/Form.js';
import { Panel } from '../../ui/Panel.js';

const statusTone = {
  DRAFT: 'neutral',
  PENDING: 'warning',
  PUBLISHED: 'success',
  REJECTED: 'danger',
} as const;

function formatPrice(cents: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function ProductsPage() {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<ProductSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(
    async (append: boolean, nextCursor?: string) => {
      setLoading(true);
      setErrorCode(null);
      try {
        const response: ProductListResponse = await productsApi.list({
          ...(status ? { status: status as ProductSummary['status'] } : {}),
          ...(category ? { category: category as ProductSummary['category'] } : {}),
          ...(search ? { search } : {}),
          ...(nextCursor ? { cursor: nextCursor } : {}),
        });
        setItems((previous) => (append ? [...previous, ...response.products] : response.products));
        setTotal(response.total);
        setCursor(response.nextCursor);
      } catch (error) {
        setErrorCode(error instanceof ApiError ? error.code : 'ERR_INTERNAL');
      } finally {
        setLoading(false);
      }
    },
    [status, category, search],
  );

  useEffect(() => {
    // Debounced so typing in the search box does not fire a request per key.
    const timer = setTimeout(() => void load(false), search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t('products.title')}</h1>
          <p className="text-ink-muted mt-1 text-sm">{t('products.total', { count: total })}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/supplier/import"
            className="border-edge-strong hover:bg-panel-raised rounded-lg border px-3 py-2 text-sm"
          >
            {t('products.importCsv')}
          </Link>
          <Link
            to="/supplier/stats"
            className="border-edge-strong hover:bg-panel-raised rounded-lg border px-3 py-2 text-sm"
          >
            {t('products.statsLink')}
          </Link>
          <Link
            to="/supplier/products/new"
            className="bg-accent text-accent-ink hover:bg-accent-hover rounded-lg px-3 py-2 text-sm font-medium"
          >
            {t('products.newProduct')}
          </Link>
        </div>
      </div>

      <Panel className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="product-search" className="text-ink-muted text-sm">
            {t('products.search')}
          </label>
          <input
            id="product-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="bg-panel-raised border-edge focus:border-accent/60 rounded-lg border px-3 py-2.5 text-sm outline-none"
          />
        </div>

        <Select
          label={t('products.filterStatus')}
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">{t('products.all')}</option>
          {MODERATION_STATUSES.map((value) => (
            <option key={value} value={value}>
              {t(`moderation.${value}`)}
            </option>
          ))}
        </Select>

        <Select
          label={t('products.filterCategory')}
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option value="">{t('products.all')}</option>
          {PRODUCT_CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {t(`category.${value}`)}
            </option>
          ))}
        </Select>
      </Panel>

      {errorCode ? <Alert tone="danger">{t(`errors.${errorCode}`)}</Alert> : null}

      {loading && items.length === 0 ? (
        <div className="text-ink-muted flex items-center gap-2 py-16 text-sm">
          <Spinner />
          {t('common.loading')}
        </div>
      ) : items.length === 0 ? (
        <Panel className="py-14 text-center">
          <p className="text-ink">
            {status || category || search ? t('products.nothingFound') : t('products.empty')}
          </p>
          <p className="text-ink-muted mx-auto mt-2 max-w-md text-sm">{t('products.emptyHint')}</p>
        </Panel>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((product) => (
            <li key={product.id}>
              <Link
                to={`/supplier/products/${product.id}`}
                className="panel hover:border-edge-strong block overflow-hidden transition-colors"
              >
                <div className="bg-panel-raised flex h-36 items-center justify-center overflow-hidden">
                  {product.previewUrl ? (
                    <img
                      src={product.previewUrl}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-ink-faint text-xs">
                      {product.hasModel ? t('products.noModel') : t('products.emptyHint')}
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-sm leading-snug font-medium">{product.title}</h2>
                    <Badge tone={statusTone[product.status]}>
                      {t(`moderation.${product.status}`)}
                    </Badge>
                  </div>

                  <p className="text-ink-muted text-sm">
                    {product.priceCents > 0
                      ? formatPrice(product.priceCents, product.currency, i18n.language)
                      : '—'}
                  </p>

                  <div className="text-ink-faint flex flex-wrap gap-x-3 gap-y-1 text-xs">
                    <span>
                      {product.viewCount} {t('products.views')}
                    </span>
                    <span>
                      {product.orderCount} {t('products.orders')}
                    </span>
                    <span>
                      {product.interactionCount} {t('products.interactions')}
                    </span>
                    {product.modelStatus === 'RUNNING' || product.modelStatus === 'PENDING' ? (
                      <Badge tone="warning">{t('products.modelProcessing')}</Badge>
                    ) : product.modelStatus === 'FAILED' ? (
                      <Badge tone="danger">{t('products.modelFailed')}</Badge>
                    ) : null}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {cursor ? (
        <div className="flex justify-center">
          <Button variant="ghost" loading={loading} onClick={() => void load(true, cursor)}>
            {t('products.loadMore')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
