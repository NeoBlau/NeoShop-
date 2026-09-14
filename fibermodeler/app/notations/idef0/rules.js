/** Connection rules for IDEF0. The attachment side defines the ICOM role. */
import { ICOM_SIDES, IDEF0_EDGE_TYPES, IDEF0_TYPES, SIDE_ROLES } from './types.js';

export function isFunction(node) {
  return node?.type === 'idef0Function';
}

export function isAnchor(node) {
  return node?.type === 'idef0Anchor';
}

export function isNote(node) {
  return IDEF0_TYPES[node?.type]?.category === 'note';
}

export function roleOfEdge(edge) {
  return IDEF0_EDGE_TYPES[edge?.type]?.role || 'input';
}

export function edgeTypeForRole(role) {
  const entry = Object.values(IDEF0_EDGE_TYPES).find((t) => t.role === role);
  return entry ? entry.id : 'idef0Input';
}

/** Role implied by dropping an arrow on a given side of a function box. */
export function edgeTypeForSide(side) {
  return edgeTypeForRole(SIDE_ROLES[side] || 'input');
}

export function defaultEdgeType(diagram, source, target, targetSide) {
  if (isNote(source) || isNote(target)) return 'idef0Input';
  if (targetSide) return edgeTypeForSide(targetSide);
  return 'idef0Input';
}

export function canConnect(diagram, source, target, requestedType) {
  if (!source || !target) return { ok: false, reason: 'missing' };
  if (source.id === target.id) return { ok: false, reason: 'self' };
  if (isNote(source) || isNote(target)) return { ok: false, reason: 'noteConnect' };
  if (isAnchor(source) && isAnchor(target)) return { ok: false, reason: 'anchorToAnchor' };
  const type = requestedType && IDEF0_EDGE_TYPES[requestedType] ? requestedType : 'idef0Input';
  const duplicate = diagram.edges.some((e) => e.source === source.id && e.target === target.id && e.type === type);
  if (duplicate) return { ok: false, reason: 'duplicate' };
  return { ok: true, type };
}

/** Preferred attachment sides for an arrow of the given type. */
export function sidesFor(edgeType, source, target) {
  const spec = IDEF0_EDGE_TYPES[edgeType] || IDEF0_EDGE_TYPES.idef0Input;
  let sourceSide = spec.sourceSide || 'right';
  let targetSide = spec.targetSide || 'left';
  if (isAnchor(source)) sourceSide = 'right';
  if (isAnchor(target)) targetSide = 'left';
  // feedback arrows: a target placed left of the source leaves through the
  // bottom / top so the diagram keeps the classic IDEF0 staircase look
  if (source && target && spec.role !== 'call') {
    if (target.x + target.w < source.x && spec.role === 'input') {
      sourceSide = 'bottom';
      targetSide = 'left';
    } else if (target.x + target.w < source.x && spec.role === 'control') {
      sourceSide = 'top';
      targetSide = 'top';
    }
  }
  return { sourceSide, targetSide };
}

export const ROLE_SIDES = ICOM_SIDES;
