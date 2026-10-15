/**
 * WEG worksheets: the course's fill-in templates, completed for the library.
 *
 *  - an impact / effort matrix for each of the eight processes (TO-BE changes),
 *  - an implementation-risk sheet for the change each matrix puts first,
 *  - a customer journey of the buyer, as is and to be.
 *
 * They are generated like the process diagrams: from specifications and from
 * the analysis of the models, so the numbers on the sheets are the models'.
 */
import { buildSheetDiagrams, pick } from '../../../notations/sheet/build.js';
import { formatMoney } from '../../../analysis/parameters.js';
import { variantFolder } from '../../shared.js';
import { MATRICES } from './matrices.js';
import { RISKS, RISK_NOTE, RISK_QUESTIONS } from './risks.js';
import { journeySpec } from './journey.js';
import { analyse, describeMeasure, fillPlaceholders, measureChange, processPair } from './engine.js';

export const WEG_SHEETS_LIBRARY = 'wegsheets';

const SHEETS_ROOT = { ru: 'WEG/Рабочие листы', en: 'WEG/Worksheets' };
const FOLDERS = {
  matrix: { ru: 'Матрица «эффект — усилия»', en: 'Impact–effort matrix' },
  risks: { ru: 'Риски внедрения', en: 'Implementation risks' },
};
const JOURNEY_ROOT = { ru: 'WEG/Путь покупателя', en: 'WEG/Customer journey' };

const sheetsFolder = (kind, locale) => `${pick(SHEETS_ROOT, locale)}/${pick(FOLDERS[kind], locale)}`;
const journeyFolder = (variant, locale) => variantFolder(pick(JOURNEY_ROOT, locale), variant, locale);

/* ---------------------------------------------------------------- scoring */

/**
 * Scores a matrix: impact (1-10) is the change's share of the process gain,
 * the largest of the weighted shares (lead time, cost of a completed case,
 * work) scaled so the strongest change of the sheet gets 10; effort is the
 * expert score stored with the change. A change the models cannot measure
 * carries its own impact.
 */
export function scoreMatrix(entry) {
  const weights = entry.weights;
  const measured = entry.items.map((item) => {
    const measure = item.measure ? measureChange(entry.processId, item.measure) : null;
    const strength = measure
      ? Math.max(0, weights.lead * measure.share.lead, weights.cost * measure.share.cost, weights.work * measure.share.work)
      : null;
    return { item, measure, strength };
  });
  const top = Math.max(...measured.filter((row) => row.strength !== null).map((row) => row.strength), 1e-9);
  return measured.map((row) => ({
    ...row,
    impact: row.item.impact ?? Math.max(1, Math.min(10, Math.round(1 + (9 * row.strength) / top))),
    effort: row.item.effort,
  }));
}

const QUADRANT_NAMES = {
  win: { ru: 'быстрая победа', en: 'quick win' },
  big: { ru: 'крупный проект', en: 'major project' },
  fill: { ru: 'по возможности', en: 'when possible' },
  drop: { ru: 'отказаться', en: 'drop' },
};
const quadrantOf = (impact, effort) => (impact >= 6 ? (effort <= 5 ? 'win' : 'big') : effort <= 5 ? 'fill' : 'drop');

function weightsLine(weights, locale) {
  const ru = locale === 'ru';
  const n = (value) => String(value).replace('.', ru ? ',' : '.');
  return ru
    ? `срок (вес ${n(weights.lead)}), стоимость доведённого до конца случая (вес ${n(weights.cost)}), трудозатраты (вес ${n(weights.work)})`
    : `lead time (weight ${n(weights.lead)}), cost of a completed case (weight ${n(weights.cost)}), work (weight ${n(weights.work)})`;
}

const WEIGHT_REASONS = {
  'weg-make-motor-tobe': {
    ru: 'Срок на линии измеряется минутами, у которых нет цены, поэтому его вес снижен.',
    en: 'Lead time on a line is measured in minutes that carry no price, so its weight is reduced.',
  },
  'weg-procurement-tobe': {
    ru: 'Срок поставки в основном ожидание, а не работа, поэтому вес срока и трудозатрат снижен.',
    en: 'Supply lead time is mostly waiting rather than work, so the weight of lead time and work is reduced.',
  },
  'weg-npd-tobe': {
    ru: 'Для разработки продукта важнее время выхода на рынок, чем стоимость одного проекта, поэтому вес стоимости снижен.',
    en: 'For product development time to market matters more than the cost of one project, so the weight of cost is reduced.',
  },
};

function matrixNote(entry, pair, locale) {
  const ru = locale === 'ru';
  const before = analyse(pair.asis);
  const after = analyse(pair.tobe);
  const days = (minutes) => `${(Math.round((minutes / 480) * 10) / 10).toString().replace('.', ru ? ',' : '.')} ${ru ? 'раб. дн.' : 'working days'}`;
  const reason = WEIGHT_REASONS[entry.processId];
  const lines = ru
    ? [
        `Эффект измерен на моделях: изменение отключают в копии TO-BE схемы, процесс пересчитывают, и берётся доля изменения в выигрыше процесса; самое сильное изменение листа получает 10. Учитывается наибольшая из долей: ${weightsLine(entry.weights, 'ru')}.${reason ? ' ' + reason.ru : ''}`,
        'Усилия (1–10) — оценка эксперта: модели ничего не знают о договорах, ИТ и людях; 5 и меньше — левая половина матрицы. Карточка с оценками открывается в свойствах: там цифры модели и то, чего они не учитывают.',
        `Процесс целиком: срок ${days(before.lead)} → ${days(after.lead)}, стоимость доведённого до конца случая ${formatMoney(before.cost, 'R$', 'ru')} → ${formatMoney(after.cost, 'R$', 'ru')}. Нормативы и доли TO-BE — отраслевые допущения WEG, их нужно калибровать по своим данным; цифры сняты на момент сборки библиотеки.`,
      ]
    : [
        `The impact is measured on the models: the change is switched off in a copy of the TO-BE diagram, the process is recalculated and the change’s share of the process gain is taken; the strongest change of the sheet gets 10. The largest of the shares counts: ${weightsLine(entry.weights, 'en')}.${reason ? ' ' + reason.en : ''}`,
        'Effort (1–10) is an expert judgement: the models know nothing about contracts, IT or people; 5 and below is the left half of the matrix. Open a card’s properties for the model’s figures and what they leave out.',
        `The whole process: lead time ${days(before.lead)} → ${days(after.lead)}, cost of a completed case ${formatMoney(before.cost, 'R$', 'en')} → ${formatMoney(after.cost, 'R$', 'en')}. The TO-BE norms and shares are industry assumptions for WEG to calibrate against its own data; the figures were taken when the library was built.`,
      ];
  return lines.join('\n\n');
}

/** Specification of one matrix, ready for `buildSheetDiagrams`. */
export function matrixSpec(entry, locale = 'ru') {
  const pair = processPair(entry.processId);
  const scored = scoreMatrix(entry);
  const measures = Object.fromEntries(scored.filter((row) => row.measure).map((row) => [row.item.id, row.measure]));
  const first = scored.find((row) => row.item.id === entry.first);
  const processName = pick(pair.asis.name, locale);
  const items = scored.map((row, index) => {
    const detail = row.measure ? describeMeasure(row.measure, locale) : '';
    const caveat = pick(row.item.caveat, locale);
    return {
      no: String(index + 1),
      label: row.item.label,
      impact: row.impact,
      effort: row.effort,
      basis: [detail, caveat].filter(Boolean).join(' '),
    };
  });
  const why = fillPlaceholders(pick(entry.why, locale), measures, first?.measure, locale);
  const title = {
    ru: 'Рабочий лист: расставьте свои TO-BE изменения',
    en: 'Worksheet: rank your TO-BE changes',
  };
  const documentation = matrixDocumentation(entry, scored, items, pair, locale);
  return {
    notation: 'sheet',
    kind: 'matrix',
    name: { ru: `Эффект — усилия · ${pick(pair.asis.name, 'ru')}`, en: `Impact–effort · ${pick(pair.asis.name, 'en')}` },
    title,
    kicker: { ru: `WEG · ${pick(pair.asis.name, 'ru')} · TO-BE`, en: `WEG · ${pick(pair.asis.name, 'en')} · TO-BE` },
    description: {
      ru: `Матрица «эффект — усилия» по ${processName}: пять изменений из TO-BE, оценка эффекта по модели и объяснение, с чего начинать.`,
      en: `Impact–effort matrix for ${processName}: five changes from the TO-BE, impact measured on the model and a reason for where to start.`,
    },
    documentation,
    items,
    why,
    note: matrixNote(entry, pair, locale),
    noteHeight: 190,
  };
}

function matrixDocumentation(entry, scored, items, pair, locale) {
  const ru = locale === 'ru';
  const head = ru
    ? `Рабочий лист «Эффект — усилия» по процессу «${pick(pair.asis.name, 'ru')}».`
    : `Impact–effort worksheet for the process “${pick(pair.asis.name, 'en')}”.`;
  const lines = scored.map((row, index) => {
    const quadrant = pick(QUADRANT_NAMES[quadrantOf(row.impact, row.effort)], locale);
    return `${index + 1}. ${pick(row.item.label, locale)} — ${ru ? 'эффект' : 'impact'} ${row.impact}, ${ru ? 'усилия' : 'effort'} ${row.effort} (${quadrant}). ${items[index].basis}`;
  });
  const foot = ru
    ? 'Эффект посчитан по моделям библиотеки (вкладка «Анализ» покажет те же схемы), усилия — оценка эксперта. Перетащите карточку, чтобы проверить другую расстановку; проверки в нижней панели подскажут, чего не хватает листу.'
    : 'Impact is computed from the library models (the Analysis tab shows the same diagrams), effort is an expert judgement. Drag a card to try another placement; the checks in the bottom panel say what the sheet still lacks.';
  return `${head}\n\n${lines.join('\n\n')}\n\n${foot}`;
}

/* ------------------------------------------------------------------ risks */

export function riskSpec(entry, locale = 'ru') {
  const matrix = MATRICES.find((item) => item.processId === entry.processId);
  const pair = processPair(entry.processId);
  const scored = scoreMatrix(matrix);
  const measures = Object.fromEntries(scored.filter((row) => row.measure).map((row) => [row.item.id, row.measure]));
  const change = matrix.items.find((item) => item.id === entry.itemId);
  const row = scored.find((item) => item.item.id === entry.itemId);
  const quadrant = pick(QUADRANT_NAMES[quadrantOf(row.impact, row.effort)], locale);
  const process = pick(pair.asis.name, locale);
  const changeText = `${pick(change.label, locale)}\n${
    locale === 'ru'
      ? `Процесс: ${process}. На матрице: эффект ${row.impact}, усилия ${row.effort} (${quadrant}).`
      : `Process: ${process}. On the matrix: impact ${row.impact}, effort ${row.effort} (${quadrant}).`
  }\n${pick(RISK_NOTE, locale)}`;
  return {
    notation: 'sheet',
    kind: 'risks',
    name: { ru: `Риски внедрения · ${pick(pair.asis.name, 'ru')}`, en: `Implementation risks · ${pick(pair.asis.name, 'en')}` },
    title: { ru: 'Рабочий лист: риски внедрения вашего изменения', en: 'Worksheet: risks of implementing your change' },
    kicker: { ru: `WEG · ${pick(pair.asis.name, 'ru')} · TO-BE`, en: `WEG · ${pick(pair.asis.name, 'en')} · TO-BE` },
    description: {
      ru: `Три вопроса о сопротивлении изменению «${pick(change.label, 'ru')}»: кто теряет, как проявится сопротивление и какая мера снизит его сильнее всего.`,
      en: `Three questions on the resistance to “${pick(change.label, 'en')}”: who loses, how the resistance will show and which measure would reduce it most.`,
    },
    documentation: [changeText, ...entry.answers.map((answer, index) => `${index + 1}. ${pick(RISK_QUESTIONS[index], locale)}\n${fillPlaceholders(pick(answer, locale), measures, null, locale)}`)].join('\n\n'),
    change: changeText,
    changeHeight: 116,
    questions: RISK_QUESTIONS.map((question, index) => ({
      question,
      answer: fillPlaceholders(pick(entry.answers[index], locale), measures, null, locale),
      height: 156,
    })),
  };
}

/* ------------------------------------------------------------------- build */

function stamp(diagram, { folder, processId, variant, description }) {
  diagram.meta.folder = folder;
  diagram.meta.library = WEG_SHEETS_LIBRARY;
  diagram.meta.processId = processId;
  if (variant) diagram.meta.variant = variant;
  diagram.meta.author = 'WEG S.A. — public disclosure; FiberModeler';
  if (description && !diagram.meta.description) diagram.meta.description = description;
  return diagram;
}

/** Matrices, risk sheets and the two journeys, in explorer order. */
export function buildWegSheetDiagrams(locale = 'ru') {
  const diagrams = [];
  for (const entry of MATRICES) {
    const [diagram] = buildSheetDiagrams(matrixSpec(entry, locale), { locale });
    diagrams.push(stamp(diagram, { folder: sheetsFolder('matrix', locale), processId: `${entry.processId.replace(/-tobe$/, '')}-matrix`, variant: 'to-be' }));
  }
  for (const entry of RISKS) {
    const [diagram] = buildSheetDiagrams(riskSpec(entry, locale), { locale });
    diagrams.push(stamp(diagram, { folder: sheetsFolder('risks', locale), processId: `${entry.processId.replace(/-tobe$/, '')}-risks`, variant: 'to-be' }));
  }
  for (const variant of ['as-is', 'to-be']) {
    const [diagram] = buildSheetDiagrams(journeySpec(variant, locale), { locale });
    diagrams.push(stamp(diagram, { folder: journeyFolder(variant, locale), processId: variant === 'as-is' ? 'weg-journey' : 'weg-journey-tobe', variant }));
  }
  return diagrams;
}

export const WEG_SHEET_COUNT = MATRICES.length + RISKS.length + 2;

export function wegSheetsDocumentation(locale = 'ru') {
  return locale === 'en'
    ? `WEG worksheets — ${WEG_SHEET_COUNT} filled templates: an impact–effort matrix and an implementation-risk sheet for each of the eight processes, and the buyer’s journey as is and to be.\n\nImpact scores and the numbers on the journey come from the library models. Effort scores, emotions and the answers on the risk sheets are hypotheses from the logic of the processes; they are marked as such and should be checked in interviews.`
    : `Рабочие листы WEG — ${WEG_SHEET_COUNT} заполненных шаблонов: матрица «эффект — усилия» и лист рисков внедрения по каждому из восьми процессов, а также путь покупателя как есть и как будет.\n\nОценки эффекта и числа на пути покупателя взяты из моделей библиотеки. Оценки усилий, эмоции и ответы на листах рисков — гипотезы по логике процессов; они помечены как гипотезы и требуют проверки интервью.`;
}

