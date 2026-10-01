/**
 * 1 (TO-BE). Touchless order to cash: B2B portal / EDI, automatic credit
 * scoring, available-to-promise from stock, early-payment discount.
 */
import { WEG, dataNote, roles, sourceBlock } from '../facts.js';
import { DAY, auto, flow, node, reported, work } from '../kit.js';

const LANES = [
  { id: 'customer', label: { ru: 'Клиент / дистрибьютор', en: 'Customer / distributor' } },
  { id: 'portal', label: { ru: 'B2B-портал и ERP (автоматика)', en: 'B2B portal and ERP (automated)' } },
  { id: 'sales', label: { ru: 'Отдел продаж (исключения)', en: 'Sales (exceptions only)' } },
  { id: 'plan', label: { ru: 'Планирование и склад', en: 'Planning and warehouse' } },
  { id: 'log', label: { ru: 'Логистика', en: 'Logistics' } },
  { id: 'fin', label: { ru: 'Финансы', en: 'Finance' } },
];

export const orderToCashToBe = {
  id: 'weg-o2c-tobe',
  order: 1,
  variant: 'to-be',
  baselineId: 'weg-o2c',
  name: {
    ru: '1. Обработка заказа на серийный двигатель — как будет',
    en: '1. Order to cash — catalogue motors — to be',
  },
  description: {
    ru: 'Заказ приходит структурированным из B2B-портала или EDI, проверка спецификации, кредита и наличия выполняется правилами, человек подключается только к исключениям; ранняя оплата со скидкой сокращает оборот дебиторки.',
    en: 'The order arrives structured from the B2B portal or EDI, specification, credit and availability are checked by rules, people handle exceptions only, and an early-payment discount shortens the receivable cycle.',
  },
  analysis: {
    currency: 'R$',
    volumePerYear: 760000,
    hoursPerFte: 1800,
    workingDays: WEG.workingDays,
    roles: roles('Менеджер по продажам', 'Аналитик', 'Планировщик', 'Оператор', 'Логист', 'Финансы'),
  },
  documentation: {
    ru: `Целевое состояние процесса обработки заказа на каталожный двигатель.

Что меняется по сравнению с «как есть»:
1. **Приём заказа.** Ручная регистрация в ERP и проверка артикулов заменены приёмом структурированного заказа из B2B-портала или по EDI: номенклатура, цены и условия уже сверены каталогом на входе. Остаётся автоматическая валидация, человек разбирает только отклонённые строки.
2. **Кредит.** Вместо ручной проверки лимита — скоринг по правилам (история платежей, страховое покрытие, открытая дебиторка). Ручная проверка остаётся на 4 % заказов вместо 100 %.
3. **Наличие.** Available-to-promise считается по остаткам и плану в момент заказа, клиент сразу видит дату отгрузки. Доля отгрузок со склада растёт с 78 до 92 % за счёт планирования по фактическому спросу портала.
4. **Отгрузка.** NF-e, уведомление клиента и трек-номер выпускаются автоматически.
5. **Деньги.** Добавлена развилка «ранняя оплата со скидкой 1,5 %»: часть клиентов платит за 7 дней вместо 30. Это прямая уступка в цене, она учтена как затрата, и видно, окупается ли она сокращением цикла.

Что НЕ меняется: отсрочка платежа для большинства клиентов, физическая комплектация и упаковка, перевозка.

Все параметры целевого состояния — **плановые величины (отраслевое допущение)**, а не отчётность: WEG не публикует ни текущих, ни целевых пооперационных нормативов. Цифры заданы так, чтобы показать механику улучшения и дать базу для калибровки по собственным данным.

${dataNote('ru')}

${sourceBlock(['numbers', 'production', 'annual2025'], 'ru')}`,
    en: `Target state of the catalogue-motor order process.

What changes against the as-is model: the order arrives structured from the B2B portal or by EDI instead of being keyed into ERP; credit is scored by rules with a manual review on 4% of orders instead of all of them; available-to-promise is computed at order entry and the share shipped from stock rises from 78% to 92%; the NF-e, the customer notification and the tracking number are issued automatically; an early-payment discount of 1.5% lets part of the customers pay in 7 days instead of 30.

What does not change: payment terms for most customers, physical picking and packing, and the carrier leg.

Every target parameter is an **assumption**, not disclosure: WEG publishes neither current nor target step-level norms. The figures show the mechanics of the improvement and are meant to be calibrated with your own data.

${dataNote('en')}

${sourceBlock(['numbers', 'production', 'annual2025'], 'en')}`,
  },
  spec: {
    notation: 'bpmn',
    name: { ru: 'Обработка заказа — как будет', en: 'Order to cash — to be' },
    lanes: LANES,
    nodes: [
      node('start', 'startMessageEvent', 'customer', 'Заказ из B2B-портала или по EDI', 'Order from the B2B portal or by EDI', reported({})),
      node('validate', 'businessRuleTask', 'portal', 'Автоматическая проверка спецификации и артикулов', 'Automatic specification and part-number check', auto(0.5, { cost: 0.4 })),
      node('gwValid', 'exclusiveGateway', 'portal', 'Строки заказа корректны?', 'Order lines valid?'),
      node('fix', 'userTask', 'sales', 'Разобрать отклонённые строки с клиентом', 'Clear the rejected lines with the customer', work(18, 'Менеджер по продажам')),
      node('gwStd', 'exclusiveGateway', 'portal', 'Каталожная позиция?', 'Catalogue item?'),
      node('toEto', 'sendTask', 'sales', 'Передать в процесс «машина на заказ»', 'Hand over to the engineer-to-order process', work(12, 'Менеджер по продажам')),
      node('endEto', 'endEvent', 'sales', 'Заказ ушёл в ETO', 'Routed to engineer-to-order'),
      node('score', 'businessRuleTask', 'portal', 'Кредитный скоринг по правилам', 'Rule-based credit scoring', auto(0.3, { cost: 0.6 })),
      node('gwScore', 'exclusiveGateway', 'portal', 'Скоринг пройден?', 'Score passed?'),
      node('review', 'userTask', 'fin', 'Ручная проверка лимита и страхового покрытия', 'Manual limit and insurance review', work(14, 'Аналитик')),
      node('gwReview', 'exclusiveGateway', 'fin', 'Отгрузка разрешена?', 'Shipment approved?'),
      node('cancel', 'endErrorEvent', 'fin', 'Заказ отменён по кредитному риску', 'Cancelled on credit risk'),
      node('atp', 'serviceTask', 'portal', 'Available-to-promise: дата отгрузки клиенту сразу', 'Available-to-promise: shipping date shown at once', auto(0.4)),
      node('gwStock', 'exclusiveGateway', 'plan', 'Есть на складе?', 'In stock?'),
      node('mrp', 'serviceTask', 'plan', 'Поставить в производственный план по спросу портала', 'Schedule from portal demand', work(8, 'Планировщик')),
      node('waitProd', 'intermediateTimerEvent', 'plan', 'Ожидание производственной партии', 'Waiting for the production batch', { waitTime: DAY * 3, dataSource: 'assumption' }),
      node('pick', 'manualTask', 'plan', 'Скомплектовать по маршруту автоматизированного склада', 'Pick on the automated warehouse route', work(12, 'Оператор')),
      node('pack', 'manualTask', 'plan', 'Упаковать и маркировать', 'Pack and label', work(10, 'Оператор')),
      node('nfe', 'serviceTask', 'portal', 'Выпустить NF-e автоматически', 'Issue the NF-e automatically', auto(0.3, { cost: 3 })),
      node('ship', 'userTask', 'log', 'Отгрузить перевозчику по сводной отгрузке', 'Hand over to the carrier in a consolidated load', work(14, 'Логист', { cost: 165 })),
      node('notify', 'serviceTask', 'portal', 'Отправить клиенту трек-номер и статус', 'Push the tracking number and status to the customer', auto(0.2)),
      node('invoice', 'serviceTask', 'portal', 'Выставить счёт и завести дебиторку', 'Raise the invoice and the receivable', auto(0.3)),
      node('gwEarly', 'exclusiveGateway', 'fin', 'Клиент берёт раннюю оплату со скидкой?', 'Early payment with a discount?'),
      node('early', 'intermediateTimerEvent', 'fin', 'Оплата за 7 дней со скидкой 1,5 %', 'Payment in 7 days at a 1.5% discount', { waitTime: DAY * 7, cost: 42, dataSource: 'assumption' }),
      node('terms', 'intermediateTimerEvent', 'fin', 'Отсрочка платежа 30 дней', '30-day payment term', { waitTime: DAY * 30, dataSource: 'assumption' }),
      node('gwCash', 'exclusiveGateway', 'fin', 'Оплата поступила в срок?', 'Paid on time?'),
      node('remind', 'serviceTask', 'portal', 'Автоматические напоминания и блокировка новых отгрузок', 'Automatic reminders and a hold on new shipments', auto(1)),
      node('gwRemind', 'exclusiveGateway', 'fin', 'Оплата после напоминания?', 'Paid after the reminder?'),
      node('dunning', 'userTask', 'fin', 'Работа с просрочкой', 'Collections', work(28, 'Финансы', { waitTime: DAY * 10 })),
      node('close', 'serviceTask', 'portal', 'Разнести оплату и закрыть заказ', 'Post the payment and close the order', auto(0.3)),
      node('end', 'endEvent', 'fin', 'Деньги получены', 'Cash collected', { completes: true }),
      node('rules', 'dataStore', 'portal', 'Правила скоринга и каталог условий', 'Scoring rules and the terms catalogue'),
      node('docs', 'dataObject', 'portal', 'NF-e и товарные документы', 'NF-e and shipping documents'),
      node('note', 'textAnnotation', 'portal', 'Автоматические шаги не занимают людей: в расчёте у них нет роли, только стоимость транзакции', 'Automated steps occupy nobody: they carry a transaction cost, not a role'),
    ],
    edges: [
      flow('start', 'validate'),
      flow('validate', 'gwValid'),
      flow('gwValid', 'gwStd', { share: 94, ru: 'корректны', en: 'valid' }),
      flow('gwValid', 'fix', { share: 6, ru: 'есть отклонения', en: 'rejected lines' }),
      flow('fix', 'gwStd'),
      flow('gwStd', 'score', { share: 97, ru: 'каталог', en: 'catalogue' }),
      flow('gwStd', 'toEto', { share: 3, ru: 'на заказ', en: 'engineered' }),
      flow('toEto', 'endEto'),
      flow('score', 'gwScore'),
      flow('gwScore', 'atp', { share: 96, ru: 'пройден', en: 'passed' }),
      flow('gwScore', 'review', { share: 4, ru: 'на проверку', en: 'to review' }),
      flow('review', 'gwReview'),
      flow('gwReview', 'atp', { share: 72, ru: 'разрешено', en: 'approved' }),
      flow('gwReview', 'cancel', { share: 28, ru: 'отказ', en: 'declined' }),
      flow('atp', 'gwStock'),
      flow('gwStock', 'pick', { share: 92, ru: 'со склада', en: 'from stock' }),
      flow('gwStock', 'mrp', { share: 8, ru: 'в производство', en: 'to production' }),
      flow('mrp', 'waitProd'),
      flow('waitProd', 'pick'),
      flow('pick', 'pack'),
      flow('pack', 'nfe'),
      flow('nfe', 'ship'),
      flow('ship', 'notify'),
      flow('notify', 'invoice'),
      flow('invoice', 'gwEarly'),
      flow('gwEarly', 'early', { share: 45, ru: 'ранняя оплата', en: 'early payment' }),
      flow('gwEarly', 'terms', { share: 55, ru: 'обычная отсрочка', en: 'standard terms' }),
      flow('early', 'close'),
      flow('terms', 'gwCash'),
      flow('gwCash', 'close', { share: 94, ru: 'оплачено', en: 'paid' }),
      flow('gwCash', 'remind', { share: 6, ru: 'просрочка', en: 'overdue' }),
      flow('remind', 'gwRemind'),
      flow('gwRemind', 'close', { share: 64, ru: 'оплачено', en: 'paid' }),
      flow('gwRemind', 'dunning', { share: 36, ru: 'не оплачено', en: 'still unpaid' }),
      flow('dunning', 'close'),
      flow('close', 'end'),
      { source: 'score', target: 'rules', type: 'dataAssociation' },
      { source: 'nfe', target: 'docs', type: 'dataAssociation' },
      { source: 'validate', target: 'note', type: 'association' },
    ],
  },
};
