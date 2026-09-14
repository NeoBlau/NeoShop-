import { Emitter } from './events.js';

/** Selection of node / edge ids inside the active diagram. */
export class Selection extends Emitter {
  constructor() {
    super();
    this.ids = new Set();
    this.primary = null;
  }

  get size() {
    return this.ids.size;
  }

  has(id) {
    return this.ids.has(id);
  }

  list() {
    return [...this.ids];
  }

  set(ids) {
    const next = new Set(Array.isArray(ids) ? ids : ids ? [ids] : []);
    if (sameSet(next, this.ids)) return;
    this.ids = next;
    this.primary = next.size ? [...next][next.size - 1] : null;
    this.emit('change', this);
  }

  add(ids) {
    const list = Array.isArray(ids) ? ids : [ids];
    let changed = false;
    for (const id of list) {
      if (!this.ids.has(id)) {
        this.ids.add(id);
        this.primary = id;
        changed = true;
      }
    }
    if (changed) this.emit('change', this);
  }

  remove(ids) {
    const list = Array.isArray(ids) ? ids : [ids];
    let changed = false;
    for (const id of list) changed = this.ids.delete(id) || changed;
    if (changed) {
      if (!this.ids.has(this.primary)) this.primary = [...this.ids].at(-1) || null;
      this.emit('change', this);
    }
  }

  toggle(id) {
    if (this.ids.has(id)) this.remove(id);
    else this.add(id);
  }

  clear() {
    if (!this.ids.size) return;
    this.ids.clear();
    this.primary = null;
    this.emit('change', this);
  }
}

function sameSet(a, b) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}
