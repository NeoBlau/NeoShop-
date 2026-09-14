/**
 * The diagram canvas: scene graph, viewport, incremental rendering and the
 * screen-space overlay (selection, handles, guides, previews).
 */
import { Emitter } from '../core/events.js';
import { clamp, inflate, rectOf, unionRect } from '../core/geometry.js';
import { getNotation } from '../notations/index.js';
import { diagramMarkup, edgeElementHtml, edgeMarkup, nodeElementHtml, nodeMarkup, sortedNodes } from './renderer.js';
import { layoutEdges } from './routing.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 5;

let instanceCounter = 0;

export class DiagramCanvas extends Emitter {
  constructor(container, context) {
    super();
    this.container = container;
    this.doc = context.doc;
    this.settings = context.settings;
    this.selection = context.selection;
    this.uid = `c${++instanceCounter}`;
    this.diagramId = null;
    this.zoom = 1;
    this.tx = 0;
    this.ty = 0;
    this.geometries = new Map();
    this.nodeEls = new Map();
    this.edgeEls = new Map();
    this._overlayState = { guides: [], preview: null, marquee: null, hover: null, dropTarget: null };
    this._build();
    this._bindResize();
  }

  /* ------------------------------------------------------------- building */

  _build() {
    this.container.classList.add('canvas-root');
    this.container.innerHTML = `
      <svg class="canvas-svg" xmlns="${SVG_NS}">
        <defs>
          <pattern id="${this.uid}-grid-fine" patternUnits="userSpaceOnUse" width="10" height="10">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="var(--grid-fine)" stroke-width="1"/>
          </pattern>
          <pattern id="${this.uid}-grid" patternUnits="userSpaceOnUse" width="100" height="100">
            <rect width="100" height="100" fill="url(#${this.uid}-grid-fine)"/>
            <path d="M 100 0 L 0 0 0 100" fill="none" stroke="var(--grid-strong)" stroke-width="1"/>
          </pattern>
        </defs>
        <rect class="canvas-grid" x="0" y="0" width="100%" height="100%" fill="url(#${this.uid}-grid)"/>
        <g class="viewport">
          <g class="layer-back"></g>
          <g class="layer-edges"></g>
          <g class="layer-nodes"></g>
        </g>
        <g class="layer-overlay"></g>
      </svg>
      <div class="canvas-empty" hidden></div>
    `;
    this.svg = this.container.querySelector('.canvas-svg');
    this.gridRect = this.container.querySelector('.canvas-grid');
    this.viewport = this.container.querySelector('.viewport');
    this.layerBack = this.container.querySelector('.layer-back');
    this.layerEdges = this.container.querySelector('.layer-edges');
    this.layerNodes = this.container.querySelector('.layer-nodes');
    this.layerOverlay = this.container.querySelector('.layer-overlay');
    this.emptyState = this.container.querySelector('.canvas-empty');
  }

  _bindResize() {
    if (typeof ResizeObserver === 'undefined') return;
    this._ro = new ResizeObserver(() => {
      this.emit('resize');
      this.renderOverlay();
    });
    this._ro.observe(this.container);
  }

  destroy() {
    this._ro?.disconnect();
    this.removeAllListeners();
  }

  /* ------------------------------------------------------------- viewport */

  get diagram() {
    return this.diagramId ? this.doc.diagram(this.diagramId) : null;
  }

  get rect() {
    return this.svg.getBoundingClientRect();
  }

  screenToWorld(point) {
    const r = this.rect;
    return { x: (point.x - r.left - this.tx) / this.zoom, y: (point.y - r.top - this.ty) / this.zoom };
  }

  worldToScreen(point) {
    return { x: point.x * this.zoom + this.tx, y: point.y * this.zoom + this.ty };
  }

  setViewport(tx, ty, zoom, { silent = false } = {}) {
    this.tx = tx;
    this.ty = ty;
    this.zoom = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
    this.viewport.setAttribute('transform', `translate(${this.tx},${this.ty}) scale(${this.zoom})`);
    const size = this.settings.get('canvas.gridSize', 10) * 10;
    this.gridRect.setAttribute('fill', this.settings.get('canvas.grid', true) ? `url(#${this.uid}-grid)` : 'none');
    const fine = this.container.querySelector(`#${this.uid}-grid-fine`);
    const coarse = this.container.querySelector(`#${this.uid}-grid`);
    const step = this.settings.get('canvas.gridSize', 10);
    fine.setAttribute('width', step);
    fine.setAttribute('height', step);
    fine.querySelector('path').setAttribute('d', `M ${step} 0 L 0 0 0 ${step}`);
    coarse.setAttribute('width', size);
    coarse.setAttribute('height', size);
    coarse.querySelector('rect').setAttribute('width', size);
    coarse.querySelector('rect').setAttribute('height', size);
    coarse.querySelector('path').setAttribute('d', `M ${size} 0 L 0 0 0 ${size}`);
    coarse.setAttribute('patternTransform', `translate(${this.tx},${this.ty}) scale(${this.zoom})`);
    this.renderOverlay();
    if (!silent) {
      this.emit('viewport', { tx: this.tx, ty: this.ty, zoom: this.zoom });
      this._persistView();
    }
  }

  _persistView() {
    if (!this.diagramId) return;
    const diagram = this.diagram;
    if (diagram) diagram.view = { x: this.tx, y: this.ty, zoom: this.zoom, saved: true };
  }

  panBy(dx, dy) {
    this.setViewport(this.tx + dx, this.ty + dy, this.zoom);
  }

  setZoom(zoom, anchorScreen) {
    const r = this.rect;
    const anchor = anchorScreen || { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    const before = this.screenToWorld(anchor);
    const next = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
    const tx = anchor.x - r.left - before.x * next;
    const ty = anchor.y - r.top - before.y * next;
    this.setViewport(tx, ty, next);
  }

  zoomIn(anchor) {
    this.setZoom(this.zoom * 1.2, anchor);
  }

  zoomOut(anchor) {
    this.setZoom(this.zoom / 1.2, anchor);
  }

  resetZoom() {
    this.setZoom(1);
  }

  contentBounds() {
    const diagram = this.diagram;
    if (!diagram || !diagram.nodes.length) return null;
    const rects = diagram.nodes.map(rectOf);
    for (const geom of this.geometries.values()) {
      for (const p of geom.points) rects.push({ x: p.x, y: p.y, w: 0, h: 0 });
    }
    return unionRect(rects);
  }

  zoomToRect(target, padding = 60) {
    const r = this.rect;
    if (!target || !r.width) return;
    const box = inflate(target, padding);
    const zoom = clamp(Math.min(r.width / box.w, r.height / box.h), MIN_ZOOM, MAX_ZOOM);
    const tx = (r.width - box.w * zoom) / 2 - box.x * zoom;
    const ty = (r.height - box.h * zoom) / 2 - box.y * zoom;
    this.setViewport(tx, ty, zoom);
  }

  fitContent() {
    const bounds = this.contentBounds();
    if (bounds) this.zoomToRect(bounds);
    else this.setViewport(0, 0, 1);
  }

  fitSelection() {
    const diagram = this.diagram;
    if (!diagram) return;
    const rects = diagram.nodes.filter((nd) => this.selection.has(nd.id)).map(rectOf);
    if (rects.length) this.zoomToRect(unionRect(rects), 120);
    else this.fitContent();
  }

  centerOn(worldPoint, zoom = this.zoom) {
    const r = this.rect;
    this.setViewport(r.width / 2 - worldPoint.x * zoom, r.height / 2 - worldPoint.y * zoom, zoom);
  }

  revealElement(id, { select = true, zoom } = {}) {
    const diagram = this.diagram;
    if (!diagram) return;
    const node = diagram.nodes.find((nd) => nd.id === id);
    const edge = node ? null : diagram.edges.find((e) => e.id === id);
    if (node) {
      this.centerOn({ x: node.x + node.w / 2, y: node.y + node.h / 2 }, zoom ?? Math.max(this.zoom, 0.8));
    } else if (edge) {
      const geom = this.geometries.get(edge.id);
      if (geom?.labelPoint) this.centerOn(geom.labelPoint, zoom ?? Math.max(this.zoom, 0.8));
    }
    if (select) this.selection.set([id]);
  }

  /* -------------------------------------------------------------- rendering */

  setDiagram(diagramId) {
    this.diagramId = diagramId;
    const diagram = this.diagram;
    this.selection.clear();
    this.render();
    const savedView = diagram?.view;
    if (savedView?.saved) {
      this.setViewport(savedView.x, savedView.y, savedView.zoom || 1, { silent: true });
      this.emit('viewport', { tx: this.tx, ty: this.ty, zoom: this.zoom });
    } else {
      this.fitContent();
      // the panels may still be laying out on the first paint
      requestAnimationFrame(() => {
        if (this.diagramId === diagramId && !this.diagram?.view?.saved) this.fitContent();
      });
    }
    this.emit('diagram', diagram);
  }

  recomputeGeometry() {
    const diagram = this.diagram;
    if (!diagram) {
      this.geometries = new Map();
      return;
    }
    this.geometries = layoutEdges(diagram, {
      connectionStyle: this.settings.get('canvas.connectionStyle', 'orthogonal'),
    });
  }

  render() {
    const diagram = this.diagram;
    this.nodeEls.clear();
    this.edgeEls.clear();
    if (!diagram) {
      this.layerBack.innerHTML = '';
      this.layerEdges.innerHTML = '';
      this.layerNodes.innerHTML = '';
      this.renderOverlay();
      this.updateEmptyState();
      return;
    }
    this.recomputeGeometry();
    const decomposedIds = new Set(
      this.doc.project.diagrams.filter((d) => d.parentNodeId).map((d) => d.parentNodeId)
    );
    const markup = diagramMarkup(diagram, this.geometries, {
      decomposedIds,
      smooth: this.settings.get('canvas.smoothEdges', true),
    });
    this.layerBack.innerHTML = markup.back;
    this.layerEdges.innerHTML = markup.edges;
    this.layerNodes.innerHTML = markup.front;
    for (const el of this.container.querySelectorAll('.node')) this.nodeEls.set(el.dataset.id, el);
    for (const el of this.container.querySelectorAll('.edge')) this.edgeEls.set(el.dataset.id, el);
    this.updateEmptyState();
    this.renderOverlay();
    this.emit('render');
  }

  updateEmptyState() {
    const diagram = this.diagram;
    const empty = !diagram || diagram.nodes.length === 0;
    this.emptyState.hidden = !empty;
    this.emit('empty-state', { empty, hasDiagram: !!diagram });
  }

  /** Re-renders a single node in place (cheap - used while dragging). */
  refreshNode(id) {
    const diagram = this.diagram;
    if (!diagram) return;
    const node = diagram.nodes.find((nd) => nd.id === id);
    const el = this.nodeEls.get(id);
    if (!node) {
      el?.remove();
      this.nodeEls.delete(id);
      return;
    }
    const notation = getNotation(diagram.notation);
    const descriptor = notation.nodeTypes[node.type];
    if (!el) {
      this.render();
      return;
    }
    el.setAttribute('transform', `translate(${node.x},${node.y})`);
    el.dataset.type = node.type;
    const decomposed = !!this.doc.decompositionOf(node.id);
    el.innerHTML = nodeMarkup(node, descriptor, { decomposed });
  }

  refreshEdge(id) {
    const diagram = this.diagram;
    if (!diagram) return;
    const edge = diagram.edges.find((e) => e.id === id);
    const el = this.edgeEls.get(id);
    if (!edge) {
      el?.remove();
      this.edgeEls.delete(id);
      return;
    }
    if (!el) {
      this.render();
      return;
    }
    const notation = getNotation(diagram.notation);
    el.dataset.type = edge.type;
    el.innerHTML = edgeMarkup(edge, this.geometries.get(edge.id), notation.edgeTypes[edge.type], {
      smooth: this.settings.get('canvas.smoothEdges', true),
    });
  }

  /** Recomputes routing and repaints every edge (after a move / resize). */
  refreshEdges(ids) {
    this.recomputeGeometry();
    const list = ids || [...this.edgeEls.keys()];
    for (const id of list) this.refreshEdge(id);
  }

  /* --------------------------------------------------------------- overlay */

  setOverlay(patch) {
    Object.assign(this._overlayState, patch);
    this.renderOverlay();
  }

  clearOverlay() {
    this._overlayState = { guides: [], preview: null, marquee: null, hover: null, dropTarget: null };
    this.renderOverlay();
  }

  renderOverlay() {
    const diagram = this.diagram;
    if (!diagram) {
      this.layerOverlay.innerHTML = '';
      return;
    }
    const parts = [];
    const state = this._overlayState;
    const notation = getNotation(diagram.notation);
    const selected = diagram.nodes.filter((nd) => this.selection.has(nd.id));
    const selectedEdges = diagram.edges.filter((e) => this.selection.has(e.id));

    if (state.dropTarget) {
      const r = this._screenRect(state.dropTarget);
      parts.push(
        `<rect class="ov-drop" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="8" fill="var(--accent-soft)" stroke="var(--accent)" stroke-width="1.5" stroke-dasharray="6 4"/>`
      );
    }

    if (state.hover && !this.selection.has(state.hover.id)) {
      const r = this._screenRect(state.hover);
      parts.push(
        `<rect class="ov-hover" x="${r.x - 2}" y="${r.y - 2}" width="${r.w + 4}" height="${r.h + 4}" rx="8" fill="none" stroke="var(--accent)" stroke-width="1.2" opacity="0.55"/>`
      );
    }

    for (const edge of selectedEdges) {
      const geom = this.geometries.get(edge.id);
      if (!geom) continue;
      const pts = geom.points.map((p) => this.worldToScreen(p));
      parts.push(
        `<polyline class="ov-edge-sel" points="${pts.map((p) => `${p.x},${p.y}`).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="3" opacity="0.28" stroke-linejoin="round" stroke-linecap="round"/>`
      );
      pts.slice(1, -1).forEach((p, i) => {
        parts.push(
          `<circle class="ov-waypoint" data-edge="${edge.id}" data-index="${i}" cx="${p.x}" cy="${p.y}" r="4.5" fill="var(--handle-fill)" stroke="var(--accent)" stroke-width="1.5"/>`
        );
      });
      const first = pts[0];
      const last = pts[pts.length - 1];
      parts.push(
        `<circle class="ov-endpoint" data-edge="${edge.id}" data-end="source" cx="${first.x}" cy="${first.y}" r="5" fill="var(--accent)" stroke="#fff" stroke-width="1.5"/>`,
        `<circle class="ov-endpoint" data-edge="${edge.id}" data-end="target" cx="${last.x}" cy="${last.y}" r="5" fill="var(--accent)" stroke="#fff" stroke-width="1.5"/>`
      );
    }

    if (selected.length) {
      for (const node of selected) {
        const r = this._screenRect(node);
        parts.push(
          `<rect class="ov-sel" x="${r.x - 1}" y="${r.y - 1}" width="${r.w + 2}" height="${r.h + 2}" rx="8" fill="none" stroke="var(--accent)" stroke-width="1.6"/>`
        );
      }
      if (selected.length === 1) {
        const node = selected[0];
        const descriptor = notation.nodeTypes[node.type];
        const r = this._screenRect(node);
        if (descriptor?.resizable !== false) {
          for (const handle of handlePositions(r)) {
            parts.push(
              `<rect class="ov-handle" data-handle="${handle.id}" x="${handle.x - 4}" y="${handle.y - 4}" width="8" height="8" rx="2" fill="var(--handle-fill)" stroke="var(--accent)" stroke-width="1.5"/>`
            );
          }
        }
        if (this.settings.get('canvas.quickHandles', true) && descriptor?.category !== 'swimlane') {
          for (const q of quickHandlePositions(r)) {
            parts.push(
              `<g class="ov-quick" data-quick="${q.id}" transform="translate(${q.x},${q.y})">` +
                '<circle r="9" fill="var(--quick-fill)" stroke="var(--accent)" stroke-width="1.3"/>' +
                `<path d="${q.icon}" fill="none" stroke="var(--accent)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>` +
                '</g>'
            );
          }
        }
      } else {
        const bounds = unionRect(selected.map(rectOf));
        const r = this._screenRect(bounds);
        parts.push(
          `<rect class="ov-multi" x="${r.x - 6}" y="${r.y - 6}" width="${r.w + 12}" height="${r.h + 12}" rx="10" fill="none" stroke="var(--accent)" stroke-width="1.2" stroke-dasharray="5 4" opacity="0.8"/>`
        );
      }
    }

    for (const guide of state.guides) {
      if (guide.x !== undefined) {
        const x = this.worldToScreen({ x: guide.x, y: 0 }).x;
        parts.push(`<line class="ov-guide" x1="${x}" y1="0" x2="${x}" y2="100%" stroke="var(--guide)" stroke-width="1" stroke-dasharray="4 3"/>`);
      } else {
        const y = this.worldToScreen({ x: 0, y: guide.y }).y;
        parts.push(`<line class="ov-guide" x1="0" y1="${y}" x2="100%" y2="${y}" stroke="var(--guide)" stroke-width="1" stroke-dasharray="4 3"/>`);
      }
    }

    if (state.preview) {
      const pts = state.preview.points.map((p) => this.worldToScreen(p));
      parts.push(
        `<polyline class="ov-preview" points="${pts.map((p) => `${p.x},${p.y}`).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="1.8" stroke-dasharray="6 4" stroke-linejoin="round"/>`
      );
      const last = pts[pts.length - 1];
      parts.push(`<circle cx="${last.x}" cy="${last.y}" r="4" fill="var(--accent)"/>`);
      if (state.preview.invalid) {
        parts.push(
          `<g transform="translate(${last.x + 10},${last.y - 10})"><circle r="8" fill="var(--danger)"/><path d="M -3 -3 L 3 3 M 3 -3 L -3 3" stroke="#fff" stroke-width="1.6"/></g>`
        );
      }
    }

    if (state.marquee) {
      const m = state.marquee;
      parts.push(
        `<rect class="ov-marquee" x="${Math.min(m.x1, m.x2)}" y="${Math.min(m.y1, m.y2)}" width="${Math.abs(
          m.x2 - m.x1
        )}" height="${Math.abs(m.y2 - m.y1)}" fill="var(--accent-soft)" stroke="var(--accent)" stroke-width="1"/>`
      );
    }

    this.layerOverlay.innerHTML = parts.join('');
  }

  _screenRect(rect) {
    const p = this.worldToScreen({ x: rect.x, y: rect.y });
    return { x: p.x, y: p.y, w: rect.w * this.zoom, h: rect.h * this.zoom };
  }

  /* ------------------------------------------------------------ hit testing */

  elementIdAt(event) {
    const target = event.target.closest?.('[data-id]');
    return target ? target.dataset.id : null;
  }

  nodeAtWorld(point, exclude = new Set()) {
    const diagram = this.diagram;
    if (!diagram) return null;
    const ordered = sortedNodes(diagram).reverse();
    for (const node of ordered) {
      if (exclude.has(node.id)) continue;
      if (point.x >= node.x && point.x <= node.x + node.w && point.y >= node.y && point.y <= node.y + node.h) {
        return node;
      }
    }
    return null;
  }

  nodesInRect(rect) {
    const diagram = this.diagram;
    if (!diagram) return [];
    return diagram.nodes.filter(
      (nd) => nd.x + nd.w >= rect.x && nd.x <= rect.x + rect.w && nd.y + nd.h >= rect.y && nd.y <= rect.y + rect.h
    );
  }

  edgesInRect(rect) {
    const result = [];
    for (const [id, geom] of this.geometries) {
      if (geom.points.some((p) => p.x >= rect.x && p.x <= rect.x + rect.w && p.y >= rect.y && p.y <= rect.y + rect.h)) {
        result.push(id);
      }
    }
    return result;
  }

  /* ------------------------------------------------------------- exporting */

  /** Standalone SVG string of the current diagram. */
  toSvgString(options = {}) {
    const diagram = this.diagram;
    if (!diagram) return '';
    return diagramToSvg(diagram, this.doc, options);
  }
}

export function handlePositions(r) {
  return [
    { id: 'nw', x: r.x, y: r.y },
    { id: 'n', x: r.x + r.w / 2, y: r.y },
    { id: 'ne', x: r.x + r.w, y: r.y },
    { id: 'e', x: r.x + r.w, y: r.y + r.h / 2 },
    { id: 'se', x: r.x + r.w, y: r.y + r.h },
    { id: 's', x: r.x + r.w / 2, y: r.y + r.h },
    { id: 'sw', x: r.x, y: r.y + r.h },
    { id: 'w', x: r.x, y: r.y + r.h / 2 },
  ];
}

const ARROW_ICON = 'M -4 0 L 4 0 M 1 -3 L 4 0 L 1 3';
export function quickHandlePositions(r) {
  const d = 22;
  return [
    { id: 'right', x: r.x + r.w + d, y: r.y + r.h / 2, icon: ARROW_ICON },
    { id: 'left', x: r.x - d, y: r.y + r.h / 2, icon: 'M 4 0 L -4 0 M -1 -3 L -4 0 L -1 3' },
    { id: 'down', x: r.x + r.w / 2, y: r.y + r.h + d, icon: 'M 0 -4 L 0 4 M -3 1 L 0 4 L 3 1' },
    { id: 'up', x: r.x + r.w / 2, y: r.y - d, icon: 'M 0 4 L 0 -4 M -3 -1 L 0 -4 L 3 -1' },
  ];
}

/** Serialises a diagram into a standalone, themeable SVG document. */
export function diagramToSvg(diagram, doc, options = {}) {
  const margin = options.margin ?? 24;
  const geometries = layoutEdges(diagram, { connectionStyle: options.connectionStyle || 'orthogonal' });
  const rects = diagram.nodes.map(rectOf);
  for (const geom of geometries.values()) for (const p of geom.points) rects.push({ x: p.x, y: p.y, w: 0, h: 0 });
  const bounds = unionRect(rects) || { x: 0, y: 0, w: 400, h: 300 };
  // labels of events/gateways stick out below the shape
  const box = {
    x: bounds.x - margin,
    y: bounds.y - margin,
    w: bounds.w + margin * 2,
    h: bounds.h + margin * 2 + 18,
  };
  const decomposedIds = new Set(doc ? doc.project.diagrams.filter((d) => d.parentNodeId).map((d) => d.parentNodeId) : []);
  const markup = diagramMarkup(diagram, geometries, { decomposedIds, smooth: options.smooth !== false });
  const background =
    options.background === 'transparent'
      ? ''
      : `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="${options.background || '#ffffff'}"/>`;
  const scale = options.scale || 1;
  return (
    `<svg xmlns="${SVG_NS}" xmlns:xlink="http://www.w3.org/1999/xlink" width="${Math.round(box.w * scale)}" height="${Math.round(
      box.h * scale
    )}" viewBox="${box.x} ${box.y} ${box.w} ${box.h}" font-family="${options.fontFamily || SVG_FONT}">` +
    `<style>${options.css || exportCss()}</style>` +
    background +
    `<g class="fm-diagram">${markup.back}${markup.edges}${markup.front}</g>` +
    '</svg>'
  );
}

export const SVG_FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', 'Segoe UI', Roboto, Arial, sans-serif";

/** Light-theme variable values so that exported files never depend on the app. */
export const EXPORT_VARS = {
  '--el-fill': '#ffffff',
  '--el-stroke': '#5b6168',
  '--el-text': '#1d1d1f',
  '--el-icon': '#5b6168',
  '--el-glyph-invert': '#ffffff',
  '--task-fill': '#ffffff',
  '--task-stroke': '#9aa1a9',
  '--gw-fill': '#fffaf0',
  '--gw-stroke': '#d99a00',
  '--ev-start-fill': '#f0faf3',
  '--ev-start-stroke': '#2f9e5e',
  '--ev-end-fill': '#fdf1f1',
  '--ev-end-stroke': '#d64545',
  '--ev-mid-fill': '#fff8ec',
  '--ev-mid-stroke': '#d98324',
  '--data-stroke': '#7a8089',
  '--pool-fill': '#ffffff',
  '--pool-header': '#f2f3f5',
  '--pool-stroke': '#9aa1a9',
  '--lane-fill': '#ffffff',
  '--flow-stroke': '#3c4043',
  '--fn-fill': '#ffffff',
  '--fn-stroke': '#4a5056',
  '--arrow-stroke': '#3c4043',
  '--anchor-fill': '#f7f8fa',
  '--accent': '#0071e3',
  '--canvas-bg': '#ffffff',
  '--danger': '#d64545',
};

export function exportCss(vars = EXPORT_VARS) {
  const declarations = Object.entries(vars)
    .map(([key, value]) => `${key}:${value};`)
    .join('');
  return `.fm-diagram{${declarations}} .fm-diagram text{font-family:inherit;}`;
}
