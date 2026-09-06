import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProductDetail } from '@3dsfera/shared';
import { ApiError } from '../../../api/client.js';
import { productsApi } from '../../../features/products/api.js';
import { LazyModelViewer, type ViewerBackground } from '../../../scene/LazyModelViewer.js';
import { Alert } from '../../../ui/Alert.js';
import { Button } from '../../../ui/Button.js';

const BACKGROUNDS: ViewerBackground[] = ['studio', 'dark', 'light'];

/**
 * Step 3. The supplier sees the model in the same viewer the buyer will use,
 * and grabs the catalogue thumbnail straight out of it — no separate render,
 * no mismatch between the preview and the thing itself.
 */
export function PreviewStep({ product, onSaved }: { product: ProductDetail; onSaved: () => void }) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [background, setBackground] = useState<ViewerBackground>('studio');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const model = product.assets.find(
    (asset) => asset.kind === 'GLB_OPTIMIZED' && asset.lodLevel === 0,
  );

  const handleCanvas = useCallback((canvas: HTMLCanvasElement) => {
    canvasRef.current = canvas;
  }, []);

  async function capture(): Promise<void> {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setSaving(true);
    setErrorCode(null);
    try {
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/png');
      });
      if (!blob) throw new Error('Canvas produced no image');

      await productsApi.uploadPreview(product.id, blob);
      setSaved(true);
      onSaved();
    } catch (error) {
      setErrorCode(error instanceof ApiError ? error.code : 'ERR_INTERNAL');
    } finally {
      setSaving(false);
    }
  }

  if (!model) return <Alert tone="info">{t('wizard.blockedProcessing')}</Alert>;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-ink-muted text-sm">{t('wizard.previewHint')}</p>

      <LazyModelViewer
        url={model.url}
        background={background}
        onCanvasReady={handleCanvas}
        className="h-[clamp(260px,45vh,520px)]"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-ink-faint text-xs">{t('wizard.background')}</span>
          {BACKGROUNDS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setBackground(option)}
              aria-current={option === background ? 'true' : undefined}
              className={`rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                option === background
                  ? 'bg-panel-raised text-ink'
                  : 'text-ink-faint hover:text-ink-muted'
              }`}
            >
              {t(`wizard.background_${option}`)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {saved ? <span className="text-success text-xs">{t('wizard.previewSaved')}</span> : null}
          <Button variant="ghost" loading={saving} onClick={() => void capture()}>
            {t('wizard.capturePreview')}
          </Button>
        </div>
      </div>

      {errorCode ? <Alert tone="danger">{t(`errors.${errorCode}`)}</Alert> : null}
    </div>
  );
}
