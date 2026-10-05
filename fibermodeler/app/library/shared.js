/**
 * Code shared by every shipped process library (WEG, Uber Eats, ...).
 *
 * A library process is a notation-neutral specification with `{ ru, en }`
 * pairs; this module resolves one language, turns the specification into a real
 * diagram through the same pipeline the templates and the table builder use,
 * and appends the computed AS-IS / TO-BE comparison to the target models.
 */
import { buildBpmnDiagram } from '../ai/schema.js';
import { compareProcesses } from '../analysis/compare.js';
import { formatDuration, formatMoney } from '../analysis/parameters.js';

/* ------------------------------------------------------------ localisation */

export function pick(value, locale) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  return value[locale] || value.en || value.ru || '';
}

function localizeProps(props, locale, roleName) {
  if (!props) return {};
  const out = {};
  for (const [key, value] of Object.entries(props)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && ('ru' in value || 'en' in value)) {
      out[key] = pick(value, locale);
    } else if (key === 'resource' && typeof value === 'string') {
      out[key] = roleName(value, locale);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** Resolves every `{ ru, en }` pair of a specification into one language. */
export function localizeSpec(spec, locale = 'ru', roleName = (name) => name) {
  return {
    notation: spec.notation || 'bpmn',
    name: pick(spec.name, locale),
    poolLabel: spec.poolLabel ? pick(spec.poolLabel, locale) : undefined,
    lanes: (spec.lanes || []).map((lane) => ({ id: lane.id, label: pick(lane.label, locale) })),
    nodes: (spec.nodes || []).map((node) => ({
      ...node,
      label: pick(node.label, locale),
      props: localizeProps(node.props, locale, roleName),
    })),
    edges: (spec.edges || []).map((edge) => ({
      ...edge,
      label: edge.label ? pick(edge.label, locale) : undefined,
      props: localizeProps(edge.props, locale, roleName),
    })),
  };
}

export function localizeAnalysis(analysis, locale, roleName = (name) => name) {
  if (!analysis) return undefined;
  return {
    ...analysis,
    roles: (analysis.roles || []).map((role) => ({ ...role, name: roleName(role.name, locale) })),
  };
}

/* --------------------------------------------------------------- building */

/**
 * One library process -> one ready diagram.
 *
 * `options`: `library` (id stored in meta.library), `folder` (explorer path),
 * `author`, `roleName(name, locale)` for the role translations.
 */
export function buildLibraryDiagram(process, locale, options) {
  const spec = localizeSpec(process.spec, locale, options.roleName);
  const diagram = buildBpmnDiagram(spec, { locale, name: pick(process.name, locale) });
  diagram.name = pick(process.name, locale);
  diagram.meta.folder = options.folder;
  diagram.meta.library = options.library;
  diagram.meta.processId = process.id;
  diagram.meta.variant = process.variant;
  if (process.baselineId) diagram.meta.baselineId = process.baselineId;
  diagram.meta.description = pick(process.description, locale);
  diagram.meta.documentation = pick(process.documentation, locale);
  diagram.meta.author = options.author;
  diagram.meta.analysis = localizeAnalysis(process.analysis, locale, options.roleName);
  return diagram;
}

/**
 * Target-state documentation ends with the measured gain against the current
 * state. It is computed from the two models here, not written by hand, so it
 * cannot drift away from what the diagrams actually say.
 */
export function comparisonBlock(baseline, current, locale) {
  const comparison = compareProcesses(baseline, current);
  if (!comparison) return '';
  const ru = locale === 'ru';
  const money = (value) => formatMoney(value, comparison.currency, locale);
  const number = (value) => Math.round(value).toLocaleString(ru ? 'ru-RU' : 'en-US');
  const label = {
    lead: ru ? 'Срок выполнения' : 'Lead time',
    work: ru ? 'Трудозатраты на случай' : 'Work per case',
    wait: ru ? 'Ожидание' : 'Waiting',
    cost: ru ? 'Стоимость случая' : 'Cost per case',
    costPerCompletion: ru ? 'Стоимость доведённого до конца случая' : 'Cost per completed case',
    annualCost: ru ? 'Затраты в год' : 'Annual cost',
    fte: ru ? 'Штат (FTE)' : 'Headcount (FTE)',
  };
  const format = (row, value) => {
    if (row.kind === 'duration') return formatDuration(value, locale);
    if (row.kind === 'money') return money(value);
    return number(value);
  };
  const lines = comparison.rows.map((row) => {
    const delta = `${row.deltaPct > 0 ? '+' : ''}${row.deltaPct.toFixed(1)} %`;
    return `| ${label[row.key]} | ${format(row, row.from)} | ${format(row, row.to)} | ${delta} |`;
  });
  const head = ru
    ? `\n\n---\n\n### Что даёт переход (расчёт по обеим моделям)\n\n| Показатель | Как есть | Как будет | Δ |\n|---|---|---|---|`
    : `\n\n---\n\n### Measured gain (computed from both models)\n\n| Metric | As is | To be | Δ |\n|---|---|---|---|`;
  const doneFrom = Math.round(comparison.completion.from * 1000) / 10;
  const doneTo = Math.round(comparison.completion.to * 1000) / 10;
  const foot = ru
    ? `\n\nДо успешного завершения доходит ${doneFrom} % случаев в модели «как есть» и ${doneTo} % в модели «как будет». Поэтому в таблице есть отдельная строка «стоимость доведённого до конца случая»: процесс, который перестаёт отбраковывать поздно, пропускает больше случаев в дорогие шаги, и его стоимость «на один запущенный случай» может вырасти, пока стоимость «на один доведённый до конца» падает.\n\nЦифры пересчитываются из самих схем: измените любой параметр в панели свойств — и этот блок перестанет совпадать с документацией, а вкладка «Анализ» покажет новое значение. Документация фиксирует состояние на момент построения библиотеки.`
    : `\n\n${doneFrom}% of cases reach a successful end in the as-is model and ${doneTo}% in the to-be one. That is why the table carries a separate "cost per completed case" row: a process that stops rejecting late lets more cases reach the expensive steps, so its cost per *started* case can rise while the cost per *completed* one falls.\n\nThe figures are computed from the models themselves. Change a parameter in the properties panel and the Analysis tab will show the new value, while this block keeps the state at the time the library was built.`;
  return `${head}\n${lines.join('\n')}${foot}`;
}

/** Every library process as diagrams, in the documented order. */
export function buildWegDiagrams(locale = 'ru') {
  const diagrams = WEG_PROCESSES.map((process) => buildWegDiagram(process, locale));
  const byProcessId = new Map(diagrams.map((diagram) => [diagram.meta.processId, diagram]));
  for (const diagram of diagrams) {
    const baseline = diagram.meta.baselineId ? byProcessId.get(diagram.meta.baselineId) : null;
    if (baseline) diagram.meta.documentation += comparisonBlock(baseline, diagram, locale);
  }
  return diagrams;
}

/**
 * Builds every process of a library and appends the computed comparison to the
 * documentation of each target-state model. `folderOf(process, locale)` gives
 * the explorer path of a process.
 */
export function buildLibraryDiagrams(processes, locale, options, folderOf) {
  const diagrams = processes.map((process) =>
    buildLibraryDiagram(process, locale, { ...options, folder: folderOf(process, locale) })
  );
  const byProcessId = new Map(diagrams.map((diagram) => [diagram.meta.processId, diagram]));
  for (const diagram of diagrams) {
    const baseline = diagram.meta.baselineId ? byProcessId.get(diagram.meta.baselineId) : null;
    if (baseline) diagram.meta.documentation += comparisonBlock(baseline, diagram, locale);
  }
  return diagrams;
}

/** Explorer sub-folders for the two versions of a process, shared by every library. */
const VARIANT_FOLDERS = {
  'as-is': { ru: 'Как есть (AS-IS)', en: 'As is (AS-IS)' },
  'to-be': { ru: 'Как будет (TO-BE)', en: 'To be (TO-BE)' },
};

export function variantFolder(root, variant, locale = 'ru') {
  const name = VARIANT_FOLDERS[variant] || VARIANT_FOLDERS['as-is'];
  return `${root}/${name[locale] || name.en}`;
}
