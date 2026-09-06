import { useTranslation } from 'react-i18next';
import type { ProductDetail } from '@3dsfera/shared';
import { formatBytes } from '../../../features/products/wizard.js';
import { Alert } from '../../../ui/Alert.js';
import { Spinner } from '../../../ui/Button.js';
import { Badge } from '../../../ui/Form.js';

/**
 * Step 2. The pipeline runs on the server; this polls and reports what it did,
 * including what it could not do. A silent "optimized!" that changed nothing
 * would teach the supplier to distrust the number.
 */
export function ProcessingStep({ product }: { product: ProductDetail }) {
  const { t, i18n } = useTranslation();
  const job = product.job;

  if (!job) {
    return <Alert tone="info">{t('wizard.blockedNoModel')}</Alert>;
  }

  if (job.status === 'FAILED') {
    return <Alert tone="danger">{t('wizard.processingFailed')}</Alert>;
  }

  if (job.status !== 'READY' || !job.stats) {
    return (
      <div className="flex flex-col gap-3">
        <div className="text-ink-muted flex items-center gap-2 text-sm">
          <Spinner />
          {t('wizard.processingTitle')}
        </div>
        <p className="text-ink-faint text-sm">{t('wizard.processingHint')}</p>
      </div>
    );
  }

  const stats = job.stats;

  return (
    <div className="flex flex-col gap-5">
      <div className="panel p-5">
        <p className="text-lg font-medium">
          {t('wizard.reduction', { percent: stats.reductionPercent })}
        </p>
        <p className="text-ink-muted mt-1 text-sm">
          {t('wizard.reductionDetail', {
            before: formatBytes(stats.originalBytes, i18n.language),
            after: formatBytes(stats.optimizedBytes, i18n.language),
          })}
        </p>
        <p className="text-ink-faint mt-3 text-xs">
          {stats.durationMs < 1000
            ? t('wizard.processingDoneMs', { ms: stats.durationMs })
            : t('wizard.processingDone', { seconds: (stats.durationMs / 1000).toFixed(1) })}
          {stats.dracoApplied ? ' · Draco' : ''}
          {stats.ktx2Applied ? ' · KTX2' : ''}
        </p>
      </div>

      <div className="panel p-5">
        <h3 className="text-sm font-medium">{t('wizard.lodTitle')}</h3>
        <table className="mt-3 w-full text-sm">
          <tbody>
            {stats.lods.map((lod) => (
              <tr key={lod.level} className="border-edge border-t first:border-t-0">
                <td className="py-2">
                  {lod.level === 0
                    ? t('wizard.lodBase')
                    : t('wizard.lodLevel', { level: lod.level })}
                </td>
                <td className="text-ink-muted py-2 text-right tabular-nums">
                  {lod.triangles.toLocaleString(i18n.language)} {t('wizard.triangles')}
                </td>
                <td className="text-ink-faint py-2 text-right tabular-nums">
                  {formatBytes(lod.byteSize, i18n.language)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {stats.skipped.length > 0 ? (
        <div className="panel p-5">
          <h3 className="text-sm font-medium">{t('wizard.skippedTitle')}</h3>
          <ul className="mt-2 flex flex-col gap-1.5">
            {stats.skipped.map((entry) => (
              <li key={entry} className="text-ink-muted flex items-center gap-2 text-sm">
                <Badge>{entry}</Badge>
                {/* LOD keys carry a level suffix; collapse them onto one message. */}
                {t(`wizard.skipped_${entry.startsWith('lod_') ? 'lod' : entry}`, {
                  defaultValue: entry,
                })}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
