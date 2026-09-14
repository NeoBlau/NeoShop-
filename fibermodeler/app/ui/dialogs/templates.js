/** Template gallery for both notations. */
import { i18n, t } from '../../i18n/index.js';
import { buttonRow, openDialog } from '../dialog.js';
import { BPMN_TEMPLATES } from '../../notations/bpmn/templates.js';
import { IDEF0_TEMPLATES } from '../../notations/idef0/templates.js';
import { localName } from '../../notations/index.js';

export function openTemplates(app, notation = 'bpmn') {
  let current = notation;
  let selected = null;

  const body = document.createElement('div');
  body.innerHTML = `
    <div class="segmented" data-role="tabs" style="margin-bottom:14px"></div>
    <div class="card-grid" data-role="grid"></div>
    <div class="note" style="margin-top:14px">${t('templates.hint')}</div>`;
  const grid = body.querySelector('[data-role="grid"]');
  const tabs = body.querySelector('[data-role="tabs"]');

  const renderTabs = () => {
    tabs.innerHTML = '';
    for (const option of [
      { value: 'bpmn', label: t('templates.bpmn') },
      { value: 'idef0', label: t('templates.idef0') },
    ]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = option.label;
      button.className = current === option.value ? 'is-active' : '';
      button.addEventListener('click', () => {
        current = option.value;
        selected = null;
        renderTabs();
        renderGrid();
      });
      tabs.appendChild(button);
    }
  };

  const renderGrid = () => {
    const list = current === 'bpmn' ? BPMN_TEMPLATES : IDEF0_TEMPLATES;
    grid.innerHTML = '';
    for (const template of list) {
      const card = document.createElement('div');
      card.className = `card${selected === template ? ' is-selected' : ''}`;
      card.innerHTML = `<h5>${escapeHtml(localName(template.name, i18n.locale))}</h5><p>${escapeHtml(
        localName(template.description, i18n.locale)
      )}</p>`;
      card.addEventListener('click', () => {
        selected = template;
        renderGrid();
      });
      card.addEventListener('dblclick', () => {
        insert(template);
      });
      grid.appendChild(card);
    }
  };

  const insert = (template) => {
    if (!template) return;
    app.insertSpec(template.spec, { name: localName(template.name, i18n.locale) });
    dialog.close();
  };

  const dialog = openDialog({ title: t('templates.title'), body, width: 'wide' });
  dialog.footer.appendChild(
    buttonRow([
      'spacer',
      { label: t('dialog.cancel'), action: () => dialog.close() },
      { label: t('templates.insert'), variant: 'primary', action: () => insert(selected || (current === 'bpmn' ? BPMN_TEMPLATES : IDEF0_TEMPLATES)[0]) },
    ])
  );
  renderTabs();
  renderGrid();
  return dialog;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}
