/**
 * IDEF0 element catalogue.
 *
 * IDEF0 semantics live in the geometry: a box side determines the ICOM role of
 * an arrow (left = Input, top = Control, right = Output, bottom = Mechanism /
 * Call).  The catalogue therefore describes both the shape and the side rules.
 */
import { esc, line, n, rect, textBlock } from '../shared.js';

export const ICOM_SIDES = { input: 'left', control: 'top', output: 'right', mechanism: 'bottom', call: 'bottom' };
export const SIDE_ROLES = { left: 'input', top: 'control', right: 'output', bottom: 'mechanism' };

function fillOf(node, fallback) {
  return node.style?.fill || fallback;
}
function strokeOf(node, fallback) {
  return node.style?.stroke || fallback;
}
function textOf(node) {
  return node.style?.textColor || 'var(--el-text)';
}

const P = {
  name: { key: 'label', type: 'text', label: { en: 'Name', ru: 'Название' }, group: 'general' },
  id: { key: 'id', type: 'id', label: { en: 'ID', ru: 'Идентификатор' }, group: 'general' },
  description: { key: 'description', type: 'textarea', label: { en: 'Description', ru: 'Описание' }, group: 'general', rows: 2 },
  documentation: { key: 'documentation', type: 'textarea', label: { en: 'Documentation', ru: 'Документация' }, group: 'documentation', rows: 5 },
};

export const IDEF0_TYPES = {};

function register(type) {
  IDEF0_TYPES[type.id] = type;
  return type;
}

register({
  id: 'idef0Function',
  category: 'function',
  name: { en: 'Function box', ru: 'Функциональный блок' },
  palette: true,
  group: 'functions',
  defaultSize: { w: 190, h: 110 },
  paletteSize: { w: 96, h: 60 },
  minSize: { w: 110, h: 70 },
  resizable: true,
  decomposable: true,
  labelPlacement: 'inside',
  draw: (node, ctx = {}) => {
    const fill = fillOf(node, 'var(--fn-fill)');
    const stroke = strokeOf(node, 'var(--fn-stroke)');
    let markup = rect(1, 1, node.w - 2, node.h - 2, 8, `fill="${fill}" stroke="${stroke}" stroke-width="1.6"`);
    markup += textBlock(node.label, {
      x: 10,
      y: 8,
      width: node.w - 20,
      height: node.h - 26,
      fontSize: 13,
      color: textOf(node),
      maxLines: 4,
    });
    const number = node.props?.number || '';
    if (number) {
      markup += `<text class="el-label idef0-number" x="${n(node.w - 8)}" y="${n(node.h - 7)}" text-anchor="end" font-size="11" fill="${textOf(
        node
      )}" opacity="0.75">${esc(number)}</text>`;
    }
    const drc = ctx.decomposed ? node.props?.drc || number : '';
    if (ctx.decomposed && drc) {
      markup += `<text class="el-label idef0-drc" x="8" y="${n(node.h - 7)}" font-size="10" fill="var(--accent)">▸ ${esc(drc)}</text>`;
    }
    return markup;
  },
  props: [
    P.name,
    P.id,
    { key: 'number', type: 'text', label: { en: 'Node number', ru: 'Номер функции' }, group: 'general' },
    { key: 'owner', type: 'text', label: { en: 'Owner', ru: 'Владелец' }, group: 'general' },
    P.description,
    P.documentation,
  ],
});

register({
  id: 'idef0Anchor',
  category: 'anchor',
  name: { en: 'ICOM boundary arrow', ru: 'Граничная стрелка (ICOM)' },
  palette: true,
  group: 'functions',
  defaultSize: { w: 110, h: 26 },
  minSize: { w: 40, h: 20 },
  resizable: true,
  labelPlacement: 'inside',
  draw: (node) => {
    const stroke = strokeOf(node, 'var(--arrow-stroke)');
    const code = node.props?.icom || '';
    const codeW = code ? 22 : 0;
    let markup = rect(0.5, 0.5, node.w - 1, node.h - 1, 6, `fill="var(--anchor-fill)" stroke="${stroke}" stroke-width="1" stroke-dasharray="4 3"`);
    if (code) {
      markup += `<text class="el-label" x="6" y="${n(node.h / 2 + 4)}" font-size="10.5" font-weight="600" fill="var(--accent)">${esc(code)}</text>`;
    }
    markup += textBlock(node.label, {
      x: 4 + codeW,
      y: 0,
      width: node.w - 8 - codeW,
      height: node.h,
      align: 'left',
      fontSize: 11,
      color: textOf(node),
      maxLines: 2,
    });
    return markup;
  },
  props: [
    P.name,
    P.id,
    {
      key: 'icom',
      type: 'text',
      label: { en: 'ICOM code', ru: 'Код ICOM' },
      group: 'general',
      placeholder: 'I1 / C1 / O1 / M1',
    },
    {
      key: 'tunnel',
      type: 'checkbox',
      label: { en: 'Tunnelled arrow', ru: 'Туннелированная стрелка' },
      group: 'advanced',
    },
    P.description,
    P.documentation,
  ],
});

register({
  id: 'idef0Note',
  category: 'note',
  name: { en: 'Note', ru: 'Примечание' },
  palette: true,
  group: 'artifacts',
  defaultSize: { w: 180, h: 60 },
  paletteSize: { w: 76, h: 46 },
  minSize: { w: 80, h: 30 },
  resizable: true,
  labelPlacement: 'inside',
  draw: (node) => {
    const stroke = strokeOf(node, 'var(--el-stroke)');
    return (
      `<path d="M 10 1 H 1 V ${n(node.h - 1)} H 10" fill="none" stroke="${stroke}" stroke-width="1.2"/>` +
      textBlock(node.label, {
        x: 14,
        y: 4,
        width: node.w - 18,
        height: node.h - 8,
        align: 'left',
        valign: 'top',
        fontSize: 11.5,
        color: textOf(node),
        maxLines: 6,
      })
    );
  },
  props: [{ ...P.name, type: 'textarea', rows: 3, label: { en: 'Text', ru: 'Текст' } }, P.id, P.documentation],
});

register({
  id: 'idef0Title',
  category: 'note',
  name: { en: 'Diagram title block', ru: 'Штамп диаграммы' },
  palette: true,
  group: 'artifacts',
  defaultSize: { w: 420, h: 54 },
  paletteSize: { w: 110, h: 44 },
  minSize: { w: 220, h: 40 },
  resizable: true,
  labelPlacement: 'inside',
  draw: (node) => {
    const stroke = strokeOf(node, 'var(--el-stroke)');
    const fill = fillOf(node, 'var(--el-fill)');
    const col = node.w * 0.62;
    return (
      rect(0.5, 0.5, node.w - 1, node.h - 1, 4, `fill="${fill}" stroke="${stroke}" stroke-width="1.2"`) +
      line(col, 0.5, col, node.h - 0.5, `stroke="${stroke}" stroke-width="1.2"`) +
      textBlock(node.label, {
        x: 8,
        y: 2,
        width: col - 16,
        height: node.h - 4,
        align: 'left',
        fontSize: 12,
        bold: true,
        color: textOf(node),
        maxLines: 2,
      }) +
      textBlock(node.props?.number || '', {
        x: col + 8,
        y: 2,
        width: node.w - col - 16,
        height: node.h - 4,
        align: 'left',
        fontSize: 11.5,
        color: textOf(node),
        maxLines: 2,
      })
    );
  },
  props: [
    { ...P.name, label: { en: 'Title', ru: 'Заголовок' } },
    P.id,
    { key: 'number', type: 'text', label: { en: 'Node number', ru: 'Номер узла' }, group: 'general' },
    P.documentation,
  ],
});

/* ------------------------------------------------------------------ arrows */

function arrowProps(role) {
  return [
    { key: 'label', type: 'text', label: { en: 'Arrow name', ru: 'Название стрелки' }, group: 'general' },
    { key: 'id', type: 'id', label: { en: 'ID', ru: 'Идентификатор' }, group: 'general' },
    {
      key: '__role',
      type: 'select',
      label: { en: 'ICOM role', ru: 'Роль ICOM' },
      group: 'general',
      options: [
        { value: 'idef0Input', label: { en: 'Input (left)', ru: 'Вход (слева)' } },
        { value: 'idef0Control', label: { en: 'Control (top)', ru: 'Управление (сверху)' } },
        { value: 'idef0Output', label: { en: 'Output (right)', ru: 'Выход (справа)' } },
        { value: 'idef0Mechanism', label: { en: 'Mechanism (bottom)', ru: 'Механизм (снизу)' } },
        { value: 'idef0Call', label: { en: 'Call (bottom)', ru: 'Вызов (снизу)' } },
      ],
    },
    { key: 'icom', type: 'text', label: { en: 'ICOM code', ru: 'Код ICOM' }, group: 'advanced' },
    { key: 'tunnelSource', type: 'checkbox', label: { en: 'Tunnel at source', ru: 'Туннель в начале' }, group: 'advanced' },
    { key: 'tunnelTarget', type: 'checkbox', label: { en: 'Tunnel at target', ru: 'Туннель в конце' }, group: 'advanced' },
    { key: 'documentation', type: 'textarea', label: { en: 'Documentation', ru: 'Документация' }, group: 'documentation', rows: 4 },
  ];
}

function arrowType(id, role, name) {
  return {
    id,
    role,
    name,
    palette: true,
    marker: role === 'call' ? 'arrow-hollow' : 'arrow-filled',
    dash: null,
    // ICOM_SIDES tells where an arrow *leaves* its source; an output arrow ends
    // on the left of whatever receives it (the next box or a boundary anchor)
    targetSide: role === 'output' ? 'left' : ICOM_SIDES[role],
    sourceSide: role === 'call' ? 'bottom' : 'right',
    props: arrowProps(role),
  };
}

export const IDEF0_EDGE_TYPES = {
  idef0Input: arrowType('idef0Input', 'input', { en: 'Input arrow', ru: 'Стрелка входа' }),
  idef0Control: arrowType('idef0Control', 'control', { en: 'Control arrow', ru: 'Стрелка управления' }),
  idef0Output: arrowType('idef0Output', 'output', { en: 'Output arrow', ru: 'Стрелка выхода' }),
  idef0Mechanism: arrowType('idef0Mechanism', 'mechanism', { en: 'Mechanism arrow', ru: 'Стрелка механизма' }),
  idef0Call: arrowType('idef0Call', 'call', { en: 'Call arrow', ru: 'Стрелка вызова' }),
};

export const IDEF0_PALETTE = [
  { id: 'functions', name: { en: 'Blocks', ru: 'Блоки' } },
  { id: 'connectors', name: { en: 'Arrows', ru: 'Стрелки' } },
  { id: 'artifacts', name: { en: 'Annotations', ru: 'Примечания' } },
];

export const IDEF0_CONVERT_GROUPS = {
  function: ['idef0Function', 'idef0Anchor'],
  note: ['idef0Note', 'idef0Title'],
};

/** Next free node number on a decomposition diagram (A1, A2, ...). */
export function nextNodeNumber(diagram, parentNumber = 'A0') {
  const used = new Set(diagram.nodes.filter((nd) => nd.type === 'idef0Function').map((nd) => nd.props?.number));
  const base = parentNumber === 'A-0' ? 'A' : parentNumber;
  for (let i = 1; i < 100; i++) {
    const candidate = base === 'A0' ? `A${i}` : `${base}${i}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${base}X`;
}

/** ICOM code for a new boundary arrow, e.g. I1, C2. */
export function nextIcomCode(diagram, role) {
  const letter = { input: 'I', control: 'C', output: 'O', mechanism: 'M', call: 'M' }[role] || 'I';
  const used = new Set(
    diagram.nodes
      .filter((nd) => nd.type === 'idef0Anchor')
      .map((nd) => nd.props?.icom)
      .filter(Boolean)
  );
  for (let i = 1; i < 100; i++) if (!used.has(`${letter}${i}`)) return `${letter}${i}`;
  return `${letter}1`;
}
