import { clone, createEdge, createNode } from './model.js';
import { uid } from './id.js';

/**
 * Copy / paste of a sub-graph.  The payload is plain JSON so it can also be
 * placed on the system clipboard and pasted into another window of the app.
 */
export const CLIPBOARD_MIME = 'application/x-fibermodeler+json';

export function extract(diagram, ids) {
  const set = new Set(ids);
  const nodes = diagram.nodes.filter((n) => set.has(n.id)).map(clone);
  const nodeIds = new Set(nodes.map((n) => n.id));
  // keep children of copied containers
  for (const n of diagram.nodes) {
    if (!nodeIds.has(n.id) && n.parent && nodeIds.has(n.parent)) {
      nodes.push(clone(n));
      nodeIds.add(n.id);
    }
  }
  const edges = diagram.edges
    .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
    .map(clone);
  return { kind: 'fibermodeler/clip', notation: diagram.notation, nodes, edges };
}

/** Creates fresh copies with new ids, offset by dx/dy. */
export function instantiate(payload, { dx = 24, dy = 24 } = {}) {
  const map = new Map();
  const nodes = payload.nodes.map((n) => {
    const copy = createNode({ ...clone(n), id: uid('node') });
    copy.x += dx;
    copy.y += dy;
    map.set(n.id, copy.id);
    return copy;
  });
  for (const node of nodes) {
    if (node.parent && map.has(node.parent)) node.parent = map.get(node.parent);
    else if (node.parent) node.parent = null;
  }
  const edges = payload.edges.map((e) => {
    const copy = createEdge({ ...clone(e), id: uid('edge') });
    copy.source = map.get(e.source);
    copy.target = map.get(e.target);
    copy.waypoints = (copy.waypoints || []).map((p) => ({ x: p.x + dx, y: p.y + dy }));
    return copy;
  });
  return { nodes, edges, idMap: map };
}

export class Clipboard {
  constructor() {
    this.payload = null;
  }
  set(payload) {
    this.payload = payload ? clone(payload) : null;
    if (payload && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(JSON.stringify(payload)).catch(() => {});
    }
  }
  get() {
    return this.payload ? clone(this.payload) : null;
  }
  get isEmpty() {
    return !this.payload || !this.payload.nodes?.length;
  }
}
