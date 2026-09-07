import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ModerationItem, ModerationStatus } from '@3dsfera/shared';
import { adminApi } from '../../features/admin/api.js';
import { ApiError } from '../../api/client.js';
import { LazyModelViewer } from '../../scene/LazyModelViewer.js';
import { formatDateTime, priceFormatter } from '../../lib/format.js';
import { Alert } from '../../ui/Alert.js';
import { Button, Spinner } from '../../ui/Button.js';
import { Badge, Textarea } from '../../ui/Form.js';
import { Panel } from '../../ui/Panel.js';

/**
 * The moderation queue.
 *
 * A moderator decides whether a thing belongs on the street, and they cannot
 * do that from a title and a thumbnail — so each item carries the model
 * itself, in the same viewer the supplier used to check it, with the numbers
 * the upload pipeline measured beside it. Approving without looking is
 * possible; approving without being able to look is not.
 */
/**
 * The three lists a moderator needs.
 *
 * Rejected is not a dead end: a supplier fixes a model and resubmits, and a
 * moderator changes their mind. Without this tab the only way back from a
 * rejection is the database.
 */
const TABS: ModerationStatus[] = ['PENDING', 'REJECTED', 'PUBLISHED'];

export function ModerationPage() {
  const { t, i18n } = useTranslation();
  const [status, setStatus] = useState<ModerationStatus>('PENDING');
  const [items, setItems] = useState<ModerationItem[] | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErrorCode(null);
    setItems(null);
    try {
      const response = await adminApi.moderation(status);
      setItems(response.items);
    } catch (cause) {
      setErrorCode(cause instanceof ApiError ? cause.code : 'ERR_INTERNAL');
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t('admin.moderation')}</h1>
          <p className="text-ink-muted mt-1 text-sm">{t('admin.moderationHint')}</p>
        </div>
        <Link to="/admin" className="text-ink-faint hover:text-ink text-sm">
          {t('common.back')}
        </Link>
      </div>

      <div className="flex flex-wrap gap-1 text-sm">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setStatus(tab)}
            aria-current={tab === status ? 'true' : undefined}
            className={`rounded-md px-2.5 py-1.5 transition-colors ${
              tab === status ? 'bg-panel-raised text-ink' : 'text-ink-muted hover:text-ink'
            }`}
          >
            {t(`moderation.${tab}`)}
          </button>
        ))}
      </div>

      {errorCode ? <Alert tone="danger">{t(`errors.${errorCode}`)}</Alert> : null}

      {!items && !errorCode ? (
        <div className="text-ink-muted flex items-center gap-2 py-16 text-sm">
          <Spinner />
          {t('common.loading')}
        </div>
      ) : null}

      {items && items.length === 0 ? (
        <Panel className="flex flex-col items-center gap-2 py-16 text-center">
          <p className="text-ink-muted text-sm">{t('admin.queueEmpty')}</p>
          <p className="text-ink-faint max-w-sm text-sm">{t('admin.queueEmptyHint')}</p>
        </Panel>
      ) : null}

      {items?.map((item) => (
        <QueueItem key={item.id} item={item} locale={i18n.language} onDecided={() => void load()} />
      ))}
    </div>
  );
}

function QueueItem({
  item,
  locale,
  onDecided,
}: {
  item: ModerationItem;
  locale: string;
  onDecided: () => void;
}) {
  const { t } = useTranslation();
  const formatPrice = useMemo(() => priceFormatter(locale), [locale]);

  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const model = item.levels[0]?.url ?? null;

  // A product cannot be published while its company is still on moderation —
  // the server refuses it, and rightly. Saying so on the card beats letting a
  // moderator press the button and read the refusal afterwards: the thing that
  // needs approving first is the company, and there is a link to it.
  const supplierBlocked = item.supplier.status !== 'APPROVED';

  async function decide(action: 'approve' | 'reject'): Promise<void> {
    if (action === 'reject' && reason.trim().length < 8) {
      setErrorCode('reason');
      return;
    }

    setBusy(true);
    setErrorCode(null);

    try {
      if (action === 'approve') await adminApi.approveProduct(item.id);
      else await adminApi.rejectProduct(item.id, reason.trim());
      onDecided();
    } catch (cause) {
      setErrorCode(cause instanceof ApiError ? cause.code : 'ERR_INTERNAL');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        {model ? (
          <LazyModelViewer
            url={model}
            background="studio"
            className="h-64 overflow-hidden rounded-lg"
          />
        ) : (
          <div className="bg-panel-raised text-ink-faint flex h-64 items-center justify-center rounded-lg text-sm">
            {t('admin.noModel')}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-medium">{item.title}</h2>
              <p className="text-ink-faint text-xs">
                {item.supplier.companyName} · {t(`category.${item.category}`)}
              </p>
            </div>
            <span className="text-accent shrink-0 text-sm">
              {formatPrice(item.priceCents, item.currency)}
            </span>
          </div>

          <p className="text-ink-muted line-clamp-4 text-sm">{item.description}</p>

          {item.stats ? (
            <dl className="text-ink-faint grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
              <div>
                <dt>{t('admin.triangles')}</dt>
                <dd className="text-ink-muted tabular-nums">
                  {item.stats.triangles.toLocaleString(locale)}
                </dd>
              </div>
              <div>
                <dt>{t('admin.materials')}</dt>
                <dd className="text-ink-muted tabular-nums">{item.stats.materials}</dd>
              </div>
              <div>
                <dt>{t('admin.textures')}</dt>
                <dd className="text-ink-muted tabular-nums">{item.stats.textures}</dd>
              </div>
              <div>
                <dt>{t('admin.modelSize')}</dt>
                <dd className="text-ink-muted tabular-nums">
                  {(item.stats.bytes / 1e6).toFixed(1)} MB
                </dd>
              </div>
            </dl>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-ink-faint text-xs">{t('admin.animations')}:</span>
            {item.interactions.length === 0 ? (
              <span className="text-ink-faint text-xs">{t('admin.noAnimations')}</span>
            ) : (
              item.interactions.map((interaction) => (
                <Badge key={interaction.id} tone="accent">
                  {interaction.label}
                </Badge>
              ))
            )}
          </div>

          {item.submittedAt ? (
            <p className="text-ink-faint text-xs">
              {t('admin.submittedAt', { date: formatDateTime(item.submittedAt, locale) })}
            </p>
          ) : null}
        </div>
      </div>

      {supplierBlocked ? (
        <Alert tone="warning">
          {t('admin.supplierNotApproved', {
            company: item.supplier.companyName,
            status: t(`supplierStatus.${item.supplier.status}`),
          })}{' '}
          <Link to="/admin/suppliers" className="underline">
            {t('admin.suppliers')}
          </Link>
        </Alert>
      ) : null}

      {errorCode ? (
        <Alert tone="danger">
          {errorCode === 'reason' ? t('admin.reasonRequired') : t(`errors.${errorCode}`)}
        </Alert>
      ) : null}

      {rejecting ? (
        <div className="flex flex-col gap-3">
          <Textarea
            label={t('admin.reason')}
            hint={t('admin.reasonHint')}
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <div className="flex gap-2">
            <Button variant="danger" loading={busy} onClick={() => void decide('reject')}>
              {t('admin.confirmReject')}
            </Button>
            <Button variant="ghost" onClick={() => setRejecting(false)}>
              {t('admin.cancel')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button loading={busy} disabled={supplierBlocked} onClick={() => void decide('approve')}>
            {t('admin.approve')}
          </Button>
          <Button variant="ghost" onClick={() => setRejecting(true)}>
            {t('admin.reject')}
          </Button>
        </div>
      )}
    </Panel>
  );
}
