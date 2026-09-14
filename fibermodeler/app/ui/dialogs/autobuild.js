/** Auto Build: description -> model. */
import { i18n, t } from '../../i18n/index.js';
import { buttonRow, openDialog } from '../dialog.js';
import { PROVIDERS } from '../../ai/providers.js';
import { localName } from '../../notations/index.js';
import { icon } from '../icons.js';

export function openAutoBuild(app) {
  const settings = app.settings;
  const state = {
    notation: 'auto',
    complexity: 'medium',
    provider: settings.get('ai.provider', 'local'),
    target: 'new',
  };

  const body = document.createElement('div');
  body.innerHTML = `
    <div class="field">
      <label>${t('autoBuild.prompt')}</label>
      <textarea class="textarea" rows="5" placeholder="${escapeAttr(t('autoBuild.placeholder'))}"></textarea>
    </div>
    <div class="field-row">
      <div class="field"><label>${t('autoBuild.notation')}</label><div class="segmented" data-group="notation"></div></div>
      <div class="field"><label>${t('autoBuild.complexity')}</label><div class="segmented" data-group="complexity"></div></div>
    </div>
    <div class="field-row">
      <div class="field"><label>${t('autoBuild.provider')}</label><select class="select" data-role="provider"></select></div>
      <div class="field"><label>${t('autoBuild.target')}</label><select class="select" data-role="target">
        <option value="new">${t('autoBuild.targetNew')}</option>
        <option value="replace">${t('autoBuild.targetReplace')}</option>
      </select></div>
    </div>
    <div class="note" data-role="hint"></div>
  `;
  const textarea = body.querySelector('textarea');
  const hint = body.querySelector('[data-role="hint"]');

  const segmented = (group, options) => {
    const host = body.querySelector(`[data-group="${group}"]`);
    host.innerHTML = '';
    for (const option of options) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = option.label;
      button.className = state[group] === option.value ? 'is-active' : '';
      button.addEventListener('click', () => {
        state[group] = option.value;
        segmented(group, options);
      });
      host.appendChild(button);
    }
  };
  segmented('notation', [
    { value: 'auto', label: t('autoBuild.auto') },
    { value: 'bpmn', label: 'BPMN' },
    { value: 'idef0', label: 'IDEF0' },
  ]);
  segmented('complexity', [
    { value: 'simple', label: t('autoBuild.simple') },
    { value: 'medium', label: t('autoBuild.medium') },
    { value: 'detailed', label: t('autoBuild.detailed') },
  ]);

  const providerSelect = body.querySelector('[data-role="provider"]');
  for (const provider of Object.values(PROVIDERS)) {
    const option = document.createElement('option');
    option.value = provider.id;
    option.textContent = localName(provider.label, i18n.locale);
    option.selected = provider.id === state.provider;
    providerSelect.appendChild(option);
  }
  const updateHint = () => {
    hint.textContent = PROVIDERS[state.provider]?.offline ? t('autoBuild.localHint') : t('autoBuild.aiHint');
  };
  providerSelect.addEventListener('change', () => {
    state.provider = providerSelect.value;
    updateHint();
  });
  body.querySelector('[data-role="target"]').addEventListener('change', (event) => {
    state.target = event.target.value;
  });
  updateHint();

  const dialog = openDialog({ title: t('autoBuild.title'), subtitle: t('autoBuild.subtitle'), body, width: '' });
  const generateButton = document.createElement('button');
  generateButton.className = 'btn primary';
  generateButton.innerHTML = `${icon('sparkles', 15)}<span>${t('autoBuild.generate')}</span>`;
  generateButton.addEventListener('click', async () => {
    const prompt = textarea.value.trim();
    if (!prompt) {
      textarea.focus();
      return;
    }
    generateButton.disabled = true;
    generateButton.querySelector('span').textContent = t('autoBuild.generating');
    try {
      await app.runAutoBuild({ prompt, ...state });
      dialog.close();
    } finally {
      generateButton.disabled = false;
      generateButton.querySelector('span').textContent = t('autoBuild.generate');
    }
  });
  dialog.footer.appendChild(buttonRow([{ label: t('dialog.cancel'), action: () => dialog.close() }, 'spacer']));
  dialog.footer.appendChild(generateButton);
  setTimeout(() => textarea.focus(), 40);
  return dialog;
}

function escapeAttr(value) {
  return String(value ?? '').replace(/"/g, '&quot;');
}
