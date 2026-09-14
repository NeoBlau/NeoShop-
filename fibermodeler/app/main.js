/**
 * Bootstrap: wires the text measurer, builds the application and reports any
 * unexpected error in a way a human can act on.
 */
import { App } from './ui/app.js';
import { setTextMeasurer } from './notations/shared.js';
import { localizeDom, t } from './i18n/index.js';
import { BRAND_MARK, icon } from './ui/icons.js';
import { toastError } from './ui/toast.js';

function installTextMeasurer() {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return;
  const cache = new Map();
  setTextMeasurer((text, fontSize, bold) => {
    const key = `${bold ? 'b' : 'n'}${fontSize}|${text}`;
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    context.font = `${bold ? '600 ' : ''}${fontSize}px -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif`;
    const width = context.measureText(text).width;
    if (cache.size > 6000) cache.clear();
    cache.set(key, width);
    return width;
  });
}

function decorateStaticIcons(root) {
  const map = {
    'btn-add-diagram': 'plus',
    'btn-lang': 'language',
    'btn-help': 'help',
    'btn-zoom-in': 'zoomIn',
    'btn-zoom-out': 'zoomOut',
    'btn-zoom-fit': 'fit',
    'btn-close-bottom': 'close',
  };
  for (const [id, name] of Object.entries(map)) {
    const element = root.querySelector(`#${id}`);
    if (element) element.innerHTML = icon(name, 15);
  }
  const brand = root.querySelector('#brand-mark');
  if (brand) brand.innerHTML = BRAND_MARK;
}

function start() {
  const root = document.getElementById('app');
  installTextMeasurer();
  decorateStaticIcons(root);
  let app;
  try {
    app = new App(root);
  } catch (error) {
    console.error('[FiberModeler] failed to start', error);
    root.innerHTML = `<div style="padding:60px;font-family:system-ui;max-width:640px;margin:0 auto">
      <h2>FiberModeler</h2>
      <p>Не удалось запустить приложение. Обновите страницу; если ошибка повторяется — откройте консоль браузера.</p>
      <pre style="white-space:pre-wrap;color:#b00">${String(error?.stack || error)}</pre></div>`;
    return;
  }
  window.fiberModeler = app;
  localizeDom(root);
  app.refreshToolbar();
  app.boot();

  window.addEventListener('error', (event) => {
    console.error('[FiberModeler]', event.error || event.message);
    toastError(t('toast.error', { error: String(event.message || event.error).slice(0, 160) }));
  });
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[FiberModeler]', event.reason);
    toastError(t('toast.error', { error: String(event.reason?.message || event.reason).slice(0, 160) }));
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
