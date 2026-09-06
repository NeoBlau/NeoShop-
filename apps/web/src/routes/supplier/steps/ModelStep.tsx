import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UPLOAD_LIMITS, type ProductDetail } from '@3dsfera/shared';
import { ApiError } from '../../../api/client.js';
import { productsApi } from '../../../features/products/api.js';
import { checkModelFile, formatBytes, type FileCheck } from '../../../features/products/wizard.js';
import { Alert } from '../../../ui/Alert.js';
import { Spinner } from '../../../ui/Button.js';
import { FileDrop } from '../../../ui/FileDrop.js';
import { Badge } from '../../../ui/Form.js';

/**
 * Step 1. The file is read and judged in the browser first: a supplier with a
 * 900k-triangle export learns about it in a second, not after a 40 MB upload.
 */
export function ModelStep({
  product,
  onUploaded,
}: {
  product: ProductDetail;
  onUploaded: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [check, setCheck] = useState<FileCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const hasModel = product.assets.some((asset) => asset.kind === 'GLB_ORIGINAL');

  async function handleFile(file: File): Promise<void> {
    setErrorCode(null);
    setCheck(null);
    setChecking(true);

    try {
      const result = await checkModelFile(file);
      setCheck(result);
      if (!result.ok) return;

      setProgress(0);
      await productsApi.uploadModel(product.id, file, setProgress);
      onUploaded();
    } catch (error) {
      setErrorCode(error instanceof ApiError ? error.code : 'ERR_INTERNAL');
    } finally {
      setChecking(false);
      setProgress(null);
    }
  }

  const busy = checking || progress !== null;

  return (
    <div className="flex flex-col gap-4">
      <FileDrop
        accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
        buttonLabel={hasModel ? t('wizard.replaceModel') : t('wizard.chooseFile')}
        disabled={busy}
        onFile={(file) => void handleFile(file)}
      >
        <p className="text-ink text-sm">{t('wizard.dropModel')}</p>
        <p className="text-ink-faint mx-auto mt-1.5 max-w-sm text-xs">
          {t('wizard.dropHint', { max: Math.round(UPLOAD_LIMITS.modelMaxBytes / 1024 / 1024) })}
        </p>
      </FileDrop>

      {checking ? (
        <div className="text-ink-muted flex items-center gap-2 text-sm">
          <Spinner />
          {t('wizard.checking')}
        </div>
      ) : null}

      {progress !== null ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-ink-muted text-sm">
            {t('wizard.uploading', { percent: progress })}
          </span>
          <div className="bg-panel-raised h-1.5 overflow-hidden rounded-full">
            <div
              className="bg-accent h-full transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : null}

      {errorCode ? <Alert tone="danger">{t(`errors.${errorCode}`)}</Alert> : null}

      {check && !check.ok && check.errorCode ? (
        <Alert tone="danger">
          {t(`modelIssues.${check.errorCode}`, {
            ...(check.verdict?.errors[0]?.params ?? {}),
            defaultValue: t('errors.ERR_UNSUPPORTED_FILE'),
          })}
        </Alert>
      ) : null}

      {check?.inspection ? (
        <div className="panel flex flex-col gap-3 p-4">
          <div className="flex items-center gap-2">
            <Badge tone={check.ok ? 'success' : 'danger'}>{t('wizard.fileAccepted')}</Badge>
            <span className="text-ink-faint text-xs">
              {formatBytes(check.inspection.byteSize, i18n.language)}
            </span>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-ink-faint text-xs">{t('wizard.triangles')}</dt>
              <dd className="tabular-nums">
                {check.inspection.triangles.toLocaleString(i18n.language)}
              </dd>
            </div>
            <div>
              <dt className="text-ink-faint text-xs">{t('wizard.materials')}</dt>
              <dd className="tabular-nums">{check.inspection.materials}</dd>
            </div>
            <div>
              <dt className="text-ink-faint text-xs">{t('wizard.textures')}</dt>
              <dd className="tabular-nums">{check.inspection.textures}</dd>
            </div>
            <div>
              <dt className="text-ink-faint text-xs">{t('wizard.clips')}</dt>
              <dd className="tabular-nums">{check.inspection.animations.length}</dd>
            </div>
          </dl>

          {check.verdict?.warnings.map((warning) => (
            <p key={warning.code} className="text-warning text-xs">
              {t(`modelIssues.${warning.code}`, warning.params)}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
