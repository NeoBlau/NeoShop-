/** IDEF0 model validation rules. */
import { IDEF0_EDGE_TYPES, IDEF0_TYPES } from './types.js';
import { isAnchor, isFunction, roleOfEdge } from './rules.js';

const MSG = {
  noFunctions: { en: 'Diagram contains no function box', ru: 'На диаграмме нет ни одного функционального блока' },
  tooManyFunctions: {
    en: 'An IDEF0 diagram should contain 3 to 6 function boxes ({count} found)',
    ru: 'Диаграмма IDEF0 должна содержать от 3 до 6 блоков (сейчас {count})',
  },
  contextSingle: {
    en: 'A context diagram (A-0) must contain exactly one function box',
    ru: 'Контекстная диаграмма (A-0) должна содержать ровно один блок',
  },
  noControl: { en: '“{name}” has no control arrow (mandatory in IDEF0)', ru: 'У блока «{name}» нет стрелки управления (обязательна в IDEF0)' },
  noOutput: { en: '“{name}” has no output arrow', ru: 'У блока «{name}» нет стрелки выхода' },
  noInputMechanism: { en: '“{name}” has neither input nor mechanism arrows', ru: 'У блока «{name}» нет ни входа, ни механизма' },
  duplicateId: { en: 'Duplicate identifier “{id}”', ru: 'Идентификатор «{id}» дублируется' },
  duplicateNumber: { en: 'Node number “{number}” is used more than once', ru: 'Номер функции «{number}» встречается несколько раз' },
  wrongSide: {
    en: 'Arrow “{name}” enters “{target}” from the wrong side for its role',
    ru: 'Стрелка «{name}» входит в «{target}» не с той стороны для своей роли',
  },
  danglingEdge: { en: 'Arrow points to a missing element', ru: 'Стрелка ведёт к несуществующему элементу' },
  unnamedArrow: { en: 'Arrow has no name', ru: 'У стрелки нет названия' },
  unnamedFunction: { en: 'Function box has no name', ru: 'У функционального блока нет названия' },
  orphanAnchor: { en: 'Boundary arrow “{name}” is not connected', ru: 'Граничная стрелка «{name}» ни с чем не соединена' },
  decompositionMismatch: {
    en: 'Decomposition of “{name}” does not carry over all its arrows',
    ru: 'В декомпозиции «{name}» отражены не все стрелки родительского блока',
  },
};

function problem(severity, key, params, target) {
  return { severity, messageKey: key, message: MSG[key], params: params || {}, ...target };
}

export function validateIdef0(diagram, doc) {
  const problems = [];
  const add = (severity, key, params, target) => problems.push(problem(severity, key, params, target));
  const functions = diagram.nodes.filter(isFunction);
  const byId = new Map(diagram.nodes.map((nd) => [nd.id, nd]));
  const isContext = /^A-0$/i.test(diagram.name?.trim() || '') || diagram.meta?.kind === 'context';

  const seen = new Set();
  for (const item of [...diagram.nodes, ...diagram.edges]) {
    if (seen.has(item.id)) add('error', 'duplicateId', { id: item.id }, { diagramId: diagram.id, elementId: item.id });
    seen.add(item.id);
  }

  if (!functions.length) add('error', 'noFunctions', {}, { diagramId: diagram.id });
  else if (isContext && functions.length !== 1) add('error', 'contextSingle', {}, { diagramId: diagram.id });
  else if (!isContext && (functions.length < 3 || functions.length > 6)) {
    add('warning', 'tooManyFunctions', { count: functions.length }, { diagramId: diagram.id });
  }

  const numbers = new Map();
  for (const fn of functions) {
    const number = fn.props?.number;
    if (!number) continue;
    if (numbers.has(number)) add('error', 'duplicateNumber', { number }, { diagramId: diagram.id, elementId: fn.id });
    numbers.set(number, fn.id);
  }

  for (const edge of diagram.edges) {
    if (!byId.has(edge.source) || !byId.has(edge.target)) {
      add('error', 'danglingEdge', {}, { diagramId: diagram.id, elementId: edge.id });
      continue;
    }
    const spec = IDEF0_EDGE_TYPES[edge.type];
    const target = byId.get(edge.target);
    if (spec && isFunction(target) && edge.targetSide && edge.targetSide !== spec.targetSide) {
      add(
        'warning',
        'wrongSide',
        { name: edge.label || edge.id, target: target.label || target.id },
        { diagramId: diagram.id, elementId: edge.id }
      );
    }
    if (!edge.label) add('info', 'unnamedArrow', {}, { diagramId: diagram.id, elementId: edge.id });
  }

  for (const fn of functions) {
    const incoming = diagram.edges.filter((e) => e.target === fn.id);
    const outgoing = diagram.edges.filter((e) => e.source === fn.id);
    const roles = new Set(incoming.map(roleOfEdge));
    const label = fn.label || fn.props?.number || fn.id;
    const target = { diagramId: diagram.id, elementId: fn.id };
    if (!fn.label) add('warning', 'unnamedFunction', {}, target);
    if (!roles.has('control')) add('error', 'noControl', { name: label }, target);
    if (!outgoing.length) add('error', 'noOutput', { name: label }, target);
    if (!roles.has('input') && !roles.has('mechanism')) add('warning', 'noInputMechanism', { name: label }, target);
  }

  for (const anchor of diagram.nodes.filter(isAnchor)) {
    const connected = diagram.edges.some((e) => e.source === anchor.id || e.target === anchor.id);
    if (!connected) {
      add('warning', 'orphanAnchor', { name: anchor.label || anchor.props?.icom || anchor.id }, { diagramId: diagram.id, elementId: anchor.id });
    }
  }

  if (doc) {
    for (const fn of functions) {
      const child = doc.decompositionOf(fn.id);
      if (!child) continue;
      const parentArrows = diagram.edges.filter((e) => e.source === fn.id || e.target === fn.id).length;
      const childAnchors = child.nodes.filter((nd) => nd.type === 'idef0Anchor').length;
      if (parentArrows > 0 && childAnchors < parentArrows) {
        add('info', 'decompositionMismatch', { name: fn.label || fn.id }, { diagramId: diagram.id, elementId: fn.id });
      }
    }
  }

  return problems;
}
