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
