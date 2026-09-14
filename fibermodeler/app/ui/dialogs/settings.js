/** Settings dialog: general, appearance, canvas, autosave, AI, export, shortcuts. */
import { i18n, t, LOCALE_NAMES } from '../../i18n/index.js';
import { buttonRow, openDialog } from '../dialog.js';
import { commandList, prettyShortcut } from '../commands.js';
import { PROVIDERS } from '../../ai/providers.js';
import { localName } from '../../notations/index.js';

const SECTIONS = [
  { id: 'general', titleKey: 'settings.general' },
  { id: 'appearance', titleKey: 'settings.appearance' },
  { id: 'canvas', titleKey: 'settings.canvas' },
  { id: 'autosave', titleKey: 'settings.autosave' },
  { id: 'ai', titleKey: 'settings.ai' },
  { id: 'export', titleKey: 'settings.export' },
  { id: 'shortcuts', titleKey: 'settings.shortcuts' },
];

export function openSettings(app, initialSection = 'general') {
  const settings = app.settings;
  const layout = document.createElement('div');
  layout.className = 'settings-layout';
  layout.innerHTML = '<div class="settings-nav"></div><div class="settings-pane"></div>';
  const nav = layout.querySelector('.settings-nav');
  const pane = layout.querySelector('.settings-pane');
  let current = initialSection;

  const renderNav = () => {
    nav.innerHTML = '';
    for (const section of SECTIONS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = section.id === current ? 'is-active' : '';
      button.textContent = t(section.titleKey);
      button.addEventListener('click', () => {
        current = section.id;
        renderNav();
        renderPane();
      });
      nav.appendChild(button);
    }
  };

  const field = (label, control, hint) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'field';
    wrapper.innerHTML = label ? `<label>${escapeHtml(label)}</label>` : '';
    wrapper.appendChild(control);
    if (hint) {
      const note = document.createElement('div');
      note.style.cssText = 'font-size:var(--fs-xs);color:var(--text-tertiary);margin-top:4px';
      note.textContent = hint;
      wrapper.appendChild(note);
    }
    return wrapper;
  };

  const select = (options, value, onChange) => {
    const element = document.createElement('select');
    element.className = 'select';
    for (const option of options) {
      const item = document.createElement('option');
      item.value = option.value;
      item.textContent = option.label;
      item.selected = String(option.value) === String(value);
      element.appendChild(item);
    }
    element.addEventListener('change', () => onChange(element.value));
    return element;
  };

  const toggle = (label, path) => {
    const row = document.createElement('label');
    row.className = 'checkbox';
    row.style.cssText = 'justify-content:space-between;padding:7px 0';
    const span = document.createElement('span');
    span.textContent = label;
    const box = document.createElement('span');
    box.className = 'switch';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = !!settings.get(path);
    input.addEventListener('change', () => {
      settings.set(path, input.checked);
      app.applySettings();
    });
    box.appendChild(input);
    row.append(span, box);
    return row;
  };

  const number = (value, onChange, min = 1, max = 999) => {
    const input = document.createElement('input');
    input.className = 'input';
    input.type = 'number';
    input.min = min;
    input.max = max;
    input.value = value;
    input.addEventListener('change', () => onChange(Number(input.value)));
    return input;
  };

  const text = (value, onChange, options = {}) => {
    const input = document.createElement('input');
    input.className = 'input';
    input.type = options.password ? 'password' : 'text';
    input.value = value || '';
    if (options.placeholder) input.placeholder = options.placeholder;
    input.addEventListener('change', () => onChange(input.value));
    return input;
  };

  const renderPane = () => {
    pane.innerHTML = '';
    const add = (element) => pane.appendChild(element);
    switch (current) {
      case 'general':
        add(
          field(
            t('settings.language'),
            select(
              Object.entries(LOCALE_NAMES).map(([value, label]) => ({ value, label })),
              settings.get('language'),
              (value) => app.setLanguage(value)
            )
          )
        );
        add(toggle(t('settings.snap'), 'canvas.snap'));
        add(toggle(t('settings.quickHandles'), 'canvas.quickHandles'));
        break;
      case 'appearance':
        add(
          field(
            t('settings.theme'),
            select(
              [
                { value: 'auto', label: t('view.themeAuto') },
                { value: 'light', label: t('view.themeLight') },
                { value: 'dark', label: t('view.themeDark') },
              ],
              settings.get('theme'),
              (value) => app.setTheme(value)
            )
          )
        );
        add(toggle(t('settings.showGrid'), 'canvas.grid'));
        add(toggle(t('settings.rulers'), 'canvas.rulers'));
        add(toggle(t('settings.minimap'), 'canvas.minimap'));
        break;
      case 'canvas':
        add(field(t('settings.gridSize'), number(settings.get('canvas.gridSize'), (value) => {
          settings.set('canvas.gridSize', Math.max(2, Math.min(100, value)));
          app.applySettings();
        }, 2, 100)));
        add(toggle(t('settings.guides'), 'canvas.guides'));
        add(
          field(
            t('settings.connectionStyle'),
            select(
              [
                { value: 'orthogonal', label: t('settings.orthogonal') },
                { value: 'straight', label: t('settings.straight') },
              ],
              settings.get('canvas.connectionStyle'),
              (value) => {
                settings.set('canvas.connectionStyle', value);
                app.refreshCanvas(true);
              }
            )
          )
        );
        add(toggle(t('settings.smoothEdges'), 'canvas.smoothEdges'));
        break;
      case 'autosave':
        add(toggle(t('settings.autosaveOn'), 'autosave.enabled'));
        add(field(t('settings.interval'), number(settings.get('autosave.intervalSec'), (value) => settings.set('autosave.intervalSec', Math.max(10, value)), 10, 3600)));
        break;
      case 'ai': {
        const note = document.createElement('div');
        note.className = 'note';
        note.textContent = t('settings.aiNote');
        add(note);
        const provider = settings.get('ai.provider');
        add(
          field(
            t('settings.provider'),
            select(
              Object.values(PROVIDERS).map((item) => ({ value: item.id, label: localName(item.label, i18n.locale) })),
              provider,
              (value) => {
                settings.set('ai.provider', value);
                renderPane();
              }
            )
          )
        );
        const spec = PROVIDERS[provider];
        if (spec && !spec.offline) {
          add(field(t('settings.model'), text(settings.get('ai.model'), (value) => settings.set('ai.model', value), { placeholder: spec.defaultModel || '' })));
          add(field(t('settings.endpoint'), text(settings.get('ai.endpoint'), (value) => settings.set('ai.endpoint', value), { placeholder: spec.defaultEndpoint || '' })));
          if (spec.needsKey) {
            add(field(t('settings.apiKey'), text(settings.get('ai.apiKey'), (value) => settings.set('ai.apiKey', value), { password: true, placeholder: '••••••••' })));
          }
        }
        break;
      }
      case 'export':
        add(field(t('settings.exportScale'), number(settings.get('export.scale'), (value) => settings.set('export.scale', Math.max(1, Math.min(6, value))), 1, 6)));
        add(
          field(
            t('settings.exportBg'),
            select(
              [
                { value: 'white', label: t('settings.bgWhite') },
                { value: 'transparent', label: t('settings.bgTransparent') },
              ],
              settings.get('export.background'),
              (value) => settings.set('export.background', value)
            )
          )
        );
        add(field(t('settings.margin'), number(settings.get('export.margin'), (value) => settings.set('export.margin', Math.max(0, value)), 0, 200)));
        break;
      case 'shortcuts': {
        const table = document.createElement('table');
        table.className = 'grid';
        table.innerHTML = '<tbody></tbody>';
        const body = table.querySelector('tbody');
        for (const command of commandList(app).filter((c) => c.shortcut)) {
          const row = document.createElement('tr');
          row.innerHTML = `<td style="padding:6px 8px">${escapeHtml(command.label)}</td><td style="text-align:right;padding:6px 8px"><kbd>${escapeHtml(
            prettyShortcut(command.shortcut)
          )}</kbd></td>`;
          body.appendChild(row);
        }
        add(table);
        break;
      }
      default:
        break;
    }
  };

  const dialog = openDialog({ title: t('settings.title'), body: layout, width: 'wide' });
  dialog.footer.appendChild(
    buttonRow([
      {
        label: t('settings.reset'),
        action: () => {
          settings.reset();
          app.applySettings();
          renderPane();
        },
      },
      'spacer',
      { label: t('dialog.close'), variant: 'primary', action: () => dialog.close() },
    ])
  );
  renderNav();
  renderPane();
  return dialog;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}
