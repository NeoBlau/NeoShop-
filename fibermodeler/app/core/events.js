/** Minimal synchronous event emitter used across the whole application. */
export class Emitter {
  constructor() {
    this._handlers = new Map();
  }

  /** Subscribe. Returns an unsubscribe function. */
  on(event, handler) {
    if (!this._handlers.has(event)) this._handlers.set(event, new Set());
    this._handlers.get(event).add(handler);
    return () => this.off(event, handler);
  }

  once(event, handler) {
    const off = this.on(event, (...args) => {
      off();
      handler(...args);
    });
    return off;
  }

  off(event, handler) {
    const set = this._handlers.get(event);
    if (set) set.delete(handler);
  }

  emit(event, ...args) {
    const set = this._handlers.get(event);
    if (!set) return;
    // copy: handlers may unsubscribe while emitting
    for (const handler of [...set]) {
      try {
        handler(...args);
      } catch (err) {
        console.error(`[FiberModeler] handler for "${event}" failed`, err);
      }
    }
  }

  removeAllListeners(event) {
    if (event) this._handlers.delete(event);
    else this._handlers.clear();
  }
}
