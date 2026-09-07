import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PAVILION_THEMES, type AdminPavilion } from '@3dsfera/shared';
import { adminApi } from '../../features/admin/api.js';
import { ApiError } from '../../api/client.js';
import { Alert } from '../../ui/Alert.js';
import { Button, Spinner } from '../../ui/Button.js';
import { Badge, Select } from '../../ui/Form.js';
import { Field } from '../../ui/Field.js';
import { Panel } from '../../ui/Panel.js';

/**
 * Where each supplier's shop stands.
 *
 * The slot is the supplier's address on the street, and it is unique: the
 * server refuses a taken one rather than swapping the two shops, because a
 * silent swap is a change to somebody else's pavilion that nobody asked for.
 */
export function PavilionsPage() {
  const { t } = useTranslation();
  const [pavilions, setPavilions] = useState<AdminPavilion[] | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    adminApi
      .pavilions()
      .then((response) => {
        if (!cancelled) setPavilions(response.pavilions);
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
          <h1 className="text-xl font-semibold">{t('admin.pavilions')}</h1>
          <p className="text-ink-muted mt-1 text-sm">{t('admin.pavilionsHint')}</p>
        </div>
        <Link to="/admin" className="text-ink-faint hover:text-ink text-sm">
          {t('common.back')}
        </Link>
      </div>

      {errorCode ? <Alert tone="danger">{t(`errors.${errorCode}`)}</Alert> : null}

      {!pavilions && !errorCode ? (
        <div className="text-ink-muted flex items-center gap-2 py-16 text-sm">
          <Spinner />
          {t('common.loading')}
        </div>
      ) : null}

      {pavilions?.map((pavilion) => (
        <PavilionRow
          key={pavilion.id}
          pavilion={pavilion}
          onSaved={(updated) =>
            setPavilions((current) =>
              (current ?? []).map((row) => (row.id === updated.id ? updated : row)),
            )
          }
        />
      ))}
    </div>
  );
}

function PavilionRow({
  pavilion,
  onSaved,
}: {
  pavilion: AdminPavilion;
  onSaved: (updated: AdminPavilion) => void;
}) {
  const { t } = useTranslation();
  const [slot, setSlot] = useState(String(pavilion.slot));
  const [title, setTitle] = useState(pavilion.title);
  const [theme, setTheme] = useState(pavilion.theme);
  const [status, setStatus] = useState(pavilion.status);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<{
    code: string;
    params?: Record<string, string | number>;
  } | null>(null);

  async function save(): Promise<void> {
    setBusy(true);
    setSaved(false);
    setError(null);

    try {
      const response = await adminApi.updatePavilion(pavilion.id, {
        slot: Number(slot),
        title: title.trim(),
        theme,
        status,
      });
      onSaved(response.pavilion);
      setSaved(true);
    } catch (cause) {
      if (cause instanceof ApiError) {
        setError({ code: cause.code, ...(cause.params ? { params: cause.params } : {}) });
      } else {
        setError({ code: 'ERR_INTERNAL' });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-medium">{pavilion.supplier.companyName}</h2>
        <Badge tone={pavilion.status === 'PUBLISHED' ? 'success' : 'neutral'}>
          {pavilion.status === 'PUBLISHED' ? t('admin.published') : t('admin.hidden')}
        </Badge>
        <span className="text-ink-faint text-xs">
          {t('admin.productCount', { count: pavilion.productCount })}
        </span>
      </div>

      {error ? (
        <Alert tone="danger">
          {error.code === 'ERR_CONFLICT' && error.params?.['slot'] !== undefined
            ? t('admin.slotTaken', error.params)
            : t(`errors.${error.code}`)}
        </Alert>
      ) : null}
      {saved ? <Alert tone="success">{t('admin.saved')}</Alert> : null}

      <div className="grid gap-3 sm:grid-cols-4">
        <Field
          label={t('admin.slot')}
          type="number"
          min={1}
          max={64}
          value={slot}
          onChange={(event) => setSlot(event.target.value)}
        />
        <div className="sm:col-span-2">
          <Field
            label={t('supplier.pavilion')}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <Select
          label={t('admin.theme')}
          value={theme}
          onChange={(event) => setTheme(event.target.value as AdminPavilion['theme'])}
        >
          {PAVILION_THEMES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Button loading={busy} onClick={() => void save()}>
          {t('admin.save')}
        </Button>
        <Button
          variant="ghost"
          onClick={() => setStatus(status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED')}
        >
          {status === 'PUBLISHED' ? t('admin.hidden') : t('admin.published')}
        </Button>
      </div>
    </Panel>
  );
}
