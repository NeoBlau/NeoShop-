/**
 * Document model.
 *
 * A project is a plain-JSON tree so that it can be cloned, stored, diffed and
 * serialised without any custom (de)serialisation logic.  The `Doc` class adds
 * indexes, invariants and change notifications on top of that plain data - it
 * never hides data inside private fields that would not survive a round trip.
 */
import { Emitter } from './events.js';
import { uid } from './id.js';

export const SCHEMA_VERSION = 1;
export const FILE_EXT = '.fibermodel';

export function nowIso() {
  return new Date().toISOString();
}

export function createProject(options = {}) {
  const ts = nowIso();
  return {
    schema: SCHEMA_VERSION,
    id: options.id || uid('project'),
    name: options.name || 'Untitled project',
    meta: {
      author: options.author || '',
      company: options.company || '',
      description: options.description || '',
      version: options.version || '1.0',
      created: ts,
      modified: ts,
    },
    documentation: options.documentation || '',
    diagrams: [],
  };
}

export function createDiagram(options = {}) {
  const ts = nowIso();
  return {
    id: options.id || uid(options.notation === 'idef0' ? 'idef0' : 'bpmn'),
    notation: options.notation || 'bpmn',
    name: options.name || 'Diagram',
    nodes: [],
    edges: [],
    parentDiagramId: options.parentDiagramId || null,
    parentNodeId: options.parentNodeId || null,
    meta: {
      author: options.author || '',
      description: options.description || '',
      version: '1.0',
      created: ts,
      modified: ts,
      documentation: '',
    },
    view: { x: 0, y: 0, zoom: 1 },
  };
}

export function createNode(options = {}) {
  return {
    id: options.id || uid('node'),
    type: options.type || 'task',
    x: options.x ?? 0,
    y: options.y ?? 0,
    w: options.w ?? 120,
    h: options.h ?? 80,
    label: options.label ?? '',
    parent: options.parent || null,
    props: { ...(options.props || {}) },
    style: { ...(options.style || {}) },
  };
}

export function createEdge(options = {}) {
  return {
    id: options.id || uid('edge'),
    type: options.type || 'sequenceFlow',
    source: options.source,
    target: options.target,
    sourceSide: options.sourceSide || null,
    targetSide: options.targetSide || null,
    waypoints: options.waypoints ? options.waypoints.map((p) => ({ x: p.x, y: p.y })) : [],
    routing: options.routing || 'auto',
    label: options.label ?? '',
    props: { ...(options.props || {}) },
    style: { ...(options.style || {}) },
  };
}

/** Deep clone that works both in browsers and in Node >= 17. */
export function clone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

export class Doc extends Emitter {
  constructor(project) {
    super();
    this.project = project || createProject();
    this._index = new Map();
    this.dirty = false;
  }

  /* ---------------------------------------------------------------- project */

  replaceProject(project, { silent = false } = {}) {
    this.project = project;
    this._index.clear();
    if (!silent) this.emit('reset', project);
  }

  setProjectMeta(patch) {
    Object.assign(this.project, patch.name !== undefined ? { name: patch.name } : {});
    Object.assign(this.project.meta, patch.meta || {});
    if (patch.documentation !== undefined) this.project.documentation = patch.documentation;
    this.touch();
    this.emit('change', { type: 'project' });
  }

  touch() {
    this.project.meta.modified = nowIso();
    this.dirty = true;
  }

  /* --------------------------------------------------------------- diagrams */

  get diagrams() {
    return this.project.diagrams;
  }

  diagram(id) {
    return this.project.diagrams.find((d) => d.id === id) || null;
  }

  childDiagrams(diagramId) {
    return this.project.diagrams.filter((d) => d.parentDiagramId === diagramId);
  }

  /** Diagram that decomposes the given node, if any. */
  decompositionOf(nodeId) {
    return this.project.diagrams.find((d) => d.parentNodeId === nodeId) || null;
  }

  addDiagram(diagram, at = -1) {
    if (at >= 0) this.project.diagrams.splice(at, 0, diagram);
    else this.project.diagrams.push(diagram);
    this._index.delete(diagram.id);
    this.touch();
    this.emit('change', { type: 'diagram-add', diagramId: diagram.id });
    return diagram;
  }

  removeDiagram(id) {
    // remove children recursively
    for (const child of this.childDiagrams(id)) this.removeDiagram(child.id);
    const i = this.project.diagrams.findIndex((d) => d.id === id);
    if (i < 0) return null;
    const [removed] = this.project.diagrams.splice(i, 1);
    this._index.delete(id);
    this.touch();
    this.emit('change', { type: 'diagram-remove', diagramId: id });
    return removed;
  }

  updateDiagram(id, patch) {
    const d = this.diagram(id);
    if (!d) return null;
    if (patch.name !== undefined) d.name = patch.name;
    if (patch.meta) Object.assign(d.meta, patch.meta);
    if (patch.view) d.view = { ...d.view, ...patch.view };
    if (patch.parentNodeId !== undefined) d.parentNodeId = patch.parentNodeId;
    if (patch.parentDiagramId !== undefined) d.parentDiagramId = patch.parentDiagramId;
    d.meta.modified = nowIso();
    this.touch();
    this.emit('change', { type: 'diagram-update', diagramId: id });
    return d;
  }

  /* --------------------------------------------------------------- indexing */

  _idx(diagramId) {
    const d = this.diagram(diagramId);
    if (!d) return null;
    let entry = this._index.get(diagramId);
    if (!entry || entry.nodesRef !== d.nodes || entry.edgesRef !== d.edges || entry.n !== d.nodes.length || entry.e !== d.edges.length) {
      entry = {
        nodesRef: d.nodes,
        edgesRef: d.edges,
        n: d.nodes.length,
        e: d.edges.length,
        nodes: new Map(d.nodes.map((x) => [x.id, x])),
        edges: new Map(d.edges.map((x) => [x.id, x])),
      };
      this._index.set(diagramId, entry);
    }
    return entry;
  }

  invalidate(diagramId) {
    if (diagramId) this._index.delete(diagramId);
    else this._index.clear();
  }

  node(diagramId, nodeId) {
    const idx = this._idx(diagramId);
    return idx ? idx.nodes.get(nodeId) || null : null;
  }

  edge(diagramId, edgeId) {
    const idx = this._idx(diagramId);
    return idx ? idx.edges.get(edgeId) || null : null;
  }

  element(diagramId, id) {
    return this.node(diagramId, id) || this.edge(diagramId, id);
  }

  /* --------------------------------------------------------------- elements */

  addNode(diagramId, node) {
    const d = this.diagram(diagramId);
    if (!d) throw new Error(`Diagram ${diagramId} not found`);
    d.nodes.push(node);
    this.invalidate(diagramId);
    this.touch();
    this.emit('change', { type: 'node-add', diagramId, ids: [node.id] });
    return node;
  }

  removeNode(diagramId, nodeId) {
    const d = this.diagram(diagramId);
    if (!d) return null;
    const i = d.nodes.findIndex((n) => n.id === nodeId);
    if (i < 0) return null;
    const [removed] = d.nodes.splice(i, 1);
    // detach children of a container
    for (const n of d.nodes) if (n.parent === nodeId) n.parent = removed.parent || null;
    this.invalidate(diagramId);
    this.touch();
    this.emit('change', { type: 'node-remove', diagramId, ids: [nodeId] });
    return removed;
  }

  updateNode(diagramId, nodeId, patch) {
    const n = this.node(diagramId, nodeId);
    if (!n) return null;
    for (const [key, value] of Object.entries(patch)) {
      if (key === 'props' || key === 'style') Object.assign(n[key], value);
      else n[key] = value;
    }
    this.touch();
    this.emit('change', { type: 'node-update', diagramId, ids: [nodeId] });
    return n;
  }

  addEdge(diagramId, edge) {
    const d = this.diagram(diagramId);
    if (!d) throw new Error(`Diagram ${diagramId} not found`);
    d.edges.push(edge);
    this.invalidate(diagramId);
    this.touch();
    this.emit('change', { type: 'edge-add', diagramId, ids: [edge.id] });
    return edge;
  }

  removeEdge(diagramId, edgeId) {
    const d = this.diagram(diagramId);
    if (!d) return null;
    const i = d.edges.findIndex((e) => e.id === edgeId);
    if (i < 0) return null;
    const [removed] = d.edges.splice(i, 1);
    this.invalidate(diagramId);
    this.touch();
    this.emit('change', { type: 'edge-remove', diagramId, ids: [edgeId] });
    return removed;
  }

  updateEdge(diagramId, edgeId, patch) {
    const e = this.edge(diagramId, edgeId);
    if (!e) return null;
    for (const [key, value] of Object.entries(patch)) {
      if (key === 'props' || key === 'style') Object.assign(e[key], value);
      else e[key] = value;
    }
    this.touch();
    this.emit('change', { type: 'edge-update', diagramId, ids: [edgeId] });
    return e;
  }

  /** All edges attached to the given node id. */
  edgesOf(diagramId, nodeId) {
    const d = this.diagram(diagramId);
    if (!d) return [];
    return d.edges.filter((e) => e.source === nodeId || e.target === nodeId);
  }

  incoming(diagramId, nodeId) {
    const d = this.diagram(diagramId);
    return d ? d.edges.filter((e) => e.target === nodeId) : [];
  }

  outgoing(diagramId, nodeId) {
    const d = this.diagram(diagramId);
    return d ? d.edges.filter((e) => e.source === nodeId) : [];
  }

  /** Direct children of a container node (pool / lane / group). */
  childrenOf(diagramId, nodeId) {
    const d = this.diagram(diagramId);
    return d ? d.nodes.filter((n) => n.parent === nodeId) : [];
  }

  /** Every id used in the project - for uniqueness checks. */
  allIds() {
    const ids = new Set();
    for (const d of this.project.diagrams) {
      ids.add(d.id);
      for (const n of d.nodes) ids.add(n.id);
      for (const e of d.edges) ids.add(e.id);
    }
    return ids;
  }

  stats() {
    let nodes = 0;
    let edges = 0;
    for (const d of this.project.diagrams) {
      nodes += d.nodes.length;
      edges += d.edges.length;
    }
    return { diagrams: this.project.diagrams.length, nodes, edges };
  }
}

/** Normalises any project payload (old schema, partial data, imports). */
export function normalizeProject(raw) {
  const project = createProject({ name: raw?.name });
  if (!raw || typeof raw !== 'object') return project;
  project.id = raw.id || project.id;
  project.name = raw.name || project.name;
  project.meta = { ...project.meta, ...(raw.meta || {}) };
  project.documentation = raw.documentation || '';
  project.schema = SCHEMA_VERSION;
  const diagrams = Array.isArray(raw.diagrams) ? raw.diagrams : [];
  project.diagrams = diagrams.map((d) => {
    const diagram = createDiagram({
      id: d.id,
      name: d.name,
      notation: d.notation === 'idef0' ? 'idef0' : 'bpmn',
      parentDiagramId: d.parentDiagramId || null,
      parentNodeId: d.parentNodeId || null,
    });
    diagram.meta = { ...diagram.meta, ...(d.meta || {}) };
    diagram.view = { ...diagram.view, ...(d.view || {}) };
    diagram.nodes = (d.nodes || []).map((n) => createNode(n));
    diagram.edges = (d.edges || [])
      .filter((e) => e && e.source && e.target)
      .map((e) => createEdge(e));
    // drop edges pointing at missing nodes
    const ids = new Set(diagram.nodes.map((n) => n.id));
    diagram.edges = diagram.edges.filter((e) => ids.has(e.source) && ids.has(e.target));
    return diagram;
  });
  return project;
}
