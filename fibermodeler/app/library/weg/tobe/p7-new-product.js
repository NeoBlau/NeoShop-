/**
 * 7 (TO-BE). Stage-gate development on a modular platform, with simulation-led
 * design, additive tooling for the pilot and certification run in parallel.
 */
import { DERIVED, WEG, dataNote, roles, sourceBlock } from '../facts.js';
import { DAY, WEEK, auto, flow, node, reported, work } from '../kit.js';

const LANES = [
  { id: 'market', label: { ru: 'Маркетинг и продукт', en: 'Marketing and product' } },
  { id: 'rnd', label: { ru: 'R&D — расчёт и конструкция', en: 'R&D — calculation and design' } },
  { id: 'proto', label: { ru: 'Опытное производство', en: 'Prototype shop' } },
  { id: 'lab', label: { ru: 'Испытательная лаборатория', en: 'Test laboratory' } },
  { id: 'cert', label: { ru: 'Сертификация', en: 'Certification' } },
  { id: 'ops', label: { ru: 'Подготовка производства', en: 'Manufacturing engineering' } },
];

export const newProductToBe = {
  id: 'weg-npd-tobe',
  order: 7,
  variant: 'to-be',
  baselineId: 'weg-npd',
  name: {
    ru: '7. Разработка нового продукта (stage-gate) — как будет',
    en: '7. New product development (stage-gate) — to be',
  },
  description: {
    ru: 'Продукт собирается из модульной платформы, численная оптимизация доводит конструкцию до класса КПД до изготовления образца, сертификация запускается параллельно испытаниям, оснастка для пилота печатается, пилот подтверждается статистикой процесса.',
    en: 'The product is assembled from a modular platform, numerical optimisation takes the design to its efficiency class before any hardware, certification starts in parallel with testing, pilot tooling is printed, and the pilot is confirmed by process statistics.',
  },
  analysis: {
    currency: 'R$',
    volumePerYear: 320,
    hoursPerFte: 1800,
    workingDays: WEG.workingDays,
    roles: roles('Аналитик', 'Ведущий инженер', 'Инженер-конструктор', 'Оператор', 'Техник-испытатель', 'ОТК', 'Планировщик'),
  },
  documentation: {
    ru: `Целевое состояние разработки нового продукта.

Контекст: WEG тратит на R&D **R$ ${(WEG.rndSpend / 1e9).toFixed(1)} млрд — ${DERIVED.rndShare} % выручки 2025 года** (публичная отчётность). Объём расчёта не меняется: 320 проектов в год.

Что меняется по сравнению с «как есть»:
1. **Ворота 1.** Оценка рынка опирается на данные о продажах и сервисе уже установленного парка, а не на отдельное исследование: 960 → 420 мин. Доля проходящих ворота оставлена прежней — 45 %: смысл хорошего отсева не в том, чтобы пропускать больше, а в том, чтобы закрывать неудачные проекты раньше и дешевле.
2. **Конструкция.** Концепция собирается из модулей платформы (1920 → 900 мин). Численная оптимизация прогоняет сотни вариантов активной части до изготовления образца, поэтому доля переработок после ворот 2 падает с 22 до 10 %.
3. **Класс КПД.** Главная развилка «класс достигнут?» решается расчётом, а не испытанием: доля доводок после испытаний падает с 30 до 12 %. Это самый дорогой цикл в исходном процессе.
4. **Образец.** Аддитивная оснастка и печать пресс-форм для опытной партии: 2880 → 1680 мин, стоимость образца ниже.
5. **Сертификация.** Подготовка документов и подача запускаются параллельно испытаниям, а не после них; лаборатория WEG аккредитована по части программы, поэтому ожидание органа сокращается.
6. **Оснастка серии.** Параллельно испытаниям бронируется слот у изготовителя оснастки — это дёшево (R$ 12 тыс.) и ничем не рискует. Сам заказ на R$ 340 тыс. размещается, как и раньше, только после ворот 3: тратить деньги на оснастку до сертификации нельзя, иначе 6 % закрытых на воротах проектов уносят её стоимость с собой. Выигрыш — не в раннем платеже, а в том, что срок изготовления сокращается с 8 до 5 недель, потому что очередь уже занята.
7. **Пилот.** Подтверждение процесса опирается на статистику линии (PPAP на данных), доля неуспешных пилотов падает с 15 до 7 %.

Что НЕ меняется: требования IEC 60034-2-1, независимость органов сертификации, ресурсные испытания подшипниковых узлов (физику не ускорить), срок изготовления серийной оснастки поставщиком.

Целевые нормативы и доли — **отраслевые допущения**, их нужно калибровать по собственной статистике проектов.

${dataNote('ru')}

${sourceBlock(['annual2025', 'numbers', 'profile'], 'ru')}`,
    en: `Target state of new product development. Context: WEG spends **R$ ${(WEG.rndSpend / 1e9).toFixed(1)}bn on R&D, ${DERIVED.rndShare}% of 2025 revenue**. The volume is unchanged at 320 projects a year.

Changes: the market case is built from installed-base sales and service data rather than a separate study (960 → 420 min), with the gate-1 pass rate deliberately left at 45% - better screening means killing the wrong projects sooner and cheaper, not letting more of them through; the concept is assembled from platform modules (1920 → 900 min) and numerical optimisation runs hundreds of active-part variants before any hardware, so redesigns after gate 2 drop from 22% to 10%; the efficiency-class decision is settled by calculation rather than by test, so post-test tuning falls from 30% to 12% - the most expensive loop in the as-is process; additive tooling shortens the prototype (2880 → 1680 min); certification is prepared and filed in parallel with testing; the tooling slot is reserved in parallel with testing for a cheap R$ 12k while the R$ 340k order still waits for gate 3 - committing earlier would make the 6% of projects killed at the gate carry the tooling cost with them - and the gain is the shorter build (8 → 5 weeks) because the queue is already held; the pilot is confirmed by line statistics, so failed pilots drop from 15% to 7%.

Unchanged: IEC 60034-2-1, the independence of the certification bodies, bearing life testing (physics does not accelerate) and the tooling supplier's lead time.

The target norms and shares are **assumptions** to calibrate against your own project statistics.

${dataNote('en')}

${sourceBlock(['annual2025', 'numbers', 'profile'], 'en')}`,
  },
  spec: {
    notation: 'bpmn',
    name: { ru: 'Разработка продукта — как будет', en: 'New product development — to be' },
    lanes: LANES,
    nodes: [
      node('start', 'startEvent', 'market', 'Идея или запрос рынка', 'Idea or market request', reported({})),
      node('screen', 'userTask', 'market', 'Оценить рынок по данным продаж и сервиса парка', 'Size the market from installed-base sales and service data', work(420, 'Аналитик')),
      node('business', 'businessRuleTask', 'market', 'Собрать бизнес-кейс и NPV по модели', 'Build the business case and NPV from the model', work(300, 'Аналитик')),
      node('gate1', 'exclusiveGateway', 'market', 'Ворота 1: идея принята?', 'Gate 1: idea approved?'),
      node('stop1', 'endEvent', 'market', 'Проект закрыт на воротах', 'Closed at a gate'),
      node('concept', 'userTask', 'rnd', 'Собрать концепцию из модулей платформы', 'Assemble the concept from platform modules', work(900, 'Ведущий инженер')),
      node('optimise', 'serviceTask', 'rnd', 'Численная оптимизация активной части (сотни вариантов)', 'Numerical optimisation of the active part (hundreds of variants)', work(600, 'Инженер-конструктор', { cost: 21000 })),
      node('gwClass', 'exclusiveGateway', 'rnd', 'Класс энергоэффективности достигнут расчётом?', 'Efficiency class reached by calculation?'),
      node('tune', 'userTask', 'rnd', 'Доработать активную часть', 'Refine the active part', work(600, 'Ведущий инженер', { cost: 16000 })),
      node('gate2', 'exclusiveGateway', 'rnd', 'Ворота 2: конструкция утверждена?', 'Gate 2: design approved?'),
      node('redesign', 'userTask', 'rnd', 'Переработать конструкцию', 'Rework the design', work(720, 'Инженер-конструктор')),
      node('pgSplit', 'parallelGateway', 'rnd', 'Образец, сертификация и оснастка параллельно', 'Prototype, certification and tooling in parallel'),
      node('proto', 'manualTask', 'proto', 'Изготовить образец с печатной оснасткой', 'Build the prototype with additive tooling', work(1680, 'Оператор', { resourceQty: 2, cost: 98000 })),
      node('splitTest', 'parallelGateway', 'lab', 'Запустить испытания параллельно', 'Start the tests in parallel'),
      node('efficiency', 'userTask', 'lab', 'Испытания КПД по IEC 60034-2-1', 'Efficiency tests to IEC 60034-2-1', work(960, 'Техник-испытатель', { cost: 22000 })),
      node('thermal', 'userTask', 'lab', 'Тепловые и вибрационные испытания', 'Thermal and vibration tests', work(600, 'Техник-испытатель')),
      node('life', 'userTask', 'lab', 'Ресурсные испытания подшипниковых узлов', 'Bearing life tests', work(720, 'Техник-испытатель', { waitTime: WEEK * 4 })),
      node('joinTest', 'parallelGateway', 'lab', 'Свести результаты испытаний', 'Consolidate the test results'),
      node('gwConfirm', 'exclusiveGateway', 'lab', 'Расчёт подтверждён испытаниями?', 'Calculation confirmed by test?'),
      node('correct', 'userTask', 'rnd', 'Скорректировать модель и конструкцию', 'Correct the model and the design', work(840, 'Ведущий инженер', { cost: 24000 })),
      node('certPrep', 'userTask', 'cert', 'Подготовить досье и подать заявку заранее', 'Prepare the dossier and file early', work(300, 'ОТК', { cost: 12000 })),
      node('cert', 'sendTask', 'cert', 'Сертификация (INMETRO, UL, CE)', 'Certification (INMETRO, UL, CE)', work(360, 'ОТК', { waitTime: WEEK * 5, cost: 83000 })),
      node('reserve', 'userTask', 'ops', 'Зарезервировать слот у изготовителя оснастки', 'Reserve the slot with the tooling supplier', work(240, 'Планировщик', { cost: 12000 })),
      node('tooling', 'userTask', 'ops', 'Заказать серийную оснастку по забронированному слоту', 'Order the series tooling against the reserved slot', work(2100, 'Планировщик', { waitTime: WEEK * 5, cost: 340000 })),
      node('pgJoin', 'parallelGateway', 'ops', 'Образец, сертификат и слот оснастки готовы', 'Prototype, certificate and tooling slot ready'),
      node('gate3', 'exclusiveGateway', 'ops', 'Ворота 3: к производству готов?', 'Gate 3: ready for production?'),
      node('pilot', 'manualTask', 'ops', 'Выпустить пилотную партию', 'Run the pilot batch', work(1800, 'Оператор', { resourceQty: 3, cost: 96000 })),
      node('ppap', 'businessRuleTask', 'ops', 'Подтвердить процесс статистикой линии (PPAP на данных)', 'Confirm the process on line statistics (data-driven PPAP)', work(240, 'ОТК')),
      node('gwPilot', 'exclusiveGateway', 'ops', 'Пилот успешен?', 'Pilot successful?'),
      node('launch', 'userTask', 'market', 'Запустить продажи и обучить сеть', 'Launch sales and train the network', work(900, 'Аналитик', { cost: 72000 })),
      node('end', 'endEvent', 'market', 'Продукт в серийном производстве', 'Product in series production', { completes: true }),
      node('platform', 'dataStore', 'rnd', 'Платформа модулей', 'Module platform'),
      node('certDoc', 'dataObject', 'cert', 'Сертификаты соответствия', 'Certificates of conformity'),
      node('note', 'textAnnotation', 'rnd', 'Класс КПД решается расчётом до железа — здесь исчезает самый дорогой цикл доводки', 'The efficiency class is settled by calculation before any hardware - that is where the costliest loop disappears'),
    ],
    edges: [
      flow('start', 'screen'),
      flow('screen', 'business'),
      flow('business', 'gate1'),
      flow('gate1', 'concept', { share: 45, ru: 'принята', en: 'approved' }),
      flow('gate1', 'stop1', { share: 55, ru: 'закрыта', en: 'closed' }),
      flow('concept', 'optimise'),
      flow('optimise', 'gwClass'),
      flow('gwClass', 'gate2', { share: 88, ru: 'достигнут', en: 'reached' }),
      flow('gwClass', 'tune', { share: 12, ru: 'не достигнут', en: 'not reached' }),
      flow('tune', 'optimise'),
      flow('gate2', 'pgSplit', { share: 90, ru: 'утверждена', en: 'approved' }),
      flow('gate2', 'redesign', { share: 10, ru: 'на доработку', en: 'rework' }),
      flow('redesign', 'optimise'),
      flow('pgSplit', 'proto'),
      flow('pgSplit', 'certPrep'),
      flow('pgSplit', 'reserve'),
      flow('proto', 'splitTest'),
      flow('splitTest', 'efficiency'),
      flow('splitTest', 'thermal'),
      flow('splitTest', 'life'),
      flow('efficiency', 'joinTest'),
      flow('thermal', 'joinTest'),
      flow('life', 'joinTest'),
      flow('joinTest', 'gwConfirm'),
      flow('gwConfirm', 'pgJoin', { share: 88, ru: 'подтверждён', en: 'confirmed' }),
      flow('gwConfirm', 'correct', { share: 12, ru: 'расхождение', en: 'deviation' }),
      flow('correct', 'splitTest'),
      flow('certPrep', 'cert'),
      flow('cert', 'pgJoin'),
      flow('reserve', 'pgJoin'),
      flow('pgJoin', 'gate3'),
      flow('gate3', 'tooling', { share: 94, ru: 'готов', en: 'ready' }),
      flow('gate3', 'stop1', { share: 6, ru: 'закрыт', en: 'closed' }),
      flow('tooling', 'pilot'),
      flow('pilot', 'ppap'),
      flow('ppap', 'gwPilot'),
      flow('gwPilot', 'launch', { share: 93, ru: 'успешен', en: 'successful' }),
      flow('gwPilot', 'pilot', { share: 7, ru: 'повтор', en: 'repeat' }),
      flow('launch', 'end'),
      { source: 'concept', target: 'platform', type: 'dataAssociation' },
      { source: 'cert', target: 'certDoc', type: 'dataAssociation' },
      { source: 'gwClass', target: 'note', type: 'association' },
    ],
  },
};
