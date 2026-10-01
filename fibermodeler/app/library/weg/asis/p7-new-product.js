/**
 * 7. New product development (stage-gate) for an efficiency-class motor.
 *
 * WEG spent R$ 1.4 billion on research, development and innovation in 2025 -
 * 3.4% of net revenue - and reports that 71% of revenue comes from products
 * classified as sustainable.
 */
import { DERIVED, WEG, dataNote, roles, sourceBlock } from '../facts.js';
import { DAY, WEEK, flow, node, reported, wait, work } from '../kit.js';

const LANES = [
  { id: 'market', label: { ru: 'Маркетинг и продукт', en: 'Marketing & product' } },
  { id: 'rnd', label: { ru: 'R&D — расчёт и конструкция', en: 'R&D — design' } },
  { id: 'proto', label: { ru: 'Опытное производство', en: 'Prototype shop' } },
  { id: 'lab', label: { ru: 'Испытательная лаборатория', en: 'Test laboratory' } },
  { id: 'cert', label: { ru: 'Сертификация', en: 'Certification' } },
  { id: 'ops', label: { ru: 'Подготовка производства', en: 'Industrialisation' } },
];

export const newProduct = {
  id: 'weg-npd',
  order: 7,
  variant: 'as-is',
  name: { ru: '7. Разработка нового продукта (stage-gate)', en: '7. New product development (stage-gate)' },
  description: {
    ru: 'Идея — бизнес-кейс — конструкция — прототип — испытания КПД по IEC 60034-2-1 — сертификация — подготовка производства — запуск.',
    en: 'Idea — business case — design — prototype — IEC 60034-2-1 efficiency tests — certification — industrialisation — launch.',
  },
  analysis: {
    currency: 'R$',
    volumePerYear: 320,
    hoursPerFte: 1800,
    workingDays: WEG.workingDays,
    roles: roles('Аналитик', 'Инженер-конструктор', 'Ведущий инженер', 'Оператор', 'Техник-испытатель', 'ОТК', 'Планировщик'),
  },
  documentation: {
    ru: `Разработка нового продукта — от идеи до серийного запуска, с воротами принятия решения (stage-gate).

Публичные данные:
• расходы на исследования, разработку и инновации в 2025 году — R$ ${(WEG.rndSpend / 1e9).toFixed(1)} млрд, это ${DERIVED.rndShare} % чистой выручки;
• 71 % выручки приходится на продукты, отнесённые компанией к устойчивым (энергоэффективные двигатели, приводы, решения для ВИЭ);
• выручка 2025 — R$ ${(WEG.revenue / 1e9).toFixed(1)} млрд, чистая прибыль R$ ${(WEG.netIncome / 1e9).toFixed(2)} млрд.

Расчёт из публичных данных: объём в модели — 320 проектов разработки в год; R$ ${(WEG.rndSpend / 1e9).toFixed(1)} млрд ÷ 320 ≈ R$ ${Math.round(WEG.rndSpend / 320 / 1e6)} млн среднего бюджета проекта — этот порядок величины и заложен в стоимость этапов.

Прохождение ворот (45 % на Gate 1) и доля повторных испытаний — отраслевые допущения.

${dataNote('ru')}

${sourceBlock(['annual2025', 'fy2025', 'numbers'], 'ru')}`,
    en: `Stage-gate development of a new product, from idea to serial launch.

Public figures: R$ ${(WEG.rndSpend / 1e9).toFixed(1)}bn spent on R&D and innovation in 2025 (${DERIVED.rndShare}% of net revenue); 71% of revenue comes from products the company classifies as sustainable.

Derived: 320 development projects a year gives an average project budget of about R$ ${Math.round(WEG.rndSpend / 320 / 1e6)}m, which is what the stage costs reflect.

${dataNote('en')}

${sourceBlock(['annual2025', 'fy2025', 'numbers'], 'en')}`,
  },
  spec: {
    notation: 'bpmn',
    name: { ru: 'Разработка нового продукта', en: 'New product development' },
    lanes: LANES,
    nodes: [
      node('start', 'startEvent', 'market', 'Идея или запрос рынка', 'Idea or market request', reported({})),
      node('screen', 'userTask', 'market', 'Оценить рынок, объём и цену', 'Assess market, volume and price', work(960, 'Аналитик')),
      node('business', 'businessRuleTask', 'market', 'Собрать бизнес-кейс и NPV', 'Build the business case and NPV', work(720, 'Аналитик')),
      node('gate1', 'exclusiveGateway', 'market', 'Ворота 1: идея принята?', 'Gate 1: idea approved?'),
      node('stop1', 'endEvent', 'market', 'Проект закрыт на Gate 1', 'Stopped at Gate 1'),
      node('concept', 'userTask', 'rnd', 'Разработать техническую концепцию', 'Develop the technical concept', work(1920, 'Ведущий инженер')),
      node('simulate', 'serviceTask', 'rnd', 'Электромагнитный и тепловой расчёт (МКЭ)', 'Electromagnetic and thermal FEA', work(1440, 'Инженер-конструктор', { cost: 18000 })),
      node('gate2', 'exclusiveGateway', 'rnd', 'Ворота 2: конструкция утверждена?', 'Gate 2: design approved?'),
      node('redesign', 'userTask', 'rnd', 'Переработать конструкцию', 'Rework the design', work(1200, 'Инженер-конструктор')),
      node('proto', 'manualTask', 'proto', 'Изготовить опытный образец', 'Build the prototype', work(2880, 'Оператор', { resourceQty: 2, cost: 145000 })),
      node('split', 'parallelGateway', 'lab', 'Запустить испытания параллельно', 'Start the test programme'),
      node('efficiency', 'userTask', 'lab', 'Испытания КПД по IEC 60034-2-1', 'Efficiency tests to IEC 60034-2-1', work(1440, 'Техник-испытатель', { cost: 26000 })),
      node('thermal', 'userTask', 'lab', 'Тепловые и вибрационные испытания', 'Thermal and vibration tests', work(960, 'Техник-испытатель')),
      node('life', 'userTask', 'lab', 'Ресурсные испытания подшипниковых узлов', 'Bearing endurance tests', work(720, 'Техник-испытатель', { waitTime: WEEK * 4 })),
      node('join', 'parallelGateway', 'lab', 'Свести результаты испытаний', 'Collect the test results'),
      node('gwClass', 'exclusiveGateway', 'lab', 'Класс энергоэффективности достигнут?', 'Efficiency class achieved?'),
      node('tune', 'userTask', 'rnd', 'Оптимизировать активную часть', 'Optimise the active part', work(1680, 'Ведущий инженер', { cost: 42000 })),
      node('cert', 'sendTask', 'cert', 'Сертификация (INMETRO, UL, CE)', 'Certification (INMETRO, UL, CE)', work(600, 'ОТК', { cost: 95000, waitTime: WEEK * 8 })),
      node('gate3', 'exclusiveGateway', 'cert', 'Ворота 3: к производству готов?', 'Gate 3: ready to industrialise?'),
      node('tooling', 'userTask', 'ops', 'Изготовить оснастку и штампы', 'Build tooling and dies', work(3840, 'Планировщик', { cost: 380000, waitTime: WEEK * 6 })),
      node('pilot', 'manualTask', 'ops', 'Выпустить пилотную партию', 'Run the pilot batch', work(2400, 'Оператор', { resourceQty: 3, cost: 120000 })),
      node('ppap', 'userTask', 'ops', 'Подтвердить процесс и качество (PPAP)', 'Confirm the process and quality (PPAP)', work(600, 'ОТК')),
      node('gwPilot', 'exclusiveGateway', 'ops', 'Пилот успешен?', 'Pilot successful?'),
      node('launch', 'userTask', 'market', 'Запустить продажи и обучить сеть', 'Launch sales and train the channel', work(1200, 'Аналитик', { cost: 85000 })),
      node('end', 'endEvent', 'market', 'Продукт в серийном производстве', 'Product in serial production', { completes: true }),
      node('spec', 'dataObject', 'rnd', 'Техническое описание и расчёты', 'Design record and calculations'),
      node('certDoc', 'dataObject', 'cert', 'Сертификаты соответствия', 'Certificates of conformity'),
      node('note', 'textAnnotation', 'market', 'R&D 2025: R$ 1,4 млрд = 3,4 % выручки (публичный отчёт)', 'R&D 2025: R$ 1.4bn = 3.4% of revenue (public report)'),
    ],
    edges: [
      flow('start', 'screen'),
      flow('screen', 'business'),
      flow('business', 'gate1'),
      flow('gate1', 'concept', { share: 45, ru: 'принято', en: 'approved' }),
      flow('gate1', 'stop1', { share: 55, ru: 'закрыто', en: 'stopped' }),
      flow('concept', 'simulate'),
      flow('simulate', 'gate2'),
      flow('gate2', 'proto', { share: 78, ru: 'утверждено', en: 'approved' }),
      flow('gate2', 'redesign', { share: 22, ru: 'на доработку', en: 'rework' }),
      flow('redesign', 'simulate'),
      flow('proto', 'split'),
      flow('split', 'efficiency'),
      flow('split', 'thermal'),
      flow('split', 'life'),
      flow('efficiency', 'join'),
      flow('thermal', 'join'),
      flow('life', 'join'),
      flow('join', 'gwClass'),
      flow('gwClass', 'cert', { share: 70, ru: 'достигнут', en: 'achieved' }),
      flow('gwClass', 'tune', { share: 30, ru: 'не достигнут', en: 'not achieved' }),
      flow('tune', 'split'),
      flow('cert', 'gate3'),
      flow('gate3', 'tooling', { share: 88, ru: 'да', en: 'yes' }),
      flow('gate3', 'stop1', { share: 12, ru: 'стоп', en: 'stop' }),
      flow('tooling', 'pilot'),
      flow('pilot', 'ppap'),
      flow('ppap', 'gwPilot'),
      flow('gwPilot', 'launch', { share: 85, ru: 'успешен', en: 'ok' }),
      flow('gwPilot', 'pilot', { share: 15, ru: 'повтор', en: 'repeat' }),
      flow('launch', 'end'),
      { source: 'simulate', target: 'spec', type: 'dataAssociation' },
      { source: 'cert', target: 'certDoc', type: 'dataAssociation' },
      { source: 'business', target: 'note', type: 'association' },
    ],
  },
};
