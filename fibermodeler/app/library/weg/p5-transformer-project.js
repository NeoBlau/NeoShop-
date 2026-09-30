/**
 * 5. GTD project: a power transformer / substation package.
 *
 * Generation, transmission and distribution is 35.8% of WEG's 2025 revenue and
 * the company is putting R$ 1.2 billion into transformer capacity.
 */
import { DERIVED, WEG, dataNote, roles, sourceBlock } from './facts.js';
import { DAY, WEEK, flow, node, reported, wait, work } from './kit.js';

const LANES = [
  { id: 'utility', label: { ru: 'Заказчик (энергокомпания)', en: 'Customer (utility)' } },
  { id: 'bid', label: { ru: 'Тендерный отдел', en: 'Bid office' } },
  { id: 'eng', label: { ru: 'Инжиниринг GTD', en: 'GTD engineering' } },
  { id: 'prod', label: { ru: 'Производство трансформаторов', en: 'Transformer plant' } },
  { id: 'lab', label: { ru: 'Высоковольтная лаборатория', en: 'High-voltage laboratory' } },
  { id: 'site', label: { ru: 'Монтаж и пусконаладка', en: 'Site works & commissioning' } },
];

export const transformerProject = {
  id: 'weg-gtd',
  order: 5,
  name: { ru: '5. Проект силового трансформатора (GTD)', en: '5. Power transformer project (GTD)' },
  description: {
    ru: 'Тендер энергокомпании — расчёт — контракт — проектирование — изготовление активной части — высоковольтные испытания — монтаж на подстанции.',
    en: 'Utility tender — costing — contract — design — active part manufacturing — high-voltage tests — substation installation.',
  },
  analysis: {
    currency: 'R$',
    volumePerYear: 1800,
    hoursPerFte: 1800,
    workingDays: WEG.workingDays,
    roles: roles('Менеджер по продажам', 'Инженер-конструктор', 'Ведущий инженер', 'Планировщик', 'Сборщик', 'Техник-испытатель', 'Сервисный инженер'),
  },
  documentation: {
    ru: `Проектная поставка силового трансформатора и оборудования подстанции.

Публичные данные:
• сегмент генерации, передачи и распределения (GTD) — ${(WEG.segments.gtd * 100).toFixed(1)} % выручки 2025 года, это ≈ R$ ${(DERIVED.gtdRevenue / 1e9).toFixed(1)} млрд;
• объявлены инвестиции R$ ${(WEG.investments.transformersBrl / 1e9).toFixed(1)} млрд в расширение производства трансформаторов;
• в Бразилии работает сеть из более чем ${WEG.serviceNetworkBrazilTransformers} аккредитованных партнёров по сервису трансформаторов — они же выполняют часть работ на площадке;
• в 4-м квартале 2025 года выручка снизилась на 5,3 % из-за меньшего спроса на солнечные проекты — сезонность спроса в GTD видна в отчётности.

Расчёт из публичных данных: объём в модели — 1 800 проектов в год (допущение: ≈ R$ 8 млн средняя стоимость проекта × 1 800 ≈ R$ 14,6 млрд выручки сегмента GTD).

Вероятность победы в тендере 25 % и доля замечаний по испытаниям 6 % — отраслевые допущения.

${dataNote('ru')}

${sourceBlock(['transformers', 'annual2025', 'fy2025', 'astec'], 'ru')}`,
    en: `Project delivery of a power transformer and substation equipment.

Public figures: GTD is ${(WEG.segments.gtd * 100).toFixed(1)}% of 2025 revenue (≈ R$ ${(DERIVED.gtdRevenue / 1e9).toFixed(1)}bn); R$ ${(WEG.investments.transformersBrl / 1e9).toFixed(1)}bn is being invested in transformer capacity; more than ${WEG.serviceNetworkBrazilTransformers} accredited transformer service partners operate in Brazil.

Volume in the model: 1,800 projects a year, derived from the segment revenue at an assumed R$ 8m average project value.

${dataNote('en')}

${sourceBlock(['transformers', 'annual2025', 'fy2025', 'astec'], 'en')}`,
  },
  spec: {
    notation: 'bpmn',
    name: { ru: 'Проект силового трансформатора (GTD)', en: 'Power transformer project (GTD)' },
    lanes: LANES,
    nodes: [
      node('start', 'startMessageEvent', 'utility', 'Опубликован тендер', 'Tender published', reported({})),
      node('screen', 'userTask', 'bid', 'Оценить условия и требования тендера', 'Screen the tender conditions', work(120, 'Менеджер по продажам')),
      node('gwGo', 'exclusiveGateway', 'bid', 'Участвуем?', 'Bid / no bid?'),
      node('noBid', 'endEvent', 'bid', 'Отказ от участия', 'No bid'),
      node('techSpec', 'userTask', 'eng', 'Разобрать техническое задание', 'Work through the specification', work(480, 'Ведущий инженер')),
      node('design1', 'userTask', 'eng', 'Предварительный расчёт активной части', 'Preliminary active-part design', work(720, 'Инженер-конструктор')),
      node('cost', 'businessRuleTask', 'bid', 'Рассчитать себестоимость и риски', 'Cost and risk calculation', work(300, 'Менеджер по продажам')),
      node('submit', 'sendTask', 'bid', 'Подать заявку и банковскую гарантию', 'Submit the bid and the bond', work(180, 'Менеджер по продажам', { cost: 9500 })),
      node('waitBid', 'intermediateTimerEvent', 'utility', 'Рассмотрение заявок', 'Tender evaluation', wait(DAY * 45)),
      node('gwWin', 'exclusiveGateway', 'bid', 'Тендер выигран?', 'Tender won?'),
      node('lost', 'endEvent', 'bid', 'Тендер проигран', 'Tender lost'),
      node('contract', 'userTask', 'bid', 'Подписать контракт и график', 'Sign the contract and the schedule', work(240, 'Менеджер по продажам', { waitTime: DAY * 10 })),
      node('design2', 'userTask', 'eng', 'Рабочий проект и согласование с заказчиком', 'Detailed design and customer approval', work(2880, 'Инженер-конструктор', { waitTime: DAY * 10 })),
      node('order', 'serviceTask', 'prod', 'Заказать сердечник, обмоточный провод, масло', 'Order core, winding wire and oil', work(150, 'Планировщик')),
      node('longlead', 'intermediateTimerEvent', 'prod', 'Поставка длинных позиций', 'Long-lead deliveries', wait(WEEK * 10)),
      node('core', 'manualTask', 'prod', 'Собрать магнитопровод', 'Stack the core', work(2400, 'Сборщик', { resourceQty: 3, cost: 180000 })),
      node('windings', 'manualTask', 'prod', 'Намотать обмотки ВН и НН', 'Wind the HV and LV coils', work(3600, 'Сборщик', { resourceQty: 4, cost: 260000 })),
      node('dryout', 'serviceTask', 'prod', 'Сушка активной части в вакууме', 'Vapour-phase drying of the active part', work(240, 'Сборщик', { waitTime: DAY * 3 })),
      node('tank', 'manualTask', 'prod', 'Установить в бак и залить масло', 'Tanking and oil filling', work(1440, 'Сборщик', { resourceQty: 3 })),
      node('routine', 'userTask', 'lab', 'Приёмо-сдаточные испытания (IEC 60076)', 'Routine tests to IEC 60076', work(720, 'Техник-испытатель')),
      node('gwTest', 'exclusiveGateway', 'lab', 'Испытания пройдены?', 'Tests passed?'),
      node('fixDefect', 'userTask', 'prod', 'Вскрыть и устранить дефект', 'Open up and fix the defect', work(2880, 'Сборщик', { resourceQty: 3, cost: 60000 })),
      node('typeTest', 'userTask', 'lab', 'Типовые испытания в присутствии заказчика', 'Witnessed type tests', work(960, 'Техник-испытатель', { cost: 45000 })),
      node('ship', 'serviceTask', 'site', 'Перевозка на подстанцию', 'Transport to the substation', work(180, 'Планировщик', { cost: 120000, waitTime: DAY * 8 })),
      node('install', 'userTask', 'site', 'Монтаж на фундаменте, сборка вводов', 'Installation and bushing assembly', work(2400, 'Сервисный инженер', { resourceQty: 2 })),
      node('commission', 'userTask', 'site', 'Пусконаладка и испытания на площадке', 'Commissioning and site tests', work(1440, 'Сервисный инженер', { resourceQty: 2, cost: 38000 })),
      node('handover', 'userTask', 'site', 'Передать заказчику, закрыть гарантию по вводу', 'Hand over to the utility', work(240, 'Сервисный инженер')),
      node('end', 'endEvent', 'site', 'Трансформатор в сети', 'Transformer energised'),
      node('protocol', 'dataObject', 'lab', 'Протоколы испытаний IEC 60076', 'IEC 60076 test reports'),
      node('asbuilt', 'dataObject', 'site', 'Исполнительная документация', 'As-built documentation'),
      node('note', 'textAnnotation', 'bid', 'GTD = 35,8 % выручки 2025 (публичный отчёт)', 'GTD = 35.8% of 2025 revenue (public report)'),
    ],
    edges: [
      flow('start', 'screen'),
      flow('screen', 'gwGo'),
      flow('gwGo', 'techSpec', { share: 58, ru: 'участвуем', en: 'bid' }),
      flow('gwGo', 'noBid', { share: 42, ru: 'отказ', en: 'no bid' }),
      flow('techSpec', 'design1'),
      flow('design1', 'cost'),
      flow('cost', 'submit'),
      flow('submit', 'waitBid'),
      flow('waitBid', 'gwWin'),
      flow('gwWin', 'contract', { share: 25, ru: 'победа', en: 'won' }),
      flow('gwWin', 'lost', { share: 75, ru: 'проигрыш', en: 'lost' }),
      flow('contract', 'design2'),
      flow('design2', 'order'),
      flow('order', 'longlead'),
      flow('longlead', 'core'),
      flow('core', 'windings'),
      flow('windings', 'dryout'),
      flow('dryout', 'tank'),
      flow('tank', 'routine'),
      flow('routine', 'gwTest'),
      flow('gwTest', 'typeTest', { share: 94, ru: 'пройдены', en: 'passed' }),
      flow('gwTest', 'fixDefect', { share: 6, ru: 'дефект', en: 'defect' }),
      flow('fixDefect', 'routine'),
      flow('typeTest', 'ship'),
      flow('ship', 'install'),
      flow('install', 'commission'),
      flow('commission', 'handover'),
      flow('handover', 'end'),
      { source: 'routine', target: 'protocol', type: 'dataAssociation' },
      { source: 'commission', target: 'asbuilt', type: 'dataAssociation' },
      { source: 'screen', target: 'note', type: 'association' },
    ],
  },
};
