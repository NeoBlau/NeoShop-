/** Model explorer: project tree with diagrams, decompositions and documentation. */
import { i18n, t } from '../../i18n/index.js';
import { icon } from '../icons.js';
import { showContextMenu } from '../menu.js';

export class Explorer {
  constructor(element, context) {
    this.el = element;
    this.doc = context.doc;
    this.app = context.app;
    this.collapsed = new Set();
    this.activeId = null;
    this.el.addEventListener('click', (event) => this.onClick(event));
    this.el.addEventListener('dblclick', (event) => this.onDoubleClick(event));
    this.el.addEventListener('contextmenu', (event) => this.onContextMenu(event));
  }

  setActive(diagramId) {
    this.activeId = diagramId;
    this.render();
  }

  render() {
    const rows = [];
    const project = this.doc.project;
    rows.push(row({ id: '__project', level: 0, label: project.name, iconName: 'folder', group: false, badge: String(project.diagrams.length), active: false, bold: true }));

    for (const notation of ['bpmn', 'idef0']) {
      const roots = project.diagrams.filter((d) => d.notation === notation && !d.parentDiagramId);
      const all = project.diagrams.filter((d) => d.notation === notation);
      rows.push(
        row({
          id: `__group_${notation}`,
          level: 1,
          label: t(notation === 'bpmn' ? 'explorer.bpmn' : 'explorer.idef0'),
          groupHeader: true,
          badge: String(all.length),
          collapsed: this.collapsed.has(`__group_${notation}`),
        })
      );
      if (this.collapsed.has(`__group_${notation}`)) continue;
      if (!roots.length) {
        rows.push(`<div class="tree-empty" style="padding-left:34px">${t('explorer.empty')}</div>`);
        continue;
      }
      for (const diagram of roots) this.renderDiagram(diagram, 2, rows);
    }

    rows.push(
      row({ id: '__docs', level: 1, label: t('explorer.documentation'), groupHeader: true, noTwisty: true })
    );
    this.el.innerHTML = rows.join('');
  }

  renderDiagram(diagram, level, rows) {
    const children = this.doc.childDiagrams(diagram.id);
    const isCollapsed = this.collapsed.has(diagram.id);
    rows.push(
      row({
        id: diagram.id,
        level,
        label: diagram.name,
        iconName: diagram.notation === 'idef0' ? 'decompose' : 'diagram',
        active: diagram.id === this.activeId,
        hasChildren: children.length > 0,
        collapsed: isCollapsed,
        badge: diagram.nodes.length ? String(diagram.nodes.length) : '',
      })
    );
    if (isCollapsed) return;
    for (const child of children) this.renderDiagram(child, level + 1, rows);
  }

  onClick(event) {
    const twisty = event.target.closest('.twisty');
    const node = event.target.closest('.tree-node');
    if (!node) return;
    const { id } = node.dataset;
    if (twisty && node.dataset.hasChildren === 'true') {
      if (this.collapsed.has(id)) this.collapsed.delete(id);
      else this.collapsed.add(id);
      this.render();
      return;
    }
    if (id === '__docs') {
      this.app.openDocumentation('project');
      return;
    }
    if (id === '__project') {
      this.app.openProjectProperties();
      return;
    }
    if (id.startsWith('__group_')) {
      if (this.collapsed.has(id)) this.collapsed.delete(id);
      else this.collapsed.add(id);
      this.render();
      return;
    }
    this.app.openDiagram(id);
  }

  onDoubleClick(event) {
    const node = event.target.closest('.tree-node');
    if (!node) return;
    const { id } = node.dataset;
    if (id.startsWith('__')) return;
    this.app.openDiagram(id);
  }

  onContextMenu(event) {
    event.preventDefault();
    const node = event.target.closest('.tree-node');
    const id = node?.dataset.id;
    if (!id || id.startsWith('__')) {
      showContextMenu(
        [
          { label: t('model.newBpmn'), action: () => this.app.createDiagram('bpmn') },
          { label: t('model.newIdef0'), action: () => this.app.createDiagram('idef0') },
          { separator: true },
          { label: t('model.templates'), action: () => this.app.openTemplates() },
        ],
        event.clientX,
        event.clientY
      );
      return;
    }
    const diagram = this.doc.diagram(id);
    if (!diagram) return;
    showContextMenu(
      [
        { label: t('model.openChild'), action: () => this.app.openDiagram(id) },
        { label: t('edit.rename'), action: () => this.app.renameDiagram(id) },
        { label: t('explorer.duplicate'), action: () => this.app.duplicateDiagram(id) },
        { separator: true },
        { label: t('model.newBpmn'), action: () => this.app.createDiagram('bpmn') },
        { label: t('model.newIdef0'), action: () => this.app.createDiagram('idef0') },
        { separator: true },
        { label: t('model.documentation'), action: () => this.app.openDocumentation('diagram', id) },
        { label: t('model.validate'), action: () => this.app.validate(id) },
        { separator: true },
        { label: t('edit.delete'), danger: true, action: () => this.app.deleteDiagram(id) },
      ],
      event.clientX,
      event.clientY
    );
  }
}

function row({ id, level, label, iconName, active, groupHeader, badge, collapsed, hasChildren, bold, noTwisty }) {
  const classes = ['tree-node'];
  if (active) classes.push('is-active');
  if (groupHeader) classes.push('is-group');
  if (collapsed) classes.push('is-collapsed');
  const twisty = noTwisty
    ? '<span class="twisty"></span>'
    : `<span class="twisty">${hasChildren || groupHeader ? icon('chevronDown', 11) : ''}</span>`;
  return (
    `<div class="${classes.join(' ')}" data-id="${escapeAttr(id)}" data-has-children="${!!hasChildren || !!groupHeader}" ` +
    `style="padding-left:${6 + level * 13}px${bold ? ';font-weight:600' : ''}">` +
    twisty +
    (iconName ? `<span class="tree-icon">${icon(iconName, 15)}</span>` : '') +
    `<span class="tree-text">${escapeHtml(label)}</span>` +
    (badge ? `<span class="tree-badge">${escapeHtml(badge)}</span>` : '') +
    '</div>'
  );
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}
function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, '&#39;');
}
