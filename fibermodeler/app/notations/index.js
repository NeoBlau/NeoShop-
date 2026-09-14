/**
 * Notation registry - the single place the rest of the app asks
 * "how does this notation behave?".  Adding a new notation means adding one
 * module here; canvas, palette, properties, validation and export adapt.
 */
import { BPMN_CONVERT_GROUPS, BPMN_EDGE_TYPES, BPMN_PALETTE, BPMN_TYPES } from './bpmn/types.js';
import * as bpmnRules from './bpmn/rules.js';
import { validateBpmn } from './bpmn/validate.js';
import { IDEF0_CONVERT_GROUPS, IDEF0_EDGE_TYPES, IDEF0_PALETTE, IDEF0_TYPES, nextIcomCode, nextNodeNumber } from './idef0/types.js';
import * as idef0Rules from './idef0/rules.js';
import { validateIdef0 } from './idef0/validate.js';
import { createNode } from '../core/model.js';
import { localName } from './shared.js';

const notations = new Map();

function define(spec) {
  notations.set(spec.id, spec);
  return spec;
}

define({
  id: 'bpmn',
  name: { en: 'BPMN 2.0', ru: 'BPMN 2.0' },
  nodeTypes: BPMN_TYPES,
  edgeTypes: BPMN_EDGE_TYPES,
  paletteGroups: BPMN_PALETTE,
  convertGroups: BPMN_CONVERT_GROUPS,
  defaultNodeType: 'task',
  defaultEdgeType: (diagram, source, target) => bpmnRules.defaultEdgeType(diagram, source, target),
  canConnect: (diagram, source, target, type) => bpmnRules.canConnect(diagram, source, target, type),
  containerAt: (diagram, rect, exclude) => bpmnRules.containerAt(diagram, rect, exclude),
  sidesFor: () => ({ sourceSide: null, targetSide: null }),
  validate: validateBpmn,
  rules: bpmnRules,
  onCreateNode(node) {
    return node;
  },
});

define({
  id: 'idef0',
  name: { en: 'IDEF0', ru: 'IDEF0' },
  nodeTypes: IDEF0_TYPES,
  edgeTypes: IDEF0_EDGE_TYPES,
  paletteGroups: IDEF0_PALETTE,
  convertGroups: IDEF0_CONVERT_GROUPS,
  defaultNodeType: 'idef0Function',
  defaultEdgeType: (diagram, source, target, targetSide) => idef0Rules.defaultEdgeType(diagram, source, target, targetSide),
  canConnect: (diagram, source, target, type) => idef0Rules.canConnect(diagram, source, target, type),
  containerAt: () => null,
  sidesFor: (edgeType, source, target) => idef0Rules.sidesFor(edgeType, source, target),
  validate: validateIdef0,
  rules: idef0Rules,
  onCreateNode(node, diagram) {
    if (node.type === 'idef0Function' && !node.props.number) {
      node.props.number = nextNodeNumber(diagram, diagram.meta?.parentNumber || 'A0');
    }
    if (node.type === 'idef0Anchor' && !node.props.icom) {
      node.props.icom = nextIcomCode(diagram, node.props.role || 'input');
    }
    return node;
  },
});

export function getNotation(id) {
  return notations.get(id) || notations.get('bpmn');
}

export function notationList() {
  return [...notations.values()];
}

export function nodeTypeOf(notationId, typeId) {
  return getNotation(notationId).nodeTypes[typeId] || null;
}

export function edgeTypeOf(notationId, typeId) {
  return getNotation(notationId).edgeTypes[typeId] || null;
}

/** Type descriptor for any element (node or edge) of a diagram. */
export function descriptorFor(diagram, element) {
  const notation = getNotation(diagram.notation);
  if (!element) return null;
  return notation.nodeTypes[element.type] || notation.edgeTypes[element.type] || null;
}

export function isEdgeType(notationId, typeId) {
  return !!getNotation(notationId).edgeTypes[typeId];
}

export function typeName(notationId, typeId, locale = 'en') {
  const notation = getNotation(notationId);
  const type = notation.nodeTypes[typeId] || notation.edgeTypes[typeId];
  return type ? localName(type.name, locale) : typeId;
}

/** Palette entries (nodes + connectors) for a notation. */
export function paletteFor(notationId) {
  const notation = getNotation(notationId);
  const groups = notation.paletteGroups.map((g) => ({ ...g, items: [] }));
  const byId = new Map(groups.map((g) => [g.id, g]));
  for (const type of Object.values(notation.nodeTypes)) {
    if (type.palette === false) continue;
    const group = byId.get(type.group);
    if (group) group.items.push({ kind: 'node', type: type.id, name: type.name, descriptor: type });
  }
  for (const type of Object.values(notation.edgeTypes)) {
    if (type.palette === false) continue;
    const group = byId.get('connectors');
    if (group) group.items.push({ kind: 'edge', type: type.id, name: type.name, descriptor: type });
  }
  return groups.filter((g) => g.items.length);
}

/** Creates a node of `typeId` positioned so that (x, y) is its centre. */
export function makeNode(notationId, typeId, x, y, overrides = {}) {
  const notation = getNotation(notationId);
  const type = notation.nodeTypes[typeId] || notation.nodeTypes[notation.defaultNodeType];
  const size = overrides.size || type.defaultSize;
  const node = createNode({
    type: type.id,
    x: Math.round(x - size.w / 2),
    y: Math.round(y - size.h / 2),
    w: size.w,
    h: size.h,
    label: overrides.label ?? '',
    props: overrides.props || {},
    style: overrides.style || {},
    parent: overrides.parent || null,
  });
  return node;
}

export { localName };
