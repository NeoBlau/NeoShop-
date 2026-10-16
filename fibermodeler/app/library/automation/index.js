/**
 * Automation worksheets: the seminar "choosing and defending an automation
 * technology" filled in for every library process, as is and to be.
 *
 * Four sheets per process and version - technology for the steps, risk and
 * mitigation, pilot scale and KPI, and the three folded into a one-screen
 * proposal - plus two reference sheets from the lecture. They live in their own
 * folder, below everything else in the explorer.
 *
 * What is measured and what is proposed: the AS-IS rows quote facts computed
 * from the models (how much of the lead time is waiting, how much automating
 * every office step as it is would save, against what the TO-BE saves). The
 * technology choices, the risks and the pilot targets are proposals.
 */
import { analyzeProcess } from '../../analysis/simulate.js';
import { completionShare } from '../../analysis/compare.js';
import { buildSheetDiagrams, pick } from '../../notations/sheet/build.js';
import { PILOT_FIELDS, RISK_FIELDS, TECH_COLUMNS } from '../../notations/sheet/templates.js';
import { variantFolder } from '../shared.js';
import { UBER_AS_IS, UBER_TO_BE, buildUberDiagram } from '../ubereats/index.js';
import { WEG_AS_IS, WEG_TO_BE, buildWegDiagram } from '../weg/index.js';
import { WEG_JOURNEY_AS_IS, WEG_JOURNEY_TO_BE, buildWegJourneyDiagram } from '../weg/journey/index.js';
import { MATRICES } from '../weg/sheets/matrices.js';
import { AUTOMATION, GOLDEN_RULE, IMPLEMENTATION_STAGES, RISK_TYPES_TEXT, SUCCESS_FACTORS_TEXT, TECH_CLASSES } from './content.js';
import { RISK_TYPES, techLabel } from './techs.js';

export const AUTOMATION_LIBRARY = 'automation';

const ROOT = { ru: 'Автоматизация (семинар)', en: 'Automation (seminar)' };
const KIND_FOLDERS = {
  tech: { ru: '1. Выбор технологии', en: '1. Technology choice' },
  risk: { ru: '2. Риск и мера снижения', en: '2. Risk and mitigation' },
  pilot: { ru: '3. Масштаб пилота и KPI', en: '3. Pilot scale and KPI' },
  summary: { ru: '4. Предложение на один экран', en: '4. One-screen proposal' },
};
const KIND_NAMES = {
  tech: { ru: 'Технология', en: 'Technology' },
  risk: { ru: 'Риск', en: 'Risk' },
  pilot: { ru: 'Пилот', en: 'Pilot' },
  summary: { ru: 'Предложение', en: 'Proposal' },
};
const REFERENCE_FOLDER = { ru: 'Справочник', en: 'Reference' };
const VARIANT_NAME = {
  'as-is': { ru: 'как есть', en: 'as is' },
  'to-be': { ru: 'как будет', en: 'to be' },
};

/* ------------------------------------------------------------------ facts */

const OFFICE_TYPES = new Set(['userTask', 'sendTask', 'receiveTask', 'businessRuleTask', 'serviceTask']);

/** The pair of processes an entry stands for, and how to draw each of them. */
function pairOf(entry) {
  if (entry.uber) return { asis: UBER_AS_IS[0], tobe: UBER_TO_BE[0], build: buildUberDiagram };
  if (entry.journey) return { asis: WEG_JOURNEY_AS_IS[0], tobe: WEG_JOURNEY_TO_BE[0], build: buildWegJourneyDiagram };
  const tobe = WEG_TO_BE.find((process) => process.id === entry.matrix);
  return { asis: WEG_AS_IS.find((process) => process.id === tobe.baselineId), tobe, build: buildWegDiagram };
}

function summarize(diagram) {
  const result = analyzeProcess(diagram);
  const done = completionShare(diagram, result);
  return { lead: result.totals.leadExpected, cost: result.totals.costPerRun / done, waitShare: result.totals.waitShare };
}

/** The same diagram with every office step instantaneous: the ceiling of automating AS-IS as it is. */
function allOfficeStepsInstant(diagram) {
  const copy = JSON.parse(JSON.stringify(diagram));
  for (const node of copy.nodes) {
    if (OFFICE_TYPES.has(node.type) && node.props?.resource && node.props.duration > 0) node.props.duration = 0;
  }
  return copy;
}

const factCache = new Map();

/**
 * Facts the AS-IS rows quote. All percentages are whole numbers.
 *  waitShare  share of the lead time that is waiting
 *  autoLead / autoCost  what making every office step instantaneous would save
 *  tobeLead / tobeCost  what the target model saves
 */
export function factsFor(entry) {
  const key = entry.key;
  if (!factCache.has(key)) {
    const { asis, tobe, build } = pairOf(entry);
    const before = build(asis, 'en');
    const base = summarize(before);
    const auto = summarize(allOfficeStepsInstant(before));
    const target = summarize(build(tobe, 'en'));
    const saved = (from, to) => Math.max(0, Math.round((1 - to / from) * 100));
    factCache.set(key, {
      waitShare: Math.round(base.waitShare),
      autoLead: saved(base.lead, auto.lead),
      autoCost: saved(base.cost, auto.cost),
      tobeLead: saved(base.lead, target.lead),
      tobeCost: saved(base.cost, target.cost),
    });
  }
  return factCache.get(key);
}

function fill(text, facts) {
  return text.replace(/\{(\w+)\}/g, (match, key) => (key in facts ? String(facts[key]) : match));
}

const filled = (value, facts, locale) => fill(pick(value, locale), facts);

/* -------------------------------------------------------------- wording */

const plainName = (process, locale) => pick(process.name, locale).replace(/\s+[—-]\s+(как есть|как будет|as is|to be)$/i, '').replace(/\s+\((BPMN)\)$/i, ' ($1)');

function stepText(entry, item, locale) {
  if (item.step) return pick(item.step, locale);
  const matrix = MATRICES.find((m) => m.processId === entry.matrix);
  return pick(matrix.items.find((candidate) => candidate.id === item.id).label, locale);
}

function riskStepItem(entry) {
  return entry.steps.find((item) => item.id === entry.risk.step);
}

const HINT = {
  tobe: {
    ru: 'Не каждый шаг TO-BE нужно автоматизировать: там, где технологии нет или она не нужна, это и есть ответ. Чаще всего шаг закрывает не один класс, а сочетание (hyperautomation): BPM ведёт маршрут, RPA выполняет внутри него рутину, данные попадают в ERP.',
    en: 'Not every TO-BE step needs automation: where there is no technology or none is needed, that is the answer. A step is more often closed by a combination of classes (hyperautomation): BPM runs the route, RPA does the routine inside it and the data lands in ERP.',
  },
};

function asIsFooter(facts, locale) {
  const ru = locale === 'ru';
  const leadSmall = facts.autoLead < facts.tobeLead / 2;
  const costClose = facts.autoCost >= 0.7 * facts.tobeCost;
  const lead = ru
    ? leadSmall ? 'срок почти не сдвинется: его определяет ожидание, а не скорость шагов' : 'срок сократится заметно'
    : leadSmall ? 'the lead time hardly moves: it is set by waiting, not by the speed of the steps' : 'the lead time falls noticeably';
  const cost = ru
    ? costClose ? 'по стоимости автоматизация «как есть» догоняет TO-BE, так что офисные шаги можно автоматизировать и без смены логики' : 'стоимость сократится заметно меньше, чем в TO-BE'
    : costClose ? 'on cost, automating as is catches up with the TO-BE, so the office steps can be automated without changing the logic' : 'the cost falls noticeably less than in the TO-BE';
  return ru
    ? `Не автоматизируй бардак. Ожидание составляет ${facts.waitShare} % срока этого процесса. Верхняя граница автоматизации «как есть», когда все офисные шаги стали мгновенными: срок −${facts.autoLead} %, стоимость −${facts.autoCost} %. Изменения TO-BE, которые меняют логику, дают срок −${facts.tobeLead} % и стоимость −${facts.tobeCost} % (расчёт по моделям библиотеки). Вывод: ${lead}; ${cost}.`
    : `Do not automate the mess. Waiting is ${facts.waitShare}% of this process's lead time. The ceiling of automating as is, with every office step made instantaneous: lead time −${facts.autoLead}%, cost −${facts.autoCost}%. The TO-BE changes, which alter the logic, give lead time −${facts.tobeLead}% and cost −${facts.tobeCost}% (computed from the library models). In short: ${lead}; ${cost}.`;
}

const PROPOSAL_NOTE = {
  ru: 'Это предложение автора, а не результат пилота: технологии, меры и целевые значения — стартовые гипотезы, которые нужно проверить и уточнить по данным компании.',
  en: 'This is the author\'s proposal, not a pilot result: technologies, measures and targets are starting hypotheses to be tested and refined with the company\'s data.',
};

/* ------------------------------------------------------------------ specs */

export function techSpec(entry, variant, locale) {
  const facts = factsFor(entry);
  const { asis, tobe } = pairOf(entry);
  const process = variant === 'as-is' ? asis : tobe;
  const name = plainName(asis, locale);
  const columns = variant === 'as-is'
    ? [
        { name: { ru: 'Шаг AS-IS', en: 'AS-IS step' }, w: TECH_COLUMNS[0].w },
        { name: { ru: 'Технология поверх шага (как есть)', en: 'Technology on top of the step (as is)' }, w: TECH_COLUMNS[1].w },
        { name: { ru: 'Что это даст и почему этого мало', en: 'What it gives and why it is not enough' }, w: TECH_COLUMNS[2].w },
      ]
    : [
        { name: { ru: 'Шаг TO-BE процесса', en: 'TO-BE process step' }, w: TECH_COLUMNS[0].w },
        { name: { ru: 'Технология', en: 'Technology' }, w: TECH_COLUMNS[1].w },
        { name: { ru: 'Обоснование', en: 'Reason' }, w: TECH_COLUMNS[2].w },
      ];
  const rows = entry.steps.map((item) => {
    if (variant === 'as-is') {
      return { height: 92, cells: [pick(item.asis.step, locale), techLabel(item.asis.tech, locale), filled(item.asis.why, facts, locale)], tone: 'pain' };
    }
    const none = item.tobe.tech.includes('NONE');
    return { height: 92, cells: [stepText(entry, item, locale), techLabel(item.tobe.tech, locale), filled(item.tobe.why, facts, locale)], tone: none ? 'neutral' : 'gain' };
  });
  return {
    notation: 'sheet',
    kind: 'table',
    name: { ru: `${KIND_NAMES.tech.ru} · ${name}`, en: `${KIND_NAMES.tech.en} · ${plainName(asis, 'en')}` },
    title: { ru: `Рабочий лист: шаги ${variant === 'as-is' ? 'AS-IS' : 'TO-BE'} и технология`, en: `Worksheet: ${variant === 'as-is' ? 'AS-IS' : 'TO-BE'} steps and technology` },
    kicker: { ru: `${plainName(asis, 'ru')} · ${pick(VARIANT_NAME[variant], 'ru')}`, en: `${plainName(asis, 'en')} · ${pick(VARIANT_NAME[variant], 'en')}` },
    description: {
      ru: `Выбор технологии автоматизации для пяти шагов процесса (${pick(VARIANT_NAME[variant], 'ru')}) и обоснование выбора.`,
      en: `The choice of an automation technology for five steps of the process (${pick(VARIANT_NAME[variant], 'en')}) and the reason for it.`,
    },
    columns,
    rows,
    footer: variant === 'as-is' ? { ru: asIsFooter(facts, 'ru'), en: asIsFooter(facts, 'en') } : HINT.tobe,
    footerHeight: 110,
    process,
  };
}

function riskContent(entry, variant, locale) {
  const facts = factsFor(entry);
  const item = riskStepItem(entry);
  const risk = entry.risk[variant === 'as-is' ? 'asis' : 'tobe'];
  const step = variant === 'as-is' ? pick(item.asis.step, locale) : stepText(entry, item, locale);
  return {
    step,
    type: pick(RISK_TYPES[risk.type], locale),
    desc: filled(risk.desc, facts, locale),
    measure: filled(risk.measure, facts, locale),
  };
}

function pilotContent(entry, variant, locale) {
  const facts = factsFor(entry);
  const item = riskStepItem(entry);
  const pilot = entry.pilot[variant === 'as-is' ? 'asis' : 'tobe'];
  const tech = variant === 'as-is' ? techLabel(pilot.tech, locale) : techLabel(item.tobe.tech, locale);
  return {
    tech,
    scale: filled(pilot.scale, facts, locale),
    kpi: filled(pilot.kpi, facts, locale),
    target: filled(pilot.target, facts, locale),
  };
}

const bothLocales = (make) => ({ ru: make('ru'), en: make('en') });

export function riskSpec(entry, variant) {
  const { asis } = pairOf(entry);
  const name = (locale) => plainName(asis, locale);
  const header = (locale) => {
    const content = riskContent(entry, variant, locale);
    return locale === 'ru'
      ? `${content.step}\nПроцесс: ${name('ru')} · ${pick(VARIANT_NAME[variant], 'ru')}.`
      : `${content.step}\nProcess: ${name('en')} · ${pick(VARIANT_NAME[variant], 'en')}.`;
  };
  return {
    notation: 'sheet',
    kind: 'form',
    name: { ru: `${KIND_NAMES.risk.ru} · ${name('ru')}`, en: `${KIND_NAMES.risk.en} · ${name('en')}` },
    title: { ru: 'Рабочий лист: риск и мера снижения', en: 'Worksheet: risk and mitigation' },
    kicker: bothLocales((locale) => `${name(locale)} · ${pick(VARIANT_NAME[variant], locale)}`),
    description: {
      ru: `Риск внедрения автоматизации для одного шага процесса (${pick(VARIANT_NAME[variant], 'ru')}): тип риска и мера на первую неделю.`,
      en: `The implementation risk of automating one step of the process (${pick(VARIANT_NAME[variant], 'en')}): the type of risk and a first-week measure.`,
    },
    changeTitle: { ru: 'Выбранный шаг', en: 'The chosen step' },
    change: bothLocales(header),
    changeHeight: 100,
    questions: RISK_FIELDS.map((question, index) => ({
      question,
      answer: bothLocales((locale) => {
        const content = riskContent(entry, variant, locale);
        return [content.type, content.desc, content.measure][index];
      }),
      height: index === 0 ? 100 : 128,
    })),
    footerTitle: { ru: 'Три типа риска (Лекция 5)', en: 'Three types of risk (lecture 5)' },
    footer: RISK_TYPES_TEXT,
    footerHeight: 250,
  };
}

export function pilotSpec(entry, variant) {
  const { asis } = pairOf(entry);
  const name = (locale) => plainName(asis, locale);
  return {
    notation: 'sheet',
    kind: 'form',
    name: { ru: `${KIND_NAMES.pilot.ru} · ${name('ru')}`, en: `${KIND_NAMES.pilot.en} · ${name('en')}` },
    title: { ru: 'Рабочий лист: масштаб пилота и KPI', en: 'Worksheet: pilot scale and KPI' },
    kicker: bothLocales((locale) => `${name(locale)} · ${pick(VARIANT_NAME[variant], locale)}`),
    description: {
      ru: variant === 'as-is'
        ? 'Пилот-замер для процесса «как есть»: что измерить за две недели, чтобы заменить допущения модели данными.'
        : 'План пилота выбранной технологии: масштаб, один измеримый показатель и его целевое значение через две недели.',
      en: variant === 'as-is'
        ? 'A measuring pilot for the as-is process: what to measure in two weeks to replace the model\'s assumptions with data.'
        : 'The pilot plan for the chosen technology: scale, one measurable indicator and its target after two weeks.',
    },
    changeTitle: variant === 'as-is' ? { ru: 'Что делаем вместо автоматизации', en: 'What we do instead of automating' } : { ru: 'Что пилотируем', en: 'What is piloted' },
    change: bothLocales((locale) => {
      const content = pilotContent(entry, variant, locale);
      const step = variant === 'as-is' ? pick(riskStepItem(entry).asis.step, locale) : stepText(entry, riskStepItem(entry), locale);
      return locale === 'ru'
        ? `${variant === 'as-is' ? 'Замер' : content.tech}: ${step}`
        : `${variant === 'as-is' ? 'Measuring' : content.tech}: ${step}`;
    }),
    changeHeight: 84,
    questions: PILOT_FIELDS.map((question, index) => ({
      question,
      answer: bothLocales((locale) => {
        const content = pilotContent(entry, variant, locale);
        return [content.tech, content.scale, content.kpi, content.target][index];
      }),
      height: index === 0 ? 78 : 104,
    })),
    footerTitle: { ru: 'Что дальше', en: 'What next' },
    footer: {
      ru: `Сложите три рабочих листа (технология → риск → пилот) в единое предложение на один экран. ${PROPOSAL_NOTE.ru}`,
      en: `Fold the three worksheets (technology → risk → pilot) into one proposal on one screen. ${PROPOSAL_NOTE.en}`,
    },
    footerHeight: 110,
  };
}

export function summarySpec(entry, variant) {
  const { asis } = pairOf(entry);
  const name = (locale) => plainName(asis, locale);
  const text = (locale) => {
    const ru = locale === 'ru';
    const item = riskStepItem(entry);
    const risk = riskContent(entry, variant, locale);
    const pilot = pilotContent(entry, variant, locale);
    const facts = factsFor(entry);
    const why = variant === 'as-is' ? filled(item.asis.why, facts, locale) : filled(item.tobe.why, facts, locale);
    const lines = ru
      ? [
          `Шаг: ${risk.step}`,
          `Технология: ${pilot.tech}. ${why}`,
          `Риск (${risk.type}): ${risk.desc}`,
          `Мера на первую неделю: ${risk.measure}`,
          `Пилот: ${pilot.scale}`,
          `Показатель: ${pilot.kpi}`,
          `Цель через 2 недели: ${pilot.target}`,
        ]
      : [
          `Step: ${risk.step}`,
          `Technology: ${pilot.tech}. ${why}`,
          `Risk (${risk.type}): ${risk.desc}`,
          `First-week measure: ${risk.measure}`,
          `Pilot: ${pilot.scale}`,
          `Indicator: ${pilot.kpi}`,
          `Target after 2 weeks: ${pilot.target}`,
        ];
    return lines.join('\n\n');
  };
  return {
    notation: 'sheet',
    kind: 'form',
    name: { ru: `${KIND_NAMES.summary.ru} · ${name('ru')}`, en: `${KIND_NAMES.summary.en} · ${name('en')}` },
    title: { ru: 'Предложение по автоматизации на один экран', en: 'The automation proposal on one screen' },
    kicker: bothLocales((locale) => `${name(locale)} · ${pick(VARIANT_NAME[variant], locale)}`),
    description: {
      ru: 'Технология, риск и пилот одного шага процесса, сложенные в одно предложение для защиты.',
      en: 'The technology, the risk and the pilot of one process step folded into one proposal for the defence.',
    },
    changeTitle: { ru: 'С чем идём на защиту', en: 'What we take to the defence' },
    change: bothLocales((locale) => (locale === 'ru' ? `${name('ru')} · ${pick(VARIANT_NAME[variant], 'ru')}` : `${name('en')} · ${pick(VARIANT_NAME[variant], 'en')}`) + '\n' + pick(PROPOSAL_NOTE, locale)),
    changeHeight: 92,
    questions: [{ question: { ru: 'Предложение', en: 'The proposal' }, answer: bothLocales(text), height: 470, tone: 'teal' }],
  };
}

const SPEC_BUILDERS = { tech: techSpec, risk: riskSpec, pilot: pilotSpec, summary: summarySpec };

/* -------------------------------------------------------------- reference */

export function classesSpec() {
  return {
    notation: 'sheet',
    kind: 'table',
    name: { ru: 'Классы технологий: когда что выбирать', en: 'Technology classes: what to choose when' },
    title: { ru: 'Какой класс технологии когда выбирать', en: 'Which technology class to choose when' },
    kicker: { ru: 'Справочник по Лекции 5 · Технологии автоматизации бизнес-процессов', en: 'Reference from lecture 5 · Business process automation technologies' },
    description: {
      ru: 'Четыре класса технологий и AI: сильная сторона, ограничение и типовая задача.',
      en: 'The four technology classes and AI: strength, limitation and a typical task.',
    },
    columns: [
      { name: { ru: 'Класс', en: 'Class' }, w: 200 },
      { name: { ru: 'Сильная сторона', en: 'Strength' }, w: 430 },
      { name: { ru: 'Ограничение', en: 'Limitation' }, w: 380 },
      { name: { ru: 'Типовая задача', en: 'Typical task' }, w: 290 },
    ],
    rows: TECH_CLASSES.map((row) => ({ height: 104, cells: [row.name, row.strength, row.limit, row.task] })),
    footerTitle: { ru: 'Главное правило', en: 'The main rule' },
    footer: GOLDEN_RULE,
    footerHeight: 150,
  };
}

export function implementationSpec() {
  return {
    notation: 'sheet',
    kind: 'form',
    name: { ru: 'Внедрение: этапы, риски, факторы успеха', en: 'Implementation: stages, risks, success factors' },
    title: { ru: 'Типовой проект внедрения автоматизации', en: 'A typical automation project' },
    kicker: { ru: 'Справочник по Лекции 5 · Внедрение: этапы и риски', en: 'Reference from lecture 5 · Implementation: stages and risks' },
    description: {
      ru: 'Пять этапов внедрения, три типа риска и факторы успеха.',
      en: 'Five stages of implementation, three types of risk and success factors.',
    },
    changeTitle: { ru: 'Пять этапов', en: 'Five stages' },
    change: bothLocales((locale) => IMPLEMENTATION_STAGES.map((stage, index) => `${index + 1}. ${pick(stage, locale)}`).join('\n')),
    changeHeight: 200,
    questions: [
      { question: { ru: 'Три типа риска', en: 'Three types of risk' }, answer: RISK_TYPES_TEXT, height: 290, tone: 'orange' },
      { question: { ru: 'Факторы успеха', en: 'Success factors' }, answer: SUCCESS_FACTORS_TEXT, height: 250, tone: 'teal' },
    ],
  };
}

/* ------------------------------------------------------------------ build */

function stamp(diagram, { folder, processId, variant }) {
  diagram.meta.folder = folder;
  diagram.meta.library = AUTOMATION_LIBRARY;
  diagram.meta.processId = processId;
  if (variant) diagram.meta.variant = variant;
  diagram.meta.author = 'FiberModeler — proposals for the automation seminar';
  return diagram;
}

const referenceFolder = (locale) => `${pick(ROOT, locale)}/${pick(REFERENCE_FOLDER, locale)}`;
const kindFolder = (variant, kind, locale) => `${variantFolder(pick(ROOT, locale), variant, locale)}/${pick(KIND_FOLDERS[kind], locale)}`;

export const AUTOMATION_SHEET_COUNT = 2 + AUTOMATION.length * 2 * 4;

/** Reference sheets first, then every process, as is and to be, in the four kinds. */
export function buildAutomationDiagrams(locale = 'ru') {
  const diagrams = [];
  for (const [spec, id] of [[classesSpec(), 'auto-ref-classes'], [implementationSpec(), 'auto-ref-implementation']]) {
    const [diagram] = buildSheetDiagrams(spec, { locale });
    diagrams.push(stamp(diagram, { folder: referenceFolder(locale), processId: id }));
  }
  for (const variant of ['as-is', 'to-be']) {
    for (const kind of Object.keys(KIND_FOLDERS)) {
      for (const entry of AUTOMATION) {
        const spec = SPEC_BUILDERS[kind](entry, variant, locale);
        const [diagram] = buildSheetDiagrams(spec, { locale });
        diagrams.push(stamp(diagram, { folder: kindFolder(variant, kind, locale), processId: `auto-${entry.key}-${variant}-${kind}`, variant }));
      }
    }
  }
  return diagrams;
}

export function automationDocumentation(locale = 'ru') {
  return locale === 'en'
    ? `Automation worksheets — ${AUTOMATION_SHEET_COUNT} filled templates of the seminar "choosing and defending an automation technology": for each of the ten processes (the eight WEG processes, Uber Eats in Dubai and the WEG buyer's journey), as is and to be: the technology for five steps, a risk with a first-week measure, a pilot with an indicator and a target, and the three folded into a one-screen proposal; plus two reference sheets from the lecture.\n\nThe AS-IS sheets argue against automating first and quote figures computed from the models: how much of the lead time is waiting, what making every office step instantaneous would save, against what the TO-BE changes save. The technology choices, risks and pilot targets are the author's proposals, not results of a pilot.`
    : `Рабочие листы по автоматизации — ${AUTOMATION_SHEET_COUNT} заполненных шаблонов семинара «Выбор и защита технологии автоматизации»: для каждого из десяти процессов (восемь процессов WEG, Uber Eats в Дубае и путь покупателя WEG), как есть и как будет: технология для пяти шагов, риск с мерой на первую неделю, пилот с показателем и целью и три листа, сложенные в предложение на один экран; плюс два справочных листа по лекции.\n\nЛисты AS-IS убеждают не автоматизировать в первую очередь и приводят цифры, посчитанные по моделям: какая доля срока приходится на ожидание, что дало бы превращение всех офисных шагов в мгновенные и что дают изменения TO-BE. Выбор технологий, риски и целевые значения пилотов — предложения автора, а не результаты пилота.`;
}
