/**
 * Application controller.
 *
 * Owns the document, the history, the canvas and every panel, and exposes the
 * verbs that menus, the command palette, the panels and the canvas call.
 */
import { Clipboard, extract, instantiate } from '../core/clipboard.js';
import { Doc, clone, createDiagram, createProject, nowIso } from '../core/model.js';
import { History } from '../core/history.js';
import { Selection } from '../core/selection.js';
import { Settings } from '../core/settings.js';
import { uid } from '../core/id.js';
import { rectOf, unionRect } from '../core/geometry.js';
import { i18n, localizeDom, t } from '../i18n/index.js';
import { DiagramCanvas } from '../canvas/canvas.js';
import { CanvasInteractions } from '../canvas/interactions.js';
import { Minimap } from '../canvas/minimap.js';
import { Rulers } from '../canvas/rulers.js';
import { descriptorFor, getNotation, localName, makeNode, typeName } from '../notations/index.js';
import { autoLayout as computeLayout, alignNodes, distributeNodes, equalizeSize, fitContainers } from '../layout/index.js';
import { buildDiagrams } from '../ai/schema.js';
import { generateModel } from '../ai/index.js';
import { createDemoProject } from '../demo.js';
import { Autosave, recoveryInfo } from '../storage/autosave.js';
import { deleteProjectRecord, listProjectRecords, loadProjectRecord, saveProjectRecord, storageAvailable } from '../storage/db.js';
import { forgetProject, rememberProject } from '../storage/recent.js';
import { download, downloadText, pickFile, safeFileName } from '../io/files.js';
import { exportDiagramSvg } from '../io/svgexport.js';
import { svgToRaster } from '../io/raster.js';
import { exportBpmnXml, importBpmnXml } from '../io/bpmn.js';
import { packProject, projectFromJson, projectToJson, unpackProject } from '../io/projectfile.js';
import { Explorer } from './panels/explorer.js';
import { Palette } from './panels/palette.js';
import { Problems, formatMessage } from './panels/problems.js';
import { Properties } from './panels/properties.js';
import { commandList, matchShortcut, prettyShortcut, IS_MAC } from './commands.js';
import { openCommandPalette } from './commandpalette.js';
import { menuDefinitions, toolbarDefinition } from './menus.js';
import { closeMenus, showContextMenu, showMenu } from './menu.js';
import { icon } from './icons.js';
import { renderWelcome } from './welcome.js';
import { confirmDialog, promptDialog } from './dialog.js';
import { toast, toastError, toastSuccess } from './toast.js';
import { openSettings } from './dialogs/settings.js';
import { openAutoBuild } from './dialogs/autobuild.js';
import { openQuickBuild } from './dialogs/quickbuild.js';
import { openTemplates } from './dialogs/templates.js';
import { openPrint } from './dialogs/print.js';
import { openAbout, openDocumentation, openGuide, openNewProject, openProjectProperties, openSearch, openShortcuts } from './dialogs/misc.js';

export class App {
  constructor(root) {
    this.root = root;
    this.settings = new Settings();
    i18n.setLocale(this.settings.get('language', 'ru'));
    this.doc = new Doc(createProject({ name: t('app.untitled') }));
    this.history = new History(this.doc);
    this.selection = new Selection();
    this.clipboard = new Clipboard();
    this.openTabs = [];
    this.activeDiagramId = null;
    this.problems = [];
    this.fileHandleName = null;

    this._queryDom();
    this._buildCanvas();
    this._buildPanels();
    this._bindEvents();
    this.applySettings();
    this.refreshChrome();
  }

  /* ------------------------------------------------------------------ DOM */

  _queryDom() {
    const q = (selector) => this.root.querySelector(selector);
    this.el = {
      menubar: q('#menubar'),
      toolbar: q('#toolbar'),
      workspace: q('#workspace'),
      explorer: q('#explorer'),
      explorerTitle: q('#explorer-title'),
      addDiagram: q('#btn-add-diagram'),
      tabstrip: q('#tabstrip'),
      stage: q('#stage'),
      canvasHost: q('#canvas-host'),
      palette: q('#palette'),
      minimap: q('#minimap'),
      zoomValue: q('#zoom-value'),
      props: q('#props'),
      propsTitle: q('#props-title'),
      bottom: q('#bottom'),
      status: {
        message: q('#status-message'),
        nodes: q('#status-nodes'),
        zoom: q('#status-zoom'),
        problems: q('#status-problems'),
        saved: q('#status-saved'),
        dot: q('#status-dot'),
        position: q('#status-position'),
      },
      docName: q('#doc-name'),
      docHint: q('#doc-hint'),
      welcome: q('#welcome'),
      rulerH: q('.ruler-h'),
      rulerV: q('.ruler-v'),
    };
  }

  _buildCanvas() {
    this.canvas = new DiagramCanvas(this.el.canvasHost, {
      doc: this.doc,
      settings: this.settings,
      selection: this.selection,
    });
    this.interactions = new CanvasInteractions(this.canvas, {
      doc: this.doc,
      history: this.history,
      selection: this.selection,
      settings: this.settings,
      app: this,
    });
    this.minimap = new Minimap(this.el.minimap, this.canvas);
    this.rulers = new Rulers({ horizontal: this.el.rulerH, vertical: this.el.rulerV, corner: this.root.querySelector('.ruler-corner') }, this.canvas);
    this.canvas.emptyState.innerHTML = `${icon('diagram', 74)}<div>${t('canvas.emptyNoDiagram')}</div>`;
  }

  _buildPanels() {
    const context = { doc: this.doc, history: this.history, selection: this.selection, settings: this.settings, app: this };
    this.explorer = new Explorer(this.el.explorer, context);
    this.palette = new Palette(this.el.palette, context);
    this.properties = new Properties(this.el.props, context);
    this.problemsPanel = new Problems(this.el.bottom, context);
    this.explorer.render();
    this.palette.render();
    this.properties.render();
    this.autosave = new Autosave({
      doc: this.doc,
      settings: this.settings,
      onSaved: (date) => {
        this.el.status.saved.textContent = t('status.autosaved', { time: date.toLocaleTimeString(i18n.locale) });
      },
      onError: () => {
        this.el.status.saved.textContent = '';
      },
    });
  }

  _bindEvents() {
    this.selection.on('change', () => {
      this.canvas.renderOverlay();
      this.properties.render();
      this.refreshToolbar();
    });
    this.doc.on('change', (event) => {
      this.refreshChrome();
      if (event?.type?.startsWith('diagram')) this.explorer.render();
    });
    this.doc.on('reset', () => {
      this.explorer.render();
      this.refreshChrome();
    });
    this.history.on('change', () => {
      this.refreshToolbar();
      this.refreshChrome();
    });
    this.canvas.on('viewport', ({ zoom }) => {
      const text = `${Math.round(zoom * 100)}%`;
      for (const element of this.root.querySelectorAll('.zoom-readout')) element.textContent = text;
      if (this.el.status.zoom) this.el.status.zoom.textContent = `${t('status.zoom')}: ${text}`;
    });
    this.canvas.on('pointer', (world) => {
      if (this.el.status.position) this.el.status.position.textContent = `${Math.round(world.x)}, ${Math.round(world.y)}`;
    });
    this.canvas.on('contextmenu', (event) => this.showCanvasContextMenu(event));
    this.canvas.on('empty-state', ({ empty, hasDiagram }) => {
      this.canvas.emptyState.innerHTML = `${icon(hasDiagram ? 'cursor' : 'diagram', 74)}<div>${
        hasDiagram ? t('canvas.empty') : t('canvas.emptyNoDiagram')
      }</div>`;
    });

    this.el.addDiagram?.addEventListener('click', (event) => {
      showMenu(
        [
          { label: t('model.newBpmn'), action: () => this.createDiagram('bpmn') },
          { label: t('model.newIdef0'), action: () => this.createDiagram('idef0') },
          { separator: true },
          { label: t('model.templates'), action: () => this.openTemplates() },
          { label: t('tools.autoBuild'), action: () => this.openAutoBuild() },
          { label: t('tools.quickBuild'), action: () => this.openQuickBuild() },
        ],
        event.clientX - 10,
        event.clientY + 14
      );
    });

    this.root.querySelector('#btn-theme')?.addEventListener('click', () => this.cycleTheme());
    this.root.querySelector('#btn-lang')?.addEventListener('click', () => this.setLanguage(i18n.locale === 'ru' ? 'en' : 'ru'));
    this.root.querySelector('#btn-help')?.addEventListener('click', () => this.openGuide());
    this.root.querySelector('#btn-zoom-in')?.addEventListener('click', () => this.canvas.zoomIn());
    this.root.querySelector('#btn-zoom-out')?.addEventListener('click', () => this.canvas.zoomOut());
    this.root.querySelector('#btn-zoom-fit')?.addEventListener('click', () => this.canvas.fitContent());
    this.root.querySelector('#btn-close-bottom')?.addEventListener('click', () => this.toggleSetting('ui.bottomPanel', false));
    this.root.querySelector('#btn-revalidate')?.addEventListener('click', () => this.validate());
    this.el.status.problems?.addEventListener('click', () => this.toggleSetting('ui.bottomPanel', true));

    this.el.tabstrip.addEventListener('click', (event) => {
      const close = event.target.closest('.close');
      const tab = event.target.closest('.tab');
      if (!tab) return;
      if (close) this.closeTab(tab.dataset.id);
      else this.openDiagram(tab.dataset.id);
    });

    window.addEventListener('keydown', (event) => this.handleKey(event), true);
    window.addEventListener('beforeunload', (event) => {
      this.autosave?.flush();
      if (this.history.isDirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    });
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (this.settings.get('theme') === 'auto') this.applyTheme();
      });
    }
  }

  /* -------------------------------------------------------------- chrome */

  refreshChrome() {
    const project = this.doc.project;
    this.el.docName.textContent = project.name;
    const diagram = this.activeDiagram;
    this.el.docHint.textContent = diagram ? `— ${diagram.name}` : '';
    this.root.classList.toggle('is-dirty', this.history.isDirty);
    const stats = this.doc.stats();
    this.el.status.nodes.textContent = t('status.nodes', { count: diagram ? diagram.nodes.length : stats.nodes });
    this.el.status.message.textContent = this.history.isDirty ? t('status.unsaved') : t('status.saved');
    this.el.status.dot.className = `status-dot${this.history.isDirty ? ' is-warning' : ''}`;
    this.renderMenubar();
    this.renderTabs();
    this.explorer.setActive(this.activeDiagramId);
    document.title = `${project.name} — FiberModeler`;
  }

  renderMenubar() {
    const definitions = menuDefinitions(this);
    this.el.menubar.innerHTML = '';
    for (const definition of definitions) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'menu-button';
      button.textContent = definition.label;
      button.addEventListener('click', (event) => {
        if (button.classList.contains('is-open')) {
          closeMenus();
          return;
        }
        const rect = button.getBoundingClientRect();
        showMenu(definition.items().filter(Boolean), rect.left, rect.bottom + 4, { anchor: button });
      });
      button.addEventListener('pointerenter', () => {
        if (this.el.menubar.querySelector('.menu-button.is-open') && !button.classList.contains('is-open')) {
          const rect = button.getBoundingClientRect();
          showMenu(definition.items().filter(Boolean), rect.left, rect.bottom + 4, { anchor: button });
        }
      });
      this.el.menubar.appendChild(button);
    }
  }

  refreshToolbar() {
    const commands = new Map(commandList(this).map((command) => [command.id, command]));
    this.el.toolbar.innerHTML = '';
    for (const entry of toolbarDefinition(this)) {
      if (entry.type === 'spacer') {
        const spacer = document.createElement('div');
        spacer.className = 'toolbar-spacer';
        this.el.toolbar.appendChild(spacer);
        continue;
      }
      if (entry.type === 'primary') {
        const command = commands.get(entry.id);
        const button = document.createElement('button');
        button.className = 'pill';
        button.innerHTML = `${icon('sparkles', 15)}<span>${command.label.replace('…', '')}</span>`;
        button.title = `${command.label} · ${prettyShortcut(command.shortcut)}`;
        button.addEventListener('click', command.run);
        this.el.toolbar.appendChild(button);
        continue;
      }
      const group = document.createElement('div');
      group.className = 'tool-group';
      for (const id of entry.items) {
        if (id === 'zoom-value') {
          const value = document.createElement('div');
          value.className = 'value zoom-readout';
          value.style.cssText = 'min-width:48px;text-align:center;font-size:var(--fs-sm);color:var(--text-secondary)';
          value.textContent = `${Math.round((this.canvas?.zoom || 1) * 100)}%`;
          value.addEventListener('click', () => this.canvas.resetZoom());
          group.appendChild(value);
          continue;
        }
        const command = commands.get(id);
        if (!command) continue;
        const button = document.createElement('button');
        button.className = `tool-btn${command.checked ? ' is-active' : ''}`;
        button.innerHTML = icon(command.icon || 'file', 17);
        button.title = command.shortcut ? `${command.label} · ${prettyShortcut(command.shortcut)}` : command.label;
        button.disabled = command.enabled === false;
        button.addEventListener('click', command.run);
        group.appendChild(button);
      }
      this.el.toolbar.appendChild(group);
    }
  }

  renderTabs() {
    this.el.tabstrip.innerHTML = this.openTabs
      .map((id) => {
        const diagram = this.doc.diagram(id);
        if (!diagram) return '';
        return `<div class="tab${id === this.activeDiagramId ? ' is-active' : ''}" data-id="${id}" data-notation="${diagram.notation}">
          <span class="notation-dot"></span><span>${escapeHtml(diagram.name)}</span><span class="close">${icon('close', 11)}</span></div>`;
      })
      .join('');
    this.el.tabstrip.hidden = this.openTabs.length === 0;
  }

  applySettings() {
    this.applyTheme();
    const settings = this.settings;
    this.el.workspace.classList.toggle('no-left', !settings.get('ui.leftPanel', true));
    this.el.workspace.classList.toggle('no-right', !settings.get('ui.rightPanel', true));
    this.el.bottom.hidden = !settings.get('ui.bottomPanel', false);
    this.el.stage.classList.toggle('no-rulers', !settings.get('canvas.rulers', true));
    this.rulers.setVisible(settings.get('canvas.rulers', true));
    this.minimap.setVisible(settings.get('canvas.minimap', true));
    this.palette.toggleCollapsed(!settings.get('ui.paletteOpen', true));
    this.canvas.setViewport(this.canvas.tx, this.canvas.ty, this.canvas.zoom, { silent: true });
    this.canvas.renderOverlay();
    this.refreshToolbar();
  }

  applyTheme() {
    const theme = this.settings.get('theme', 'auto');
    const dark = theme === 'dark' || (theme === 'auto' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    const button = this.root.querySelector('#btn-theme');
    if (button) button.innerHTML = icon(dark ? 'sun' : 'moon', 16);
    this.canvas?.render();
  }

  setTheme(theme) {
    this.settings.set('theme', theme);
    this.applyTheme();
    this.refreshChrome();
  }

  cycleTheme() {
    const order = ['auto', 'light', 'dark'];
    const next = order[(order.indexOf(this.settings.get('theme', 'auto')) + 1) % order.length];
    this.setTheme(next);
    toast(`${t('view.theme')}: ${t(`view.theme${next[0].toUpperCase()}${next.slice(1)}`)}`);
  }

  setLanguage(locale) {
    this.settings.set('language', locale);
    i18n.setLocale(locale);
    localizeDom(this.root);
    this.palette.localize();
    this.explorer.render();
    this.properties.render();
    this.problemsPanel.render();
    this.refreshChrome();
    this.refreshToolbar();
  }

  toggleSetting(path, value) {
    const next = value === undefined ? !this.settings.get(path) : value;
    this.settings.set(path, next);
    this.applySettings();
    return next;
  }

  /* ------------------------------------------------------------ diagrams */

  get activeDiagram() {
    return this.activeDiagramId ? this.doc.diagram(this.activeDiagramId) : null;
  }

  openDiagram(id) {
    const diagram = this.doc.diagram(id);
    if (!diagram) return;
    if (!this.openTabs.includes(id)) this.openTabs.push(id);
    this.activeDiagramId = id;
    this.canvas.setDiagram(id);
    this.palette.setNotation(diagram.notation);
    this.properties.render();
    this.refreshChrome();
    this.hideWelcome();
  }

  closeTab(id) {
    this.openTabs = this.openTabs.filter((tab) => tab !== id);
    if (this.activeDiagramId === id) {
      const next = this.openTabs[this.openTabs.length - 1];
      if (next) this.openDiagram(next);
      else {
        this.activeDiagramId = null;
        this.canvas.setDiagram(null);
        this.properties.render();
      }
    }
    this.refreshChrome();
  }

  createDiagram(notation, options = {}) {
    const existing = this.doc.project.diagrams.filter((d) => d.notation === notation).length;
    const diagram = createDiagram({
      notation,
      name: options.name || (notation === 'bpmn' ? `${t('search.diagram')} ${existing + 1}` : existing === 0 ? 'A-0' : `A${existing}`),
      parentDiagramId: options.parentDiagramId || null,
      parentNodeId: options.parentNodeId || null,
    });
    if (notation === 'idef0' && !options.empty) {
      const box = makeNode('idef0', 'idef0Function', 480, 320, { label: '', props: { number: existing === 0 ? 'A0' : `A${existing}` } });
      box.w = 240;
      box.h = 130;
      diagram.nodes.push(box);
    }
    if (notation === 'bpmn' && !options.empty) {
      diagram.nodes.push(makeNode('bpmn', 'startEvent', 200, 200, { label: '' }));
    }
    this.history.run('diagram', '*', (doc) => doc.addDiagram(diagram));
    this.explorer.render();
    this.openDiagram(diagram.id);
    return diagram;
  }

  async renameDiagram(id) {
    const diagram = this.doc.diagram(id);
    if (!diagram) return;
    const name = await promptDialog({ title: t('edit.rename'), label: t('props.name'), value: diagram.name });
    if (!name) return;
    this.history.run('rename', id, (doc) => doc.updateDiagram(id, { name }));
    this.explorer.render();
    this.refreshChrome();
  }

  duplicateDiagram(id) {
    const source = this.doc.diagram(id);
    if (!source) return;
    const copy = clone(source);
    copy.id = uid(source.notation);
    copy.name = `${source.name} (2)`;
    copy.parentDiagramId = null;
    copy.parentNodeId = null;
    const idMap = new Map();
    for (const node of copy.nodes) {
      const next = uid('node');
      idMap.set(node.id, next);
      node.id = next;
    }
    for (const node of copy.nodes) if (node.parent) node.parent = idMap.get(node.parent) || null;
    for (const edge of copy.edges) {
      edge.id = uid('edge');
      edge.source = idMap.get(edge.source);
      edge.target = idMap.get(edge.target);
    }
    this.history.run('duplicate', '*', (doc) => doc.addDiagram(copy));
    this.explorer.render();
    this.openDiagram(copy.id);
  }

  async deleteDiagram(id) {
    const diagram = this.doc.diagram(id);
    if (!diagram) return;
    const confirmed = await confirmDialog({
      title: t('dialog.delete'),
      message: t('dialog.confirmDelete', { name: diagram.name }),
      confirmLabel: t('dialog.delete'),
      danger: true,
    });
    if (!confirmed) return;
    this.history.run('delete diagram', '*', (doc) => doc.removeDiagram(id));
    this.openTabs = this.openTabs.filter((tab) => this.doc.diagram(tab));
    if (this.activeDiagramId === id) {
      this.activeDiagramId = this.openTabs[this.openTabs.length - 1] || null;
      this.canvas.setDiagram(this.activeDiagramId);
    }
    this.explorer.render();
    this.refreshChrome();
  }

  openParentDiagram() {
    const diagram = this.activeDiagram;
    if (diagram?.parentDiagramId) this.openDiagram(diagram.parentDiagramId);
  }

  /** Opens - creating it when needed - the decomposition of a node. */
  openDecomposition(nodeId) {
    const diagram = this.activeDiagram;
    if (!diagram || !nodeId) return;
    const node = this.doc.node(diagram.id, nodeId);
    if (!node) return;
    const descriptor = descriptorFor(diagram, node);
    const existing = this.doc.decompositionOf(nodeId);
    if (existing) {
      this.openDiagram(existing.id);
      return;
    }
    if (!descriptor?.decomposable && node.type !== 'idef0Function') {
      toast(t('toast.decomposeUnsupported'));
      return;
    }
    const number = node.props?.number || 'A0';
    const child = createDiagram({
      notation: diagram.notation,
      name: diagram.notation === 'idef0' ? childNumber(number) : node.label || t('model.decompose'),
      parentDiagramId: diagram.id,
      parentNodeId: node.id,
    });
    child.meta.parentNumber = childNumber(number);
    child.meta.description = node.label || '';

    if (diagram.notation === 'idef0') {
      // carry the parent arrows over as boundary (ICOM) arrows
      const arrows = this.doc.edgesOf(diagram.id, node.id);
      let counters = { I: 0, C: 0, O: 0, M: 0 };
      const inner = makeNode('idef0', 'idef0Function', 520, 340, { label: node.label, props: { number: `${childNumber(number)}1` } });
      child.nodes.push(inner);
      for (const arrow of arrows) {
        const role = { idef0Input: 'input', idef0Control: 'control', idef0Output: 'output', idef0Mechanism: 'mechanism', idef0Call: 'mechanism' }[arrow.type] || 'input';
        const letter = { input: 'I', control: 'C', output: 'O', mechanism: 'M' }[role];
        counters[letter] += 1;
        const anchor = makeNode('idef0', 'idef0Anchor', 0, 0, {
          label: arrow.label || '',
          props: { icom: `${letter}${counters[letter]}`, role },
        });
        child.nodes.push(anchor);
        const isOutgoing = arrow.source === node.id;
        child.edges.push({
          id: uid('edge'),
          type: arrow.type,
          source: isOutgoing ? inner.id : anchor.id,
          target: isOutgoing ? anchor.id : inner.id,
          sourceSide: null,
          targetSide: null,
          waypoints: [],
          routing: 'auto',
          label: '',
          props: {},
          style: {},
        });
      }
      const changes = computeLayout(child);
      for (const change of changes) {
        const target = child.nodes.find((n) => n.id === change.id);
        if (target) Object.assign(target, change);
      }
    } else {
      child.nodes.push(makeNode('bpmn', 'startEvent', 180, 220, { label: '' }));
      child.nodes.push(makeNode('bpmn', 'endEvent', 620, 220, { label: '' }));
    }

    this.history.run('decompose', '*', (doc) => doc.addDiagram(child));
    this.explorer.render();
    this.openDiagram(child.id);
    toast(t('toast.decomposeCreated'));
  }

  /* ------------------------------------------------------------ elements */

  placeElement(type, point) {
    const diagram = this.activeDiagram;
    if (!diagram) {
      toast(t('toast.diagramNeeded'));
      return null;
    }
    const notation = getNotation(diagram.notation);
    if (notation.edgeTypes[type]) {
      this.interactions.setTool({ mode: 'connect', type });
      return null;
    }
    const node = makeNode(diagram.notation, type, point.x, point.y);
    notation.onCreateNode(node, diagram);
    const container = notation.containerAt?.(diagram, rectOf(node), new Set());
    if (container) node.parent = container.id;
    this.history.run('add', diagram.id, (doc) => doc.addNode(diagram.id, node));
    this.canvas.render();
    this.selection.set([node.id]);
    this.interactions.startEdit(node.id);
    return node;
  }

  /** Creates the next element in a direction and connects it (quick handles). */
  quickCreate(sourceNode, direction, worldPoint) {
    const diagram = this.activeDiagram;
    if (!diagram) return;
    const notation = getNotation(diagram.notation);
    const descriptor = notation.nodeTypes[sourceNode.type];
    const nextType = suggestNextType(diagram.notation, descriptor);
    const size = notation.nodeTypes[nextType].defaultSize;
    const gap = 90;
    const centre = { x: sourceNode.x + sourceNode.w / 2, y: sourceNode.y + sourceNode.h / 2 };
    const offset = {
      right: { x: sourceNode.w / 2 + gap + size.w / 2, y: 0 },
      left: { x: -(sourceNode.w / 2 + gap + size.w / 2), y: 0 },
      up: { x: 0, y: -(sourceNode.h / 2 + gap + size.h / 2) },
      down: { x: 0, y: sourceNode.h / 2 + gap + size.h / 2 },
    }[direction] || { x: sourceNode.w / 2 + gap + size.w / 2, y: 0 };
    const target = worldPoint || { x: centre.x + offset.x, y: centre.y + offset.y };
    const node = makeNode(diagram.notation, nextType, target.x, target.y);
    node.parent = sourceNode.parent;
    notation.onCreateNode(node, diagram);
    const edgeType = notation.defaultEdgeType(diagram, sourceNode, node, direction === 'up' ? 'top' : direction === 'down' ? 'bottom' : 'left');
    this.history.run('quick create', diagram.id, (doc) => {
      doc.addNode(diagram.id, node);
      doc.addEdge(diagram.id, this._makeEdge(diagram, sourceNode, node, edgeType));
    });
    this.canvas.render();
    this.selection.set([node.id]);
    this.interactions.startEdit(node.id);
  }

  connect(sourceNode, targetNode, requestedType) {
    const diagram = this.activeDiagram;
    if (!diagram || !sourceNode || !targetNode) {
      toast(t('toast.connectFail'));
      return null;
    }
    const notation = getNotation(diagram.notation);
    const check = notation.canConnect(diagram, sourceNode, targetNode, requestedType);
    if (!check.ok) {
      if (check.reason !== 'duplicate') toast(t('toast.connectRule'), { type: 'error' });
      return null;
    }
    const edge = this._makeEdge(diagram, sourceNode, targetNode, check.type);
    this.history.run('connect', diagram.id, (doc) => doc.addEdge(diagram.id, edge));
    this.canvas.render();
    this.selection.set([edge.id]);
    return edge;
  }

  _makeEdge(diagram, source, target, type) {
    const notation = getNotation(diagram.notation);
    const sides = notation.sidesFor(type, source, target) || {};
    return {
      id: uid('edge'),
      type,
      source: source.id,
      target: target.id,
      sourceSide: sides.sourceSide || null,
      targetSide: sides.targetSide || null,
      waypoints: [],
      routing: 'auto',
      label: '',
      props: {},
      style: {},
    };
  }

  changeType(elementId, newType) {
    const diagram = this.activeDiagram;
    if (!diagram) return;
    const node = this.doc.node(diagram.id, elementId);
    const notation = getNotation(diagram.notation);
    this.history.run('change type', diagram.id, (doc) => {
      if (node) {
        const oldDescriptor = notation.nodeTypes[node.type];
        const descriptor = notation.nodeTypes[newType];
        if (!descriptor) return;
        const patch = { type: newType };
        if (oldDescriptor && node.w === oldDescriptor.defaultSize.w && node.h === oldDescriptor.defaultSize.h) {
          patch.w = descriptor.defaultSize.w;
          patch.h = descriptor.defaultSize.h;
        }
        doc.updateNode(diagram.id, elementId, patch);
      } else {
        const edge = doc.edge(diagram.id, elementId);
        if (!edge) return;
        const spec = notation.edgeTypes[newType];
        if (!spec) return;
        doc.updateEdge(diagram.id, elementId, {
          type: newType,
          sourceSide: spec.sourceSide || null,
          targetSide: spec.targetSide || null,
          routing: 'auto',
          waypoints: [],
        });
      }
    });
    this.canvas.render();
    this.properties.render();
  }

  changeElementId(oldId, newId) {
    const diagram = this.activeDiagram;
    const value = String(newId || '').trim();
    if (!diagram || !value || value === oldId) return;
    if (this.doc.allIds().has(value)) {
      toastError(`ID “${value}” ${i18n.locale === 'ru' ? 'уже занят' : 'is already used'}`);
      this.properties.render();
      return;
    }
    this.history.run('rename id', diagram.id, (doc) => {
      const node = doc.node(diagram.id, oldId);
      if (node) {
        node.id = value;
        for (const edge of doc.diagram(diagram.id).edges) {
          if (edge.source === oldId) edge.source = value;
          if (edge.target === oldId) edge.target = value;
        }
        for (const other of doc.diagram(diagram.id).nodes) if (other.parent === oldId) other.parent = value;
        for (const child of doc.project.diagrams) if (child.parentNodeId === oldId) child.parentNodeId = value;
      } else {
        const edge = doc.edge(diagram.id, oldId);
        if (edge) edge.id = value;
      }
      doc.invalidate(diagram.id);
    });
    this.selection.set([value]);
    this.canvas.render();
    this.properties.render();
  }

  selectPaletteTool(kind, type) {
    if (kind === 'edge') this.interactions.setTool({ mode: 'connect', type });
    else this.interactions.setTool({ mode: 'place', type });
    this.palette.setActiveType(type);
    this.canvas.emit('tool-changed', type);
  }

  refreshCanvas(full = false) {
    if (full) this.canvas.render();
    else {
      this.canvas.recomputeGeometry();
      this.canvas.render();
    }
    this.minimap.scheduleUpdate();
  }

  refreshProperties() {
    this.properties.render();
  }

  /* ---------------------------------------------------------- edit verbs */

  undo() {
    if (this.history.undo()) {
      this.selection.clear();
      this.canvas.render();
      this.explorer.render();
      this.properties.render();
      this.refreshChrome();
    }
  }

  redo() {
    if (this.history.redo()) {
      this.selection.clear();
      this.canvas.render();
      this.explorer.render();
      this.properties.render();
      this.refreshChrome();
    }
  }

  copy() {
    const diagram = this.activeDiagram;
    if (!diagram || !this.selection.size) return;
    const payload = extract(diagram, this.selection.list());
    if (!payload.nodes.length) return;
    this.clipboard.set(payload);
    toast(t('toast.copied', { count: payload.nodes.length }));
  }

  cut() {
    this.copy();
    this.deleteSelection({ silent: true });
  }

  paste(point) {
    const diagram = this.activeDiagram;
    const payload = this.clipboard.get();
    if (!diagram || !payload?.nodes?.length) return;
    if (payload.notation !== diagram.notation) {
      toastError(i18n.locale === 'ru' ? 'Элементы из другой нотации' : 'Elements belong to another notation');
      return;
    }
    let dx = 24;
    let dy = 24;
    if (point) {
      const bounds = unionRect(payload.nodes.map(rectOf));
      dx = point.x - bounds.x;
      dy = point.y - bounds.y;
    }
    const { nodes, edges } = instantiate(payload, { dx, dy });
    this.history.run('paste', diagram.id, (doc) => {
      for (const node of nodes) doc.addNode(diagram.id, node);
      for (const edge of edges) doc.addEdge(diagram.id, edge);
    });
    this.canvas.render();
    this.selection.set(nodes.map((node) => node.id));
  }

  duplicateSelection() {
    const diagram = this.activeDiagram;
    if (!diagram || !this.selection.size) return;
    const payload = extract(diagram, this.selection.list());
    const { nodes, edges } = instantiate(payload, { dx: 30, dy: 30 });
    this.history.run('duplicate', diagram.id, (doc) => {
      for (const node of nodes) doc.addNode(diagram.id, node);
      for (const edge of edges) doc.addEdge(diagram.id, edge);
    });
    this.canvas.render();
    this.selection.set(nodes.map((node) => node.id));
  }

  deleteSelection({ silent = false } = {}) {
    const diagram = this.activeDiagram;
    if (!diagram || !this.selection.size) return;
    const ids = this.selection.list();
    const nodeIds = ids.filter((id) => this.doc.node(diagram.id, id));
    const edgeIds = ids.filter((id) => this.doc.edge(diagram.id, id));
    const childDiagrams = this.doc.project.diagrams.filter((d) => nodeIds.includes(d.parentNodeId));
    this.history.run('delete', '*', (doc) => {
      for (const id of nodeIds) {
        for (const edge of doc.edgesOf(diagram.id, id)) doc.removeEdge(diagram.id, edge.id);
        for (const child of doc.childrenOf(diagram.id, id)) doc.updateNode(diagram.id, child.id, { parent: null });
        doc.removeNode(diagram.id, id);
      }
      for (const id of edgeIds) doc.removeEdge(diagram.id, id);
      for (const child of childDiagrams) doc.removeDiagram(child.id);
    });
    this.openTabs = this.openTabs.filter((tab) => this.doc.diagram(tab));
    this.selection.clear();
    this.canvas.render();
    this.explorer.render();
    if (!silent) toast(t('toast.deleted', { count: ids.length }));
  }

  selectAll() {
    const diagram = this.activeDiagram;
    if (!diagram) return;
    this.selection.set([...diagram.nodes.map((node) => node.id), ...diagram.edges.map((edge) => edge.id)]);
  }

  /* --------------------------------------------------------- arrangement */

  align(mode) {
    const diagram = this.activeDiagram;
    if (!diagram) return;
    const nodes = diagram.nodes.filter((node) => this.selection.has(node.id));
    const changes = alignNodes(nodes, mode);
    this._applyChanges(changes, 'align');
  }

  distribute(axis) {
    const diagram = this.activeDiagram;
    if (!diagram) return;
    const nodes = diagram.nodes.filter((node) => this.selection.has(node.id));
    this._applyChanges(distributeNodes(nodes, axis), 'distribute');
  }

  equalizeSize() {
    const diagram = this.activeDiagram;
    if (!diagram) return;
    const nodes = diagram.nodes.filter((node) => this.selection.has(node.id));
    this._applyChanges(equalizeSize(nodes), 'size');
  }

  autoLayout() {
    const diagram = this.activeDiagram;
    if (!diagram) return;
    const changes = [...computeLayout(diagram), ...[]];
    this.history.run('layout', diagram.id, (doc) => {
      for (const change of changes) doc.updateNode(diagram.id, change.id, change);
      for (const change of fitContainers(doc.diagram(diagram.id))) doc.updateNode(diagram.id, change.id, change);
      for (const edge of doc.diagram(diagram.id).edges) {
        edge.routing = 'auto';
        edge.waypoints = [];
      }
    });
    this.canvas.render();
    this.canvas.fitContent();
    toast(t('toast.layout'));
  }

  autoRoute() {
    const diagram = this.activeDiagram;
    if (!diagram) return;
    this.history.run('route', diagram.id, (doc) => {
      for (const edge of doc.diagram(diagram.id).edges) {
        edge.routing = 'auto';
        edge.waypoints = [];
        edge.sourceSide = null;
        edge.targetSide = null;
      }
    });
    this.canvas.render();
  }

  _applyChanges(changes, label) {
    if (!changes.length) {
      toast(t('toast.noSelection'));
      return;
    }
    const diagram = this.activeDiagram;
    this.history.run(label, diagram.id, (doc) => {
      for (const change of changes) doc.updateNode(diagram.id, change.id, change);
    });
    this.canvas.render();
  }

  /* --------------------------------------------------------- validation */

  validate(diagramId) {
    const targets = diagramId ? [this.doc.diagram(diagramId)] : this.activeDiagram ? [this.activeDiagram] : this.doc.project.diagrams;
    const problems = [];
    for (const diagram of targets.filter(Boolean)) {
      const notation = getNotation(diagram.notation);
      problems.push(...notation.validate(diagram, this.doc));
    }
    this.problems = problems;
    this.problemsPanel.setProblems(problems);
    const counts = this.problemsPanel.counts;
    this.el.status.problems.innerHTML = problems.length
      ? `${icon(counts.error ? 'error' : 'warning', 13)} ${t('problems.count', { count: problems.length })}`
      : `${icon('check', 13)} ${t('toast.validationOk')}`;
    if (problems.length) {
      this.toggleSetting('ui.bottomPanel', true);
      toast(t('toast.validationBad', { count: problems.length }), { type: counts.error ? 'error' : '' });
    } else {
      toastSuccess(t('toast.validationOk'));
    }
    return problems;
  }

  revealProblem(problem) {
    if (problem.diagramId && problem.diagramId !== this.activeDiagramId) this.openDiagram(problem.diagramId);
    if (problem.elementId) this.canvas.revealElement(problem.elementId);
  }

  /* -------------------------------------------------------------- search */

  search(query) {
    const lower = String(query).toLowerCase();
    const results = [];
    const match = (value) => String(value || '').toLowerCase().includes(lower);
    for (const diagram of this.doc.project.diagrams) {
      if (match(diagram.name) || match(diagram.meta?.description)) {
        results.push({ kind: 'diagram', id: diagram.id, label: diagram.name, typeName: t('search.diagram'), diagramId: diagram.id, diagramName: diagram.name });
      }
      for (const node of diagram.nodes) {
        if (match(node.label) || match(node.id) || match(node.type) || match(node.props?.description) || match(node.props?.documentation) || match(node.props?.number)) {
          results.push({
            kind: 'node',
            id: node.id,
            label: node.label || node.props?.number || node.id,
            typeName: typeName(diagram.notation, node.type, i18n.locale),
            diagramId: diagram.id,
            diagramName: diagram.name,
          });
        }
      }
      for (const edge of diagram.edges) {
        if (match(edge.label) || match(edge.id) || match(edge.type) || match(edge.props?.condition)) {
          results.push({
            kind: 'edge',
            id: edge.id,
            label: edge.label || edge.id,
            typeName: typeName(diagram.notation, edge.type, i18n.locale),
            diagramId: diagram.id,
            diagramName: diagram.name,
          });
        }
      }
    }
    return results.slice(0, 200);
  }

  gotoSearchResult(result) {
    if (!result) return;
    if (result.kind === 'diagram') {
      this.openDiagram(result.id);
      return;
    }
    this.openDiagram(result.diagramId);
    this.canvas.revealElement(result.id);
  }

  /* --------------------------------------------------------- project I/O */

  createProject({ name, author, start }) {
    this._loadProject(createProject({ name, author }), { fresh: true });
    if (start === 'demo') {
      this._loadProject(createDemoProject(i18n.locale), { fresh: true });
    } else if (start === 'bpmn') {
      this.createDiagram('bpmn', { name: name || undefined });
    } else if (start === 'idef0') {
      this.createDiagram('idef0', { name: 'A-0' });
    }
    if (this.doc.project.diagrams.length) this.openDiagram(this.doc.project.diagrams[0].id);
    else this.showWelcome();
    this.history.clear();
    this.refreshChrome();
  }

  newProject() {
    openNewProject(this);
  }

  openDemoProject() {
    this._loadProject(createDemoProject(i18n.locale), { fresh: true });
    this.openDiagram(this.doc.project.diagrams[0].id);
    this.settings.set('onboarding.demoOffered', true);
    toastSuccess(t('toast.opened'));
  }

  _loadProject(project, { fresh = false } = {}) {
    this.doc.replaceProject(project);
    this.history.clear();
    this.selection.clear();
    this.openTabs = [];
    this.activeDiagramId = null;
    this.canvas.setDiagram(null);
    this.explorer.render();
    this.properties.render();
    this.problems = [];
    this.problemsPanel.setProblems([]);
    if (!fresh) this.history.markSaved();
    rememberProject(project);
    this.refreshChrome();
  }

  async openProjectFile() {
    const file = await pickFile('.fibermodel,.json,.bpmn,.xml');
    if (!file) return;
    try {
      if (/\.(bpmn|xml)$/i.test(file.name)) {
        await this.importBpmn(file);
        return;
      }
      if (/\.json$/i.test(file.name)) {
        const project = projectFromJson(await file.text());
        this._loadProject(project);
      } else {
        const project = await unpackProject(await file.arrayBuffer());
        this._loadProject(project);
      }
      this.fileHandleName = file.name;
      if (this.doc.project.diagrams.length) this.openDiagram(this.doc.project.diagrams[0].id);
      else this.showWelcome();
      toastSuccess(t('toast.opened'));
      await saveProjectRecord(this.doc.project).catch(() => {});
    } catch (error) {
      toastError(t('toast.importFail', { error: error.message }));
    }
  }

  async openRecent(id) {
    try {
      const record = await loadProjectRecord(id);
      if (!record?.project) {
        forgetProject(id);
        toastError(t('toast.importFail', { error: 'not found' }));
        return;
      }
      this._loadProject(record.project);
      if (this.doc.project.diagrams.length) this.openDiagram(this.doc.project.diagrams[0].id);
      toastSuccess(t('toast.opened'));
    } catch (error) {
      toastError(t('toast.importFail', { error: error.message }));
    }
  }

  async saveProject({ as = false } = {}) {
    const project = this.doc.project;
    try {
      await saveProjectRecord(project).catch(() => {});
      rememberProject(project);
      if (as || !this.settings.get('lastSaveWasFile')) {
        const blob = await packProject(project);
        download(blob, safeFileName(project.name, '.fibermodel'));
        this.settings.set('lastSaveWasFile', true);
      } else {
        const blob = await packProject(project);
        download(blob, safeFileName(project.name, '.fibermodel'));
      }
      this.history.markSaved();
      this.refreshChrome();
      toastSuccess(t('toast.saved'));
    } catch (error) {
      toastError(t('toast.error', { error: error.message }));
    }
  }

  saveDocumentation(scope, id, value) {
    if (scope === 'project') {
      this.doc.setProjectMeta({ documentation: value });
    } else if (scope === 'diagram') {
      const diagramId = id || this.activeDiagramId;
      this.history.run('documentation', diagramId, (doc) => doc.updateDiagram(diagramId, { meta: { documentation: value } }));
    } else if (scope === 'element' && this.activeDiagram) {
      const diagramId = this.activeDiagramId;
      this.history.run('documentation', diagramId, (doc) => {
        if (doc.node(diagramId, id)) doc.updateNode(diagramId, id, { props: { documentation: value } });
        else doc.updateEdge(diagramId, id, { props: { documentation: value } });
      });
    }
    this.refreshChrome();
  }

  /* ------------------------------------------------------------ import */

  async importBpmn(existingFile) {
    const file = existingFile || (await pickFile('.bpmn,.xml'));
    if (!file) return;
    try {
      const { diagram, hasLayout } = importBpmnXml(await file.text(), { name: file.name.replace(/\.[^.]+$/, '') });
      if (!hasLayout) {
        for (const change of computeLayout(diagram)) {
          const node = diagram.nodes.find((n) => n.id === change.id);
          if (node) Object.assign(node, change);
        }
      }
      this.history.run('import', '*', (doc) => doc.addDiagram(diagram));
      this.explorer.render();
      this.openDiagram(diagram.id);
      this.canvas.fitContent();
      toastSuccess(t('toast.imported', { count: diagram.nodes.length + diagram.edges.length }));
    } catch (error) {
      toastError(t('toast.importFail', { error: error.message }));
    }
  }

  async importJson() {
    const file = await pickFile('.json');
    if (!file) return;
    try {
      const project = projectFromJson(await file.text());
      const added = [];
      this.history.run('import', '*', (doc) => {
        for (const diagram of project.diagrams) {
          const copy = clone(diagram);
          copy.id = uid(copy.notation);
          added.push(copy);
          doc.addDiagram(copy);
        }
      });
      this.explorer.render();
      if (added.length) this.openDiagram(added[0].id);
      toastSuccess(t('toast.imported', { count: added.length }));
    } catch (error) {
      toastError(t('toast.importFail', { error: error.message }));
    }
  }

  /* ------------------------------------------------------------ export */

  _currentSvg(options = {}) {
    const diagram = this.activeDiagram;
    if (!diagram) return null;
    return exportDiagramSvg(diagram, this.doc, {
      background: this.settings.get('export.background') === 'transparent' ? 'transparent' : '#ffffff',
      margin: this.settings.get('export.margin', 24),
      connectionStyle: this.settings.get('canvas.connectionStyle', 'orthogonal'),
      smooth: this.settings.get('canvas.smoothEdges', true),
      ...options,
    });
  }

  async exportImage(type = 'image/png') {
    const svg = this._currentSvg();
    if (!svg) return;
    try {
      const blob = await svgToRaster(svg, {
        type,
        scale: Number(this.settings.get('export.scale', 2)),
        background: type === 'image/jpeg' ? '#ffffff' : this.settings.get('export.background') === 'transparent' ? null : '#ffffff',
      });
      const extension = type === 'image/jpeg' ? '.jpg' : '.png';
      const name = safeFileName(this.activeDiagram.name, extension);
      download(blob, name);
      toastSuccess(t('toast.exported', { name }));
    } catch (error) {
      toastError(t('toast.error', { error: error.message }));
    }
  }

  exportSvg() {
    const svg = this._currentSvg();
    if (!svg) return;
    const name = safeFileName(this.activeDiagram.name, '.svg');
    downloadText(svg, name, 'image/svg+xml;charset=utf-8');
    toastSuccess(t('toast.exported', { name }));
  }

  async exportPdf({ documentation = false } = {}) {
    const diagram = this.activeDiagram;
    if (!diagram) return;
    try {
      const { svgsToPdf, pageSize } = await import('../io/pdf.js');
      const items = [{ svg: this._currentSvg(), header: `${this.doc.project.name} — ${diagram.name}` }];
      if (documentation) {
        items.push({
          kind: 'text',
          blocks: [
            { text: diagram.name, size: 18, bold: true },
            { text: `${t('props.author')}: ${diagram.meta.author || this.doc.project.meta.author || '—'}`, size: 11 },
            { text: `${t('props.version')}: ${diagram.meta.version || '1.0'} · ${t('props.modified')}: ${new Date(diagram.meta.modified).toLocaleString(i18n.locale)}`, size: 11 },
            { text: '', size: 8 },
            { text: t('doc.diagram'), size: 13, bold: true },
            { text: diagram.meta.documentation || diagram.meta.description || '—', size: 11 },
            { text: '', size: 8 },
            { text: t('doc.element'), size: 13, bold: true },
            ...diagram.nodes
              .filter((node) => node.label || node.props?.documentation)
              .map((node) => ({
                text: `• ${node.label || node.id} — ${typeName(diagram.notation, node.type, i18n.locale)}${
                  node.props?.documentation ? `: ${node.props.documentation}` : ''
                }`,
                size: 11,
              })),
          ],
        });
      }
      const blob = svgsToPdf(items, {
        size: pageSize(this.settings.get('export.pageSize', 'A4'), this.settings.get('export.orientation', 'landscape')),
        meta: { title: diagram.name, author: this.doc.project.meta.author },
      });
      const name = safeFileName(diagram.name, '.pdf');
      download(blob, name);
      toastSuccess(t('toast.exported', { name }));
    } catch (error) {
      toastError(t('toast.error', { error: error.message }));
    }
  }

  async exportProjectPdf() {
    try {
      const { svgsToPdf, pageSize } = await import('../io/pdf.js');
      const items = [];
      for (const diagram of this.doc.project.diagrams) {
        items.push({
          svg: exportDiagramSvg(diagram, this.doc, { background: '#ffffff', margin: 24 }),
          header: `${this.doc.project.name} — ${diagram.name}`,
        });
      }
      if (!items.length) return;
      const blob = svgsToPdf(items, {
        size: pageSize(this.settings.get('export.pageSize', 'A4'), this.settings.get('export.orientation', 'landscape')),
        meta: { title: this.doc.project.name, author: this.doc.project.meta.author },
      });
      const name = safeFileName(this.doc.project.name, '.pdf');
      download(blob, name);
      toastSuccess(t('toast.exported', { name }));
    } catch (error) {
      toastError(t('toast.error', { error: error.message }));
    }
  }

  exportBpmn() {
    const diagram = this.activeDiagram;
    if (!diagram) return;
    if (diagram.notation !== 'bpmn') {
      toastError(i18n.locale === 'ru' ? 'Экспорт в BPMN XML доступен только для BPMN-диаграмм' : 'BPMN XML export works for BPMN diagrams only');
      return;
    }
    const xml = exportBpmnXml(diagram, { connectionStyle: this.settings.get('canvas.connectionStyle', 'orthogonal') });
    const name = safeFileName(diagram.name, '.bpmn');
    downloadText(xml, name, 'application/xml;charset=utf-8');
    toastSuccess(t('toast.exported', { name }));
  }

  exportJson() {
    const name = safeFileName(this.doc.project.name, '.json');
    downloadText(projectToJson(this.doc.project), name, 'application/json;charset=utf-8');
    toastSuccess(t('toast.exported', { name }));
  }

  /* ------------------------------------------------------- generation */

  insertSpec(spec, { name } = {}) {
    const diagrams = buildDiagrams(spec, { locale: i18n.locale, name });
    if (!diagrams.length) return null;
    this.history.run('generate', '*', (doc) => {
      for (const diagram of diagrams) doc.addDiagram(diagram);
    });
    this.explorer.render();
    this.openDiagram(diagrams[0].id);
    this.canvas.fitContent();
    return diagrams;
  }

  async runAutoBuild({ prompt, notation, complexity, provider, target }) {
    try {
      const result = await generateModel({
        prompt,
        notation,
        complexity,
        provider,
        locale: i18n.locale,
        settings: this.settings.get('ai', {}),
      });
      if (result.fallbackFrom) toast(t('autoBuild.fallback'), { type: 'error' });
      if (target === 'replace' && this.activeDiagram) {
        const diagrams = buildDiagrams(result.spec, { locale: i18n.locale });
        const replacement = diagrams[0];
        const diagramId = this.activeDiagramId;
        this.history.run('generate', '*', (doc) => {
          const diagram = doc.diagram(diagramId);
          diagram.nodes = replacement.nodes;
          diagram.edges = replacement.edges;
          diagram.notation = replacement.notation;
          doc.invalidate(diagramId);
          for (const extra of diagrams.slice(1)) {
            extra.parentDiagramId = diagramId;
            doc.addDiagram(extra);
          }
        });
        this.canvas.render();
        this.canvas.fitContent();
        this.explorer.render();
      } else {
        this.insertSpec(result.spec, {});
      }
      toastSuccess(
        result.source === 'template'
          ? i18n.locale === 'ru'
            ? 'Модель построена по шаблону — правьте как обычную диаграмму'
            : 'Built from the closest template — edit it like any diagram'
          : t('toast.layout')
      );
      return result;
    } catch (error) {
      toastError(t('autoBuild.failed', { error: error.message }));
      return null;
    }
  }

  /* ------------------------------------------------------------ dialogs */

  openSettings(section) {
    openSettings(this, section);
  }
  openAutoBuild() {
    openAutoBuild(this);
  }
  openQuickBuild() {
    openQuickBuild(this);
  }
  openTemplates() {
    openTemplates(this, this.activeDiagram?.notation || 'bpmn');
  }
  openPrint() {
    openPrint(this);
  }
  openSearch() {
    openSearch(this);
  }
  openCommandPalette() {
    openCommandPalette(this);
  }
  openProjectProperties() {
    openProjectProperties(this);
  }
  openDocumentation(scope = 'project', id = null) {
    openDocumentation(this, scope, id ?? (scope === 'diagram' ? this.activeDiagramId : this.selection.list()[0]));
  }
  openShortcuts() {
    openShortcuts(this);
  }
  openGuide() {
    openGuide(this);
  }
  openAbout() {
    openAbout(this);
  }

  showWelcome() {
    renderWelcome(this.el.welcome, this);
  }

  hideWelcome() {
    this.el.welcome.hidden = true;
  }

  /* ------------------------------------------------------ context menu */

  showCanvasContextMenu({ id, clientX, clientY, world }) {
    const diagram = this.activeDiagram;
    if (!diagram) return;
    const node = id ? this.doc.node(diagram.id, id) : null;
    const edge = id && !node ? this.doc.edge(diagram.id, id) : null;
    const notation = getNotation(diagram.notation);
    const items = [];

    if (node) {
      const descriptor = notation.nodeTypes[node.type];
      items.push({ label: t('ctx.edit'), action: () => this.interactions.startEdit(node.id) });
      items.push({ label: t('edit.duplicate'), action: () => this.duplicateSelection() });
      const convertGroup = Object.entries(notation.convertGroups).find(([, list]) => list.includes(node.type));
      if (convertGroup) {
        items.push({
          label: t('ctx.changeType'),
          submenu: convertGroup[1].map((typeId) => ({
            label: typeName(diagram.notation, typeId, i18n.locale),
            checked: typeId === node.type,
            action: () => this.changeType(node.id, typeId),
          })),
        });
      }
      items.push({ separator: true });
      if (diagram.notation === 'idef0' && node.type === 'idef0Function') {
        items.push({ label: t('ctx.addInput'), action: () => this.addIdef0Arrow(node, 'input') });
        items.push({ label: t('ctx.addControl'), action: () => this.addIdef0Arrow(node, 'control') });
        items.push({ label: t('ctx.addOutput'), action: () => this.addIdef0Arrow(node, 'output') });
        items.push({ label: t('ctx.addMechanism'), action: () => this.addIdef0Arrow(node, 'mechanism') });
        items.push({ separator: true });
      }
      if (descriptor?.decomposable || node.type === 'idef0Function') {
        items.push({
          label: this.doc.decompositionOf(node.id) ? t('model.openChild') : t('ctx.createSubprocess'),
          action: () => this.openDecomposition(node.id),
        });
      }
      if (diagram.notation === 'bpmn') {
        items.push({ label: t('ctx.addAnnotation'), action: () => this.addAnnotation(node) });
      }
      items.push({ label: t('model.documentation'), action: () => this.openDocumentation('element', node.id) });
      items.push({ separator: true });
      items.push({ label: t('edit.delete'), action: () => this.deleteSelection() });
    } else if (edge) {
      items.push({ label: t('ctx.edit'), action: () => this.interactions.startEdit(edge.id) });
      items.push({
        label: t('ctx.addWaypoint'),
        action: () => this.addWaypoint(edge.id, world),
      });
      items.push({
        label: t('ctx.resetWaypoints'),
        action: () =>
          this.history.run('route', diagram.id, (doc) => doc.updateEdge(diagram.id, edge.id, { routing: 'auto', waypoints: [] })) &&
          this.canvas.render(),
      });
      const convertGroup = Object.keys(notation.edgeTypes);
      if (convertGroup.length > 1) {
        items.push({
          label: t('ctx.changeType'),
          submenu: convertGroup.map((typeId) => ({
            label: typeName(diagram.notation, typeId, i18n.locale),
            checked: typeId === edge.type,
            action: () => this.changeType(edge.id, typeId),
          })),
        });
      }
      items.push({ separator: true });
      items.push({ label: t('edit.delete'), action: () => this.deleteSelection() });
    } else {
      items.push({
        label: t('ctx.create'),
        submenu: Object.values(notation.nodeTypes)
          .filter((type) => type.palette !== false)
          .slice(0, 14)
          .map((type) => ({
            label: localName(type.name, i18n.locale),
            action: () => this.placeElement(type.id, world),
          })),
      });
      if (!this.clipboard.isEmpty) items.push({ label: t('ctx.pasteHere'), action: () => this.paste(world) });
      items.push({ separator: true });
      items.push({ label: t('model.autoLayout'), action: () => this.autoLayout() });
      items.push({ label: t('view.fitScreen'), action: () => this.canvas.fitContent() });
      items.push({ label: t('model.validate'), action: () => this.validate() });
    }
    showContextMenu(items, clientX, clientY);
  }

  addWaypoint(edgeId, world) {
    const diagram = this.activeDiagram;
    const geometry = this.canvas.geometries.get(edgeId);
    if (!diagram || !geometry) return;
    const points = geometry.points.slice(1, -1);
    this.history.run('waypoint', diagram.id, (doc) =>
      doc.updateEdge(diagram.id, edgeId, { routing: 'manual', waypoints: [...points, { x: Math.round(world.x), y: Math.round(world.y) }] })
    );
    this.canvas.render();
  }

  addIdef0Arrow(node, role) {
    const diagram = this.activeDiagram;
    if (!diagram) return;
    const offsets = {
      input: { x: node.x - 240, y: node.y + node.h * 0.3 },
      control: { x: node.x + node.w * 0.3, y: node.y - 120 },
      output: { x: node.x + node.w + 220, y: node.y + node.h * 0.5 },
      mechanism: { x: node.x + node.w * 0.4, y: node.y + node.h + 110 },
    };
    const point = offsets[role] || offsets.input;
    const anchor = makeNode('idef0', 'idef0Anchor', point.x, point.y, { label: '' });
    getNotation('idef0').onCreateNode(anchor, diagram);
    const letter = { input: 'I', control: 'C', output: 'O', mechanism: 'M' }[role];
    const used = diagram.nodes.filter((n) => n.type === 'idef0Anchor' && (n.props?.icom || '').startsWith(letter)).length;
    anchor.props.icom = `${letter}${used + 1}`;
    anchor.props.role = role;
    const edgeType = { input: 'idef0Input', control: 'idef0Control', output: 'idef0Output', mechanism: 'idef0Mechanism' }[role];
    const edge =
      role === 'output'
        ? this._makeEdge(diagram, node, anchor, edgeType)
        : this._makeEdge(diagram, anchor, node, edgeType);
    this.history.run('arrow', diagram.id, (doc) => {
      doc.addNode(diagram.id, anchor);
      doc.addEdge(diagram.id, edge);
    });
    this.canvas.render();
    this.selection.set([anchor.id]);
    this.interactions.startEdit(anchor.id);
  }

  addAnnotation(node) {
    const diagram = this.activeDiagram;
    if (!diagram) return;
    const annotation = makeNode('bpmn', 'textAnnotation', node.x + node.w + 130, node.y - 60, { label: '' });
    const edge = this._makeEdge(diagram, node, annotation, 'association');
    this.history.run('annotation', diagram.id, (doc) => {
      doc.addNode(diagram.id, annotation);
      doc.addEdge(diagram.id, edge);
    });
    this.canvas.render();
    this.selection.set([annotation.id]);
    this.interactions.startEdit(annotation.id);
  }

  onCanvasDoubleClick(world) {
    const diagram = this.activeDiagram;
    if (!diagram) return;
    const notation = getNotation(diagram.notation);
    this.placeElement(notation.defaultNodeType, world);
  }

  /* ------------------------------------------------------------ keyboard */

  handleKey(event) {
    const target = event.target;
    const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
    if (isInput) return;
    if (event.key === 'Escape') {
      closeMenus();
      this.interactions.setTool({ mode: 'select' });
      this.palette.setActiveType(null);
      return;
    }
    for (const command of commandList(this)) {
      if (!command.shortcut) continue;
      if (matchShortcut(event, command.shortcut)) {
        if (command.enabled === false) return;
        event.preventDefault();
        event.stopPropagation();
        command.run();
        return;
      }
    }
    if (!event.metaKey && !event.ctrlKey && !event.altKey) {
      const step = event.shiftKey ? 10 : 1;
      const arrows = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      const delta = arrows[event.key];
      if (delta && this.selection.size && this.activeDiagram) {
        event.preventDefault();
        const diagram = this.activeDiagram;
        const ids = this.selection.list().filter((id) => this.doc.node(diagram.id, id));
        this.history.run('move', diagram.id, (doc) => {
          for (const id of ids) {
            const node = doc.node(diagram.id, id);
            if (node) doc.updateNode(diagram.id, id, { x: node.x + delta[0], y: node.y + delta[1] });
          }
        });
        this.canvas.render();
      } else if (event.key === 'Enter' && this.selection.size === 1) {
        event.preventDefault();
        this.interactions.startEdit(this.selection.list()[0]);
      }
    }
  }

  /* --------------------------------------------------------------- boot */

  async boot() {
    const recovery = await recoveryInfo();
    if (recovery?.projectId) {
      const record = await loadProjectRecord(recovery.projectId).catch(() => null);
      if (record?.project?.diagrams?.length) {
        this._loadProject(record.project);
        this.openDiagram(record.project.diagrams[0].id);
        toast(t('toast.recovered'));
        return;
      }
    }
    this.showWelcome();
  }
}

function childNumber(parentNumber) {
  if (!parentNumber || parentNumber === 'A-0') return 'A0';
  return parentNumber;
}

function suggestNextType(notation, descriptor) {
  if (notation === 'idef0') return 'idef0Function';
  if (!descriptor) return 'task';
  if (descriptor.category === 'gateway') return 'task';
  if (descriptor.category === 'event' && descriptor.kind === 'end') return 'task';
  return 'task';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}
