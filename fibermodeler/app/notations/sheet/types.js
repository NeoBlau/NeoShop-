/**
 * Worksheet element catalogue.
 *
 * Worksheets are the fill-in documents of a process workshop: the
 * impact / effort matrix for ranking changes, the implementation-risk sheet and
 * the customer journey map. They live on the same canvas as diagrams, so they
 * can be dragged, resized, searched, exported and saved like everything else -
 * but they have no connections: what matters is where a card sits.
 */
import { esc, n, rect, textBlock } from '../shared.js';

/** Quadrant tones of the impact / effort matrix (also used by the checks). */
export const QUADRANTS = {
  win: { id: 'win', color: '#2a9d8f', fill: 'rgba(42,157,143,0.13)' },
  big: { id: 'big', color: '#4f7cd6', fill: 'rgba(79,124,214,0.13)' },
  fill: { id: 'fill', color: '#c98a1b', fill: 'rgba(201,138,27,0.12)' },
  drop: { id: 'drop', color: '#d0504a', fill: 'rgba(208,80,74,0.11)' },
};

export const TONES = {
  teal: '#5fb8a6',
  orange: '#e0a070',
  violet: '#9aa7e0',
};

const AXIS_W = 56; // strip with the vertical axis label
const AXIS_H = 44; // strip with the horizontal axis label

/** Plot area of a matrix board and its four quadrants, in the board's own coordinates. */
export function matrixGeometry(board) {
  const x = AXIS_W;
  const y = 0;
  const w = Math.max(40, board.w - AXIS_W);
  const h = Math.max(40, board.h - AXIS_H);
  const hw = w / 2;
  const hh = h / 2;
  return {
    area: { x, y, w, h },
    quadrants: {
      win: { x, y, w: hw, h: hh },
      big: { x: x + hw, y, w: hw, h: hh },
      fill: { x, y: y + hh, w: hw, h: hh },
      drop: { x: x + hw, y: y + hh, w: hw, h: hh },
    },
  };
}

/**
 * Quadrant a rectangle (in diagram coordinates) sits in, or null when its
 * centre is off the plot area. High impact is the top half, high effort the
 * right half - the layout of the classic matrix.
 */
export function matrixQuadrant(board, rectangle) {
  const geometry = matrixGeometry(board);
  const cx = rectangle.x + rectangle.w / 2 - board.x;
  const cy = rectangle.y + rectangle.h / 2 - board.y;
  const { area } = geometry;
  if (cx < area.x || cx > area.x + area.w || cy < area.y || cy > area.y + area.h) return null;
  const top = cy < area.y + area.h / 2;
  const left = cx < area.x + area.w / 2;
  if (top) return left ? 'win' : 'big';
  return left ? 'fill' : 'drop';
}

/** "1, 0, -1" -> [1, 0, -1]; anything unreadable is dropped. */
export function parseScores(text) {
  return String(text ?? '')
    .split(/[;,\s]+/)
    .filter((part) => part !== '')
    .map(Number)
    .filter((value) => Number.isFinite(value));
}

function textOf(node) {
  return node.style?.textColor || 'var(--el-text)';
}

const P = {
  name: (en, ru, type = 'textarea') => ({ key: 'label', type, rows: 3, label: { en, ru }, group: 'general' }),
  id: { key: 'id', type: 'id', label: { en: 'ID', ru: 'Идентификатор' }, group: 'general' },
  documentation: { key: 'documentation', type: 'textarea', label: { en: 'Documentation', ru: 'Документация' }, group: 'documentation', rows: 4 },
};

export const SHEET_TYPES = {};

function register(type) {
  SHEET_TYPES[type.id] = type;
  return type;
}

/* ------------------------------------------------------------------ matrix */

register({
  id: 'sheetBoard',
  category: 'board',
  name: { en: 'Impact / effort matrix', ru: 'Матрица «эффект — усилия»' },
  palette: true,
  group: 'matrix',
  defaultSize: { w: 940, h: 600 },
  paletteSize: { w: 110, h: 62 },
  minSize: { w: 420, h: 300 },
  resizable: true,
  container: true,
  zIndex: -20,
  labelPlacement: 'inside',
  draw: (node) => {
    const { area, quadrants } = matrixGeometry(node);
    const titles = {
      win: node.props?.qWin || '',
      big: node.props?.qBig || '',
      fill: node.props?.qFill || '',
      drop: node.props?.qDrop || '',
    };
    let markup = '';
    for (const [id, box] of Object.entries(quadrants)) {
      const tone = QUADRANTS[id];
      markup += rect(box.x, box.y, box.w, box.h, 0, `fill="${tone.fill}" stroke="rgba(100,116,139,0.38)" stroke-width="1"`);
      markup += `<text class="el-label" x="${n(box.x + 14)}" y="${n(box.y + 24)}" font-size="14" font-weight="700" fill="${tone.color}">${esc(titles[id])}</text>`;
    }
    // the outer frame sits on top of the quadrant edges
    markup += rect(area.x + 0.5, area.y + 0.5, area.w - 1, area.h - 1, 0, 'fill="none" stroke="rgba(100,116,139,0.6)" stroke-width="1.4"');
    markup += `<g transform="translate(${n(AXIS_W / 2 - 2)},${n(area.h / 2)}) rotate(-90)">${textBlock(node.props?.yAxis || '', {
      x: -area.h / 2,
      y: -12,
      width: area.h,
      height: 24,
      fontSize: 13,
      bold: true,
      color: 'var(--el-text)',
      maxLines: 1,
    })}</g>`;
    markup += textBlock(node.props?.xAxis || '', {
      x: area.x,
      y: area.h + 6,
      width: area.w,
      height: AXIS_H - 10,
      fontSize: 13,
      bold: true,
      color: 'var(--el-text)',
      maxLines: 1,
    });
    return markup;
  },
  props: [
    P.id,
    { key: 'yAxis', type: 'text', label: { en: 'Vertical axis', ru: 'Вертикальная ось' }, group: 'general' },
    { key: 'xAxis', type: 'text', label: { en: 'Horizontal axis', ru: 'Горизонтальная ось' }, group: 'general' },
    { key: 'qWin', type: 'text', label: { en: 'Top left', ru: 'Левый верхний' }, group: 'general' },
    { key: 'qBig', type: 'text', label: { en: 'Top right', ru: 'Правый верхний' }, group: 'general' },
    { key: 'qFill', type: 'text', label: { en: 'Bottom left', ru: 'Левый нижний' }, group: 'general' },
    { key: 'qDrop', type: 'text', label: { en: 'Bottom right', ru: 'Правый нижний' }, group: 'general' },
    P.documentation,
  ],
});

register({
  id: 'sheetItem',
  category: 'card',
  name: { en: 'Change card', ru: 'Карточка изменения' },
  palette: true,
  group: 'matrix',
  defaultSize: { w: 188, h: 66 },
  paletteSize: { w: 86, h: 40 },
  minSize: { w: 120, h: 48 },
  resizable: true,
  labelPlacement: 'inside',
  draw: (node) => {
    const stroke = node.style?.stroke || 'var(--accent)';
    const no = node.props?.no || '';
    let markup = rect(1, 1, node.w - 2, node.h - 2, 10, `fill="var(--el-fill)" stroke="${stroke}" stroke-width="1.5"`);
    markup += `<circle cx="22" cy="${n(node.h / 2)}" r="13" fill="${stroke}"/>`;
    markup += `<text class="el-label" x="22" y="${n(node.h / 2 + 4.5)}" text-anchor="middle" font-size="13" font-weight="700" fill="#fff">${esc(no)}</text>`;
    markup += textBlock(node.label || '…', {
      x: 42,
      y: 4,
      width: node.w - 50,
      height: node.h - 8,
      align: 'left',
      fontSize: 12,
      color: node.label ? textOf(node) : 'var(--el-muted, #94a3b8)',
      maxLines: 4,
    });
    return markup;
  },
  props: [
    P.name('Change', 'Изменение'),
    P.id,
    { key: 'no', type: 'text', label: { en: 'Number', ru: 'Номер' }, group: 'general' },
    { key: 'basis', type: 'textarea', rows: 3, label: { en: 'Why this position', ru: 'Почему здесь' }, group: 'general' },
    P.documentation,
  ],
});

register({
  id: 'sheetText',
  category: 'text',
  name: { en: 'Text block', ru: 'Текстовый блок' },
  palette: true,
  group: 'matrix',
  defaultSize: { w: 340, h: 160 },
  paletteSize: { w: 90, h: 48 },
  minSize: { w: 140, h: 60 },
  resizable: true,
  labelPlacement: 'inside',
  draw: (node) => {
    const stroke = node.style?.stroke || 'rgba(100,116,139,0.5)';
    const title = node.props?.title || '';
    const titleH = title ? 26 : 0;
    let markup = rect(0.5, 0.5, node.w - 1, node.h - 1, 10, `fill="var(--el-fill)" stroke="${stroke}" stroke-width="1.2"`);
    if (title) {
      markup += textBlock(title, {
        x: 14,
        y: 8,
        width: node.w - 28,
        height: 20,
        align: 'left',
        fontSize: 13,
        bold: true,
        color: 'var(--accent)',
        maxLines: 2,
      });
    }
    markup += textBlock(node.label || '…', {
      x: 14,
      y: 10 + titleH,
      width: node.w - 28,
      height: node.h - 20 - titleH,
      align: 'left',
      valign: 'top',
      fontSize: 12.5,
      color: node.label ? textOf(node) : 'var(--el-muted, #94a3b8)',
      maxLines: 14,
    });
    return markup;
  },
  props: [
    { key: 'title', type: 'text', label: { en: 'Heading', ru: 'Заголовок' }, group: 'general' },
    P.name('Text', 'Текст'),
    P.id,
    { key: 'role', type: 'text', label: { en: 'Role (why / hint)', ru: 'Роль (why / hint)' }, group: 'advanced' },
    P.documentation,
  ],
});

register({
  id: 'sheetTitle',
  category: 'text',
  name: { en: 'Sheet title', ru: 'Заголовок листа' },
  palette: true,
  group: 'questions',
  defaultSize: { w: 900, h: 70 },
  paletteSize: { w: 100, h: 40 },
  minSize: { w: 240, h: 44 },
  resizable: true,
  labelPlacement: 'inside',
  draw: (node) => {
    const kicker = node.props?.kicker || '';
    let markup = '';
    if (kicker) {
      markup += `<text class="el-label" x="2" y="14" font-size="11.5" font-weight="700" letter-spacing="1.4" fill="var(--accent)">${esc(kicker.toUpperCase())}</text>`;
    }
    markup += textBlock(node.label, {
      x: 2,
      y: kicker ? 20 : 0,
      width: node.w - 4,
      height: node.h - (kicker ? 20 : 0),
      align: 'left',
      valign: 'top',
      fontSize: 24,
      bold: true,
      color: textOf(node),
      maxLines: 2,
    });
    return markup;
  },
  props: [P.name('Title', 'Заголовок', 'text'), { key: 'kicker', type: 'text', label: { en: 'Small line above', ru: 'Строка над заголовком' }, group: 'general' }, P.id],
});

/* --------------------------------------------------------------- questions */

register({
  id: 'sheetQuestion',
  category: 'card',
  name: { en: 'Question with an answer', ru: 'Вопрос с ответом' },
  palette: true,
  group: 'questions',
  defaultSize: { w: 900, h: 176 },
  paletteSize: { w: 110, h: 52 },
  minSize: { w: 300, h: 90 },
  resizable: true,
  labelPlacement: 'inside',
  draw: (node) => {
    const bar = TONES[node.props?.tone] || TONES.teal;
    const question = node.props?.question || '';
    let markup = rect(0.5, 0.5, node.w - 1, node.h - 1, 8, 'fill="var(--el-fill)" stroke="rgba(100,116,139,0.4)" stroke-width="1"');
    markup += rect(0, 0, 9, node.h, 4, `fill="${bar}"`);
    markup += textBlock(question, {
      x: 26,
      y: 10,
      width: node.w - 44,
      height: 40,
      align: 'left',
      valign: 'top',
      fontSize: 14,
      bold: true,
      color: textOf(node),
      maxLines: 2,
    });
    markup += `<line x1="26" y1="56" x2="${n(node.w - 18)}" y2="56" stroke="rgba(100,116,139,0.25)" stroke-width="1"/>`;
    markup += textBlock(node.label || '…', {
      x: 26,
      y: 64,
      width: node.w - 44,
      height: node.h - 74,
      align: 'left',
      valign: 'top',
      fontSize: 13,
      color: node.label ? textOf(node) : 'var(--el-muted, #94a3b8)',
      maxLines: 9,
    });
    return markup;
  },
  props: [
    { key: 'question', type: 'textarea', rows: 2, label: { en: 'Question', ru: 'Вопрос' }, group: 'general' },
    P.name('Answer', 'Ответ'),
    P.id,
    {
      key: 'tone',
      type: 'select',
      label: { en: 'Colour bar', ru: 'Цвет полосы' },
      group: 'general',
      options: [
        { value: 'teal', label: { en: 'Teal', ru: 'Бирюзовый' } },
        { value: 'orange', label: { en: 'Orange', ru: 'Оранжевый' } },
        { value: 'violet', label: { en: 'Violet', ru: 'Фиолетовый' } },
      ],
    },
    P.documentation,
  ],
});

/* ------------------------------------------------------------ customer path */

register({
  id: 'journeyStage',
  category: 'journey',
  name: { en: 'Journey stage', ru: 'Этап пути' },
  palette: true,
  group: 'journey',
  defaultSize: { w: 196, h: 60 },
  paletteSize: { w: 92, h: 40 },
  minSize: { w: 100, h: 40 },
  resizable: true,
  labelPlacement: 'inside',
  draw: (node) => {
    const no = node.props?.no || '';
    let markup = rect(0.5, 0.5, node.w - 1, node.h - 1, 8, 'fill="rgba(10,108,241,0.12)" stroke="var(--accent)" stroke-width="1.3"');
    if (no) {
      markup += `<circle cx="20" cy="${n(node.h / 2)}" r="11" fill="var(--accent)"/>`;
      markup += `<text class="el-label" x="20" y="${n(node.h / 2 + 4)}" text-anchor="middle" font-size="12" font-weight="700" fill="#fff">${esc(no)}</text>`;
    }
    markup += textBlock(node.label || '…', {
      x: no ? 36 : 8,
      y: 2,
      width: node.w - (no ? 44 : 16),
      height: node.h - 4,
      align: no ? 'left' : 'center',
      fontSize: 12.5,
      bold: true,
      color: textOf(node),
      maxLines: 3,
    });
    return markup;
  },
  props: [P.name('Stage', 'Этап', 'text'), P.id, { key: 'no', type: 'text', label: { en: 'Number', ru: 'Номер' }, group: 'general' }, P.documentation],
});

register({
  id: 'journeyRow',
  category: 'journey',
  name: { en: 'Journey row heading', ru: 'Заголовок строки пути' },
  palette: true,
  group: 'journey',
  defaultSize: { w: 150, h: 96 },
  paletteSize: { w: 92, h: 40 },
  minSize: { w: 80, h: 36 },
  resizable: true,
  labelPlacement: 'inside',
  draw: (node) =>
    rect(0.5, 0.5, node.w - 1, node.h - 1, 8, 'fill="rgba(100,116,139,0.16)" stroke="rgba(100,116,139,0.45)" stroke-width="1"') +
    textBlock(node.label || '…', {
      x: 10,
      y: 2,
      width: node.w - 20,
      height: node.h - 4,
      align: 'left',
      fontSize: 12,
      bold: true,
      color: textOf(node),
      maxLines: 5,
    }),
  props: [P.name('Heading', 'Заголовок', 'text'), P.id, P.documentation],
});

const CELL_TONES = {
  pain: { fill: 'rgba(208,80,74,0.10)', stroke: 'rgba(208,80,74,0.45)' },
  gain: { fill: 'rgba(42,157,143,0.12)', stroke: 'rgba(42,157,143,0.5)' },
  neutral: { fill: 'var(--el-fill)', stroke: 'rgba(100,116,139,0.38)' },
};

register({
  id: 'journeyCell',
  category: 'journey',
  name: { en: 'Journey cell', ru: 'Ячейка пути' },
  palette: true,
  group: 'journey',
  defaultSize: { w: 196, h: 96 },
  paletteSize: { w: 92, h: 40 },
  minSize: { w: 80, h: 36 },
  resizable: true,
  labelPlacement: 'inside',
  draw: (node) => {
    const tone = CELL_TONES[node.props?.tone] || CELL_TONES.neutral;
    return (
      rect(0.5, 0.5, node.w - 1, node.h - 1, 8, `fill="${tone.fill}" stroke="${tone.stroke}" stroke-width="1"`) +
      textBlock(node.label || '…', {
        x: 9,
        y: 7,
        width: node.w - 18,
        height: node.h - 12,
        align: 'left',
        valign: 'top',
        fontSize: 11.5,
        color: node.label ? textOf(node) : 'var(--el-muted, #94a3b8)',
        maxLines: 12,
      })
    );
  },
  props: [
    P.name('Text', 'Текст'),
    P.id,
    {
      key: 'tone',
      type: 'select',
      label: { en: 'Meaning', ru: 'Смысл' },
      group: 'general',
      options: [
        { value: 'neutral', label: { en: 'Neutral', ru: 'Нейтрально' } },
        { value: 'pain', label: { en: 'Pain point', ru: 'Боль' } },
        { value: 'gain', label: { en: 'Improvement', ru: 'Улучшение' } },
      ],
    },
    P.documentation,
  ],
});

register({
  id: 'journeyCurve',
  category: 'journey',
  name: { en: 'Emotion curve', ru: 'Кривая эмоций' },
  palette: true,
  group: 'journey',
  defaultSize: { w: 760, h: 150 },
  paletteSize: { w: 100, h: 44 },
  minSize: { w: 200, h: 90 },
  resizable: true,
  labelPlacement: 'inside',
  draw: (node) => {
    const scores = parseScores(node.props?.scores);
    const pad = 22;
    const mid = node.h / 2;
    const span = node.h / 2 - pad;
    let markup = rect(0.5, 0.5, node.w - 1, node.h - 1, 8, 'fill="var(--el-fill)" stroke="rgba(100,116,139,0.38)" stroke-width="1"');
    markup += `<line x1="8" y1="${n(mid)}" x2="${n(node.w - 8)}" y2="${n(mid)}" stroke="rgba(100,116,139,0.5)" stroke-width="1" stroke-dasharray="4 4"/>`;
    markup += `<text class="el-label" x="10" y="14" font-size="10" fill="#2a9d8f">+2</text>`;
    markup += `<text class="el-label" x="10" y="${n(node.h - 6)}" font-size="10" fill="#d0504a">−2</text>`;
    if (!scores.length) return markup;
    const step = node.w / scores.length;
    const points = scores.map((value, i) => ({
      x: step * (i + 0.5),
      y: mid - (Math.max(-2, Math.min(2, value)) / 2) * span,
      value,
    }));
    markup += `<polyline points="${points.map((p) => `${n(p.x)},${n(p.y)}`).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`;
    for (const p of points) {
      const color = p.value > 0 ? '#2a9d8f' : p.value < 0 ? '#d0504a' : '#64748b';
      markup += `<circle cx="${n(p.x)}" cy="${n(p.y)}" r="7" fill="${color}" stroke="var(--el-fill)" stroke-width="2"/>`;
      const sign = p.value > 0 ? '+' : p.value < 0 ? '−' : '';
      const above = p.value >= 0;
      markup += `<text class="el-label" x="${n(p.x)}" y="${n(above ? p.y - 12 : p.y + 20)}" text-anchor="middle" font-size="11.5" font-weight="700" fill="${color}">${sign}${Math.abs(p.value)}</text>`;
    }
    return markup;
  },
  props: [
    { key: 'scores', type: 'text', label: { en: 'Emotion by stage (-2 … +2)', ru: 'Эмоция по этапам (−2 … +2)' }, group: 'general', placeholder: '1, 0, -1, 2' },
    P.id,
    P.documentation,
  ],
});

export const SHEET_EDGE_TYPES = {};

export const SHEET_PALETTE = [
  { id: 'matrix', name: { en: 'Matrix', ru: 'Матрица' } },
  { id: 'questions', name: { en: 'Questions', ru: 'Вопросы' } },
  { id: 'journey', name: { en: 'Customer journey', ru: 'Путь клиента' } },
];

export const SHEET_CONVERT_GROUPS = {
  card: ['sheetItem', 'sheetQuestion'],
  text: ['sheetText', 'sheetTitle'],
  journey: ['journeyStage', 'journeyRow', 'journeyCell'],
};
