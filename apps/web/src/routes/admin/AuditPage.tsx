import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { AuditEntry } from '@3dsfera/shared';
import { adminApi } from '../../features/admin/api.js';
import { ApiError } from '../../api/client.js';
import { formatDateTime } from '../../lib/format.js';
import { Alert } from '../../ui/Alert.js';
import { Button, Spinner } from '../../ui/Button.js';
import { Panel } from '../../ui/Panel.js';

/**
 * The audit log.
 *
 * Append-only, newest first, paged by key rather than by offset — the log is
 * busy, and an offset page two is a different page every time somebody acts
 * while you are reading it.
 *
 * What it does not contain is as deliberate as what it does: amounts, counts
 * and status transitions, never a name, an email, an address, or the text of a
 * moderation reason. Those belong to the people they are about.
 */
export function AuditPage() {
  const { t, i18n } = useTranslation();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const load = useCallback(async (from?: string) => {
    setLoading(true);
    setErrorCode(null);

    try {
      const page = await adminApi.audit(from);
      setEntries((current) => (from ? [...current, ...page.entries] : page.entries));
      setCursor(page.nextCursor);
    } catch (cause) {
      setErrorCode(cause instanceof ApiError ? cause.code : 'ERR_INTERNAL');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t('admin.audit')}</h1>
          <p className="text-ink-muted mt-1 text-sm">{t('admin.auditHint')}</p>
        </div>
        <Link to="/admin" className="text-ink-faint hover:text-ink text-sm">
          {t('common.back')}
        </Link>
      </div>

      {errorCode ? <Alert tone="danger">{t(`errors.${errorCode}`)}</Alert> : null}

      {entries.length === 0 && !loading ? (
        <Panel className="text-ink-muted py-14 text-center text-sm">{t('admin.auditEmpty')}</Panel>
      ) : null}

      {entries.length > 0 ? (
        <Panel className="overflow-x-auto p-0">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="text-ink-faint border-edge border-b text-left text-xs">
              <tr>
                <th className="px-4 py-3 font-normal">{t('admin.when')}</th>
                <th className="px-4 py-3 font-normal">{t('admin.actor')}</th>
                <th className="px-4 py-3 font-normal">{t('admin.action')}</th>
                <th className="px-4 py-3 font-normal">{t('admin.entity')}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-edge/60 border-b last:border-0">
                  <td className="text-ink-muted px-4 py-2.5 whitespace-nowrap">
                    {formatDateTime(entry.createdAt, i18n.language)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-ink-muted">
                      {entry.actor?.email ?? t('admin.system')}
                    </span>
                    {entry.actor ? (
                      <span className="text-ink-faint ml-1.5 text-xs">
                        {t(`roles.${entry.actor.role}`)}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">{entry.action}</td>
                  <td className="text-ink-faint px-4 py-2.5 font-mono text-xs">
                    {entry.entityType}
                    {entry.entityId ? `:${entry.entityId.slice(-6)}` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      ) : null}

      {loading ? (
        <div className="text-ink-muted flex items-center gap-2 text-sm">
          <Spinner />
          {t('common.loading')}
        </div>
      ) : cursor ? (
        <Button variant="ghost" className="self-start" onClick={() => void load(cursor)}>
          {t('admin.more')}
        </Button>
      ) : null}
    </div>
  );
}
