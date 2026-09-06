import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { InteractionInput, ProductDetail } from '@3dsfera/shared';
import { ApiError } from '../../../api/client.js';
import { productsApi } from '../../../features/products/api.js';
import { presetInteractions, suggestInteractions } from '../../../features/products/wizard.js';
import { LazyModelViewer } from '../../../scene/LazyModelViewer.js';
import { Alert } from '../../../ui/Alert.js';
import { Button } from '../../../ui/Button.js';
import { Badge } from '../../../ui/Form.js';

/**
 * Step 4. The clip list comes from the uploaded GLB, so a supplier can only
 * wire up buttons that actually do something. Each row previews in place: the
 * caption is written next to the motion it describes.
 */
export function InteractionsStep({
  product,
  onSaved,
}: {
  product: ProductDetail;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<InteractionInput[]>([]);
  const [playing, setPlaying] = useState<{ clip: string; loop: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setRows(
      product.interactions.map((interaction) => ({
        type: interaction.type,
        ...(interaction.clipName ? { clipName: interaction.clipName } : {}),
        label: interaction.label,
        ...(interaction.labelEn ? { labelEn: interaction.labelEn } : {}),
        order: interaction.order,
        loop: interaction.loop,
        ...(interaction.config ? { config: interaction.config } : {}),
      })),
    );
  }, [product.interactions]);

  const model = product.assets.find(
    (asset) => asset.kind === 'GLB_OPTIMIZED' && asset.lodLevel === 0,
  );

  function update(index: number, patch: Partial<InteractionInput>): void {
    setSaved(false);
    setRows((previous) =>
      previous.map((row, position) => (position === index ? { ...row, ...patch } : row)),
    );
  }

  function move(index: number, direction: -1 | 1): void {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;

    setRows((previous) => {
      const next = [...previous];
      const moved = next[index];
      const replaced = next[target];
      if (!moved || !replaced) return previous;
      next[index] = replaced;
      next[target] = moved;
      return next.map((row, position) => ({ ...row, order: position }));
    });
  }

  async function save(): Promise<void> {
    setSaving(true);
    setErrorCode(null);
    try {
      await productsApi.setInteractions(product.id, {
        interactions: rows.map((row, index) => ({ ...row, order: index })),
      });
      setSaved(true);
      onSaved();
    } catch (error) {
      setErrorCode(error instanceof ApiError ? error.code : 'ERR_INTERNAL');
    } finally {
      setSaving(false);
    }
  }

  const hasClips = product.availableClips.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-ink-muted text-sm">{t('wizard.interactionsHint')}</p>

      {model ? (
        <LazyModelViewer
          url={model.url}
          activeClip={playing?.clip ?? null}
          loop={playing?.loop ?? false}
          className="h-[clamp(220px,35vh,400px)]"
        />
      ) : null}

      {!hasClips ? (
        <div className="panel flex flex-col gap-3 p-5">
          <h3 className="text-sm font-medium">{t('wizard.noClipsTitle')}</h3>
          <p className="text-ink-muted text-sm">{t('wizard.noClipsHint')}</p>
          <div>
            <Button variant="ghost" onClick={() => setRows(presetInteractions())}>
              {t('wizard.usePresets')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            onClick={() => setRows(suggestInteractions(product.availableClips))}
          >
            {t('wizard.useSuggested')}
          </Button>
          <span className="text-ink-faint text-xs">
            {product.availableClips.map((clip) => clip.name).join(' · ')}
          </span>
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {rows.map((row, index) => (
          <li
            key={`${row.type}-${row.clipName ?? index}`}
            className="panel flex flex-col gap-3 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge tone={row.type === 'GLTF_ANIMATION' ? 'accent' : 'neutral'}>
                  {row.clipName ?? row.type}
                </Badge>
                {row.clipName ? (
                  <span className="text-ink-faint text-xs">
                    {product.availableClips.find((clip) => clip.name === row.clipName)?.duration ??
                      '—'}
                    s
                  </span>
                ) : null}
              </div>

              <div className="flex items-center gap-1.5">
                {row.clipName && model ? (
                  <button
                    type="button"
                    onClick={() =>
                      setPlaying((current) =>
                        current?.clip === row.clipName
                          ? null
                          : { clip: row.clipName as string, loop: row.loop },
                      )
                    }
                    className="text-accent hover:underline text-xs"
                  >
                    {playing?.clip === row.clipName ? t('wizard.stop') : t('wizard.play')}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  className="text-ink-faint hover:text-ink text-xs"
                >
                  {t('wizard.moveUp')}
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  className="text-ink-faint hover:text-ink text-xs"
                >
                  {t('wizard.moveDown')}
                </button>
                <button
                  type="button"
                  onClick={() => setRows((previous) => previous.filter((_, i) => i !== index))}
                  className="text-danger hover:underline text-xs"
                >
                  {t('wizard.remove')}
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-ink-muted text-xs">{t('wizard.labelRu')}</span>
                <input
                  value={row.label}
                  onChange={(event) => update(index, { label: event.target.value })}
                  className="bg-panel-raised border-edge focus:border-accent/60 rounded-lg border px-3 py-2 text-sm outline-none"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-ink-muted text-xs">{t('wizard.labelEn')}</span>
                <input
                  value={row.labelEn ?? ''}
                  onChange={(event) => update(index, { labelEn: event.target.value })}
                  className="bg-panel-raised border-edge focus:border-accent/60 rounded-lg border px-3 py-2 text-sm outline-none"
                />
              </label>
            </div>

            <label className="text-ink-muted flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={row.loop}
                onChange={(event) => update(index, { loop: event.target.checked })}
                className="accent-accent"
              />
              {t('wizard.loop')}
            </label>
          </li>
        ))}
      </ul>

      {errorCode ? <Alert tone="danger">{t(`errors.${errorCode}`)}</Alert> : null}

      <div className="flex items-center gap-3">
        <Button loading={saving} onClick={() => void save()}>
          {t('common.save')}
        </Button>
        {saved ? <span className="text-success text-xs">{t('wizard.saved')}</span> : null}
      </div>
    </div>
  );
}
