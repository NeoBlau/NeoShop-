/**
 * 5 (TO-BE). Transformer project on standard platforms, with concurrent design
 * and procurement, expanded capacity and a remote type test.
 */
import { WEG, dataNote, roles, sourceBlock } from '../facts.js';
import { DAY, WEEK, auto, flow, node, reported, work } from '../../kit.js';

const LANES = [
  { id: 'utility', label: { ru: 'Заказчик (энергокомпания)', en: 'Customer (utility)' } },
  { id: 'bid', label: { ru: 'Тендерный отдел', en: 'Bid office' } },
  { id: 'eng', label: { ru: 'Инжиниринг GTD', en: 'GTD engineering' } },
  { id: 'plan', label: { ru: 'Снабжение', en: 'Supply' } },
  { id: 'prod', label: { ru: 'Производство трансформаторов', en: 'Transformer production' } },
  { id: 'lab', label: { ru: 'Высоковольтная лаборатория', en: 'High-voltage laboratory' } },
  { id: 'site', label: { ru: 'Монтаж и пусконаладка', en: 'Installation and commissioning' } },
];

export const transformerProjectToBe = {
  id: 'weg-gtd-tobe',
  order: 5,
  variant: 'to-be',
  baselineId: 'weg-gtd',
  name: {
    ru: '5. Проект силового трансформатора (GTD) — как будет',
    en: '5. Power transformer project (GTD) — to be',
  },
  description: {
    ru: 'Платформенные типоразмеры закрывают большинство тендеров, расчёт активной части и смета считаются из платформы, закупка длинных позиций идёт параллельно рабочему проекту, типовые испытания платформы не повторяются на каждом экземпляре, пусконаладка поддерживается удалённо.',
    en: 'Standard platforms cover most tenders, the active-part calculation and the cost come from the platform, long-lead procurement runs in parallel with detailed design, platform type tests are not repeated on every unit, and commissioning is supported remotely.',
  },
  analysis: {
    currency: 'R$',
    volumePerYear: 1800,
    hoursPerFte: 1800,
    workingDays: WEG.workingDays,
    roles: roles('Менеджер по продажам', 'Ведущий инженер', 'Инженер-конструктор', 'Планировщик', 'Сборщик', 'Техник-испытатель', 'Сервисный инженер'),
  },
  documentation: {
    ru: `Целевое состояние проекта силового трансформатора.

Опирается на публично объявленные инвестиции: WEG вкладывает **R$ ${(WEG.investments.transformersBrl / 1e9).toFixed(1)} млрд в расширение мощностей по трансформаторам**. Сегмент GTD — ${(WEG.segments.gtd * 100).toFixed(1)} % выручки 2025 года (публичная отчётность).

Что меняется по сравнению с «как есть»:
1. **Платформы.** Библиотека типоразмеров закрывает 64 % тендеров: предварительный расчёт активной части берётся из платформы (720 → 180 мин), смета считается правилами. Уникальный расчёт остаётся для нестандартных требований сети.
2. **Решение об участии.** Платформенная себестоимость известна заранее, поэтому отказ от заведомо убыточных тендеров происходит раньше и дешевле: доля участия снижается с 58 до 52 %, и расходы на подготовку заявки не тратятся впустую.

   Доля побед в модели оставлена прежней — 25 %. Играя там, где компания конкурентна, выигрывать логично чаще, но рост конверсии поднял бы стоимость «на один тендер» просто потому, что больше проектов доходит до производства. Это дополнительная выручка сверх таблицы, а не то, что таблица измеряет.
3. **Параллельность.** Заказ сердечника, провода и масла запускается сразу после контракта по платформенной спецификации, не дожидаясь окончания рабочего проекта. Это главный выигрыш по сроку.
4. **Производство.** Расширенные мощности убирают очередь между переделами: сушка и заливка начинаются по готовности, а не по слоту.
5. **Испытания.** Типовые испытания выполнены для платформы один раз; на экземпляре остаются приёмо-сдаточные плюс сокращённая программа с удалённым участием заказчика. Доля полной программы типовых испытаний падает с 100 до 36 % (только нестандартные исполнения).
6. **Площадка.** Удалённая поддержка пусконаладки из инжинирингового центра сокращает работу бригады на подстанции.

Что НЕ меняется: требования IEC 60076, сроки рассмотрения заявок заказчиком, перевозка негабарита, монтаж на фундаменте.

Целевые нормативы — **отраслевые допущения**. Доли побед в тендерах нужно калибровать по собственной тендерной статистике.

${dataNote('ru')}

${sourceBlock(['transformers', 'fy2025', 'profile'], 'ru')}`,
    en: `Target state of a power transformer project, anchored on the publicly announced **R$ ${(WEG.investments.transformersBrl / 1e9).toFixed(1)}bn investment in transformer capacity**. GTD is ${(WEG.segments.gtd * 100).toFixed(1)}% of 2025 revenue.

Changes: a platform library covers 64% of tenders, so the preliminary active-part calculation comes from the platform (720 → 180 min) and the cost is computed by rule; knowing the platform cost early means walking away from unwinnable tenders sooner, so participation falls from 58% to 52% and bid preparation is not spent in vain (the win rate is deliberately left at 25%: a conversion gain would raise the cost per tender simply because more projects reach production, and it is upside on top of the table); core, wire and oil are ordered straight after the contract from the platform bill of material instead of after detailed design, which is the main lead-time gain; the expanded capacity removes the queue between operations; platform type tests are done once, so a full type-test programme remains on 36% of units (non-standard executions only) with the customer witnessing remotely; remote engineering support shortens the crew's work on site.

Unchanged: IEC 60076, the customer's bid evaluation period, oversize transport and foundation installation.

The target norms are **assumptions**; calibrate the win rates against your own tender statistics.

${dataNote('en')}

${sourceBlock(['transformers', 'fy2025', 'profile'], 'en')}`,
  },
  spec: {
    notation: 'bpmn',
    name: { ru: 'Проект трансформатора — как будет', en: 'Transformer project — to be' },
    lanes: LANES,
    nodes: [
      node('start', 'startMessageEvent', 'utility', 'Опубликован тендер', 'Tender published', reported({})),
      node('screen', 'userTask', 'bid', 'Оценить условия и требования тендера', 'Assess the tender terms', work(90, 'Менеджер по продажам')),
      node('gwPlatform', 'exclusiveGateway', 'bid', 'Подходит платформенный типоразмер?', 'Covered by a platform rating?'),
      node('platform', 'serviceTask', 'eng', 'Взять расчёт активной части из платформы', 'Take the active-part design from the platform', auto(8)),
      node('techSpec', 'userTask', 'eng', 'Разобрать нестандартное техническое задание', 'Work through the non-standard specification', work(360, 'Ведущий инженер')),
      node('design1', 'userTask', 'eng', 'Предварительный расчёт активной части', 'Preliminary active-part calculation', work(540, 'Инженер-конструктор')),
      node('cost', 'businessRuleTask', 'bid', 'Рассчитать себестоимость и риски по правилам', 'Cost and risk by rule', auto(6)),
      node('gwGo', 'exclusiveGateway', 'bid', 'Участвуем?', 'Do we bid?'),
      node('noBid', 'endEvent', 'bid', 'Отказ от участия', 'No bid'),
      node('submit', 'sendTask', 'bid', 'Подать заявку и банковскую гарантию', 'Submit the bid and the bank guarantee', work(120, 'Менеджер по продажам', { cost: 9500 })),
      node('waitBid', 'intermediateTimerEvent', 'utility', 'Рассмотрение заявок', 'Bid evaluation', { waitTime: WEEK * 9, dataSource: 'assumption' }),
      node('gwWin', 'exclusiveGateway', 'bid', 'Тендер выигран?', 'Tender won?'),
      node('lost', 'endEvent', 'bid', 'Тендер проигран', 'Tender lost'),
      node('contract', 'userTask', 'bid', 'Подписать контракт и график', 'Sign the contract and the schedule', work(180, 'Менеджер по продажам', { waitTime: DAY * 6 })),
      node('pgSplit', 'parallelGateway', 'plan', 'Проект и закупка параллельно', 'Design and procurement in parallel'),
      node('order', 'serviceTask', 'plan', 'Заказать сердечник, провод и масло по платформе', 'Order core, wire and oil from the platform BOM', work(90, 'Планировщик')),
      node('longlead', 'intermediateTimerEvent', 'plan', 'Поставка длинных позиций', 'Long-lead delivery', { waitTime: WEEK * 8, dataSource: 'assumption' }),
      node('design2', 'userTask', 'eng', 'Рабочий проект и согласование с заказчиком', 'Detailed design and customer approval', work(1680, 'Инженер-конструктор', { waitTime: DAY * 5 })),
      node('pgJoin', 'parallelGateway', 'prod', 'Материал и проект готовы', 'Material and design ready'),
      node('core', 'manualTask', 'prod', 'Собрать магнитопровод', 'Build the core', work(2100, 'Сборщик', { resourceQty: 3, cost: 172000 })),
      node('windings', 'manualTask', 'prod', 'Намотать обмотки ВН и НН', 'Wind the HV and LV coils', work(3000, 'Сборщик', { resourceQty: 4, cost: 248000 })),
      node('dryout', 'serviceTask', 'prod', 'Сушка активной части в вакууме', 'Vacuum dry-out of the active part', work(240, 'Сборщик', { waitTime: 480 })),
      node('tank', 'manualTask', 'prod', 'Установить в бак и залить масло', 'Tank up and fill with oil', work(1200, 'Сборщик', { resourceQty: 3 })),
      node('routine', 'userTask', 'lab', 'Приёмо-сдаточные испытания (IEC 60076)', 'Routine tests (IEC 60076)', work(600, 'Техник-испытатель')),
      node('gwTest', 'exclusiveGateway', 'lab', 'Испытания пройдены?', 'Tests passed?'),
      node('fixDefect', 'userTask', 'prod', 'Вскрыть и устранить дефект', 'Open up and fix the defect', work(2400, 'Сборщик', { resourceQty: 3, cost: 54000 })),
      node('gwType', 'exclusiveGateway', 'lab', 'Нужна полная программа типовых испытаний?', 'Full type-test programme needed?'),
      node('typeTest', 'userTask', 'lab', 'Типовые испытания с удалённым участием заказчика', 'Type tests witnessed remotely', work(720, 'Техник-испытатель', { cost: 31000 })),
      node('shortTest', 'userTask', 'lab', 'Сокращённая программа по протоколам платформы', 'Short programme against the platform records', work(180, 'Техник-испытатель', { cost: 6000 })),
      node('ship', 'serviceTask', 'site', 'Перевозка на подстанцию', 'Transport to the substation', work(180, 'Планировщик', { waitTime: DAY * 8, cost: 120000 })),
      node('install', 'userTask', 'site', 'Монтаж на фундаменте, сборка вводов', 'Install on the foundation, fit the bushings', work(2100, 'Сервисный инженер', { resourceQty: 2 })),
      node('commission', 'userTask', 'site', 'Пусконаладка с удалённой поддержкой инжиниринга', 'Commissioning with remote engineering support', work(960, 'Сервисный инженер', { resourceQty: 2, cost: 28000 })),
      node('handover', 'serviceTask', 'site', 'Передать цифровую исполнительную документацию', 'Hand over the digital as-built documentation', work(60, 'Сервисный инженер')),
      node('end', 'endEvent', 'site', 'Трансформатор в сети', 'Transformer energised', { completes: true }),
      node('platformData', 'dataStore', 'eng', 'Библиотека платформ и протоколы типовых испытаний', 'Platform library and type-test records'),
      node('asbuilt', 'dataObject', 'site', 'Цифровая исполнительная документация', 'Digital as-built documentation'),
      node('note', 'textAnnotation', 'bid', 'GTD = 35,8 % выручки 2025; расширение мощностей — R$ 1,2 млрд (публичная отчётность)', 'GTD = 35.8% of 2025 revenue; R$ 1.2bn capacity expansion (public disclosure)'),
    ],
    edges: [
      flow('start', 'screen'),
      flow('screen', 'gwPlatform'),
      flow('gwPlatform', 'platform', { share: 64, ru: 'платформа подходит', en: 'platform fits' }),
      flow('gwPlatform', 'techSpec', { share: 36, ru: 'нестандарт', en: 'non-standard' }),
      flow('techSpec', 'design1'),
      flow('design1', 'cost'),
      flow('platform', 'cost'),
      flow('cost', 'gwGo'),
      flow('gwGo', 'submit', { share: 52, ru: 'участвуем', en: 'bid' }),
      flow('gwGo', 'noBid', { share: 48, ru: 'отказ', en: 'no bid' }),
      flow('submit', 'waitBid'),
      flow('waitBid', 'gwWin'),
      flow('gwWin', 'contract', { share: 25, ru: 'выигран', en: 'won' }),
      flow('gwWin', 'lost', { share: 75, ru: 'проигран', en: 'lost' }),
      flow('contract', 'pgSplit'),
      flow('pgSplit', 'order'),
      flow('pgSplit', 'design2'),
      flow('order', 'longlead'),
      flow('longlead', 'pgJoin'),
      flow('design2', 'pgJoin'),
      flow('pgJoin', 'core'),
      flow('core', 'windings'),
      flow('windings', 'dryout'),
      flow('dryout', 'tank'),
      flow('tank', 'routine'),
      flow('routine', 'gwTest'),
      flow('gwTest', 'gwType', { share: 96, ru: 'пройдены', en: 'passed' }),
      flow('gwTest', 'fixDefect', { share: 4, ru: 'дефект', en: 'defect' }),
      flow('fixDefect', 'routine'),
      flow('gwType', 'typeTest', { share: 36, ru: 'нестандартное исполнение', en: 'non-standard unit' }),
      flow('gwType', 'shortTest', { share: 64, ru: 'платформа испытана', en: 'platform already tested' }),
      flow('typeTest', 'ship'),
      flow('shortTest', 'ship'),
      flow('ship', 'install'),
      flow('install', 'commission'),
      flow('commission', 'handover'),
      flow('handover', 'end'),
      { source: 'platform', target: 'platformData', type: 'dataAssociation' },
      { source: 'handover', target: 'asbuilt', type: 'dataAssociation' },
      { source: 'screen', target: 'note', type: 'association' },
    ],
  },
};
