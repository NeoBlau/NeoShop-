/** Modal dialog helper with focus handling and Escape/Enter behaviour. */
import { t } from '../i18n/index.js';
import { icon } from './icons.js';

export function openDialog({ title, subtitle, body, footer, width = '', onMount, onClose, dismissible = true }) {
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  const dialog = document.createElement('div');
  dialog.className = `dialog ${width}`.trim();
  dialog.innerHTML = `
    <div class="dialog-head">
      <div>
        <h2></h2>
        ${subtitle ? '<div class="sub"></div>' : ''}
      </div>
      <div style="flex:1"></div>
      <button class="icon-btn close-btn" type="button" aria-label="${t('dialog.close')}">${icon('close', 15)}</button>
    </div>
    <div class="dialog-body"></div>
    <div class="dialog-foot"></div>
  `;
  dialog.querySelector('h2').textContent = title || '';
  if (subtitle) dialog.querySelector('.sub').textContent = subtitle;
  const bodyEl = dialog.querySelector('.dialog-body');
  if (typeof body === 'string') bodyEl.innerHTML = body;
  else if (body) bodyEl.appendChild(body);
  const footEl = dialog.querySelector('.dialog-foot');
  if (typeof footer === 'string') footEl.innerHTML = footer;
  else if (footer) footEl.appendChild(footer);

  scrim.appendChild(dialog);
  document.body.appendChild(scrim);

  const api = {
    element: dialog,
    body: bodyEl,
    footer: footEl,
    close(result) {
      scrim.remove();
      document.removeEventListener('keydown', onKey, true);
      onClose?.(result);
    },
  };

  const onKey = (event) => {
    if (event.key === 'Escape' && dismissible) {
      event.stopPropagation();
      api.close(null);
    }
  };
  document.addEventListener('keydown', onKey, true);
  dialog.querySelector('.close-btn').addEventListener('click', () => api.close(null));
  scrim.addEventListener('pointerdown', (event) => {
    if (event.target === scrim && dismissible) api.close(null);
  });
  onMount?.(api);
  setTimeout(() => {
    const focusable = dialog.querySelector('input, textarea, select, button.primary');
    focusable?.focus();
  }, 30);
  return api;
}

export function buttonRow(buttons) {
  const wrapper = document.createElement('div');
  wrapper.style.display = 'contents';
  for (const spec of buttons) {
    if (spec === 'spacer') {
      const spacer = document.createElement('div');
      spacer.className = 'spacer';
      wrapper.appendChild(spacer);
      continue;
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `btn ${spec.variant || ''}`.trim();
    button.textContent = spec.label;
    if (spec.disabled) button.disabled = true;
    button.addEventListener('click', spec.action);
    wrapper.appendChild(button);
  }
  return wrapper;
}

export function confirmDialog({ title, message, confirmLabel, danger }) {
  return new Promise((resolve) => {
    const dialog = openDialog({
      title,
      width: 'narrow',
      body: `<p style="margin:6px 0 2px;line-height:1.5">${escapeHtml(message)}</p>`,
      onClose: (result) => resolve(!!result),
    });
    dialog.footer.appendChild(
      buttonRow([
        'spacer',
        { label: t('dialog.cancel'), action: () => dialog.close(false) },
        { label: confirmLabel || t('dialog.ok'), variant: danger ? 'primary danger' : 'primary', action: () => dialog.close(true) },
      ])
    );
  });
}

export function promptDialog({ title, label, value = '', placeholder = '' }) {
  return new Promise((resolve) => {
    const field = document.createElement('div');
    field.className = 'field';
    field.innerHTML = `<label>${escapeHtml(label || '')}</label><input class="input" type="text">`;
    const input = field.querySelector('input');
    input.value = value;
    input.placeholder = placeholder;
    const dialog = openDialog({
      title,
      width: 'narrow',
      body: field,
      onClose: (result) => resolve(result),
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') dialog.close(input.value.trim());
    });
    dialog.footer.appendChild(
      buttonRow([
        'spacer',
        { label: t('dialog.cancel'), action: () => dialog.close(null) },
        { label: t('dialog.ok'), variant: 'primary', action: () => dialog.close(input.value.trim()) },
      ])
    );
  });
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}
