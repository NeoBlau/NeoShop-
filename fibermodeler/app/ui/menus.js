/** Menu bar definitions, built from the command registry. */
import { t } from '../i18n/index.js';
import { commandList, prettyShortcut } from './commands.js';
import { recentProjects } from '../storage/recent.js';

function toItem(commands, id, overrides = {}) {
  const command = commands.find((c) => c.id === id);
  if (!command) return null;
  return {
    label: command.label,
    shortcut: prettyShortcut(command.shortcut),
    disabled: command.enabled === false,
    checked: command.checked,
    action: command.run,
    ...overrides,
  };
}

export function menuDefinitions(app) {
  const commands = commandList(app);
  const item = (id, overrides) => toItem(commands, id, overrides);
  const recent = recentProjects();

  return [
    {
      id: 'file',
      label: t('menu.file'),
      items: () => [
        item('file.new'),
        item('file.open'),
        {
          label: t('file.openRecent'),
          submenu: recent.length
            ? recent.map((entry) => ({
                label: `${entry.name} · ${new Date(entry.updatedAt).toLocaleDateString()}`,
                action: () => app.openRecent(entry.id),
              }))
            : [{ label: t('welcome.noRecent'), disabled: true }],
        },
        item('file.demo'),
        { separator: true },
        item('file.save'),
        item('file.saveAs'),
        { separator: true },
        {
          label: t('file.import'),
          submenu: [item('import.bpmn'), item('import.json')],
        },
        {
          label: t('file.export'),
          submenu: [
            { header: t('file.exportCurrent') },
            item('export.png'),
            item('export.jpeg'),
            item('export.svg'),
            item('export.pdf'),
            item('export.bpmn'),
            { separator: true },
            item('export.pdfDoc'),
            item('export.json'),
            item('export.project'),
          ],
        },
        { separator: true },
        item('file.print'),
        item('file.projectInfo'),
      ],
    },
    {
      id: 'edit',
      label: t('menu.edit'),
      items: () => [
        item('edit.undo'),
        item('edit.redo'),
        { separator: true },
        item('edit.cut'),
        item('edit.copy'),
        item('edit.paste'),
        item('edit.duplicate'),
        item('edit.delete'),
        { separator: true },
        item('edit.selectAll'),
        item('edit.find'),
      ],
    },
    {
      id: 'view',
      label: t('menu.view'),
      items: () => [
        item('view.zoomIn'),
        item('view.zoomOut'),
        item('view.zoom100'),
        item('view.fitScreen'),
        { separator: true },
        item('view.grid'),
        item('view.snap'),
        item('view.guides'),
        item('view.rulers'),
        item('view.minimap'),
        { separator: true },
        item('view.leftPanel'),
        item('view.rightPanel'),
        item('view.problems'),
        { separator: true },
        {
          label: t('view.theme'),
          submenu: [
            { label: t('view.themeAuto'), checked: app.settings.get('theme') === 'auto', action: () => app.setTheme('auto') },
            { label: t('view.themeLight'), checked: app.settings.get('theme') === 'light', action: () => app.setTheme('light') },
            { label: t('view.themeDark'), checked: app.settings.get('theme') === 'dark', action: () => app.setTheme('dark') },
          ],
        },
      ],
    },
    {
      id: 'model',
      label: t('menu.model'),
      items: () => [
        item('model.newBpmn'),
        item('model.newIdef0'),
        item('model.templates'),
        { separator: true },
        item('model.decompose'),
        item('model.openParent'),
        { separator: true },
        item('model.autoLayout'),
        item('model.autoRoute'),
        {
          label: t('model.align'),
          submenu: [
            item('model.alignLeft'),
            item('model.alignCenter'),
            item('model.alignRight'),
            { separator: true },
            item('model.alignTop'),
            item('model.alignMiddle'),
            item('model.alignBottom'),
            { separator: true },
            item('model.distributeH'),
            item('model.distributeV'),
          ],
        },
        { separator: true },
        item('model.validate'),
        item('model.documentation'),
      ],
    },
    {
      id: 'tools',
      label: t('menu.tools'),
      items: () => [
        item('tools.autoBuild'),
        item('tools.quickBuild'),
        { separator: true },
        item('tools.palette'),
        {
          label: t('tools.language'),
          submenu: [
            { label: 'Русский', checked: app.settings.get('language') === 'ru', action: () => app.setLanguage('ru') },
            { label: 'English', checked: app.settings.get('language') === 'en', action: () => app.setLanguage('en') },
          ],
        },
        { separator: true },
        item('tools.settings'),
      ],
    },
    {
      id: 'help',
      label: t('menu.help'),
      items: () => [item('help.guide'), item('help.shortcuts'), { separator: true }, item('help.about')],
    },
  ];
}

export function toolbarDefinition(app) {
  const commands = commandList(app);
  const find = (id) => commands.find((c) => c.id === id);
  return [
    { type: 'group', items: ['file.new', 'file.open', 'file.save'] },
    { type: 'group', items: ['edit.undo', 'edit.redo'] },
    { type: 'group', items: ['view.zoomOut', 'zoom-value', 'view.zoomIn', 'view.fitScreen'] },
    { type: 'group', items: ['model.autoLayout', 'model.autoRoute', 'model.validate'] },
    { type: 'group', items: ['model.alignLeft', 'model.alignCenter', 'model.alignRight', 'model.alignTop', 'model.alignMiddle', 'model.alignBottom'] },
    { type: 'spacer' },
    { type: 'group', items: ['tools.quickBuild'] },
    { type: 'primary', id: 'tools.autoBuild' },
  ].map((entry) => ({ ...entry, resolve: find }));
}
