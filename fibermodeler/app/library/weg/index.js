/**
 * WEG process library.
 *
 * Eight BPMN 2.0 models of WEG S.A.'s main business processes, grounded in the
 * company's public disclosure (see `facts.js`). The library is shipped with the
 * application: it is loaded on start-up into a "WEG" folder of the model
 * explorer, so every user sees the diagrams on entering the program.
 *
 * Each process is stored as a notation-neutral specification and turned into a
 * real diagram (identity, geometry, lanes, routed connections) by the same
 * pipeline the templates and the table builder use.
 */
import { createProject } from '../../core/model.js';
import { buildBpmnDiagram } from '../../ai/schema.js';
import { compareProcesses } from '../../analysis/compare.js';
import { formatDuration, formatMoney } from '../../analysis/parameters.js';
import { WEG, WEG_SOURCES, dataNote, roleLabel } from './facts.js';
import { orderToCash } from './asis/p1-order-to-cash.js';
import { motorManufacturing } from './asis/p2-motor-manufacturing.js';
import { procurement } from './asis/p3-procurement.js';
import { engineerToOrder } from './asis/p4-engineer-to-order.js';
import { transformerProject } from './asis/p5-transformer-project.js';
import { serviceProcess } from './asis/p6-service.js';
import { newProduct } from './asis/p7-new-product.js';
import { exportProcess } from './asis/p8-export-customs.js';
import { orderToCashToBe } from './tobe/p1-order-to-cash.js';
import { motorManufacturingToBe } from './tobe/p2-motor-manufacturing.js';
import { procurementToBe } from './tobe/p3-procurement.js';
import { engineerToOrderToBe } from './tobe/p4-engineer-to-order.js';
import { transformerProjectToBe } from './tobe/p5-transformer-project.js';
import { serviceProcessToBe } from './tobe/p6-service.js';
import { newProductToBe } from './tobe/p7-new-product.js';
import { exportProcessToBe } from './tobe/p8-export-customs.js';

/** Root folder shown in the model explorer; the variants are its sub-folders. */
export const WEG_FOLDER = 'WEG';

const VARIANT_FOLDERS = {
  'as-is': { ru: 'Как есть (AS-IS)', en: 'As is (AS-IS)' },
  'to-be': { ru: 'Как будет (TO-BE)', en: 'To be (TO-BE)' },
};

/** `WEG/Как есть (AS-IS)` - the explorer splits the path into nested folders. */
export function wegFolder(variant, locale = 'ru') {
  const name = VARIANT_FOLDERS[variant] || VARIANT_FOLDERS['as-is'];
  return `${WEG_FOLDER}/${name[locale] || name.en}`;
}

export const WEG_AS_IS = [
  orderToCash,
  motorManufacturing,
  procurement,
  engineerToOrder,
  transformerProject,
  serviceProcess,
  newProduct,
  exportProcess,
].sort((a, b) => a.order - b.order);

export const WEG_TO_BE = [
  orderToCashToBe,
  motorManufacturingToBe,
  procurementToBe,
  engineerToOrderToBe,
  transformerProjectToBe,
  serviceProcessToBe,
  newProductToBe,
  exportProcessToBe,
].sort((a, b) => a.order - b.order);

/** Current state first, then the target state - the order of the explorer. */
export const WEG_PROCESSES = [...WEG_AS_IS, ...WEG_TO_BE];

/* ------------------------------------------------------------ localisation */

function pick(value, locale) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  return value[locale] || value.en || value.ru || '';
}

function localizeProps(props, locale) {
  if (!props) return {};
  const out = {};
  for (const [key, value] of Object.entries(props)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && ('ru' in value || 'en' in value)) {
      out[key] = pick(value, locale);
    } else if (key === 'resource' && typeof value === 'string') {
      out[key] = roleLabel(value, locale);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** Resolves every `{ ru, en }` pair of a specification into one language. */
export function localizeSpec(spec, locale = 'ru') {
  return {
    notation: spec.notation || 'bpmn',
    name: pick(spec.name, locale),
    poolLabel: spec.poolLabel ? pick(spec.poolLabel, locale) : undefined,
    lanes: (spec.lanes || []).map((lane) => ({ id: lane.id, label: pick(lane.label, locale) })),
    nodes: (spec.nodes || []).map((node) => ({
      ...node,
      label: pick(node.label, locale),
      props: localizeProps(node.props, locale),
    })),
    edges: (spec.edges || []).map((edge) => ({
      ...edge,
      label: edge.label ? pick(edge.label, locale) : undefined,
      props: localizeProps(edge.props, locale),
    })),
  };
}

function localizeAnalysis(analysis, locale) {
  if (!analysis) return undefined;
  return {
    ...analysis,
    roles: (analysis.roles || []).map((role) => ({ ...role, name: roleLabel(role.name, locale) })),
  };
}

/* --------------------------------------------------------------- building */

/** One library process -> one ready diagram placed in the WEG folder. */
export function buildWegDiagram(process, locale = 'ru') {
  const spec = localizeSpec(process.spec, locale);
  const diagram = buildBpmnDiagram(spec, { locale, name: pick(process.name, locale) });
  diagram.name = pick(process.name, locale);
  diagram.meta.folder = wegFolder(process.variant, locale);
  diagram.meta.library = 'weg';
  diagram.meta.processId = process.id;
  diagram.meta.variant = process.variant;
  if (process.baselineId) diagram.meta.baselineId = process.baselineId;
  diagram.meta.description = pick(process.description, locale);
  diagram.meta.documentation = pick(process.documentation, locale);
  diagram.meta.author = 'WEG S.A. — public disclosure';
  diagram.meta.analysis = localizeAnalysis(process.analysis, locale);
  return diagram;
}

/**
 * Target-state documentation ends with the measured gain against the current
 * state. It is computed from the two models here, not written by hand, so it
 * cannot drift away from what the diagrams actually say.
 */
function comparisonBlock(baseline, current, locale) {
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

export function wegProjectName(locale = 'ru') {
  return locale === 'en' ? 'WEG — business process library' : 'WEG — библиотека бизнес-процессов';
}

export function wegProjectDocumentation(locale = 'ru') {
  const head =
    locale === 'en'
      ? `WEG S.A. business process library — ${WEG_PROCESSES.length} BPMN 2.0 models with calculable time, resource and cost parameters.

WEG in ${WEG.year}: net revenue R$ ${(WEG.revenue / 1e9).toFixed(1)}bn, EBITDA R$ ${(WEG.ebitda / 1e9).toFixed(2)}bn, net income R$ ${(WEG.netIncome / 1e9).toFixed(2)}bn, ROIC ${(WEG.roic * 100).toFixed(1)}%, more than ${WEG.employees.toLocaleString('en-US')} employees, ${WEG.plants} plants in ${WEG.countries} countries, more than ${(WEG.motorsPerYear / 1e6).toFixed(0)} million motors a year, ${(WEG.externalShare * 100).toFixed(1)}% of revenue from outside Brazil.

Open the Analysis tab (⌥⇧A) to recalculate lead time, cost, resource demand and the bottleneck of the selected diagram; every parameter can be edited in the Properties panel and the totals follow.`
      : `Библиотека бизнес-процессов WEG S.A. — ${WEG_PROCESSES.length} моделей BPMN 2.0 с рассчитываемыми параметрами времени, ресурсов и стоимости.

WEG в ${WEG.year} году: выручка R$ ${(WEG.revenue / 1e9).toFixed(1)} млрд, EBITDA R$ ${(WEG.ebitda / 1e9).toFixed(2)} млрд, чистая прибыль R$ ${(WEG.netIncome / 1e9).toFixed(2)} млрд, ROIC ${(WEG.roic * 100).toFixed(1)} %, более ${WEG.employees.toLocaleString('ru-RU')} сотрудников, ${WEG.plants} производственных площадок в ${WEG.countries} странах, более ${(WEG.motorsPerYear / 1e6).toFixed(0)} млн двигателей в год, ${(WEG.externalShare * 100).toFixed(1)} % выручки — вне Бразилии.

Вкладка «Анализ» (⌥⇧A) пересчитывает длительность, стоимость, потребность в ресурсах и узкое место выбранной схемы; любой параметр правится в панели свойств, и итоги пересчитываются сразу.`;

  const list = WEG_PROCESSES.map((process) => `• ${pick(process.name, locale)} — ${pick(process.description, locale)}`).join('\n');
  const sources = WEG_SOURCES.map((item) => `• ${item.title[locale] || item.title.en} — ${item.url}`).join('\n');
  const sourceHead = locale === 'en' ? 'Public sources:' : 'Источники публичных данных:';
  return `${head}\n\n${list}\n\n${dataNote(locale)}\n\n${sourceHead}\n${sources}`;
}

/** The library as a stand-alone project - what the application opens on start. */
export function createWegProject(locale = 'ru') {
  const project = createProject({
    name: wegProjectName(locale),
    company: 'WEG S.A.',
    author: 'FiberModeler',
    description:
      locale === 'en'
        ? 'Eight BPMN 2.0 models of WEG main business processes with calculable parameters.'
        : 'Восемь моделей BPMN 2.0 по основным бизнес-процессам WEG с рассчитываемыми параметрами.',
  });
  project.documentation = wegProjectDocumentation(locale);
  project.diagrams = buildWegDiagrams(locale);
  return project;
}

/** Adds the library to an existing project, replacing an older copy of it. */
export function addWegLibrary(project, locale = 'ru') {
  const kept = project.diagrams.filter((diagram) => diagram.meta?.library !== 'weg');
  project.diagrams = [...kept, ...buildWegDiagrams(locale)];
  return project;
}
