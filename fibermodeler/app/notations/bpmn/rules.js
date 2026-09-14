/** Connection rules for BPMN: which element may be linked to which, and how. */
import { BPMN_EDGE_TYPES, BPMN_TYPES } from './types.js';

const FLOW_CATEGORIES = new Set(['event', 'activity', 'gateway']);

export function isFlowNode(node) {
  const type = BPMN_TYPES[node?.type];
  return !!type && FLOW_CATEGORIES.has(type.category);
}

export function isDataNode(node) {
  return BPMN_TYPES[node?.type]?.category === 'data';
}

export function isArtifact(node) {
  return BPMN_TYPES[node?.type]?.category === 'artifact';
}

export function isSwimlane(node) {
  return BPMN_TYPES[node?.type]?.category === 'swimlane';
}

/** Walks the parent chain and returns the containing pool node, if any. */
export function poolOf(diagram, node) {
  let current = node;
  const seen = new Set();
  while (current && current.parent && !seen.has(current.id)) {
    seen.add(current.id);
    const parent = diagram.nodes.find((x) => x.id === current.parent);
    if (!parent) return null;
    if (parent.type === 'pool') return parent;
    current = parent;
  }
  return null;
}

export function defaultEdgeType(diagram, source, target) {
  if (!source || !target) return 'sequenceFlow';
  if (isArtifact(source) || isArtifact(target)) return 'association';
  if (isDataNode(source) || isDataNode(target)) return 'dataAssociation';
  if (isSwimlane(source) || isSwimlane(target)) return 'messageFlow';
  const poolA = poolOf(diagram, source);
  const poolB = poolOf(diagram, target);
  if (poolA && poolB && poolA.id !== poolB.id) return 'messageFlow';
  return 'sequenceFlow';
}

/**
 * @returns {{ok: boolean, type?: string, reason?: string}}
 * `reason` is an i18n-independent code that the UI turns into a message.
 */
export function canConnect(diagram, source, target, requestedType) {
  if (!source || !target) return { ok: false, reason: 'missing' };
  if (source.id === target.id) return { ok: false, reason: 'self' };
  const type = requestedType || defaultEdgeType(diagram, source, target);
  const exists = diagram.edges.some((e) => e.source === source.id && e.target === target.id && e.type === type);
  if (exists) return { ok: false, reason: 'duplicate' };

  switch (type) {
    case 'sequenceFlow': {
      if (!isFlowNode(source) || !isFlowNode(target)) return { ok: false, reason: 'notFlowNode' };
      const sourceType = BPMN_TYPES[source.type];
      const targetType = BPMN_TYPES[target.type];
      if (sourceType.category === 'event' && sourceType.kind === 'end') return { ok: false, reason: 'endHasNoOutgoing' };
      if (targetType.category === 'event' && targetType.kind === 'start') return { ok: false, reason: 'startHasNoIncoming' };
      const poolA = poolOf(diagram, source);
      const poolB = poolOf(diagram, target);
      if (poolA && poolB && poolA.id !== poolB.id) return { ok: false, reason: 'crossPool' };
      return { ok: true, type };
    }
    case 'messageFlow': {
      if (isArtifact(source) || isArtifact(target)) return { ok: false, reason: 'artifact' };
      const poolA = poolOf(diagram, source) || (source.type === 'pool' ? source : null);
      const poolB = poolOf(diagram, target) || (target.type === 'pool' ? target : null);
      if (poolA && poolB && poolA.id === poolB.id) return { ok: false, reason: 'samePool' };
      return { ok: true, type };
    }
    case 'association':
      return { ok: true, type };
    case 'dataAssociation': {
      const dataSide = isDataNode(source) ? target : source;
      if (!isDataNode(source) && !isDataNode(target)) return { ok: false, reason: 'needsData' };
      if (!isFlowNode(dataSide)) return { ok: false, reason: 'needsActivity' };
      return { ok: true, type };
    }
    default:
      return BPMN_EDGE_TYPES[type] ? { ok: true, type } : { ok: false, reason: 'unknownType' };
  }
}

/** Container that a dropped node should become a child of. */
export function containerAt(diagram, rect, exclude = new Set()) {
  let best = null;
  for (const node of diagram.nodes) {
    if (exclude.has(node.id)) continue;
    const type = BPMN_TYPES[node.type];
    if (!type?.container) continue;
    const inside =
      rect.x + rect.w / 2 >= node.x &&
      rect.x + rect.w / 2 <= node.x + node.w &&
      rect.y + rect.h / 2 >= node.y &&
      rect.y + rect.h / 2 <= node.y + node.h;
    if (!inside) continue;
    // prefer the smallest (most specific) container, e.g. lane inside pool
    if (!best || node.w * node.h < best.w * best.h) best = node;
  }
  return best;
}
