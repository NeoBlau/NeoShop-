/**
 * Worksheet templates: the empty sheets a user starts from.
 *
 * The wording of the matrix instructions and of the three risk questions is the
 * course's own; the journey rows are the usual customer-journey layers.
 */

/** Rows of a customer journey map; `curve` marks the emotion band. */
export const JOURNEY_ROWS = {
  goal: { key: 'goal', label: { ru: 'Цель клиента', en: 'Customer goal' }, height: 84 },
  actions: { key: 'actions', label: { ru: 'Действия клиента', en: 'Customer actions' }, height: 104 },
  touch: { key: 'touch', label: { ru: 'Точки контакта', en: 'Touchpoints' }, height: 92 },
  doubts: { key: 'doubts', label: { ru: 'Вопросы и сомнения', en: 'Questions and doubts' }, height: 104 },
  emotion: { key: 'emotion', label: { ru: 'Эмоция\n(−2 … +2)', en: 'Emotion\n(−2 … +2)' }, height: 150, curve: true },
  pain: { key: 'pain', label: { ru: 'Боли', en: 'Pain points' }, height: 118, tone: 'pain' },
  inside: { key: 'inside', label: { ru: 'Что происходит внутри компании', en: 'What happens inside the company' }, height: 118 },
  metric: { key: 'metric', label: { ru: 'Метрика этапа', en: 'Stage metric' }, height: 84 },
  ideas: { key: 'ideas', label: { ru: 'Возможности', en: 'Opportunities' }, height: 104, tone: 'gain' },
};

/** Columns of the technology-choice table, shared with the filled sheets of the library. */
export const TECH_COLUMNS = [
  { name: { ru: 'Шаг процесса', en: 'Process step' }, w: 440 },
  { name: { ru: 'Технология (впишите)', en: 'Technology (fill in)' }, w: 220 },
  { name: { ru: 'Обоснование (впишите)', en: 'Reason (fill in)' }, w: 520 },
];

export const RISK_FIELDS = [
  { ru: 'Тип риска (организационный / технологический / «бардак»)', en: 'Type of risk (organisational / technological / "mess")' },
  { ru: 'Описание риска именно для этого шага', en: 'The risk described for this very step' },
  { ru: 'Мера снижения — что сделаем в первую неделю', en: 'Mitigation: what we do in the first week' },
];

export const PILOT_FIELDS = [
  { ru: 'Технология, которую пилотируем', en: 'The technology we pilot' },
  { ru: 'Масштаб пилота (кто / что / сколько времени)', en: 'Pilot scale (who / what / how long)' },
  { ru: 'Показатель успеха пилота (1 измеримая метрика)', en: 'Pilot success indicator (one measurable metric)' },
  { ru: 'Целевое значение через 2 недели', en: 'Target value after 2 weeks' },
];

const blank = (count) => Array.from({ length: count }, () => ({ ru: '', en: '' }));

export const SHEET_TEMPLATES = [
  {
    id: 'impact-effort',
    name: { ru: 'Матрица «эффект — усилия»', en: 'Impact / effort matrix' },
    description: {
      ru: 'Рабочий лист: расставьте 3–5 изменений из своей TO-BE по четырём квадрантам и объясните, почему быстрая победа идёт первой.',
      en: 'Worksheet: place 3–5 changes from your TO-BE into four quadrants and explain why the quick win goes first.',
    },
    spec: {
      notation: 'sheet',
      kind: 'matrix',
      name: { ru: 'Матрица «эффект — усилия»', en: 'Impact / effort matrix' },
      title: { ru: 'Рабочий лист: расставьте свои TO-BE изменения', en: 'Worksheet: rank your TO-BE changes' },
      items: [
        { no: '1', label: '', placed: false },
        { no: '2', label: '', placed: false },
        { no: '3', label: '', placed: false },
      ],
      why: '',
    },
  },
  {
    id: 'implementation-risks',
    name: { ru: 'Риски внедрения изменения', en: 'Implementation risks' },
    description: {
      ru: 'Рабочий лист из трёх вопросов: кто теряет, как проявится сопротивление и какая одна мера снизит его сильнее всего.',
      en: 'A three-question worksheet: who loses, how the resistance will show, and the one measure that reduces it most.',
    },
    spec: {
      notation: 'sheet',
      kind: 'risks',
      name: { ru: 'Риски внедрения изменения', en: 'Implementation risks' },
      title: { ru: 'Рабочий лист: риски внедрения вашего изменения', en: 'Worksheet: risks of implementing your change' },
      change: '',
      changeHeight: 84,
      questions: [
        {
          question: {
            ru: 'Кто теряет от этого изменения и что именно (время / контроль / комфорт / статус)?',
            en: 'Who loses from this change, and what exactly (time / control / comfort / status)?',
          },
          answer: '',
        },
        {
          question: {
            ru: 'Как будет проявляться сопротивление на практике (конкретно, не абстрактно)?',
            en: 'How will resistance show up in practice (concretely, not in the abstract)?',
          },
          answer: '',
        },
        {
          question: {
            ru: 'Какая одна мера снизит сопротивление сильнее всего?',
            en: 'Which single measure would reduce the resistance the most?',
          },
          answer: '',
        },
      ],
    },
  },
  {
    id: 'technology-choice',
    name: { ru: 'Выбор технологии для шагов TO-BE', en: 'Technology choice for TO-BE steps' },
    description: {
      ru: 'Таблица: шаг TO-BE, класс технологии (RPA / BPM / CRM / ERP / AI) и обоснование одним предложением; отметьте шаги, которые автоматизировать не нужно.',
      en: 'A table: the TO-BE step, the technology class (RPA / BPM / CRM / ERP / AI) and a one-sentence reason; mark the steps that need no automation.',
    },
    spec: {
      notation: 'sheet',
      kind: 'table',
      name: { ru: 'Выбор технологии для шагов TO-BE', en: 'Technology choice for TO-BE steps' },
      title: { ru: 'Рабочий лист: шаги TO-BE и технология', en: 'Worksheet: TO-BE steps and technology' },
      columns: TECH_COLUMNS,
      rows: [1, 2, 3, 4, 5].map((no) => ({ cells: [{ ru: '', en: '' }, '', ''] })),
      footer: {
        ru: 'Для каждого шага спросите себя: выполняет его человек или уже система? Какой класс технологии решает именно этот шаг? Не каждый шаг TO-BE нужно автоматизировать: отметьте такие и объясните почему.',
        en: 'For every step ask: is it done by a person or already by a system? Which technology class solves exactly this step? Not every TO-BE step needs automation: mark those and say why.',
      },
    },
  },
  {
    id: 'risk-mitigation',
    name: { ru: 'Риск и мера снижения', en: 'Risk and mitigation' },
    description: {
      ru: 'Выберите один шаг, назовите тип риска (организационный / технологический / «бардак») и одну меру на первую неделю.',
      en: 'Pick one step, name the risk type (organisational / technological / "mess") and one measure for the first week.',
    },
    spec: {
      notation: 'sheet',
      kind: 'form',
      name: { ru: 'Риск и мера снижения', en: 'Risk and mitigation' },
      title: { ru: 'Рабочий лист: риск и мера снижения', en: 'Worksheet: risk and mitigation' },
      changeTitle: { ru: 'Выбранный шаг', en: 'The chosen step' },
      change: '',
      changeHeight: 84,
      questions: RISK_FIELDS.map((question) => ({ question, answer: '', height: 110 })),
    },
  },
  {
    id: 'pilot-plan',
    name: { ru: 'Масштаб пилота и KPI', en: 'Pilot scale and KPI' },
    description: {
      ru: 'Технология, масштаб пилота (кто, что, сколько времени), один измеримый показатель и его целевое значение через две недели.',
      en: 'The technology, the pilot scale (who, what, how long), one measurable indicator and its target after two weeks.',
    },
    spec: {
      notation: 'sheet',
      kind: 'form',
      name: { ru: 'Масштаб пилота и KPI', en: 'Pilot scale and KPI' },
      title: { ru: 'Рабочий лист: масштаб пилота и KPI', en: 'Worksheet: pilot scale and KPI' },
      changeTitle: { ru: 'Что пилотируем', en: 'What is piloted' },
      change: '',
      changeHeight: 72,
      questions: PILOT_FIELDS.map((question) => ({ question, answer: '', height: 100 })),
    },
  },
  {
    id: 'customer-journey',
    name: { ru: 'Карта пути клиента', en: 'Customer journey map' },
    description: {
      ru: 'Этапы пути клиента по строкам: цели, действия, точки контакта, сомнения, кривая эмоций, боли, внутренний процесс, метрика и возможности.',
      en: 'The customer\'s path by layers: goals, actions, touchpoints, doubts, an emotion curve, pain points, the internal process, a metric and opportunities.',
    },
    spec: {
      notation: 'sheet',
      kind: 'journey',
      name: { ru: 'Карта пути клиента', en: 'Customer journey map' },
      title: { ru: 'Карта пути клиента', en: 'Customer journey map' },
      stages: [
        { name: { ru: 'Осознание', en: 'Awareness' }, emotion: 0 },
        { name: { ru: 'Поиск', en: 'Search' }, emotion: 0 },
        { name: { ru: 'Выбор', en: 'Choice' }, emotion: 0 },
        { name: { ru: 'Покупка', en: 'Purchase' }, emotion: 0 },
        { name: { ru: 'Использование', en: 'Use' }, emotion: 0 },
        { name: { ru: 'Поддержка', en: 'Support' }, emotion: 0 },
      ],
      rows: Object.values(JOURNEY_ROWS).map((row) => (row.curve ? row : { ...row, cells: blank(6) })),
    },
  },
];
