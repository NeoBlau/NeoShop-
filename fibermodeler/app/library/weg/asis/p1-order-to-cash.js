/**
 * 1. Order to cash for catalogue motors (make to stock).
 *
 * WEG sells more than 19 million motors a year through distributors and OEMs;
 * the bulk of that volume is catalogue product shipped from stock, which is
 * what this model describes.
 */
import { DERIVED, WEG, dataNote, roles, sourceBlock } from '../facts.js';
import { DAY, derived, flow, node, reported, wait, work } from '../../kit.js';

const LANES = [
  { id: 'customer', label: { ru: 'Клиент / дистрибьютор', en: 'Customer / distributor' } },
  { id: 'sales', label: { ru: 'Отдел продаж', en: 'Sales' } },
  { id: 'credit', label: { ru: 'Кредитный контроль', en: 'Credit control' } },
  { id: 'plan', label: { ru: 'Планирование и склад', en: 'Planning & warehouse' } },
  { id: 'log', label: { ru: 'Логистика', en: 'Logistics' } },
  { id: 'fin', label: { ru: 'Финансы', en: 'Finance' } },
];

export const orderToCash = {
  id: 'weg-o2c',
  order: 1,
  variant: 'as-is',
  name: { ru: '1. Обработка заказа на серийный двигатель', en: '1. Order to cash — catalogue motors' },
  description: {
    ru: 'От заказа дистрибьютора до поступления оплаты: проверка спецификации, кредитный лимит, резерв на складе, отгрузка и закрытие дебиторки.',
    en: 'From a distributor order to cash in the bank: specification check, credit limit, stock reservation, shipment and receivables.',
  },
  analysis: {
    currency: 'R$',
    volumePerYear: 760000,
    hoursPerFte: 1800,
    workingDays: WEG.workingDays,
    roles: roles('Менеджер по продажам', 'Аналитик', 'Планировщик', 'Оператор', 'Логист', 'Финансы'),
  },
  documentation: {
    ru: `Процесс «заказ — деньги» для каталожных двигателей WEG (сегмент промышленного электрооборудования — ${(WEG.segments.industrial * 100).toFixed(1)} % выручки 2025 года).

Публичные данные, на которых построена модель:
• чистая выручка 2025 — R$ ${(WEG.revenue / 1e9).toFixed(1)} млрд (+7,4 %);
• произведено более ${(WEG.motorsPerYear / 1e6).toFixed(0)} млн двигателей на ${WEG.plants} площадках в ${WEG.countries} странах;
• доля внешних рынков — ${(WEG.externalShare * 100).toFixed(0)} %.

Расчёт из публичных данных:
• ${(WEG.motorsPerYear / 1e6).toFixed(0)} млн двигателей ÷ ${WEG.workingDays} рабочих дней = ${DERIVED.motorsPerDay.toLocaleString('ru-RU')} двигателей в день;
• объём заказов в модели: ${(WEG.motorsPerYear / 1e6).toFixed(0)} млн ÷ 25 шт средний заказ ≈ 760 000 заказов в год (25 шт — допущение, меняется в параметрах расчёта);
• выручка на заказ ≈ R$ ${Math.round(DERIVED.industrialRevenue / 760000).toLocaleString('ru-RU')} (выручка промышленного сегмента ÷ число заказов).

${dataNote('ru')}

${sourceBlock(['annual2025', 'production', 'fy2025', 'profile'], 'ru')}`,
    en: `Order-to-cash for WEG catalogue motors (industrial electro-electronic segment — ${(WEG.segments.industrial * 100).toFixed(1)}% of 2025 revenue).

Public figures behind the model: net revenue R$ ${(WEG.revenue / 1e9).toFixed(1)}bn in 2025, more than ${(WEG.motorsPerYear / 1e6).toFixed(0)} million motors produced in ${WEG.plants} plants across ${WEG.countries} countries, ${(WEG.externalShare * 100).toFixed(0)}% of revenue from outside Brazil.

Derived: ${DERIVED.motorsPerDay.toLocaleString('en-US')} motors per working day; ~760,000 orders per year assuming 25 units per order.

${dataNote('en')}

${sourceBlock(['annual2025', 'production', 'fy2025', 'profile'], 'en')}`,
  },
  spec: {
    notation: 'bpmn',
    name: { ru: 'Обработка заказа на серийный двигатель', en: 'Order to cash — catalogue motors' },
    lanes: LANES,
    nodes: [
      node('start', 'startMessageEvent', 'customer', 'Заказ поступил в WEG', 'Order received', reported({})),
      node('register', 'serviceTask', 'sales', 'Зарегистрировать заказ в ERP', 'Register the order in ERP', work(4, 'Менеджер по продажам')),
      node('check', 'userTask', 'sales', 'Проверить спецификацию и артикулы', 'Check specification and part numbers', work(12, 'Менеджер по продажам')),
      node('gwStd', 'exclusiveGateway', 'sales', 'Каталожная позиция?', 'Catalogue item?'),
      node('toEto', 'sendTask', 'sales', 'Передать в процесс «машина на заказ»', 'Hand over to engineer-to-order', work(15, 'Менеджер по продажам')),
      node('endEto', 'endEvent', 'sales', 'Заказ ушёл в ETO', 'Moved to ETO'),
      node('credit', 'businessRuleTask', 'credit', 'Проверить кредитный лимит и лимит страховщика', 'Check credit and insurance limit', work(8, 'Аналитик')),
      node('gwCredit', 'exclusiveGateway', 'credit', 'Лимит достаточен?', 'Limit sufficient?'),
      node('prepay', 'sendTask', 'credit', 'Запросить предоплату', 'Request prepayment', work(10, 'Аналитик', { waitTime: DAY * 2 })),
      node('gwPaid', 'exclusiveGateway', 'credit', 'Предоплата получена?', 'Prepayment received?'),
      node('cancel', 'endErrorEvent', 'credit', 'Заказ отменён', 'Order cancelled'),
      node('reserve', 'serviceTask', 'plan', 'Зарезервировать остатки на складе', 'Reserve stock', work(3, 'Планировщик')),
      node('gwStock', 'exclusiveGateway', 'plan', 'Есть на складе?', 'Available from stock?'),
      node('mrp', 'serviceTask', 'plan', 'Поставить в производственный план', 'Add to the production plan', work(20, 'Планировщик')),
      node('waitProd', 'intermediateTimerEvent', 'plan', 'Ожидание производственной партии', 'Waiting for the production batch', wait(DAY * 9)),
      node('pick', 'manualTask', 'plan', 'Скомплектовать заказ', 'Pick the order', work(35, 'Оператор', { resourceQty: 2 })),
      node('pack', 'manualTask', 'plan', 'Упаковать и маркировать', 'Pack and label', work(22, 'Оператор')),
      node('nfe', 'serviceTask', 'fin', 'Выпустить электронную накладную NF-e', 'Issue the NF-e invoice', work(6, 'Финансы', { cost: 3 })),
      node('ship', 'userTask', 'log', 'Отгрузить перевозчику', 'Hand over to the carrier', work(25, 'Логист', { cost: 180 })),
      node('notify', 'sendTask', 'log', 'Уведомить клиента и передать трек-номер', 'Notify the customer with tracking', work(4, 'Логист')),
      node('docs', 'dataObject', 'fin', 'NF-e и товарные документы', 'NF-e and shipping documents'),
      node('invoice', 'serviceTask', 'fin', 'Выставить счёт и завести дебиторку', 'Post the receivable', work(5, 'Финансы')),
      node('terms', 'intermediateTimerEvent', 'fin', 'Отсрочка платежа 30 дней', 'Payment terms, 30 days', wait(DAY * 30)),
      node('gwCash', 'exclusiveGateway', 'fin', 'Оплата поступила в срок?', 'Paid on time?'),
      node('dunning', 'userTask', 'fin', 'Работа с просрочкой', 'Collections', work(30, 'Финансы', { waitTime: DAY * 12 })),
      node('close', 'serviceTask', 'fin', 'Закрыть заказ и разнести оплату', 'Close the order and apply the payment', work(6, 'Финансы')),
      node('end', 'endEvent', 'fin', 'Деньги получены', 'Cash received', { completes: true }),
      node('note', 'textAnnotation', 'sales', 'Объём: ≈760 тыс. заказов в год (расчёт из 19 млн двигателей)', 'Volume: ≈760k orders/year (derived from 19m motors)'),
    ],
    edges: [
      flow('start', 'register'),
      flow('register', 'check'),
      flow('check', 'gwStd'),
      flow('gwStd', 'credit', { share: 82, ru: 'каталог', en: 'catalogue' }),
      flow('gwStd', 'toEto', { share: 18, ru: 'под заказ', en: 'engineered' }),
      flow('toEto', 'endEto'),
      flow('credit', 'gwCredit'),
      flow('gwCredit', 'reserve', { share: 91, ru: 'да', en: 'yes' }),
      flow('gwCredit', 'prepay', { share: 9, ru: 'нет', en: 'no' }),
      flow('prepay', 'gwPaid'),
      flow('gwPaid', 'reserve', { share: 85, ru: 'оплачено', en: 'paid' }),
      flow('gwPaid', 'cancel', { share: 15, ru: 'нет оплаты', en: 'not paid' }),
      flow('reserve', 'gwStock'),
      flow('gwStock', 'pick', { share: 78, ru: 'в наличии', en: 'in stock' }),
      flow('gwStock', 'mrp', { share: 22, ru: 'нет остатка', en: 'out of stock' }),
      flow('mrp', 'waitProd'),
      flow('waitProd', 'pick'),
      flow('pick', 'pack'),
      flow('pack', 'nfe'),
      flow('nfe', 'ship'),
      flow('ship', 'notify'),
      flow('notify', 'invoice'),
      flow('invoice', 'terms'),
      flow('terms', 'gwCash'),
      flow('gwCash', 'close', { share: 93, ru: 'да', en: 'yes' }),
      flow('gwCash', 'dunning', { share: 7, ru: 'просрочка', en: 'overdue' }),
      flow('dunning', 'close'),
      flow('close', 'end'),
      { source: 'nfe', target: 'docs', type: 'dataAssociation' },
      { source: 'check', target: 'note', type: 'association' },
    ],
  },
};
