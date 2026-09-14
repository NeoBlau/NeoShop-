/**
 * Single command registry.
 *
 * Menus, the toolbar, the command palette (⌘K) and the keyboard shortcuts all
 * read from this list, so a command can never be available in one place and
 * missing in another.
 */
import { t } from '../i18n/index.js';

export const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
const MOD = IS_MAC ? '⌘' : 'Ctrl';
const ALT = IS_MAC ? '⌥' : 'Alt';
const SHIFT = IS_MAC ? '⇧' : 'Shift';

export function prettyShortcut(spec) {
  if (!spec) return '';
  return spec
    .replace(/Mod/g, MOD)
    .replace(/Shift/g, SHIFT)
    .replace(/Alt/g, ALT)
    .replace(/\+/g, IS_MAC ? '' : '+');
}

/** Matches a KeyboardEvent against a shortcut spec like "Mod+Shift+S". */
export function matchShortcut(event, spec) {
  if (!spec) return false;
  const parts = spec.split('+');
  const key = parts[parts.length - 1].toLowerCase();
  const wantMod = parts.includes('Mod');
  const wantShift = parts.includes('Shift');
  const wantAlt = parts.includes('Alt');
  const mod = IS_MAC ? event.metaKey : event.ctrlKey;
  const otherMod = IS_MAC ? event.ctrlKey : event.metaKey;
  if (wantMod !== mod) return false;
  if (wantMod && otherMod) return false;
  if (wantShift !== event.shiftKey) return false;
  if (wantAlt !== event.altKey) return false;
  const eventKey = (event.key || '').toLowerCase();
  const code = (event.code || '').toLowerCase();
  if (key === 'delete') return eventKey === 'delete' || eventKey === 'backspace';
  if (key === 'escape') return eventKey === 'escape';
  if (key === 'space') return code === 'space';
  if (key === 'plus') return eventKey === '+' || eventKey === '=' || code === 'equal';
  if (key === 'minus') return eventKey === '-' || code === 'minus';
  return eventKey === key;
}

export function commandList(app) {
  const hasDiagram = !!app.activeDiagram;
  const hasSelection = app.selection.size > 0;
  const multi = app.selection.size > 1;
  return [
    /* file */
    { id: 'file.new', group: 'file', icon: 'new', shortcut: 'Mod+n', label: t('file.new'), run: () => app.newProject() },
    { id: 'file.open', group: 'file', icon: 'open', shortcut: 'Mod+o', label: t('file.open'), run: () => app.openProjectFile() },
    { id: 'file.save', group: 'file', icon: 'save', shortcut: 'Mod+s', label: t('file.save'), run: () => app.saveProject() },
    { id: 'file.saveAs', group: 'file', icon: 'save', shortcut: 'Mod+Shift+s', label: t('file.saveAs'), run: () => app.saveProject({ as: true }) },
    { id: 'file.demo', group: 'file', icon: 'sparkles', label: t('file.demo'), run: () => app.openDemoProject() },
    { id: 'file.projectInfo', group: 'file', icon: 'file', label: t('file.projectInfo'), run: () => app.openProjectProperties() },
    { id: 'file.print', group: 'file', icon: 'print', shortcut: 'Mod+p', label: t('file.print'), enabled: hasDiagram, run: () => app.openPrint() },

    /* import / export */
    { id: 'import.bpmn', group: 'file', icon: 'import', label: `${t('file.import')}: ${t('file.importBpmn')}`, run: () => app.importBpmn() },
    { id: 'import.json', group: 'file', icon: 'import', label: `${t('file.import')}: ${t('file.importJson')}`, run: () => app.importJson() },
    { id: 'export.png', group: 'file', icon: 'export', label: `${t('file.export')}: PNG`, enabled: hasDiagram, run: () => app.exportImage('image/png') },
    { id: 'export.jpeg', group: 'file', icon: 'export', label: `${t('file.export')}: JPEG`, enabled: hasDiagram, run: () => app.exportImage('image/jpeg') },
    { id: 'export.svg', group: 'file', icon: 'export', label: `${t('file.export')}: SVG`, enabled: hasDiagram, run: () => app.exportSvg() },
    { id: 'export.pdf', group: 'file', icon: 'export', label: `${t('file.export')}: PDF`, enabled: hasDiagram, run: () => app.exportPdf() },
    { id: 'export.pdfDoc', group: 'file', icon: 'export', label: t('file.exportPdfDoc'), enabled: hasDiagram, run: () => app.exportPdf({ documentation: true }) },
    { id: 'export.bpmn', group: 'file', icon: 'export', label: `${t('file.export')}: BPMN 2.0 XML`, enabled: hasDiagram, run: () => app.exportBpmn() },
    { id: 'export.json', group: 'file', icon: 'export', label: `${t('file.export')}: JSON`, run: () => app.exportJson() },
    { id: 'export.project', group: 'file', icon: 'export', label: t('file.exportProject'), run: () => app.exportProjectPdf() },

    /* edit */
    { id: 'edit.undo', group: 'edit', icon: 'undo', shortcut: 'Mod+z', label: t('edit.undo'), enabled: app.history.canUndo, run: () => app.undo() },
    { id: 'edit.redo', group: 'edit', icon: 'redo', shortcut: IS_MAC ? 'Mod+Shift+z' : 'Mod+y', label: t('edit.redo'), enabled: app.history.canRedo, run: () => app.redo() },
    { id: 'edit.cut', group: 'edit', icon: 'cut', shortcut: 'Mod+x', label: t('edit.cut'), enabled: hasSelection, run: () => app.cut() },
    { id: 'edit.copy', group: 'edit', icon: 'copy', shortcut: 'Mod+c', label: t('edit.copy'), enabled: hasSelection, run: () => app.copy() },
    { id: 'edit.paste', group: 'edit', icon: 'paste', shortcut: 'Mod+v', label: t('edit.paste'), enabled: !app.clipboard.isEmpty, run: () => app.paste() },
    { id: 'edit.duplicate', group: 'edit', icon: 'duplicate', shortcut: 'Mod+d', label: t('edit.duplicate'), enabled: hasSelection, run: () => app.duplicateSelection() },
    { id: 'edit.delete', group: 'edit', icon: 'delete', shortcut: 'Delete', label: t('edit.delete'), enabled: hasSelection, run: () => app.deleteSelection() },
    { id: 'edit.selectAll', group: 'edit', icon: 'duplicate', shortcut: 'Mod+a', label: t('edit.selectAll'), enabled: hasDiagram, run: () => app.selectAll() },
    { id: 'edit.find', group: 'edit', icon: 'search', shortcut: 'Mod+f', label: t('edit.find'), run: () => app.openSearch() },

    /* view */
    { id: 'view.zoomIn', group: 'view', icon: 'zoomIn', shortcut: 'Mod+plus', label: t('view.zoomIn'), run: () => app.canvas.zoomIn() },
    { id: 'view.zoomOut', group: 'view', icon: 'zoomOut', shortcut: 'Mod+minus', label: t('view.zoomOut'), run: () => app.canvas.zoomOut() },
    { id: 'view.zoom100', group: 'view', icon: 'fit', shortcut: 'Mod+0', label: t('view.zoom100'), run: () => app.canvas.resetZoom() },
    { id: 'view.fitScreen', group: 'view', icon: 'fit', shortcut: 'f', label: t('view.fitScreen'), run: () => app.canvas.fitContent() },
    { id: 'view.grid', group: 'view', icon: 'grid', label: t('view.grid'), checked: app.settings.get('canvas.grid'), run: () => app.toggleSetting('canvas.grid') },
    { id: 'view.snap', group: 'view', icon: 'grid', label: t('view.snap'), checked: app.settings.get('canvas.snap'), run: () => app.toggleSetting('canvas.snap') },
    { id: 'view.rulers', group: 'view', icon: 'map', label: t('view.rulers'), checked: app.settings.get('canvas.rulers'), run: () => app.toggleSetting('canvas.rulers') },
    { id: 'view.minimap', group: 'view', icon: 'map', label: t('view.minimap'), checked: app.settings.get('canvas.minimap'), run: () => app.toggleSetting('canvas.minimap') },
    { id: 'view.guides', group: 'view', icon: 'route', label: t('view.guides'), checked: app.settings.get('canvas.guides'), run: () => app.toggleSetting('canvas.guides') },
    { id: 'view.leftPanel', group: 'view', icon: 'panelLeft', shortcut: 'Mod+1', label: t('view.leftPanel'), checked: app.settings.get('ui.leftPanel'), run: () => app.toggleSetting('ui.leftPanel') },
    { id: 'view.rightPanel', group: 'view', icon: 'panelRight', shortcut: 'Mod+2', label: t('view.rightPanel'), checked: app.settings.get('ui.rightPanel'), run: () => app.toggleSetting('ui.rightPanel') },
    { id: 'view.problems', group: 'view', icon: 'panelBottom', shortcut: 'Mod+3', label: t('view.problems'), checked: app.settings.get('ui.bottomPanel'), run: () => app.toggleSetting('ui.bottomPanel') },
    { id: 'view.theme', group: 'view', icon: 'moon', label: t('view.theme'), run: () => app.cycleTheme() },

    /* model */
    { id: 'model.newBpmn', group: 'model', icon: 'diagram', label: t('model.newBpmn'), run: () => app.createDiagram('bpmn') },
    { id: 'model.newIdef0', group: 'model', icon: 'decompose', label: t('model.newIdef0'), run: () => app.createDiagram('idef0') },
    { id: 'model.templates', group: 'model', icon: 'file', label: t('model.templates'), run: () => app.openTemplates() },
    { id: 'model.autoLayout', group: 'model', icon: 'layout', shortcut: 'l', label: t('model.autoLayout'), enabled: hasDiagram, run: () => app.autoLayout() },
    { id: 'model.autoRoute', group: 'model', icon: 'route', label: t('model.autoRoute'), enabled: hasDiagram, run: () => app.autoRoute() },
    { id: 'model.validate', group: 'model', icon: 'validate', shortcut: 'Mod+Shift+v', label: t('model.validate'), enabled: hasDiagram, run: () => app.validate() },
    { id: 'model.decompose', group: 'model', icon: 'decompose', label: t('model.decompose'), enabled: app.selection.size === 1, run: () => app.openDecomposition(app.selection.list()[0]) },
    { id: 'model.openParent', group: 'model', icon: 'chevronLeft', label: t('model.openParent'), enabled: !!app.activeDiagram?.parentDiagramId, run: () => app.openParentDiagram() },
    { id: 'model.documentation', group: 'model', icon: 'file', label: t('model.documentation'), enabled: hasDiagram, run: () => app.openDocumentation('diagram') },
    { id: 'model.alignLeft', group: 'align', icon: 'alignLeft', label: t('model.alignLeft'), enabled: multi, run: () => app.align('left') },
    { id: 'model.alignCenter', group: 'align', icon: 'alignCenterH', label: t('model.alignCenter'), enabled: multi, run: () => app.align('center') },
    { id: 'model.alignRight', group: 'align', icon: 'alignRight', label: t('model.alignRight'), enabled: multi, run: () => app.align('right') },
    { id: 'model.alignTop', group: 'align', icon: 'alignTop', label: t('model.alignTop'), enabled: multi, run: () => app.align('top') },
    { id: 'model.alignMiddle', group: 'align', icon: 'alignMiddleV', label: t('model.alignMiddle'), enabled: multi, run: () => app.align('middle') },
    { id: 'model.alignBottom', group: 'align', icon: 'alignBottom', label: t('model.alignBottom'), enabled: multi, run: () => app.align('bottom') },
    { id: 'model.distributeH', group: 'align', icon: 'distributeH', label: t('model.distributeH'), enabled: app.selection.size > 2, run: () => app.distribute('horizontal') },
    { id: 'model.distributeV', group: 'align', icon: 'distributeV', label: t('model.distributeV'), enabled: app.selection.size > 2, run: () => app.distribute('vertical') },

    /* tools */
    { id: 'tools.palette', group: 'tools', icon: 'command', shortcut: 'Mod+k', label: t('tools.palette'), run: () => app.openCommandPalette() },
    { id: 'tools.autoBuild', group: 'tools', icon: 'sparkles', shortcut: 'Mod+g', label: t('tools.autoBuild'), run: () => app.openAutoBuild() },
    { id: 'tools.quickBuild', group: 'tools', icon: 'table', shortcut: 'Mod+Shift+b', label: t('tools.quickBuild'), run: () => app.openQuickBuild() },
    { id: 'tools.settings', group: 'tools', icon: 'settings', shortcut: 'Mod+,', label: t('tools.settings'), run: () => app.openSettings() },

    /* help */
    { id: 'help.shortcuts', group: 'help', icon: 'command', label: t('help.shortcuts'), run: () => app.openShortcuts() },
    { id: 'help.guide', group: 'help', icon: 'help', label: t('help.guide'), run: () => app.openGuide() },
    { id: 'help.about', group: 'help', icon: 'info', label: t('help.about'), run: () => app.openAbout() },
  ];
}

export function commandById(app, id) {
  return commandList(app).find((command) => command.id === id) || null;
}

export function runCommand(app, id) {
  const command = commandById(app, id);
  if (!command || command.enabled === false) return false;
  command.run();
  return true;
}
