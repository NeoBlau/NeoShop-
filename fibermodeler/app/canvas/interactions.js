/**
 * All pointer driven editing on the canvas.
 *
 * The module is a small state machine: `this.drag` holds the active gesture,
 * live gestures mutate the model directly (for 60fps feedback) and are turned
 * into a single undo step when the gesture ends.
 */
import { clamp, rectOf, snap as snapValue, unionRect } from '../core/geometry.js';
import { getNotation } from '../notations/index.js';
import { previewRoute } from './routing.js';

const GUIDE_TOLERANCE = 6;
const DRAG_THRESHOLD = 3;

export class CanvasInteractions {
  constructor(canvas, context) {
    this.canvas = canvas;
    this.doc = context.doc;
    this.history = context.history;
    this.selection = context.selection;
    this.settings = context.settings;
    this.app = context.app;
    this.tool = { mode: 'select', type: null };
    this.drag = null;
    this.spaceDown = false;
    this._bind();
  }

  /* ------------------------------------------------------------------ setup */

  _bind() {
    const svg = this.canvas.svg;
    this._onPointerDown = (e) => this.handlePointerDown(e);
    this._onPointerMove = (e) => this.handlePointerMove(e);
    this._onPointerUp = (e) => this.handlePointerUp(e);
    this._onWheel = (e) => this.handleWheel(e);
    this._onDblClick = (e) => this.handleDoubleClick(e);
    this._onContextMenu = (e) => this.handleContextMenu(e);
    this._onKeyDown = (e) => {
      if (e.code === 'Space' && !isTextInput(e.target)) {
        this.spaceDown = true;
        this.canvas.container.classList.add('is-panning');
      }
      if (e.key === 'Escape') this.cancelGesture();
    };
    this._onKeyUp = (e) => {
      if (e.code === 'Space') {
        this.spaceDown = false;
        this.canvas.container.classList.remove('is-panning');
      }
    };

    svg.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('pointermove', this._onPointerMove);
    window.addEventListener('pointerup', this._onPointerUp);
    svg.addEventListener('wheel', this._onWheel, { passive: false });
    svg.addEventListener('dblclick', this._onDblClick);
    svg.addEventListener('contextmenu', this._onContextMenu);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);

    // palette drag & drop
    const root = this.canvas.container;
    root.addEventListener('dragover', (e) => {
      if (!e.dataTransfer?.types.includes('application/x-fibermodeler-type')) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      root.classList.add('is-drop-target');
    });
    root.addEventListener('dragleave', (e) => {
      if (e.target === root) root.classList.remove('is-drop-target');
    });
    root.addEventListener('drop', (e) => {
      const type = e.dataTransfer?.getData('application/x-fibermodeler-type');
      root.classList.remove('is-drop-target');
      if (!type) return;
      e.preventDefault();
      const world = this.canvas.screenToWorld({ x: e.clientX, y: e.clientY });
      this.app.placeElement(type, this.snapPoint(world));
    });
  }

  destroy() {
    const svg = this.canvas.svg;
    svg.removeEventListener('pointerdown', this._onPointerDown);
    window.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('pointerup', this._onPointerUp);
    svg.removeEventListener('wheel', this._onWheel);
    svg.removeEventListener('dblclick', this._onDblClick);
    svg.removeEventListener('contextmenu', this._onContextMenu);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
  }

  setTool(tool) {
    this.tool = { mode: 'select', type: null, ...tool };
    this.canvas.container.dataset.tool = this.tool.mode;
    this.canvas.emit('tool', this.tool);
  }

  /* ------------------------------------------------------------- utilities */

  get diagram() {
    return this.canvas.diagram;
  }

  get notation() {
    return this.diagram ? getNotation(this.diagram.notation) : getNotation('bpmn');
  }

  snapPoint(point) {
    if (!this.settings.get('canvas.snap', true)) return point;
    const step = this.settings.get('canvas.gridSize', 10);
    return { x: snapValue(point.x, step), y: snapValue(point.y, step) };
  }

  worldOf(event) {
    return this.canvas.screenToWorld({ x: event.clientX, y: event.clientY });
  }

  cancelGesture() {
    if (this.drag?.token) this.history.cancelLive(this.drag.token);
    this.drag = null;
    this.canvas.clearOverlay();
    this.canvas.render();
    if (this.tool.mode !== 'select') this.setTool({ mode: 'select' });
  }

  /* --------------------------------------------------------------- pointer */

  handlePointerDown(event) {
    if (event.button === 2) return; // context menu handled separately
    if (!this.diagram) return;
    const world = this.worldOf(event);
    const start = { x: event.clientX, y: event.clientY };

    // panning
    if (event.button === 1 || this.spaceDown || this.tool.mode === 'pan') {
      this.drag = { type: 'pan', start, tx: this.canvas.tx, ty: this.canvas.ty };
      this.canvas.container.classList.add('is-panning');
      event.preventDefault();
      return;
    }

    // placing a new element with the palette tool
    if (this.tool.mode === 'place') {
      event.preventDefault();
      this.app.placeElement(this.tool.type, this.snapPoint(world));
      if (!event.shiftKey) this.setTool({ mode: 'select' });
      return;
    }

    const overlayTarget = event.target.closest?.('[data-handle], [data-quick], .ov-waypoint, .ov-endpoint');
    if (overlayTarget) {
      event.preventDefault();
      if (overlayTarget.dataset.handle) return this.startResize(overlayTarget.dataset.handle, start);
      if (overlayTarget.dataset.quick) return this.startQuick(overlayTarget.dataset.quick, start, world);
      if (overlayTarget.classList.contains('ov-waypoint')) {
        return this.startWaypointDrag(overlayTarget.dataset.edge, Number(overlayTarget.dataset.index), start);
      }
      if (overlayTarget.classList.contains('ov-endpoint')) {
        return this.startEndpointDrag(overlayTarget.dataset.edge, overlayTarget.dataset.end, start);
      }
    }

    const hitId = this.canvas.elementIdAt(event);
    const node = hitId ? this.diagram.nodes.find((x) => x.id === hitId) : null;
    const edge = hitId && !node ? this.diagram.edges.find((x) => x.id === hitId) : null;

    // connection tool
    if (this.tool.mode === 'connect') {
      if (node) return this.startConnect(node, start, world, this.tool.type);
      this.setTool({ mode: 'select' });
      return;
    }

    if (node) {
      const additive = event.shiftKey || event.metaKey || event.ctrlKey;
      if (additive) this.selection.toggle(node.id);
      else if (!this.selection.has(node.id)) this.selection.set([node.id]);
      if (this.selection.has(node.id)) this.startNodeDrag(node, start, world);
      event.preventDefault();
      return;
    }

    if (edge) {
      const additive = event.shiftKey || event.metaKey || event.ctrlKey;
      if (additive) this.selection.toggle(edge.id);
      else this.selection.set([edge.id]);
      event.preventDefault();
      return;
    }

    // empty canvas: marquee selection
    if (!event.shiftKey && !event.metaKey && !event.ctrlKey) this.selection.clear();
    this.drag = { type: 'marquee', start, additive: event.shiftKey || event.metaKey || event.ctrlKey, base: this.selection.list() };
    event.preventDefault();
  }

  handlePointerMove(event) {
    const drag = this.drag;
    if (!drag) {
      this.updateHover(event);
      this.canvas.emit('pointer', this.worldOf(event));
      return;
    }
    const dx = event.clientX - drag.start.x;
    const dy = event.clientY - drag.start.y;
    if (!drag.active && Math.hypot(dx, dy) < DRAG_THRESHOLD && drag.type !== 'pan') return;
    drag.active = true;

    switch (drag.type) {
      case 'pan':
        this.canvas.setViewport(drag.tx + dx, drag.ty + dy, this.canvas.zoom);
        break;
      case 'marquee':
        this.canvas.setOverlay({
          marquee: { x1: drag.start.x - this.canvas.rect.left, y1: drag.start.y - this.canvas.rect.top, x2: event.clientX - this.canvas.rect.left, y2: event.clientY - this.canvas.rect.top },
        });
        this.previewMarquee(drag, event);
        break;
      case 'node':
        this.updateNodeDrag(drag, event);
        break;
      case 'resize':
        this.updateResize(drag, event);
        break;
      case 'connect':
        this.updateConnect(drag, event);
        break;
      case 'waypoint':
        this.updateWaypointDrag(drag, event);
        break;
      case 'endpoint':
        this.updateEndpointDrag(drag, event);
        break;
      default:
        break;
    }
  }

  handlePointerUp(event) {
    const drag = this.drag;
    this.canvas.container.classList.remove('is-panning');
    if (!drag) return;
    this.drag = null;
    switch (drag.type) {
      case 'marquee':
        this.finishMarquee(drag, event);
        break;
      case 'node':
        this.finishNodeDrag(drag);
        break;
      case 'resize':
        this.finishResize(drag);
        break;
      case 'connect':
        this.finishConnect(drag, event);
        break;
      case 'waypoint':
      case 'endpoint':
        this.history.commitLive(drag.token);
        this.canvas.setOverlay({ guides: [] });
        this.canvas.refreshEdges();
        break;
      default:
        break;
    }
    this.canvas.setOverlay({ marquee: null, preview: null, guides: [], dropTarget: null });
  }

  updateHover(event) {
    if (!this.diagram) return;
    const id = this.canvas.elementIdAt(event);
    const node = id ? this.diagram.nodes.find((x) => x.id === id) : null;
    const current = this.canvas._overlayState.hover;
    if ((current?.id || null) !== (node?.id || null)) this.canvas.setOverlay({ hover: node || null });
  }

  handleWheel(event) {
    event.preventDefault();
    if (event.ctrlKey || event.metaKey || !event.shiftKey) {
      const factor = Math.exp(-event.deltaY * 0.0016);
      this.canvas.setZoom(this.canvas.zoom * factor, { x: event.clientX, y: event.clientY });
    } else {
      this.canvas.panBy(-event.deltaX, -event.deltaY);
    }
  }

  handleDoubleClick(event) {
    if (!this.diagram) return;
    const id = this.canvas.elementIdAt(event);
    if (!id) {
      this.app.onCanvasDoubleClick?.(this.snapPoint(this.worldOf(event)));
      return;
    }
    const node = this.diagram.nodes.find((x) => x.id === id);
    if (node && event.altKey) {
      this.app.openDecomposition(node.id);
      return;
    }
    this.startEdit(id);
  }

  handleContextMenu(event) {
    event.preventDefault();
    if (!this.diagram) return;
    const id = this.canvas.elementIdAt(event);
    if (id && !this.selection.has(id)) this.selection.set([id]);
    this.canvas.emit('contextmenu', {
      id: id || null,
      clientX: event.clientX,
      clientY: event.clientY,
      world: this.worldOf(event),
    });
  }

  /* ---------------------------------------------------------------- marquee */

  previewMarquee(drag, event) {
    const a = this.canvas.screenToWorld(drag.start);
    const b = this.worldOf(event);
    const rect = normalizeRect(a, b);
    const ids = [
      ...this.canvas.nodesInRect(rect).map((x) => x.id),
      ...this.canvas.edgesInRect(rect),
    ];
    this.selection.set(drag.additive ? [...new Set([...drag.base, ...ids])] : ids);
  }

  finishMarquee(drag, event) {
    if (drag.active) this.previewMarquee(drag, event);
    this.canvas.setOverlay({ marquee: null });
  }

  /* ------------------------------------------------------------- node drag */

  startNodeDrag(node, start, world) {
    const ids = this.selection.list().filter((id) => this.diagram.nodes.some((nd) => nd.id === id));
    const nodes = this.diagram.nodes.filter((nd) => ids.includes(nd.id));
    // dragging a container moves its children too
    const notation = this.notation;
    const withChildren = new Set(nodes.map((nd) => nd.id));
    let added = true;
    while (added) {
      added = false;
      for (const nd of this.diagram.nodes) {
        if (!withChildren.has(nd.id) && nd.parent && withChildren.has(nd.parent)) {
          withChildren.add(nd.id);
          added = true;
        }
      }
    }
    const moving = new Set(withChildren);
    this.drag = {
      type: 'node',
      start,
      world,
      primary: node.id,
      token: this.history.beginLive('move', this.diagram.id),
      items: [...withChildren].map((id) => {
        const nd = this.diagram.nodes.find((x) => x.id === id);
        return { id, x: nd.x, y: nd.y };
      }),
      // only the edges touching the moved nodes need re-routing on every frame
      edgeIds: this.diagram.edges.filter((e) => moving.has(e.source) || moving.has(e.target)).map((e) => e.id),
      notation,
    };
  }

  updateNodeDrag(drag, event) {
    const world = this.worldOf(event);
    let dx = world.x - drag.world.x;
    let dy = world.y - drag.world.y;
    if (event.shiftKey) {
      if (Math.abs(dx) > Math.abs(dy)) dy = 0;
      else dx = 0;
    }
    const primary = drag.items.find((it) => it.id === drag.primary);
    let offsetX = dx;
    let offsetY = dy;
    if (this.settings.get('canvas.snap', true) && primary) {
      const step = this.settings.get('canvas.gridSize', 10);
      offsetX = snapValue(primary.x + dx, step) - primary.x;
      offsetY = snapValue(primary.y + dy, step) - primary.y;
    }

    const moving = new Set(drag.items.map((it) => it.id));
    const guides = [];
    if (this.settings.get('canvas.guides', true) && primary) {
      const node = this.doc.node(this.diagram.id, primary.id);
      const candidate = { x: primary.x + offsetX, y: primary.y + offsetY, w: node.w, h: node.h };
      const adjust = this.computeGuides(candidate, moving, guides);
      offsetX += adjust.dx;
      offsetY += adjust.dy;
    }

    for (const item of drag.items) {
      const node = this.doc.node(this.diagram.id, item.id);
      if (!node) continue;
      node.x = Math.round(item.x + offsetX);
      node.y = Math.round(item.y + offsetY);
      this.canvas.refreshNode(item.id);
    }
    this.canvas.refreshEdges(drag.edgeIds);

    let dropTarget = null;
    if (drag.items.length && this.notation.containerAt) {
      const node = this.doc.node(this.diagram.id, drag.primary);
      const container = this.notation.containerAt(this.diagram, rectOf(node), moving);
      if (container) dropTarget = rectOf(container);
      drag.container = container || null;
    }
    this.canvas.setOverlay({ guides, dropTarget });
  }

  computeGuides(candidate, moving, guides) {
    const tol = GUIDE_TOLERANCE / this.canvas.zoom;
    let dx = 0;
    let dy = 0;
    let bestX = tol;
    let bestY = tol;
    const cx = candidate.x + candidate.w / 2;
    const cy = candidate.y + candidate.h / 2;
    for (const other of this.diagram.nodes) {
      if (moving.has(other.id)) continue;
      const ox = [other.x, other.x + other.w / 2, other.x + other.w];
      const oy = [other.y, other.y + other.h / 2, other.y + other.h];
      for (const value of ox) {
        for (const mine of [candidate.x, cx, candidate.x + candidate.w]) {
          const delta = value - mine;
          if (Math.abs(delta) < bestX) {
            bestX = Math.abs(delta);
            dx = delta;
          }
        }
      }
      for (const value of oy) {
        for (const mine of [candidate.y, cy, candidate.y + candidate.h]) {
          const delta = value - mine;
          if (Math.abs(delta) < bestY) {
            bestY = Math.abs(delta);
            dy = delta;
          }
        }
      }
    }
    if (dx) guides.push({ x: candidate.x + candidate.w / 2 + dx });
    if (dy) guides.push({ y: candidate.y + candidate.h / 2 + dy });
    return { dx, dy };
  }

  finishNodeDrag(drag) {
    if (!drag.active) {
      this.history.cancelLive(drag.token);
      return;
    }
    if (drag.container !== undefined) {
      const node = this.doc.node(this.diagram.id, drag.primary);
      if (node) node.parent = drag.container ? drag.container.id : null;
    }
    this.doc.touch();
    this.history.commitLive(drag.token);
    this.canvas.refreshEdges();
    this.canvas.renderOverlay();
    this.doc.emit('change', { type: 'node-update', diagramId: this.diagram.id, ids: drag.items.map((i) => i.id) });
  }

  /* ----------------------------------------------------------------- resize */

  startResize(handle, start) {
    const id = this.selection.list()[0];
    const node = this.doc.node(this.diagram.id, id);
    if (!node) return;
    this.drag = {
      type: 'resize',
      handle,
      start,
      id,
      origin: { x: node.x, y: node.y, w: node.w, h: node.h },
      edgeIds: this.diagram.edges.filter((e) => e.source === id || e.target === id).map((e) => e.id),
      token: this.history.beginLive('resize', this.diagram.id),
    };
  }

  updateResize(drag, event) {
    const node = this.doc.node(this.diagram.id, drag.id);
    if (!node) return;
    const descriptor = this.notation.nodeTypes[node.type];
    const min = descriptor?.minSize || { w: 30, h: 24 };
    const world = this.worldOf(event);
    const startWorld = this.canvas.screenToWorld(drag.start);
    let dx = world.x - startWorld.x;
    let dy = world.y - startWorld.y;
    const o = drag.origin;
    let { x, y, w, h } = o;
    if (drag.handle.includes('e')) w = o.w + dx;
    if (drag.handle.includes('s')) h = o.h + dy;
    if (drag.handle.includes('w')) {
      x = o.x + dx;
      w = o.w - dx;
    }
    if (drag.handle.includes('n')) {
      y = o.y + dy;
      h = o.h - dy;
    }
    if (descriptor?.keepSquare || event.shiftKey) {
      const size = Math.max(w, h);
      if (drag.handle.includes('w')) x = o.x + o.w - size;
      if (drag.handle.includes('n')) y = o.y + o.h - size;
      w = size;
      h = size;
    }
    if (this.settings.get('canvas.snap', true)) {
      const step = this.settings.get('canvas.gridSize', 10);
      w = snapValue(w, step);
      h = snapValue(h, step);
      x = snapValue(x, step);
      y = snapValue(y, step);
    }
    node.w = Math.max(min.w, Math.round(w));
    node.h = Math.max(min.h, Math.round(h));
    node.x = Math.round(x);
    node.y = Math.round(y);
    this.canvas.refreshNode(node.id);
    this.canvas.refreshEdges(drag.edgeIds);
    this.canvas.renderOverlay();
  }

  finishResize(drag) {
    if (!drag.active) {
      this.history.cancelLive(drag.token);
      return;
    }
    this.history.commitLive(drag.token);
    this.doc.emit('change', { type: 'node-update', diagramId: this.diagram.id, ids: [drag.id] });
  }

  /* ---------------------------------------------------------------- connect */

  startQuick(direction, start, world) {
    const id = this.selection.list()[0];
    const node = this.doc.node(this.diagram.id, id);
    if (!node) return;
    this.drag = { type: 'connect', start, source: node, direction, quick: true, edgeType: null };
  }

  startConnect(node, start, world, edgeType) {
    this.drag = { type: 'connect', start, source: node, edgeType: edgeType || null };
  }

  updateConnect(drag, event) {
    const world = this.worldOf(event);
    const target = this.canvas.nodeAtWorld(world, new Set([drag.source.id]));
    const side = drag.direction ? { right: 'right', left: 'left', up: 'top', down: 'bottom' }[drag.direction] : null;
    let invalid = false;
    if (target) {
      const type = drag.edgeType || this.notation.defaultEdgeType(this.diagram, drag.source, target);
      invalid = !this.notation.canConnect(this.diagram, drag.source, target, type).ok;
    }
    const points = previewRoute(rectOf(drag.source), side, world, target ? rectOf(target) : null);
    drag.target = target;
    this.canvas.setOverlay({ preview: { points, invalid }, hover: target || null });
  }

  finishConnect(drag, event) {
    const world = this.worldOf(event);
    const target = this.canvas.nodeAtWorld(world, new Set([drag.source.id]));
    this.canvas.setOverlay({ preview: null });
    if (!drag.active && drag.quick) {
      this.app.quickCreate(drag.source, drag.direction);
      return;
    }
    if (!target) {
      if (drag.active && drag.quick) this.app.quickCreate(drag.source, drag.direction, world);
      return;
    }
    this.app.connect(drag.source, target, drag.edgeType);
  }

  /* -------------------------------------------------------------- waypoints */

  startWaypointDrag(edgeId, index, start) {
    const edge = this.doc.edge(this.diagram.id, edgeId);
    const geom = this.canvas.geometries.get(edgeId);
    if (!edge || !geom) return;
    if (edge.routing !== 'manual' || !edge.waypoints?.length) {
      edge.routing = 'manual';
      edge.waypoints = geom.points.slice(1, -1).map((p) => ({ x: p.x, y: p.y }));
    }
    this.drag = { type: 'waypoint', edgeId, index, start, token: this.history.beginLive('waypoint', this.diagram.id) };
  }

  updateWaypointDrag(drag, event) {
    const edge = this.doc.edge(this.diagram.id, drag.edgeId);
    if (!edge?.waypoints?.[drag.index]) return;
    const world = this.snapPoint(this.worldOf(event));
    edge.waypoints[drag.index] = { x: Math.round(world.x), y: Math.round(world.y) };
    this.canvas.refreshEdges([drag.edgeId]);
    this.canvas.renderOverlay();
  }

  startEndpointDrag(edgeId, end, start) {
    const edge = this.doc.edge(this.diagram.id, edgeId);
    if (!edge) return;
    this.drag = {
      type: 'endpoint',
      edgeId,
      end,
      start,
      original: edge[end],
      token: this.history.beginLive('reconnect', this.diagram.id),
    };
  }

  updateEndpointDrag(drag, event) {
    const world = this.worldOf(event);
    const edge = this.doc.edge(this.diagram.id, drag.edgeId);
    if (!edge) return;
    const other = drag.end === 'source' ? edge.target : edge.source;
    const node = this.canvas.nodeAtWorld(world, new Set([other]));
    this.canvas.setOverlay({ hover: node || null });
    if (!node || node.id === edge[drag.end]) return;
    const source = drag.end === 'source' ? node : this.doc.node(this.diagram.id, edge.source);
    const target = drag.end === 'target' ? node : this.doc.node(this.diagram.id, edge.target);
    if (!this.notation.canConnect(this.diagram, source, target, edge.type).ok) return;
    edge[drag.end] = node.id;
    edge.routing = 'auto';
    edge.waypoints = [];
    this.canvas.refreshEdges();
    this.canvas.renderOverlay();
  }

  /* ------------------------------------------------------------ inline edit */

  startEdit(elementId) {
    const diagram = this.diagram;
    if (!diagram) return;
    const node = diagram.nodes.find((x) => x.id === elementId);
    const edge = node ? null : diagram.edges.find((x) => x.id === elementId);
    const element = node || edge;
    if (!element) return;
    this.finishEdit();

    const editor = document.createElement('textarea');
    editor.className = 'inline-editor';
    editor.value = element.label || '';
    editor.spellcheck = false;
    const place = () => {
      const rect = node
        ? this.canvas._screenRect(rectOf(node))
        : (() => {
            const geom = this.canvas.geometries.get(edge.id);
            const p = this.canvas.worldToScreen(geom?.labelPoint || { x: 0, y: 0 });
            return { x: p.x - 70, y: p.y - 24, w: 140, h: 26 };
          })();
      const descriptor = this.notation.nodeTypes[element.type];
      const outside = descriptor?.labelPlacement === 'outside';
      editor.style.left = `${rect.x + (outside ? -30 : 4)}px`;
      editor.style.top = `${rect.y + (outside ? rect.h + 2 : 4)}px`;
      editor.style.width = `${Math.max(90, rect.w + (outside ? 60 : -8))}px`;
      editor.style.height = `${Math.max(24, outside ? 30 : rect.h - 8)}px`;
      editor.style.fontSize = `${Math.max(10, 12.5 * this.canvas.zoom)}px`;
    };
    place();
    this.canvas.container.appendChild(editor);
    this._editor = { editor, elementId, isNode: !!node };

    const commit = () => {
      const value = editor.value.trim();
      this.finishEdit();
      if (value === (element.label || '')) return;
      this.history.run('label', diagram.id, (doc) => {
        if (node) doc.updateNode(diagram.id, elementId, { label: value });
        else doc.updateEdge(diagram.id, elementId, { label: value });
      });
      this.canvas.render();
      this.app.refreshProperties?.();
    };
    // focus on the next frame: the browser moves focus back to the canvas at
    // the end of the pointer event that opened the editor
    requestAnimationFrame(() => {
      if (this._editor?.editor !== editor) return;
      editor.focus();
      editor.select();
      editor.addEventListener('blur', commit);
    });
    editor.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        editor.value = element.label || '';
        editor.blur();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        editor.blur();
      }
    });
  }

  finishEdit() {
    if (!this._editor) return;
    const { editor } = this._editor;
    this._editor = null;
    editor.remove();
  }
}

function normalizeRect(a, b) {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
}

function isTextInput(el) {
  return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
}
