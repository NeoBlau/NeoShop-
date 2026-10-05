/**
 * 4 (TO-BE). Configure-to-order: a product configurator with a library of
 * validated executions, modular design, a digital twin and a virtual FAT.
 */
import { WEG, dataNote, roles, sourceBlock } from '../facts.js';
import { DAY, WEEK, auto, flow, node, reported, work } from '../../kit.js';

const LANES = [
  { id: 'customer', label: { ru: 'Заказчик', en: 'Customer' } },
  { id: 'sales', label: { ru: 'Продажи проектов', en: 'Project sales' } },
  { id: 'cfg', label: { ru: 'Конфигуратор и библиотека решений', en: 'Configurator and solution library' } },
  { id: 'eng', label: { ru: 'Инжиниринг', en: 'Engineering' } },
  { id: 'plan', label: { ru: 'Планирование и снабжение', en: 'Planning and supply' } },
  { id: 'prod', label: { ru: 'Производство', en: 'Production' } },
  { id: 'test', label: { ru: 'Испытательный центр', en: 'Test centre' } },
  { id: 'field', label: { ru: 'Шеф-монтаж', en: 'Commissioning' } },
];

export const engineerToOrderToBe = {
  id: 'weg-eto-tobe',
  order: 4,
  variant: 'to-be',
  baselineId: 'weg-eto',
  name: {
    ru: '4. Крупная машина на заказ (ETO) — как будет',
    en: '4. Engineer-to-order machine — to be',
  },
  description: {
    ru: 'Конфигуратор с библиотекой проверенных исполнений закрывает большинство запросов без расчёта с нуля, проектирование модульное, закупка длинных позиций идёт параллельно проектированию, цифровой двойник заменяет часть испытаний, FAT проводится удалённо.',
    en: 'A configurator with a library of validated executions covers most enquiries without designing from scratch, engineering is modular, long-lead procurement runs in parallel with design, a digital twin replaces part of the testing, and the FAT is witnessed remotely.',
  },
  analysis: {
    currency: 'R$',
    volumePerYear: 2600,
    hoursPerFte: 1800,
    workingDays: WEG.workingDays,
    roles: roles('Менеджер по продажам', 'Инженер-конструктор', 'Ведущий инженер', 'Планировщик', 'Сборщик', 'Техник-испытатель', 'Сервисный инженер'),
  },
  documentation: {
    ru: `Целевое состояние процесса «машина на заказ» — переход от engineer-to-order к configure-to-order там, где это возможно.

Что меняется по сравнению с «как есть»:
1. **Коммерческая проработка.** Конфигуратор с библиотекой ранее выполненных исполнений закрывает 68 % запросов: расчёт характеристик и себестоимости считается правилами за минуты, а не инженером за 7 часов. Полный инженерный расчёт остаётся для действительно уникальных машин.
2. **Срок ответа.** Коммерческое предложение уходит в тот же день, а не через неделю.

   Конверсия в модели намеренно оставлена прежней — 32 %. Ответ в тот же день почти наверняка поднимает выигрыш, но тогда стоимость «на один запрос» выросла бы просто потому, что больше заказов доходит до производства, и сравнение перестало бы показывать эффективность процесса. Выигрыш по конверсии — это дополнительная выручка сверх того, что видно в таблице, а не то, что здесь измеряется.
3. **Проектирование.** Модульная конструкция из проверенных узлов: 2400 → 1200 мин, доля замечаний заказчика по чертежам падает с 28 до 14 %, потому что он видит 3D-модель в конфигураторе на этапе предложения.
4. **Параллельность.** Заказ длинных позиций запускается сразу после договора, параллельно рабочему проектированию, а не после него. Это главный выигрыш по сроку.
5. **Испытания.** Цифровой двойник прогоняет режимы до сборки, поэтому доля непринятых FAT падает с 8 до 3 %. Сам FAT проводится удалённо с трансляцией — заказчику не нужно ехать, ожидание сокращается.
6. **Пусконаладка.** Предварительная настройка на стенде по цифровому двойнику сокращает работу на площадке.

Что НЕ меняется: сроки поставки длинных позиций от поставщиков, физическое изготовление и сборка, перевозка, подписание акта.

Доли и нормативы целевого состояния — **отраслевые допущения**, их нужно калибровать по CRM и ERP.

${dataNote('ru')}

${sourceBlock(['profile', 'numbers', 'annual2025'], 'ru')}`,
    en: `Target state of the engineer-to-order process - a move to configure-to-order where it is possible.

Changes: a configurator with a library of previously built executions covers 68% of enquiries, so sizing and costing take minutes by rule instead of seven engineer-hours; the quotation goes out the same day (the win rate is deliberately left at 32% so the comparison isolates process efficiency - a conversion gain would raise the cost per enquiry simply because more orders reach production, and it is upside on top of the table rather than what the table measures); modular design on validated sub-assemblies halves detailed engineering and cuts customer drawing comments from 28% to 14%, because the customer already saw the 3D model at quotation; long-lead procurement starts right after the contract, in parallel with detailed design, which is the main lead-time gain; a digital twin runs the duty points before assembly, so failed FATs drop from 8% to 3%, and the FAT itself is witnessed remotely; pre-setting on the test bench from the twin shortens site work.

Unchanged: supplier lead times for long-lead items, physical manufacture and assembly, transport and the handover.

The target shares and norms are **assumptions** to calibrate against your CRM and ERP.

${dataNote('en')}

${sourceBlock(['profile', 'numbers', 'annual2025'], 'en')}`,
  },
  spec: {
    notation: 'bpmn',
    name: { ru: 'Машина на заказ — как будет', en: 'Engineer-to-order — to be' },
    lanes: LANES,
    nodes: [
      node('start', 'startMessageEvent', 'customer', 'Получен запрос (RFQ)', 'Request for quotation received', reported({})),
      node('qualify', 'userTask', 'sales', 'Квалифицировать запрос и заказчика', 'Qualify the enquiry and the customer', work(30, 'Менеджер по продажам')),
      node('configure', 'serviceTask', 'cfg', 'Подобрать исполнение в конфигураторе', 'Configure the execution', auto(4)),
      node('gwFit', 'exclusiveGateway', 'cfg', 'Исполнение есть в библиотеке?', 'Execution in the library?'),
      node('clarify', 'userTask', 'eng', 'Уточнить техническое задание', 'Clarify the specification', work(140, 'Инженер-конструктор', { waitTime: DAY })),
      node('concept', 'userTask', 'eng', 'Рассчитать уникальное исполнение', 'Size a bespoke execution', work(360, 'Ведущий инженер')),
      node('cost', 'businessRuleTask', 'cfg', 'Рассчитать себестоимость и цену по правилам', 'Cost and price by rule', auto(2)),
      node('gwDiscount', 'exclusiveGateway', 'sales', 'Скидка выше полномочий?', 'Discount above the mandate?'),
      node('approve', 'userTask', 'sales', 'Согласовать условия по электронному маршруту', 'Approve the terms on the electronic route', work(20, 'Менеджер по продажам', { waitTime: 240 })),
      node('quote', 'sendTask', 'sales', 'Отправить КП с 3D-моделью в тот же день', 'Send the quotation with the 3D model the same day', work(15, 'Менеджер по продажам')),
      node('waitDecision', 'intermediateTimerEvent', 'customer', 'Ожидание решения заказчика', 'Waiting for the customer decision', { waitTime: WEEK * 3, dataSource: 'assumption' }),
      node('gwWin', 'exclusiveGateway', 'sales', 'Заказ выигран?', 'Order won?'),
      node('lost', 'endEvent', 'sales', 'Проиграно конкуренту', 'Lost to a competitor'),
      node('contract', 'userTask', 'sales', 'Заключить договор и получить аванс', 'Sign the contract and collect the advance', work(60, 'Менеджер по продажам', { waitTime: DAY * 3 })),
      node('pgSplit', 'parallelGateway', 'plan', 'Проектирование и закупка параллельно', 'Design and procurement in parallel'),
      node('bom', 'serviceTask', 'plan', 'Выгрузить спецификацию длинных позиций из конфигуратора', 'Export the long-lead bill of material from the configurator', auto(3)),
      node('order', 'serviceTask', 'plan', 'Разместить заказы на длинные позиции', 'Place the long-lead orders', work(45, 'Планировщик')),
      node('longlead', 'intermediateTimerEvent', 'plan', 'Поставка длинных позиций', 'Long-lead delivery', { waitTime: WEEK * 10, dataSource: 'assumption' }),
      node('design', 'userTask', 'eng', 'Рабочее проектирование из проверенных модулей', 'Detailed design from validated modules', work(1200, 'Инженер-конструктор')),
      node('twin', 'serviceTask', 'eng', 'Прогнать режимы на цифровом двойнике', 'Run the duty points on the digital twin', work(240, 'Ведущий инженер', { cost: 9000 })),
      node('review', 'sendTask', 'eng', 'Согласовать чертежи с заказчиком в портале', 'Review the drawings with the customer in the portal', work(30, 'Инженер-конструктор', { waitTime: DAY * 3 })),
      node('gwReview', 'exclusiveGateway', 'eng', 'Есть замечания?', 'Any comments?'),
      node('rework', 'userTask', 'eng', 'Внести изменения в проект', 'Update the design', work(240, 'Инженер-конструктор')),
      node('pgJoin', 'parallelGateway', 'prod', 'Материал и документация готовы', 'Material and documentation ready'),
      node('manufacture', 'manualTask', 'prod', 'Изготовить статор, ротор, корпус', 'Manufacture the stator, rotor and frame', work(4200, 'Сборщик', { resourceQty: 4, cost: 38000 })),
      node('assemble', 'manualTask', 'prod', 'Собрать машину', 'Assemble the machine', work(1500, 'Сборщик', { resourceQty: 3 })),
      node('routine', 'userTask', 'test', 'Приёмо-сдаточные испытания', 'Routine tests', work(400, 'Техник-испытатель')),
      node('fat', 'userTask', 'test', 'Удалённый FAT с трансляцией заказчику', 'Remote FAT streamed to the customer', work(360, 'Техник-испытатель', { cost: 3200 })),
      node('gwFat', 'exclusiveGateway', 'test', 'FAT принят?', 'FAT accepted?'),
      node('fix', 'userTask', 'prod', 'Устранить замечания FAT', 'Clear the FAT findings', work(720, 'Сборщик', { resourceQty: 2 })),
      node('preset', 'serviceTask', 'test', 'Предварительно настроить привод по двойнику', 'Pre-set the drive from the twin', work(120, 'Техник-испытатель')),
      node('pack', 'manualTask', 'plan', 'Консервация и упаковка для перевозки', 'Preservation and transport packing', work(360, 'Сборщик', { cost: 6200 })),
      node('ship', 'serviceTask', 'plan', 'Отгрузить заказчику', 'Ship to the customer', work(90, 'Планировщик', { waitTime: DAY * 12, cost: 23000 })),
      node('commission', 'userTask', 'field', 'Шеф-монтаж и пусконаладка', 'Supervision and commissioning', work(1200, 'Сервисный инженер', { cost: 9800 })),
      node('handover', 'userTask', 'field', 'Подписать акт и открыть гарантию', 'Sign the acceptance and open the warranty', work(60, 'Сервисный инженер')),
      node('end', 'endEvent', 'field', 'Машина принята в эксплуатацию', 'Machine accepted into service', { completes: true }),
      node('library', 'dataStore', 'cfg', 'Библиотека исполнений и модулей', 'Library of executions and modules'),
      node('drawings', 'dataObject', 'eng', 'Согласованные чертежи и цифровой двойник', 'Approved drawings and the digital twin'),
      node('note', 'textAnnotation', 'plan', 'Главный выигрыш по сроку — закупка длинных позиций параллельно проектированию', 'The main lead-time gain: long-lead procurement runs in parallel with design'),
    ],
    edges: [
      flow('start', 'qualify'),
      flow('qualify', 'configure'),
      flow('configure', 'gwFit'),
      flow('gwFit', 'cost', { share: 68, ru: 'есть в библиотеке', en: 'in the library' }),
      flow('gwFit', 'clarify', { share: 32, ru: 'уникальная машина', en: 'bespoke machine' }),
      flow('clarify', 'concept'),
      flow('concept', 'cost'),
      flow('cost', 'gwDiscount'),
      flow('gwDiscount', 'approve', { share: 31, ru: 'да', en: 'yes' }),
      flow('gwDiscount', 'quote', { share: 69, ru: 'нет', en: 'no' }),
      flow('approve', 'quote'),
      flow('quote', 'waitDecision'),
      flow('waitDecision', 'gwWin'),
      flow('gwWin', 'contract', { share: 32, ru: 'выигран', en: 'won' }),
      flow('gwWin', 'lost', { share: 68, ru: 'проигран', en: 'lost' }),
      flow('contract', 'pgSplit'),
      flow('pgSplit', 'bom'),
      flow('pgSplit', 'design'),
      flow('bom', 'order'),
      flow('order', 'longlead'),
      flow('longlead', 'pgJoin'),
      flow('design', 'twin'),
      flow('twin', 'review'),
      flow('review', 'gwReview'),
      flow('gwReview', 'rework', { share: 14, ru: 'есть', en: 'yes' }),
      flow('gwReview', 'pgJoin', { share: 86, ru: 'нет', en: 'no' }),
      flow('rework', 'review'),
      flow('pgJoin', 'manufacture'),
      flow('manufacture', 'assemble'),
      flow('assemble', 'routine'),
      flow('routine', 'fat'),
      flow('fat', 'gwFat'),
      flow('gwFat', 'preset', { share: 97, ru: 'принят', en: 'accepted' }),
      flow('gwFat', 'fix', { share: 3, ru: 'замечания', en: 'findings' }),
      flow('fix', 'fat'),
      flow('preset', 'pack'),
      flow('pack', 'ship'),
      flow('ship', 'commission'),
      flow('commission', 'handover'),
      flow('handover', 'end'),
      { source: 'configure', target: 'library', type: 'dataAssociation' },
      { source: 'twin', target: 'drawings', type: 'dataAssociation' },
      { source: 'pgSplit', target: 'note', type: 'association' },
    ],
  },
};
