/**
 * Undo / redo.
 *
 * Commands are first class objects with `do` / `undo`.  The default and most
 * used implementation is a memento command produced by `history.run()`:
 * it snapshots the affected diagram(s) before and after the mutation.  That
 * gives correct undo for *every* operation (including bulk ones such as auto
 * layout or import) without every feature having to hand-write an inverse.
 *
 * Fine grained commands can still be pushed directly via `history.execute()`.
 */
import { Emitter } from './events.js';
import { clone } from './model.js';

const DEFAULT_LIMIT = 200;
const DEFAULT_BUDGET = 48 * 1024 * 1024; // rough guard against unbounded memory

export class Command {
  constructor(label, doFn, undoFn) {
    this.label = label;
    this._do = doFn;
    this._undo = undoFn;
  }
  do(doc) {
    this._do(doc);
  }
  undo(doc) {
    this._undo(doc);
  }
}

/** Memento command: restores whole diagram snapshots. */
export class SnapshotCommand {
  constructor(label, before, after) {
    this.label = label;
    this.before = before; // { diagramId: diagramJSON|null, ... }
    this.after = after;
    this.size = estimate(before) + estimate(after);
  }

  _restore(doc, snapshot) {
    for (const [id, data] of Object.entries(snapshot)) {
      const index = doc.project.diagrams.findIndex((d) => d.id === id);
      if (data === null) {
        if (index >= 0) doc.project.diagrams.splice(index, 1);
      } else if (index >= 0) {
        doc.project.diagrams[index] = clone(data);
      } else {
        doc.project.diagrams.push(clone(data));
      }
    }
    doc.invalidate();
    doc.touch();
    doc.emit('change', { type: 'bulk', diagramIds: Object.keys(snapshot) });
  }

  do(doc) {
    this._restore(doc, this.after);
  }

  undo(doc) {
    this._restore(doc, this.before);
  }
}

function estimate(snapshot) {
  let n = 0;
  for (const value of Object.values(snapshot)) {
    if (!value) continue;
    n += (value.nodes?.length || 0) * 220 + (value.edges?.length || 0) * 180 + 200;
  }
  return n;
}

export class History extends Emitter {
  constructor(doc, { limit = DEFAULT_LIMIT, budget = DEFAULT_BUDGET } = {}) {
    super();
    this.doc = doc;
    this.limit = limit;
    this.budget = budget;
    this.undoStack = [];
    this.redoStack = [];
    this._batch = null;
    this._savePoint = null;
  }

  get canUndo() {
    return this.undoStack.length > 0;
  }

  get canRedo() {
    return this.redoStack.length > 0;
  }

  get undoLabel() {
    return this.undoStack.at(-1)?.label || '';
  }

  get redoLabel() {
    return this.redoStack.at(-1)?.label || '';
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this._savePoint = null;
    this.emit('change', this);
  }

  markSaved() {
    this._savePoint = this.undoStack.length;
    this.doc.dirty = false;
    this.emit('change', this);
  }

  get isDirty() {
    if (this._savePoint === null) return this.doc.dirty;
    return this.undoStack.length !== this._savePoint;
  }

  /**
   * Runs `mutator`, recording an undoable snapshot of every diagram it touched.
   * `diagramIds` may be a single id, an array, or '*' for the whole project.
   */
  run(label, diagramIds, mutator) {
    const ids = this._resolveIds(diagramIds);
    const before = this._snapshot(ids);
    let result;
    try {
      result = mutator(this.doc);
    } catch (err) {
      // roll back a half applied mutation so the model never stays corrupted
      this._rollback(before);
      throw err;
    }
    const afterIds = this._resolveIds(diagramIds === '*' ? '*' : ids);
    const after = this._snapshot(afterIds);
    if (sameSnapshot(before, after)) return result;
    this._push(new SnapshotCommand(label, before, after));
    return result;
  }

  /**
   * Live interactions (dragging, resizing) mutate the model directly for
   * responsiveness.  `beginLive` remembers the state, `commitLive` turns the
   * accumulated change into one undo step, `cancelLive` rolls it back.
   */
  beginLive(label, diagramIds) {
    const ids = this._resolveIds(diagramIds);
    return { label, ids, before: this._snapshot(ids) };
  }

  commitLive(token) {
    if (!token) return false;
    const after = this._snapshot(token.ids);
    if (sameSnapshot(token.before, after)) return false;
    this._push(new SnapshotCommand(token.label, token.before, after));
    return true;
  }

  cancelLive(token) {
    if (!token) return;
    this._rollback(token.before);
  }

  execute(command) {
    command.do(this.doc);
    this._push(command);
    return command;
  }

  _push(command) {
    if (this._batch) {
      this._batch.commands.push(command);
      return;
    }
    this.undoStack.push(command);
    this.redoStack.length = 0;
    if (this._savePoint !== null && this._savePoint > this.undoStack.length - 1) {
      this._savePoint = null;
    }
    this._trim();
    this.emit('change', this);
  }

  /** Groups several commands into one undo step. */
  batch(label, fn) {
    if (this._batch) return fn();
    this._batch = { label, commands: [] };
    let result;
    try {
      result = fn();
    } finally {
      const { commands } = this._batch;
      this._batch = null;
      if (commands.length === 1) this._push(commands[0]);
      else if (commands.length > 1) this._push(new CompositeCommand(label, commands));
    }
    return result;
  }

  undo() {
    const command = this.undoStack.pop();
    if (!command) return false;
    command.undo(this.doc);
    this.redoStack.push(command);
    this.emit('change', this);
    this.emit('undo', command);
    return true;
  }

  redo() {
    const command = this.redoStack.pop();
    if (!command) return false;
    command.do(this.doc);
    this.undoStack.push(command);
    this.emit('change', this);
    this.emit('redo', command);
    return true;
  }

  _trim() {
    while (this.undoStack.length > this.limit) {
      this.undoStack.shift();
      if (this._savePoint !== null) this._savePoint = Math.max(0, this._savePoint - 1);
    }
    let total = 0;
    for (const c of this.undoStack) total += c.size || 0;
    while (total > this.budget && this.undoStack.length > 1) {
      total -= this.undoStack.shift().size || 0;
      if (this._savePoint !== null) this._savePoint = Math.max(0, this._savePoint - 1);
    }
  }

  _resolveIds(diagramIds) {
    if (diagramIds === '*') return this.doc.project.diagrams.map((d) => d.id);
    if (Array.isArray(diagramIds)) return [...new Set(diagramIds.filter(Boolean))];
    return diagramIds ? [diagramIds] : [];
  }

  _snapshot(ids) {
    const snap = {};
    for (const id of ids) {
      const d = this.doc.diagram(id);
      snap[id] = d ? clone(d) : null;
    }
    return snap;
  }

  _rollback(before) {
    for (const [id, data] of Object.entries(before)) {
      const index = this.doc.project.diagrams.findIndex((d) => d.id === id);
      if (data === null) {
        if (index >= 0) this.doc.project.diagrams.splice(index, 1);
      } else if (index >= 0) this.doc.project.diagrams[index] = clone(data);
      else this.doc.project.diagrams.push(clone(data));
    }
    this.doc.invalidate();
    this.doc.emit('change', { type: 'bulk' });
  }
}

export class CompositeCommand {
  constructor(label, commands) {
    this.label = label;
    this.commands = commands;
    this.size = commands.reduce((a, c) => a + (c.size || 0), 0);
  }
  do(doc) {
    for (const c of this.commands) c.do(doc);
  }
  undo(doc) {
    for (let i = this.commands.length - 1; i >= 0; i--) this.commands[i].undo(doc);
  }
}

function sameSnapshot(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (JSON.stringify(a[key] ?? null) !== JSON.stringify(b[key] ?? null)) return false;
  }
  return true;
}
