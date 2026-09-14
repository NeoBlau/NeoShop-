/** Miniature overview of the whole diagram with a draggable viewport frame. */
import { rectOf, unionRect } from '../core/geometry.js';

export class Minimap {
  constructor(element, canvas) {
    this.el = element;
    this.canvas = canvas;
    this.el.classList.add('minimap');
    this.el.innerHTML = '<svg class="minimap-svg"><g class="minimap-content"></g><rect class="minimap-view"/></svg>';
    this.svg = this.el.querySelector('svg');
    this.content = this.el.querySelector('.minimap-content');
    this.view = this.el.querySelector('.minimap-view');
    this._bind();
    this.scheduleUpdate();
  }

  _bind() {
    const move = (event) => {
      if (!this._bounds) return;
      const rect = this.svg.getBoundingClientRect();
      const x = (event.clientX - rect.left) / this._scale + this._bounds.x;
      const y = (event.clientY - rect.top) / this._scale + this._bounds.y;
      this.canvas.centerOn({ x, y });
    };
    this.svg.addEventListener('pointerdown', (e) => {
      this._dragging = true;
      this.svg.setPointerCapture(e.pointerId);
      move(e);
    });
    this.svg.addEventListener('pointermove', (e) => this._dragging && move(e));
    this.svg.addEventListener('pointerup', (e) => {
      this._dragging = false;
      this.svg.releasePointerCapture(e.pointerId);
    });
    this.canvas.on('viewport', () => this.scheduleUpdate());
    this.canvas.on('render', () => this.scheduleUpdate());
    this.canvas.on('resize', () => this.scheduleUpdate());
  }

  scheduleUpdate() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => {
      this._raf = null;
      this.update();
    });
  }

  update() {
    const diagram = this.canvas.diagram;
    const box = this.el.getBoundingClientRect();
    if (!diagram || !box.width) {
      this.content.innerHTML = '';
      return;
    }
    const canvasRect = this.canvas.rect;
    const viewWorld = {
      x: -this.canvas.tx / this.canvas.zoom,
      y: -this.canvas.ty / this.canvas.zoom,
      w: canvasRect.width / this.canvas.zoom,
      h: canvasRect.height / this.canvas.zoom,
    };
    const rects = diagram.nodes.map(rectOf);
    const bounds = unionRect([...rects, viewWorld]) || viewWorld;
    const pad = 20;
    const padded = { x: bounds.x - pad, y: bounds.y - pad, w: bounds.w + pad * 2, h: bounds.h + pad * 2 };
    const scale = Math.min(box.width / padded.w, box.height / padded.h);
    this._bounds = padded;
    this._scale = scale;
    this.svg.setAttribute('viewBox', `${padded.x} ${padded.y} ${box.width / scale} ${box.height / scale}`);
    this.content.innerHTML = diagram.nodes
      .map(
        (n) =>
          `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="3" fill="var(--minimap-node)" stroke="var(--minimap-stroke)" stroke-width="${
            1 / scale
          }"/>`
      )
      .join('');
    this.view.setAttribute('x', viewWorld.x);
    this.view.setAttribute('y', viewWorld.y);
    this.view.setAttribute('width', Math.max(4, viewWorld.w));
    this.view.setAttribute('height', Math.max(4, viewWorld.h));
    this.view.setAttribute('stroke-width', 2 / scale);
  }

  setVisible(visible) {
    this.el.hidden = !visible;
    if (visible) this.scheduleUpdate();
  }
}
