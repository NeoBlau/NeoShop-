import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CSV_COLUMNS, type CsvImportResult } from '@3dsfera/shared';
import { ApiError } from '../../api/client.js';
import { productsApi } from '../../features/products/api.js';
import { Alert } from '../../ui/Alert.js';
import { Spinner } from '../../ui/Button.js';
import { FileDrop } from '../../ui/FileDrop.js';
import { Badge } from '../../ui/Form.js';
import { Panel } from '../../ui/Panel.js';

export function ImportPage() {
  const { t } = useTranslation();
  const [result, setResult] = useState<CsvImportResult | null>(null);
  const [pending, setPending] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  async function handleFile(file: File): Promise<void> {
    setPending(true);
    setErrorCode(null);
    setResult(null);

    try {
      setResult(await productsApi.importCsv(file));
    } catch (error) {
      setErrorCode(error instanceof ApiError ? error.code : 'ERR_INTERNAL');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold">{t('csv.title')}</h1>
        <p className="text-ink-muted mt-1 text-sm">{t('csv.hint')}</p>
      </div>

      <FileDrop
        accept=".csv,text/csv"
        buttonLabel={t('csv.chooseFile')}
        disabled={pending}
        onFile={(file) => void handleFile(file)}
      >
        <p className="text-ink-faint mx-auto max-w-lg text-xs">
          {t('csv.columns', { columns: CSV_COLUMNS.join(', ') })}
        </p>
        <a
          href={productsApi.templateUrl}
          className="text-accent mt-3 inline-block text-sm hover:underline"
        >
          {t('csv.template')}
        </a>
      </FileDrop>

      {pending ? (
        <div className="text-ink-muted flex items-center gap-2 text-sm">
          <Spinner />
          {t('csv.importing')}
        </div>
      ) : null}

      {errorCode ? <Alert tone="danger">{t(`errors.${errorCode}`)}</Alert> : null}

      {result ? (
        <Panel className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-sm font-medium">{t('csv.resultTitle')}</h2>
            <Badge tone="success">{t('csv.created', { count: result.created })}</Badge>
            {result.skipped > 0 ? (
              <Badge tone="warning">{t('csv.skipped', { count: result.skipped })}</Badge>
            ) : null}
          </div>

          <ul className="flex flex-col gap-1.5 text-sm">
            {result.rows.map((row) => (
              <li key={row.line} className="flex flex-wrap items-center gap-2">
                <span className="text-ink-faint text-xs tabular-nums">
                  {t('csv.line', { line: row.line })}
                </span>
                <span className={row.status === 'created' ? 'text-ink' : 'text-ink-muted'}>
                  {row.title || '—'}
                </span>
                {row.status === 'skipped' ? (
                  <span className="text-warning text-xs">
                    {t(`csv.issue_${row.issue ?? 'invalid_row'}`, {
                      defaultValue: row.issue ?? '',
                    })}
                    {row.field ? ` (${row.field})` : ''}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>

          <Link to="/supplier/products" className="text-accent text-sm hover:underline">
            {t('wizard.backToList')}
          </Link>
        </Panel>
      ) : null}
    </div>
  );
}
