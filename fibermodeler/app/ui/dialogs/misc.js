/** Smaller dialogs: new project, documentation, search, about, shortcuts, guide. */
import { i18n, t } from '../../i18n/index.js';
import { buttonRow, escapeHtml, openDialog } from '../dialog.js';
import { commandList, prettyShortcut, IS_MAC } from '../commands.js';
import { descriptorFor, localName, typeName } from '../../notations/index.js';
import { icon, BRAND_MARK } from '../icons.js';

/* ------------------------------------------------------------ new project */

export function openNewProject(app) {
  const body = document.createElement('div');
  body.innerHTML = `
    <div class="field"><label>${t('newProject.name')}</label><input class="input" data-role="name"></div>
    <div class="field"><label>${t('newProject.author')}</label><input class="input" data-role="author"></div>
    <div class="field"><label>${t('newProject.start')}</label><div class="card-grid" data-role="start"></div></div>`;
  const nameInput = body.querySelector('[data-role="name"]');
  const authorInput = body.querySelector('[data-role="author"]');
  nameInput.value = t('app.untitled');
  authorInput.value = app.settings.get('lastAuthor', '') || '';
  let start = 'bpmn';
  const grid = body.querySelector('[data-role="start"]');
  const options = [
    { id: 'bpmn', label: t('newProject.bpmn') },
    { id: 'idef0', label: t('newProject.idef0') },
    { id: 'blank', label: t('newProject.blank') },
    { id: 'demo', label: t('newProject.demo') },
  ];
  const renderOptions = () => {
    grid.innerHTML = '';
    for (const option of options) {
      const card = document.createElement('div');
      card.className = `card${start === option.id ? ' is-selected' : ''}`;
      card.innerHTML = `<h5>${escapeHtml(option.label)}</h5>`;
      card.addEventListener('click', () => {
        start = option.id;
        renderOptions();
      });
      grid.appendChild(card);
    }
  };
  renderOptions();

  const dialog = openDialog({ title: t('newProject.title'), body });
  dialog.footer.appendChild(
    buttonRow([
      'spacer',
      { label: t('dialog.cancel'), action: () => dialog.close() },
      {
        label: t('dialog.create'),
        variant: 'primary',
        action: () => {
          app.settings.set('lastAuthor', authorInput.value.trim());
          app.createProject({ name: nameInput.value.trim() || t('app.untitled'), author: authorInput.value.trim(), start });
          dialog.close();
        },
      },
    ])
  );
  return dialog;
}

/* --------------------------------------------------------- project / docs */

export function openProjectProperties(app) {
  const project = app.doc.project;
  const body = document.createElement('div');
  body.innerHTML = `
    <div class="field"><label>${t('props.name')}</label><input class="input" data-role="name"></div>
    <div class="field-row">
      <div class="field"><label>${t('props.author')}</label><input class="input" data-role="author"></div>
      <div class="field"><label>${t('props.version')}</label><input class="input" data-role="version"></div>
    </div>
    <div class="field"><label>${t('props.description')}</label><textarea class="textarea" rows="3" data-role="description"></textarea></div>
    <div class="field"><label>${t('doc.project')}</label><textarea class="textarea" rows="6" data-role="documentation" placeholder="${escapeHtml(
      t('doc.placeholder')
    )}"></textarea></div>
    <div class="note" data-role="stats"></div>`;
  const get = (role) => body.querySelector(`[data-role="${role}"]`);
  get('name').value = project.name;
  get('author').value = project.meta.author || '';
  get('version').value = project.meta.version || '';
  get('description').value = project.meta.description || '';
  get('documentation').value = project.documentation || '';
  const stats = app.doc.stats();
  get('stats').textContent = `${t('search.diagram')}: ${stats.diagrams} · ${t('status.nodes', { count: stats.nodes })} · ${stats.edges} ↔ · ${t(
    'props.modified'
  )}: ${new Date(project.meta.modified).toLocaleString(i18n.locale)}`;

  const dialog = openDialog({ title: t('file.projectInfo'), body });
  dialog.footer.appendChild(
    buttonRow([
      'spacer',
      { label: t('dialog.cancel'), action: () => dialog.close() },
      {
        label: t('dialog.apply'),
        variant: 'primary',
        action: () => {
          app.doc.setProjectMeta({
            name: get('name').value.trim() || project.name,
            meta: {
              author: get('author').value.trim(),
              version: get('version').value.trim(),
              description: get('description').value.trim(),
            },
            documentation: get('documentation').value,
          });
          app.refreshChrome();
          dialog.close();
        },
      },
    ])
  );
  return dialog;
}

export function openDocumentation(app, scope = 'project', id = null) {
  const diagram = scope === 'diagram' ? app.doc.diagram(id) || app.activeDiagram : null;
  const element = scope === 'element' ? app.doc.element(app.activeDiagram?.id, id) : null;
  const title = scope === 'project' ? t('doc.project') : scope === 'diagram' ? t('doc.diagram') : t('doc.element');
  const value = scope === 'project' ? app.doc.project.documentation : scope === 'diagram' ? diagram?.meta.documentation : element?.props?.documentation;
  const body = document.createElement('div');
  body.innerHTML = `<div class="field"><textarea class="textarea" rows="14" placeholder="${escapeHtml(t('doc.placeholder'))}"></textarea></div>`;
  const textarea = body.querySelector('textarea');
  textarea.value = value || '';

  const dialog = openDialog({ title, subtitle: diagram?.name || element?.label || app.doc.project.name, body });
  dialog.footer.appendChild(
    buttonRow([
      'spacer',
      { label: t('dialog.cancel'), action: () => dialog.close() },
      {
        label: t('dialog.save'),
        variant: 'primary',
        action: () => {
          app.saveDocumentation(scope, id, textarea.value);
          dialog.close();
        },
      },
    ])
  );
  return dialog;
}

/* --------------------------------------------------------------- search */

export function openSearch(app) {
  const body = document.createElement('div');
  body.innerHTML = `
    <div class="field"><input class="input" data-role="q" placeholder="${escapeHtml(t('search.placeholder'))}" autocomplete="off"></div>
    <div data-role="results" style="max-height:46vh;overflow:auto"></div>`;
  const input = body.querySelector('[data-role="q"]');
  const results = body.querySelector('[data-role="results"]');

  const render = () => {
    const query = input.value.trim().toLowerCase();
    if (!query) {
      results.innerHTML = `<div class="empty-note">${t('search.placeholder')}</div>`;
      return;
    }
    const found = app.search(query);
    if (!found.length) {
      results.innerHTML = `<div class="empty-note">${t('search.empty')}</div>`;
      return;
    }
    results.innerHTML =
      `<div class="menu-label">${t('search.results', { count: found.length })}</div>` +
      found
        .map(
          (item, index) =>
            `<div class="problem-row" data-index="${index}"><span class="problem-icon">${icon(
              item.kind === 'diagram' ? 'diagram' : 'file',
              15
            )}</span><span><b>${escapeHtml(item.label || item.id)}</b> <span style="color:var(--text-tertiary)">${escapeHtml(item.typeName)}</span></span><span class="where">${escapeHtml(
              item.diagramName
            )}</span></div>`
        )
        .join('');
    results.querySelectorAll('.problem-row').forEach((row) => {
      row.addEventListener('click', () => {
        app.gotoSearchResult(found[Number(row.dataset.index)]);
        dialog.close();
      });
    });
  };

  input.addEventListener('input', render);
  input.addEventListener('keydown', (event) => {
    event.stopPropagation();
    if (event.key === 'Enter') {
      const first = results.querySelector('.problem-row');
      first?.click();
    }
  });

  const dialog = openDialog({ title: t('search.title'), body });
  render();
  return dialog;
}

/* -------------------------------------------------------- help & about */

export function openShortcuts(app) {
  const rows = commandList(app)
    .filter((command) => command.shortcut)
    .map((command) => `<tr><td style="padding:5px 8px">${escapeHtml(command.label)}</td><td style="text-align:right;padding:5px 8px"><kbd>${escapeHtml(
      prettyShortcut(command.shortcut)
    )}</kbd></td></tr>`)
    .join('');
  const extra = [
    [IS_MAC ? 'Space + перетаскивание' : 'Space + drag', t('palette.hand')],
    ['Shift + click', t('edit.selectAll')],
    [IS_MAC ? '⌥ + double click' : 'Alt + double click', t('model.openChild')],
    ['Double click', t('ctx.edit')],
    ['Mouse wheel', t('view.zoomIn')],
  ]
    .map(([keys, label]) => `<tr><td style="padding:5px 8px">${escapeHtml(label)}</td><td style="text-align:right;padding:5px 8px"><kbd>${escapeHtml(keys)}</kbd></td></tr>`)
    .join('');
  return openDialog({
    title: t('help.shortcuts'),
    body: `<table class="grid"><tbody>${rows}${extra}</tbody></table>`,
  });
}

export function openGuide(app) {
  const steps =
    i18n.locale === 'ru'
      ? [
          ['Создайте диаграмму', 'В левой панели нажмите «+» или выберите «Модель → Новая диаграмма BPMN».'],
          ['Поставьте элементы', 'Перетащите элемент из палитры слева на холст или кликните по нему и щёлкните на холсте.'],
          ['Соедините', 'Выделите элемент и потяните за синюю стрелку вокруг него к следующему элементу.'],
          ['Назовите', 'Двойной клик по элементу — редактирование текста прямо на холсте.'],
          ['Выровняйте', 'Нажмите L — авторасположение. Или выделите несколько элементов и используйте выравнивание справа.'],
          ['Проверьте', '⌘⇧V — проверка модели по правилам нотации, ошибки появятся в нижней панели.'],
          ['Сохраните и экспортируйте', '⌘S — сохранить проект, «Файл → Экспорт» — PDF, SVG, PNG, BPMN 2.0 XML.'],
          ['Декомпозиция IDEF0', 'Выделите блок и нажмите «Создать декомпозицию» в панели свойств — откроется дочерняя диаграмма.'],
        ]
      : [
          ['Create a diagram', 'Use “+” in the left panel or Model → New BPMN diagram.'],
          ['Place elements', 'Drag from the palette onto the canvas, or click a palette item and click on the canvas.'],
          ['Connect', 'Select an element and drag the blue arrow handle onto the next element.'],
          ['Name it', 'Double click an element to edit its text inline.'],
          ['Arrange', 'Press L for auto layout, or select several elements and use the alignment tools.'],
          ['Validate', '⌘⇧V checks the model against the notation rules; problems appear in the bottom panel.'],
          ['Save and export', '⌘S saves the project; File → Export gives PDF, SVG, PNG and BPMN 2.0 XML.'],
          ['IDEF0 decomposition', 'Select a function box and press “Create decomposition” in the properties panel.'],
        ];
  const body = steps
    .map(
      ([title, text], index) =>
        `<div class="welcome-step" style="margin-bottom:12px"><span class="n">${index + 1}</span><div><b>${escapeHtml(
          title
        )}</b><div style="color:var(--text-secondary);margin-top:2px">${escapeHtml(text)}</div></div></div>`
    )
    .join('');
  return openDialog({ title: t('guide.title'), body });
}

export function openAbout(app) {
  const stats = app.doc.stats();
  const body = `
    <div style="display:flex;gap:16px;align-items:flex-start">
      <div style="width:58px">${BRAND_MARK.replace('class="brand-mark"', 'style="width:58px;height:58px"')}</div>
      <div>
        <h3 style="margin:0 0 4px;font-size:20px;letter-spacing:-.02em">FiberModeler</h3>
        <div style="color:var(--text-secondary);margin-bottom:10px">${escapeHtml(t('app.tagline'))} · 1.0</div>
        <p style="margin:0 0 8px;line-height:1.55">${
          i18n.locale === 'ru'
            ? 'Редактор бизнес-процессов в нотациях BPMN 2.0 и IDEF0. Работает офлайн, хранит проекты локально, экспортирует векторные PDF и SVG, читает и пишет BPMN 2.0 XML.'
            : 'A business process editor for BPMN 2.0 and IDEF0. Works offline, keeps projects locally, exports vector PDF and SVG, reads and writes BPMN 2.0 XML.'
        }</p>
        <div class="note">${escapeHtml(
          `${t('search.diagram')}: ${stats.diagrams} · ${t('status.nodes', { count: stats.nodes })} · ${stats.edges} ↔`
        )}</div>
      </div>
    </div>`;
  return openDialog({ title: t('help.about'), body, width: 'narrow' });
}

export { descriptorFor, localName, typeName };
