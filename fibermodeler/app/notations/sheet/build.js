/**
 * Worksheet specification -> diagram.
 *
 * A specification says what is on the sheet (changes with their impact and
 * effort scores, questions with answers, journey stages with cells); this
 * module gives it identity and geometry. The same pipeline builds the empty
 * templates a user starts from and the filled sheets shipped in a library.
 */
import { createDiagram, createNode } from '../../core/model.js';
import { matrixGeometry } from './types.js';

export function pick(value, locale) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  return value[locale] || value.en || value.ru || '';
}

/** The captions every matrix carries, in both languages. */
export const STRINGS = {
  quadrants: {
    win: { ru: 'Быстрые победы', en: 'Quick wins' },
    big: { ru: 'Крупные проекты', en: 'Major projects' },
    fill: { ru: 'По возможности', en: 'When possible' },
    drop: { ru: 'Отказаться', en: 'Drop' },
  },
  yAxis: { ru: 'Эффект (Impact) ↑ выше', en: 'Impact ↑ higher' },
  xAxis: { ru: 'Усилия (Effort) → выше', en: 'Effort → higher' },
  hintTitle: { ru: 'Как заполнять', en: 'How to fill it in' },
  hint: {
    ru: 'Впишите 3–5 изменений из своей TO-BE (можно просто номерами 1, 2, 3…) и отметьте точкой их место на матрице слева.\n\nЗатем для изменения, которое попало в «Быстрые победы», одним предложением объясните, почему это логично внедрить первым.',
    en: 'Write down 3–5 changes from your TO-BE (numbers 1, 2, 3… are enough) and mark their place on the matrix on the left.\n\nThen, for the change that landed in “Quick wins”, explain in one sentence why it makes sense to implement it first.',
  },
  whyTitle: { ru: 'Почему внедрять первым', en: 'Why implement it first' },
  basisTitle: { ru: 'Как оценено', en: 'How it was scored' },
  changeTitle: { ru: 'Изменение, которое вы внедряете', en: 'The change you are implementing' },
};

const CARD = { w: 188, h: 66 };
const SLOT_GAP = 8;
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

/** Quadrant a pair of 1–10 scores belongs to: impact ≥ 6 is the top half, effort ≤ 5 the left half. */
export function quadrantForScores(impact, effort) {
  const top = impact >= 6;
  const left = effort <= 5;
  if (top) return left ? 'win' : 'big';
  return left ? 'fill' : 'drop';
}

/** Evenly spaced card slots inside a quadrant (a grid, so cards never overlap). */
function quadrantSlots(box) {
  const low = { x: box.x + 10, y: box.y + 38 };
  const high = { x: box.x + box.w - 10 - CARD.w, y: box.y + box.h - 10 - CARD.h };
  const cols = Math.max(1, Math.floor((high.x - low.x + CARD.w + SLOT_GAP) / (CARD.w + SLOT_GAP)));
  const rows = Math.max(1, Math.floor((high.y - low.y + CARD.h + SLOT_GAP) / (CARD.h + SLOT_GAP)));
  const slots = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      slots.push({
        x: cols === 1 ? low.x : low.x + (c * (high.x - low.x)) / (cols - 1),
        y: rows === 1 ? low.y : low.y + (r * (high.y - low.y)) / (rows - 1),
        w: CARD.w,
        h: CARD.h,
      });
    }
  }
  return { slots, low, high };
}

/**
 * Positions of the cards, relative to the board's top-left corner. A card goes
 * to the free slot of its quadrant that is closest to the point its scores ask
 * for, so the position always agrees with the scores and no two cards overlap
 * (a quadrant holds six; beyond that the extra cards stack on the nearest slot).
 */
export function placeCards(items, board) {
  const geometry = matrixGeometry(board);
  const used = new Map(); // quadrant -> set of slot indexes
  const out = new Map();
  const order = [...items.keys()].sort((a, b) => items[b].impact - items[a].impact || items[a].effort - items[b].effort);
  for (const index of order) {
    const item = items[index];
    const impact = clamp(item.impact, 1, 10);
    const effort = clamp(item.effort, 1, 10);
    const quadrant = quadrantForScores(impact, effort);
    const { slots, low, high } = quadrantSlots(geometry.quadrants[quadrant]);
    // where inside its quadrant the scores point: 0 = left / top edge, 1 = right / bottom edge
    const fx = effort <= 5 ? (effort - 0.5) / 5 : (effort - 5.5) / 5;
    const fy = impact >= 6 ? 1 - (impact - 5.5) / 5 : 1 - (impact - 0.5) / 5;
    const want = { x: low.x + clamp(fx, 0, 1) * (high.x - low.x), y: low.y + clamp(fy, 0, 1) * (high.y - low.y) };
    const taken = used.get(quadrant) || new Set();
    let best = -1;
    let bestDistance = Infinity;
    slots.forEach((slot, i) => {
      const distance = Math.hypot(slot.x - want.x, slot.y - want.y) + (taken.has(i) ? 1e6 : 0);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    });
    taken.add(best);
    used.set(quadrant, taken);
    out.set(index, slots[best]);
  }
  return out;
}

function node(diagram, type, options) {
  const made = createNode({ type, ...options });
  diagram.nodes.push(made);
  return made;
}

/* ------------------------------------------------------------------ matrix */

function buildMatrix(diagram, spec, locale) {
  const title = pick(spec.title, locale);
  node(diagram, 'sheetTitle', {
    x: 0,
    y: 0,
    w: 1320,
    h: 70,
    label: title,
    props: { kicker: pick(spec.kicker, locale) },
  });

  const boardBox = { x: 0, y: 96, w: 940, h: 600 };
  const board = node(diagram, 'sheetBoard', {
    ...boardBox,
    props: {
      yAxis: pick(STRINGS.yAxis, locale),
      xAxis: pick(STRINGS.xAxis, locale),
      qWin: pick(STRINGS.quadrants.win, locale),
      qBig: pick(STRINGS.quadrants.big, locale),
      qFill: pick(STRINGS.quadrants.fill, locale),
      qDrop: pick(STRINGS.quadrants.drop, locale),
    },
  });

  const items = spec.items || [];
  const scored = items.filter((item) => item.placed !== false);
  const positions = placeCards(scored, board);
  let scoredIndex = 0;
  items.forEach((item, index) => {
    const no = String(item.no ?? index + 1);
    const common = {
      w: CARD.w,
      h: CARD.h,
      label: pick(item.label, locale),
      props: { no, ...(item.basis ? { basis: pick(item.basis, locale) } : {}) },
    };
    if (item.placed === false) {
      // a blank card waits below the board until its owner decides where it goes
      node(diagram, 'sheetItem', { ...common, x: boardBox.x + 60 + index * (CARD.w + 20), y: boardBox.y + boardBox.h + 30 });
      return;
    }
    const spot = positions.get(scoredIndex++);
    node(diagram, 'sheetItem', { ...common, x: board.x + spot.x, y: board.y + spot.y, parent: board.id });
  });

  const column = 980;
  node(diagram, 'sheetText', {
    x: column,
    y: 96,
    w: 340,
    h: 218,
    label: pick(spec.hint ?? STRINGS.hint, locale),
    props: { title: pick(STRINGS.hintTitle, locale), role: 'hint' },
  });
  node(diagram, 'sheetText', {
    x: column,
    y: 334,
    w: 340,
    h: boardBox.y + boardBox.h - 334,
    label: pick(spec.why, locale),
    props: { title: pick(STRINGS.whyTitle, locale), role: 'why' },
  });
  if (spec.note) {
    // how the scores were obtained, under the whole sheet
    node(diagram, 'sheetText', {
      x: 0,
      y: boardBox.y + boardBox.h + 24,
      w: 1320,
      h: spec.noteHeight || 150,
      label: pick(spec.note, locale),
      props: { title: pick(STRINGS.basisTitle, locale), role: 'basis' },
    });
  }
}

/* ------------------------------------------------------------------- risks */

function buildRisks(diagram, spec, locale) {
  node(diagram, 'sheetTitle', { x: 0, y: 0, w: 900, h: 70, label: pick(spec.title, locale), props: { kicker: pick(spec.kicker, locale) } });
  node(diagram, 'sheetText', {
    x: 0,
    y: 90,
    w: 900,
    h: spec.changeHeight || 96,
    label: pick(spec.change, locale),
    props: { title: pick(spec.changeTitle ?? STRINGS.changeTitle, locale), role: 'change' },
  });
  let y = 90 + (spec.changeHeight || 96) + 22;
  const tones = ['teal', 'orange', 'violet'];
  (spec.questions || []).forEach((entry, index) => {
    const height = entry.height || 176;
    node(diagram, 'sheetQuestion', {
      x: 0,
      y,
      w: 900,
      h: height,
      label: pick(entry.answer, locale),
      props: { question: pick(entry.question, locale), tone: entry.tone || tones[index % tones.length] },
    });
    y += height + 20;
  });
  if (spec.footer) {
    node(diagram, 'sheetText', {
      x: 0,
      y,
      w: 900,
      h: spec.footerHeight || 96,
      label: pick(spec.footer, locale),
      props: { title: pick(spec.footerTitle ?? '', locale), role: 'hint' },
    });
  }
}

/* ------------------------------------------------------------------- table */

/**
 * A fill-in table: a header row and rows of cells, as in the worksheets of a
 * seminar (step / technology / reason). Cells reuse the journey cell, so the
 * checks, export and editing work as they do on a journey map.
 */
function buildTable(diagram, spec, locale) {
  const columns = spec.columns || [];
  const gap = 8;
  const width = columns.reduce((sum, column) => sum + column.w, 0) + gap * (columns.length - 1);
  node(diagram, 'sheetTitle', { x: 0, y: 0, w: Math.min(width, 1400), h: 70, label: pick(spec.title, locale), props: { kicker: pick(spec.kicker, locale) } });
  const lefts = [];
  let x = 0;
  for (const column of columns) {
    lefts.push(x);
    x += column.w + gap;
  }
  let y = 92;
  columns.forEach((column, index) => {
    node(diagram, 'journeyStage', { x: lefts[index], y, w: column.w, h: 44, label: pick(column.name, locale) });
  });
  y += 44 + gap;
  for (const row of spec.rows || []) {
    const height = row.height || 78;
    columns.forEach((column, index) => {
      const cell = (row.cells || [])[index] ?? '';
      node(diagram, 'journeyCell', {
        x: lefts[index],
        y,
        w: column.w,
        h: height,
        label: pick(cell.text ?? cell, locale),
        props: { tone: (cell && cell.tone) || (index === 0 ? 'neutral' : row.tone || 'neutral') },
      });
    });
    y += height + gap;
  }
  if (spec.footer) {
    node(diagram, 'sheetText', {
      x: 0,
      y: y + 12,
      w: width,
      h: spec.footerHeight || 70,
      label: pick(spec.footer, locale),
      props: { title: pick(spec.footerTitle ?? '', locale), role: 'hint' },
    });
  }
}

/* ----------------------------------------------------------------- journey */

const JOURNEY = { head: 150, stage: 196, gap: 8, stageH: 60 };

function buildJourney(diagram, spec, locale) {
  const stages = spec.stages || [];
  const width = JOURNEY.head + JOURNEY.gap + stages.length * (JOURNEY.stage + JOURNEY.gap) - JOURNEY.gap;
  node(diagram, 'sheetTitle', { x: 0, y: 0, w: Math.min(width, 1400), h: 70, label: pick(spec.title, locale), props: { kicker: pick(spec.kicker, locale) } });

  const left = (index) => JOURNEY.head + JOURNEY.gap + index * (JOURNEY.stage + JOURNEY.gap);
  let y = 92;
  stages.forEach((stage, index) => {
    node(diagram, 'journeyStage', {
      x: left(index),
      y,
      w: JOURNEY.stage,
      h: JOURNEY.stageH,
      label: pick(stage.name, locale),
      props: { no: String(index + 1) },
    });
  });
  y += JOURNEY.stageH + JOURNEY.gap;

  for (const row of spec.rows || []) {
    const height = row.height || 96;
    node(diagram, 'journeyRow', { x: 0, y, w: JOURNEY.head, h: height, label: pick(row.label, locale) });
    if (row.curve) {
      node(diagram, 'journeyCurve', {
        x: left(0),
        y,
        w: stages.length * (JOURNEY.stage + JOURNEY.gap) - JOURNEY.gap,
        h: height,
        props: { scores: stages.map((stage) => stage.emotion).join(', ') },
      });
    } else {
      stages.forEach((stage, index) => {
        const cell = (row.cells || [])[index] || {};
        node(diagram, 'journeyCell', {
          x: left(index),
          y,
          w: JOURNEY.stage,
          h: height,
          label: pick(cell.text ?? cell, locale),
          props: { tone: cell.tone || row.tone || 'neutral' },
        });
      });
    }
    y += height + JOURNEY.gap;
  }
}

/* ------------------------------------------------------------------- entry */

const BUILDERS = { matrix: buildMatrix, risks: buildRisks, form: buildRisks, table: buildTable, journey: buildJourney };

export function buildSheetDiagrams(spec, options = {}) {
  const locale = options.locale || 'ru';
  const build = BUILDERS[spec.kind];
  if (!build) return [];
  const diagram = createDiagram({ notation: 'sheet', name: options.name || pick(spec.name, locale) || 'Worksheet' });
  build(diagram, spec, locale);
  diagram.meta.sheet = { kind: spec.kind };
  if (spec.description) diagram.meta.description = pick(spec.description, locale);
  if (spec.documentation) diagram.meta.documentation = pick(spec.documentation, locale);
  return [diagram];
}
