import { Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import type { ModelViewerProps } from './ModelViewer.js';

/**
 * three.js, R3F and drei together weigh more than the rest of the application.
 * Nobody should download them to read a catalogue page or to check out — the
 * flat fallback for weak devices least of all. The viewer is therefore split
 * into its own chunk and fetched only when a 3D view is actually opened.
 */
const ModelViewer = lazy(async () => {
  const module = await import('./ModelViewer.js');
  return { default: module.ModelViewer };
});

export function LazyModelViewer(props: ModelViewerProps) {
  const { t } = useTranslation();

  return (
    <Suspense
      fallback={
        <div
          className={`panel text-ink-muted flex items-center justify-center text-sm ${props.className ?? ''}`}
        >
          {t('common.loadingScene')}
        </div>
      }
    >
      <ModelViewer {...props} />
    </Suspense>
  );
}

export type { ModelViewerProps, ViewerBackground } from './ModelViewer.js';
