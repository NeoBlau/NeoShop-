import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { AdminSupplier, SupplierStatus } from '@3dsfera/shared';
import { adminApi } from '../../features/admin/api.js';
import { ApiError } from '../../api/client.js';
import { formatDate } from '../../lib/format.js';
import { Alert } from '../../ui/Alert.js';
import { Button, Spinner } from '../../ui/Button.js';
import { Badge, Textarea } from '../../ui/Form.js';
import { Panel } from '../../ui/Panel.js';

const TONES: Record<SupplierStatus, 'warning' | 'success' | 'danger' | 'neutral'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  BLOCKED: 'danger',
};

/**
 * Companies, and what may be done to them.
 *
 * Blocking is not deleting: their products leave the street immediately —
 * the world only shows approved suppliers — but everything they have already
 * sold still has to be shipped, so the rows stay and the orders keep working.
 */
export function SuppliersPage() {
  const { t, i18n } = useTranslation();
  const [suppliers, setSuppliers] = useState<AdminSupplier[] | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErrorCode(null);
    try {
      const response = await adminApi.suppliers();
      setSuppliers(response.suppliers);
    } catch (cause) {
      setErrorCode(cause instanceof ApiError ? cause.code : 'ERR_INTERNAL');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t('admin.suppliers')}</h1>
          <p className="text-ink-muted mt-1 text-sm">{t('admin.suppliersHint')}</p>
        </div>
        <Link to="/admin" className="text-ink-faint hover:text-ink text-sm">
          {t('common.back')}
        </Link>
      </div>

      {errorCode ? <Alert tone="danger">{t(`errors.${errorCode}`)}</Alert> : null}

      {!suppliers && !errorCode ? (
        <div className="text-ink-muted flex items-center gap-2 py-16 text-sm">
          <Spinner />
          {t('common.loading')}
        </div>
      ) : null}

      {suppliers?.map((supplier) => (
        <SupplierRow
          key={supplier.id}
          supplier={supplier}
          locale={i18n.language}
          onDecided={() => void load()}
        />
      ))}
    </div>
  );
}

function SupplierRow({
  supplier,
  locale,
  onDecided,
}: {
  supplier: AdminSupplier;
  locale: string;
  onDecided: () => void;
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'idle' | 'reject' | 'block'>('idle');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  async function act(action: 'approve' | 'reject' | 'block'): Promise<void> {
    if (action !== 'approve' && reason.trim().length < 8) {
      setErrorCode('reason');
      return;
    }

    setBusy(true);
    setErrorCode(null);

    try {
      if (action === 'approve') await adminApi.approveSupplier(supplier.id);
      else if (action === 'reject') await adminApi.rejectSupplier(supplier.id, reason.trim());
      else await adminApi.blockSupplier(supplier.id, reason.trim());
      onDecided();
    } catch (cause) {
      setErrorCode(cause instanceof ApiError ? cause.code : 'ERR_INTERNAL');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-medium">{supplier.companyName}</h2>
            <Badge tone={TONES[supplier.status]}>{t(`supplierStatus.${supplier.status}`)}</Badge>
          </div>
          <p className="text-ink-faint mt-1 text-xs">
            {[supplier.legalName, supplier.taxId, supplier.contactEmail]
              .filter(Boolean)
              .join(' · ') || '—'}
          </p>
        </div>

        <div className="text-ink-faint text-right text-xs">
          <div>{t('admin.productCount', { count: supplier.productCount })}</div>
          <div>{formatDate(supplier.createdAt, locale)}</div>
        </div>
      </div>

      {supplier.rejectionReason ? (
        <p className="text-ink-muted border-edge border-l-2 pl-3 text-sm">
          {supplier.rejectionReason}
        </p>
      ) : null}

      {errorCode ? (
        <Alert tone="danger">
          {errorCode === 'reason' ? t('admin.reasonRequired') : t(`errors.${errorCode}`)}
        </Alert>
      ) : null}

      {mode === 'idle' ? (
        <div className="flex flex-wrap gap-2">
          {supplier.status !== 'APPROVED' ? (
            <Button loading={busy} onClick={() => void act('approve')}>
              {supplier.status === 'BLOCKED' ? t('admin.unblock') : t('admin.approve')}
            </Button>
          ) : null}
          {supplier.status === 'PENDING' ? (
            <Button variant="ghost" onClick={() => setMode('reject')}>
              {t('admin.reject')}
            </Button>
          ) : null}
          {supplier.status !== 'BLOCKED' ? (
            <Button variant="danger" onClick={() => setMode('block')}>
              {t('admin.block')}
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Textarea
            label={t('admin.reason')}
            hint={t('admin.reasonHint')}
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <div className="flex gap-2">
            <Button variant="danger" loading={busy} onClick={() => void act(mode)}>
              {mode === 'block' ? t('admin.confirmBlock') : t('admin.reject')}
            </Button>
            <Button variant="ghost" onClick={() => setMode('idle')}>
              {t('admin.cancel')}
            </Button>
          </div>
        </div>
      )}
    </Panel>
  );
}
