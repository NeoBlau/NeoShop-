/** Horizontal and vertical rulers drawn on 2D canvases (crisp at any zoom). */
export class Rulers {
  constructor({ horizontal, vertical, corner }, canvas) {
    this.h = horizontal;
    this.v = vertical;
    this.corner = corner;
    this.canvas = canvas;
    this.pointer = null;
    canvas.on('viewport', () => this.schedule());
    canvas.on('resize', () => this.schedule());
    canvas.on('pointer', (world) => {
      this.pointer = world;
      this.schedule();
    });
    this.schedule();
  }

  schedule() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => {
      this._raf = null;
      this.draw();
    });
  }

  setVisible(visible) {
    for (const el of [this.h, this.v, this.corner]) if (el) el.hidden = !visible;
    if (visible) this.schedule();
  }

  _prepare(canvasEl) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvasEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    canvasEl.width = Math.round(rect.width * dpr);
    canvasEl.height = Math.round(rect.height * dpr);
    const ctx = canvasEl.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    const styles = getComputedStyle(canvasEl);
    ctx.fillStyle = styles.getPropertyValue('--ruler-bg') || '#f5f5f7';
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.strokeStyle = styles.getPropertyValue('--ruler-tick') || '#c7c7cc';
    ctx.fillStyle = styles.getPropertyValue('--ruler-text') || '#8e8e93';
    ctx.font = '9px -apple-system, system-ui, sans-serif';
    return { ctx, rect, styles };
  }

  static step(zoom) {
    const candidates = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000];
    for (const c of candidates) if (c * zoom >= 60) return c;
    return 5000;
  }

  draw() {
    if (!this.h || this.h.hidden) return;
    const zoom = this.canvas.zoom;
    const step = Rulers.step(zoom);
    const hp = this._prepare(this.h);
    if (hp) {
      const { ctx, rect } = hp;
      const start = Math.floor(-this.canvas.tx / zoom / step) * step;
      const end = start + (rect.width / zoom) + step;
      ctx.beginPath();
      for (let world = start; world <= end; world += step) {
        const x = Math.round(world * zoom + this.canvas.tx) + 0.5;
        ctx.moveTo(x, rect.height - 7);
        ctx.lineTo(x, rect.height);
        ctx.fillText(String(world), x + 3, rect.height - 9);
        for (let i = 1; i < 5; i++) {
          const sub = Math.round((world + (step / 5) * i) * zoom + this.canvas.tx) + 0.5;
          ctx.moveTo(sub, rect.height - 4);
          ctx.lineTo(sub, rect.height);
        }
      }
      ctx.stroke();
      if (this.pointer) {
        const x = Math.round(this.pointer.x * zoom + this.canvas.tx) + 0.5;
        ctx.strokeStyle = getComputedStyle(this.h).getPropertyValue('--accent') || '#0071e3';
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, rect.height);
        ctx.stroke();
      }
    }
    const vp = this._prepare(this.v);
    if (vp) {
      const { ctx, rect } = vp;
      const start = Math.floor(-this.canvas.ty / zoom / step) * step;
      const end = start + rect.height / zoom + step;
      ctx.beginPath();
      for (let world = start; world <= end; world += step) {
        const y = Math.round(world * zoom + this.canvas.ty) + 0.5;
        ctx.moveTo(rect.width - 7, y);
        ctx.lineTo(rect.width, y);
        ctx.save();
        ctx.translate(rect.width - 10, y + 3);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(String(world), 0, 0);
        ctx.restore();
        for (let i = 1; i < 5; i++) {
          const sub = Math.round((world + (step / 5) * i) * zoom + this.canvas.ty) + 0.5;
          ctx.moveTo(rect.width - 4, sub);
          ctx.lineTo(rect.width, sub);
        }
      }
      ctx.stroke();
      if (this.pointer) {
        const y = Math.round(this.pointer.y * zoom + this.canvas.ty) + 0.5;
        ctx.strokeStyle = getComputedStyle(this.v).getPropertyValue('--accent') || '#0071e3';
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(rect.width, y);
        ctx.stroke();
      }
    }
  }
}
