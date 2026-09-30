/**
 * 2. Manufacturing of a low-voltage induction motor.
 *
 * WEG reported more than 19 million motors produced in 2025 across 67 plants;
 * Jaraguá do Sul hosts what the industry recognises as the largest electric
 * motor plant in the world. The model follows one motor through the line.
 */
import { DERIVED, WEG, dataNote, roles, sourceBlock } from './facts.js';
import { flow, node, reported, wait, work } from './kit.js';

const LANES = [
  { id: 'plan', label: { ru: 'Планирование производства', en: 'Production planning' } },
  { id: 'stamp', label: { ru: 'Штамповка и пакетирование', en: 'Stamping & core stacking' } },
  { id: 'rotor', label: { ru: 'Литьё ротора и механообработка', en: 'Rotor casting & machining' } },
  { id: 'wind', label: { ru: 'Обмотка и изоляция', en: 'Winding & insulation' } },
  { id: 'assy', label: { ru: 'Сборка', en: 'Assembly' } },
  { id: 'test', label: { ru: 'Испытания (IEC 60034)', en: 'Testing (IEC 60034)' } },
  { id: 'finish', label: { ru: 'Окраска и упаковка', en: 'Painting & packing' } },
];

export const motorManufacturing = {
  id: 'weg-make-motor',
  order: 2,
  name: { ru: '2. Производство асинхронного двигателя', en: '2. Induction motor manufacturing' },
  description: {
    ru: 'Маршрут одного двигателя по линии: штамповка, литьё ротора, обмотка, пропитка, сборка, испытания по IEC 60034, окраска и упаковка.',
    en: 'One motor through the line: stamping, rotor casting, winding, impregnation, assembly, IEC 60034 testing, painting and packing.',
  },
  analysis: {
    currency: 'R$',
    volumePerYear: WEG.motorsPerYear,
    hoursPerFte: 1800,
    workingDays: WEG.workingDays,
    roles: roles('Планировщик', 'Оператор', 'Намотчик', 'Сборщик', 'Техник-испытатель', 'ОТК'),
  },
  documentation: {
    ru: `Производственный маршрут низковольтного асинхронного двигателя.

Публичные данные:
• произведено более ${(WEG.motorsPerYear / 1e6).toFixed(0)} млн двигателей за 2025 год — это объём расчёта в модели;
• ${WEG.plants} производственных площадок в ${WEG.countries} странах, крупнейший в мире парк по производству электродвигателей — Jaraguá do Sul (SC);
• инвестиции R$ ${(WEG.investments.verticalizationBrl / 1e6).toFixed(0)} млн в вертикальную интеграцию в Бразилии и Мексике (собственный обмоточный провод, литьё).

Расчёт из публичных данных:
• ${(WEG.motorsPerYear / 1e6).toFixed(0)} млн ÷ ${WEG.workingDays} рабочих дней = ${DERIVED.motorsPerDay.toLocaleString('ru-RU')} двигателей в день по группе;
• при односменной работе ${DERIVED.motorsPerDay.toLocaleString('ru-RU')} шт/день ÷ 480 мин = такт ${(480 / DERIVED.motorsPerDay * 60).toFixed(2)} секунды на двигатель по всей группе — то есть линии работают параллельно на ${WEG.plants} площадках.

Времена операций — отраслевые допущения для линии серийных двигателей IE3; их нужно заменить нормативами конкретного завода. Доля брака 2,5 % и переделка обмотки 3 % — тоже допущения.

${dataNote('ru')}

${sourceBlock(['production', 'annual2025', 'verticalization', 'numbers'], 'ru')}`,
    en: `Production route of a low-voltage induction motor.

Public figures: more than ${(WEG.motorsPerYear / 1e6).toFixed(0)} million motors in 2025 (the annual volume used here), ${WEG.plants} plants in ${WEG.countries} countries, R$ ${(WEG.investments.verticalizationBrl / 1e6).toFixed(0)}m invested in vertical integration in Brazil and Mexico.

Derived: ${DERIVED.motorsPerDay.toLocaleString('en-US')} motors per working day across the group.

Operation times are industry assumptions for an IE3 serial line and should be replaced with the plant's own standards.

${dataNote('en')}

${sourceBlock(['production', 'annual2025', 'verticalization', 'numbers'], 'en')}`,
  },
  spec: {
    notation: 'bpmn',
    name: { ru: 'Производство асинхронного двигателя', en: 'Induction motor manufacturing' },
    lanes: LANES,
    nodes: [
      node('start', 'startTimerEvent', 'plan', 'Производственный заказ по плану MPS', 'Production order released by MPS', reported({})),
      node('release', 'serviceTask', 'plan', 'Выпустить заказ и зарезервировать материалы', 'Release the order and reserve materials', work(6, 'Планировщик')),
      node('split', 'parallelGateway', 'plan', 'Запустить ветки', 'Start the branches'),

      node('stampStator', 'manualTask', 'stamp', 'Штамповать пластины статора и ротора', 'Stamp stator and rotor laminations', work(0.6, 'Оператор', { cost: 18 })),
      node('stack', 'manualTask', 'stamp', 'Собрать и скрепить пакет статора', 'Stack and clamp the stator core', work(1.2, 'Оператор')),

      node('cast', 'serviceTask', 'rotor', 'Литьё ротора под давлением (алюминий)', 'Die-cast the rotor (aluminium)', work(1.5, 'Оператор', { cost: 24 })),
      node('shaft', 'serviceTask', 'rotor', 'Обточить вал и напрессовать ротор', 'Machine the shaft and press the rotor', work(2.5, 'Оператор')),
      node('balance', 'serviceTask', 'rotor', 'Отбалансировать ротор', 'Balance the rotor', work(1.1, 'Техник-испытатель')),

      node('coil', 'manualTask', 'wind', 'Намотать катушки', 'Wind the coils', work(6, 'Намотчик', { cost: 31 })),
      node('insert', 'manualTask', 'wind', 'Уложить обмотку и изолировать пазы', 'Insert the winding and insulate the slots', work(4, 'Намотчик')),
      node('surge', 'userTask', 'wind', 'Импульсный тест межвитковой изоляции', 'Surge test of the inter-turn insulation', work(1.2, 'Техник-испытатель')),
      node('gwWind', 'exclusiveGateway', 'wind', 'Обмотка годна?', 'Winding OK?'),
      node('rewind', 'manualTask', 'wind', 'Перемотать', 'Rewind', work(9, 'Намотчик', { cost: 26 })),
      node('impreg', 'serviceTask', 'wind', 'Пропитка лаком и полимеризация', 'Varnish impregnation and curing', work(2, 'Оператор', { waitTime: 40 })),

      node('join', 'parallelGateway', 'assy', 'Синхронизировать ветки', 'Join the branches'),
      node('assemble', 'manualTask', 'assy', 'Собрать двигатель (щиты, подшипники, клеммная коробка)', 'Assemble the motor (end shields, bearings, terminal box)', work(7, 'Сборщик', { cost: 46 })),
      node('nameplate', 'serviceTask', 'assy', 'Нанести шильд и серийный номер', 'Attach the nameplate and serial number', work(0.8, 'Сборщик')),

      node('routine', 'userTask', 'test', 'Приёмо-сдаточные испытания по IEC 60034-1', 'Routine tests to IEC 60034-1', work(3.5, 'Техник-испытатель')),
      node('gwTest', 'exclusiveGateway', 'test', 'Соответствует классу КПД?', 'Efficiency class met?'),
      node('repair', 'userTask', 'test', 'Дефектовка и устранение', 'Diagnose and fix', work(24, 'Техник-испытатель', { cost: 65 })),
      node('gwRepair', 'exclusiveGateway', 'test', 'Ремонт возможен?', 'Repairable?'),
      node('scrap', 'endErrorEvent', 'test', 'Брак списан', 'Scrapped'),
      node('sample', 'userTask', 'test', 'Выборочные типовые испытания партии', 'Sample type test of the batch', work(0.4, 'ОТК')),

      node('paint', 'serviceTask', 'finish', 'Окрасить корпус', 'Paint the frame', work(1.8, 'Оператор', { waitTime: 25, cost: 12 })),
      node('pack', 'manualTask', 'finish', 'Упаковать и передать на склад', 'Pack and move to the warehouse', work(1.2, 'Оператор', { cost: 9 })),
      node('end', 'endEvent', 'finish', 'Двигатель на складе готовой продукции', 'Motor in finished goods'),

      node('specData', 'dataObject', 'plan', 'Спецификация и маршрутная карта', 'BOM and routing'),
      node('testData', 'dataStore', 'test', 'Протоколы испытаний', 'Test records'),
      node('note', 'textAnnotation', 'test', 'Объём расчёта: 19 млн двигателей в год (публичный отчёт 2025)', 'Volume: 19m motors per year (2025 report)'),
    ],
    edges: [
      flow('start', 'release'),
      flow('release', 'split'),
      flow('split', 'stampStator'),
      flow('split', 'coil'),
      flow('stampStator', 'stack'),
      flow('stack', 'cast'),
      flow('cast', 'shaft'),
      flow('shaft', 'balance'),
      flow('balance', 'join'),
      flow('coil', 'insert'),
      flow('insert', 'surge'),
      flow('surge', 'gwWind'),
      flow('gwWind', 'impreg', { share: 97, ru: 'годна', en: 'pass' }),
      flow('gwWind', 'rewind', { share: 3, ru: 'дефект', en: 'fail' }),
      flow('rewind', 'surge'),
      flow('impreg', 'join'),
      flow('join', 'assemble'),
      flow('assemble', 'nameplate'),
      flow('nameplate', 'routine'),
      flow('routine', 'gwTest'),
      flow('gwTest', 'sample', { share: 97.5, ru: 'годен', en: 'pass' }),
      flow('gwTest', 'repair', { share: 2.5, ru: 'не соответствует', en: 'fail' }),
      flow('repair', 'gwRepair'),
      flow('gwRepair', 'routine', { share: 88, ru: 'исправлен', en: 'fixed' }),
      flow('gwRepair', 'scrap', { share: 12, ru: 'неисправим', en: 'scrap' }),
      flow('sample', 'paint'),
      flow('paint', 'pack'),
      flow('pack', 'end'),
      { source: 'release', target: 'specData', type: 'dataAssociation' },
      { source: 'routine', target: 'testData', type: 'dataAssociation' },
      { source: 'routine', target: 'note', type: 'association' },
    ],
  },
};
