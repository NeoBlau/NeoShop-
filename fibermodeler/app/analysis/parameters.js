/**
 * Process parameters: the numbers that make a diagram calculable.
 *
 * Every parameter carries where it came from - a published report, a value
 * derived from published figures, or an industry assumption - so a reader can
 * always tell measured data from an estimate.
 */

export const SOURCE_KINDS = {
  report: { en: 'From public report', ru: 'Из публичной отчётности' },
  derived: { en: 'Derived from public figures', ru: 'Расчёт из публичных данных' },
  assumption: { en: 'Industry assumption', ru: 'Отраслевое допущение' },
};

export const DEFAULT_ANALYSIS = {
  currency: 'R$',
  volumePerYear: 0,
  hoursPerFte: 1800,
  workingDays: 250,
  roles: [], // [{ id, name, rate }] - rate is per hour in `currency`
};

/* ------------------------------------------------------------------ units */

export const TIME_UNITS = {
  min: { minutes: 1, name: { en: 'min', ru: 'мин' } },
  h: { minutes: 60, name: { en: 'h', ru: 'ч' } },
  d: { minutes: 60 * 8, name: { en: 'working days', ru: 'раб. дней' } },
  wk: { minutes: 60 * 8 * 5, name: { en: 'weeks', ru: 'недель' } },
};

/** Durations are always stored in minutes; the unit only affects display. */
export function toMinutes(value, unit = 'min') {
  const spec = TIME_UNITS[unit] || TIME_UNITS.min;
  return Number(value || 0) * spec.minutes;
}

export function formatDuration(minutes, locale = 'ru') {
  const value = Number(minutes) || 0;
  if (!value) return '—';
  const abs = Math.abs(value);
  if (abs < 60) return `${round(value, 1)} ${locale === 'ru' ? 'мин' : 'min'}`;
  if (abs < 60 * 8) return `${round(value / 60, 1)} ${locale === 'ru' ? 'ч' : 'h'}`;
  if (abs < 60 * 8 * 20) return `${round(value / (60 * 8), 1)} ${locale === 'ru' ? 'дн' : 'd'}`;
  return `${round(value / (60 * 8 * 20), 1)} ${locale === 'ru' ? 'мес' : 'mo'}`;
}

export function formatMoney(value, currency = 'R$', locale = 'ru') {
  const number = Number(value) || 0;
  const abs = Math.abs(number);
  if (abs >= 1e9) return `${currency} ${round(number / 1e9, 2)} ${locale === 'ru' ? 'млрд' : 'bn'}`;
  if (abs >= 1e6) return `${currency} ${round(number / 1e6, 2)} ${locale === 'ru' ? 'млн' : 'm'}`;
  if (abs >= 1e3) return `${currency} ${round(number / 1e3, 1)} ${locale === 'ru' ? 'тыс' : 'k'}`;
  return `${currency} ${round(number, 2)}`;
}

export function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
}

/* ------------------------------------------------------------ accessors */

export function nodeDuration(node) {
  return Math.max(0, Number(node?.props?.duration) || 0);
}

export function nodeWait(node) {
  return Math.max(0, Number(node?.props?.waitTime) || 0);
}

export function nodeCost(node) {
  return Math.max(0, Number(node?.props?.cost) || 0);
}

export function nodeResource(node) {
  return (node?.props?.resource || '').trim();
}

export function nodeResourceQty(node) {
  const value = Number(node?.props?.resourceQty);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

/** Share of tokens that take this flow, 0..1. `null` when not set. */
export function edgeProbability(edge) {
  const raw = edge?.props?.probability;
  if (raw === undefined || raw === null || raw === '') return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  return Math.min(1, Math.max(0, value / 100));
}

export function analysisSettings(diagram) {
  return { ...DEFAULT_ANALYSIS, ...(diagram?.meta?.analysis || {}) };
}

export function roleRate(settings, role) {
  const entry = (settings.roles || []).find((item) => item.id === role || item.name === role);
  return entry ? Number(entry.rate) || 0 : 0;
}

/* -------------------------------------------- property schema for the UI */

const ANALYSIS_GROUP = 'analysis';

export const NODE_ANALYSIS_PROPS = [
  {
    key: 'duration',
    type: 'number',
    label: { en: 'Processing time, min', ru: 'Время выполнения, мин' },
    group: ANALYSIS_GROUP,
  },
  {
    key: 'waitTime',
    type: 'number',
    label: { en: 'Waiting time, min', ru: 'Ожидание, мин' },
    group: ANALYSIS_GROUP,
  },
  {
    key: 'resource',
    type: 'text',
    label: { en: 'Resource / role', ru: 'Ресурс / роль' },
    group: ANALYSIS_GROUP,
  },
  {
    key: 'resourceQty',
    type: 'number',
    label: { en: 'Resource units', ru: 'Количество ресурсов' },
    group: ANALYSIS_GROUP,
  },
  {
    key: 'cost',
    type: 'number',
    label: { en: 'Direct cost per run', ru: 'Прямые затраты за прогон' },
    group: ANALYSIS_GROUP,
  },
  {
    key: 'reworkRate',
    type: 'number',
    label: { en: 'Rework, %', ru: 'Доля переделок, %' },
    group: ANALYSIS_GROUP,
  },
  {
    key: 'dataSource',
    type: 'select',
    label: { en: 'Data source', ru: 'Источник данных' },
    group: ANALYSIS_GROUP,
    options: [
      { value: '', label: { en: 'Not specified', ru: 'Не указан' } },
      { value: 'report', label: SOURCE_KINDS.report },
      { value: 'derived', label: SOURCE_KINDS.derived },
      { value: 'assumption', label: SOURCE_KINDS.assumption },
    ],
  },
];

export const EDGE_ANALYSIS_PROPS = [
  {
    key: 'probability',
    type: 'number',
    label: { en: 'Share of cases, %', ru: 'Доля случаев, %' },
    group: ANALYSIS_GROUP,
  },
];

export function hasAnalysisData(diagram) {
  if (!diagram) return false;
  return diagram.nodes.some((node) => nodeDuration(node) || nodeCost(node) || nodeWait(node) || nodeResource(node));
}
