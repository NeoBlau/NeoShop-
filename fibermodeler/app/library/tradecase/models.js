/**
 * The three BPMN models of the case "diagnosis and redesign of an order process".
 *
 *  1. the source model of figure 1, reproduced with its mistakes;
 *  2. the corrected AS-IS model;
 *  3. the TO-BE model.
 *
 * The case says not to calculate numeric effects without source data, so none of
 * the models carries times, costs or branch shares: they are about structure.
 */
import { flow, node } from '../kit.js';

const t = (ru, en) => ({ ru, en });

const POOLS = [
  { id: 'client', label: t('Клиент', 'Customer') },
  { id: 'company', label: t('Торговая компания', 'Trading company') },
];

const LANES = [
  { id: 'manager', pool: 'company', label: t('Менеджер', 'Manager') },
  { id: 'warehouse', pool: 'company', label: t('Склад', 'Warehouse') },
  { id: 'accounting', pool: 'company', label: t('Бухгалтерия', 'Accounting') },
];

const SYSTEM_LANE = { id: 'system', pool: 'company', label: t('Информационная система компании (настроена; допущение)', 'The company\'s information system (configured; an assumption)') };

/** A message flow between two pools. */
const message = (source, target, ru, en) => ({ source, target, type: 'messageFlow', label: ru ? t(ru, en || ru) : undefined, props: {} });

/* --------------------------------------------------- 1. the source, with mistakes */

export const SOURCE_SPEC = {
  notation: 'bpmn',
  name: t('Обработка и выполнение заказа покупателя: исходная модель с ошибками', 'Customer order processing: the source model with errors'),
  pools: POOLS,
  lanes: LANES,
  nodes: [
    node('start', 'startEvent', 'client', 'Заказ возник', 'Order arises'),
    node('send', 'task', 'client', 'Направить заказ', 'Send the order'),
    node('register', 'task', 'manager', 'Зарегистрировать заказ', 'Register the order'),
    node('check', 'task', 'warehouse', 'Проверить наличие товара', 'Check the stock'),
    node('gwStock', 'exclusiveGateway', 'warehouse', 'Товар есть?', 'In stock?'),
    node('notifyAbsent', 'task', 'manager', 'Сообщить клиенту об отсутствии', 'Tell the customer it is out of stock'),
    node('invoice', 'task', 'accounting', 'Выставить счёт', 'Issue the invoice'),
    node('paid', 'intermediateMessageCatchEvent', 'accounting', 'Оплата получена', 'Payment received'),
    node('join', 'parallelGateway', 'warehouse', '', ''),
    node('close', 'task', 'manager', 'Закрыть заказ', 'Close the order'),
    node('ship', 'task', 'warehouse', 'Отгрузить товар', 'Ship the goods'),
    node('end', 'endEvent', 'warehouse', 'Заказ выполнен', 'Order fulfilled'),
  ],
  edges: [
    flow('start', 'send'),
    flow('send', 'register'), // a sequence flow across the pool boundary: mistake
    { source: 'register', target: 'check', type: 'messageFlow', props: {} }, // a message flow inside one pool: mistake
    flow('check', 'gwStock'),
    flow('gwStock', 'notifyAbsent', { ru: 'Нет', en: 'No' }),
    flow('gwStock', 'invoice', { ru: 'Да', en: 'Yes' }),
    flow('notifyAbsent', 'join'),
    flow('invoice', 'paid'),
    flow('paid', 'join'),
    flow('join', 'close'),
    flow('close', 'ship'),
    flow('ship', 'end'),
  ],
};

/* ------------------------------------------------------- 2. corrected AS-IS */

/** The customer's side, shared by AS-IS and TO-BE apart from the first two steps. */
function customerNodes(firstStep) {
  return [
    node('cStart', 'startEvent', 'client', 'Потребность в товаре', 'A need for goods'),
    firstStep,
    node('cGw1', 'eventBasedGateway', 'client', 'Ответ компании', 'The company\'s answer'),
    node('cAbsent', 'intermediateMessageCatchEvent', 'client', 'Получено уведомление об отсутствии товара', 'Notice received: out of stock'),
    node('cEndAbsent', 'endEvent', 'client', 'Заказ не выполнен: товара нет', 'Order not fulfilled: out of stock'),
    node('cInvoice', 'intermediateMessageCatchEvent', 'client', 'Получен счёт', 'Invoice received'),
    node('cGwPay', 'exclusiveGateway', 'client', 'Оплатить счёт в срок?', 'Pay the invoice in time?'),
    node('cPay', 'sendTask', 'client', 'Оплатить счёт', 'Pay the invoice'),
    node('cJoin', 'exclusiveGateway', 'client', 'Решение об оплате принято', 'Payment decision made'),
    node('cGw2', 'eventBasedGateway', 'client', 'Итог обработки заказа', 'The outcome of the order'),
    node('cDone', 'intermediateMessageCatchEvent', 'client', 'Получено уведомление о выполнении заказа', 'Notice received: order fulfilled'),
    node('cCancelled', 'intermediateMessageCatchEvent', 'client', 'Получено уведомление об отмене заказа', 'Notice received: order cancelled'),
    node('cEndDone', 'endEvent', 'client', 'Заказ выполнен для клиента', 'Order fulfilled for the customer'),
    node('cEndCancel', 'endEvent', 'client', 'Заказ отменён', 'Order cancelled'),
  ];
}

function customerEdges(firstId) {
  return [
    flow('cStart', firstId),
    flow(firstId, 'cGw1'),
    flow('cGw1', 'cAbsent'),
    flow('cGw1', 'cInvoice'),
    flow('cAbsent', 'cEndAbsent'),
    flow('cInvoice', 'cGwPay'),
    flow('cGwPay', 'cPay', { ru: 'Да', en: 'Yes' }),
    flow('cGwPay', 'cJoin', { ru: 'Нет', en: 'No' }),
    flow('cPay', 'cJoin'),
    flow('cJoin', 'cGw2'),
    flow('cGw2', 'cDone'),
    flow('cGw2', 'cCancelled'),
    flow('cDone', 'cEndDone'),
    flow('cCancelled', 'cEndCancel'),
  ];
}

export const AS_IS_SPEC = {
  notation: 'bpmn',
  name: t('Обработка и выполнение заказа покупателя: исправленная модель AS-IS', 'Customer order processing: the corrected AS-IS model'),
  pools: POOLS,
  lanes: LANES,
  nodes: [
    ...customerNodes(node('cSend', 'sendTask', 'client', 'Направить заказ', 'Send the order')),
    node('start', 'startMessageEvent', 'manager', 'Получен заказ клиента', 'Customer order received'),
    node('register', 'userTask', 'manager', 'Зарегистрировать заказ', 'Register the order'),
    node('check', 'userTask', 'warehouse', 'Проверить наличие товара', 'Check the stock'),
    node('gwStock', 'exclusiveGateway', 'warehouse', 'Товар есть?', 'In stock?'),
    node('notifyAbsent', 'sendTask', 'manager', 'Уведомить клиента об отсутствии товара', 'Notify the customer that the goods are out of stock'),
    node('cancelNoStock', 'userTask', 'manager', 'Отменить заказ', 'Cancel the order'),
    node('endNoStock', 'endEvent', 'manager', 'Заказ отменён: товара нет', 'Order cancelled: out of stock'),
    node('invoice', 'sendTask', 'accounting', 'Выставить счёт клиенту', 'Issue the invoice to the customer'),
    node('gwWait', 'eventBasedGateway', 'accounting', 'Ожидание оплаты', 'Waiting for payment'),
    node('paid', 'intermediateMessageCatchEvent', 'accounting', 'Оплата получена', 'Payment received'),
    node('timeout', 'intermediateTimerEvent', 'accounting', 'Прошло 3 рабочих дня', '3 working days have passed'),
    node('confirm', 'userTask', 'accounting', 'Подтвердить поступление оплаты', 'Confirm the receipt of payment'),
    node('ship', 'userTask', 'warehouse', 'Отгрузить товар', 'Ship the goods'),
    node('notifyDone', 'sendTask', 'manager', 'Сообщить клиенту о выполнении заказа', 'Tell the customer the order is fulfilled'),
    node('close', 'userTask', 'manager', 'Закрыть заказ', 'Close the order'),
    node('endDone', 'endEvent', 'manager', 'Заказ выполнен', 'Order fulfilled'),
    node('cancelNoPay', 'userTask', 'manager', 'Отменить заказ', 'Cancel the order'),
    node('notifyCancel', 'sendTask', 'manager', 'Уведомить клиента об отмене заказа', 'Notify the customer that the order is cancelled'),
    node('endNoPay', 'endEvent', 'manager', 'Заказ отменён: нет оплаты', 'Order cancelled: no payment'),
  ],
  edges: [
    ...customerEdges('cSend'),
    flow('start', 'register'),
    flow('register', 'check'),
    flow('check', 'gwStock'),
    flow('gwStock', 'notifyAbsent', { ru: 'Нет', en: 'No' }),
    flow('notifyAbsent', 'cancelNoStock'),
    flow('cancelNoStock', 'endNoStock'),
    flow('gwStock', 'invoice', { ru: 'Да', en: 'Yes' }),
    flow('invoice', 'gwWait'),
    flow('gwWait', 'paid'),
    flow('gwWait', 'timeout'),
    flow('paid', 'confirm'),
    flow('confirm', 'ship'),
    flow('ship', 'notifyDone'),
    flow('notifyDone', 'close'),
    flow('close', 'endDone'),
    flow('timeout', 'cancelNoPay'),
    flow('cancelNoPay', 'notifyCancel'),
    flow('notifyCancel', 'endNoPay'),
    message('cSend', 'start', 'Заказ', 'Order'),
    message('notifyAbsent', 'cAbsent', 'Отсутствие товара', 'Out of stock'),
    message('invoice', 'cInvoice', 'Счёт', 'Invoice'),
    message('cPay', 'paid', 'Оплата', 'Payment'),
    message('notifyDone', 'cDone', 'Заказ выполнен', 'Order fulfilled'),
    message('notifyCancel', 'cCancelled', 'Заказ отменён', 'Order cancelled'),
  ],
};

/* ------------------------------------------------------------------- 3. TO-BE */

export const TO_BE_SPEC = {
  notation: 'bpmn',
  name: t('Обработка и выполнение заказа покупателя: модель TO-BE', 'Customer order processing: the TO-BE model'),
  pools: POOLS,
  lanes: [LANES[0], LANES[1], LANES[2], SYSTEM_LANE],
  nodes: [
    ...customerNodes(node('cSend', 'sendTask', 'client', 'Заполнить и отправить электронную форму заказа', 'Fill in and send the electronic order form')),
    node('start', 'startMessageEvent', 'system', 'Получен заказ из электронной формы', 'Order received from the electronic form'),
    node('register', 'serviceTask', 'system', 'Автоматически зарегистрировать заказ', 'Register the order automatically'),
    node('reserve', 'businessRuleTask', 'system', 'Проверить остатки и зарезервировать товар на срок оплаты', 'Check the stock and reserve the goods for the payment term'),
    node('gwStock', 'exclusiveGateway', 'system', 'Товар есть?', 'In stock?'),
    node('notifyAbsent', 'sendTask', 'manager', 'Уведомить клиента об отсутствии товара', 'Notify the customer that the goods are out of stock'),
    node('cancelNoStock', 'serviceTask', 'system', 'Отменить заказ', 'Cancel the order'),
    node('endNoStock', 'endEvent', 'system', 'Заказ отменён: товара нет', 'Order cancelled: out of stock'),
    node('invoice', 'serviceTask', 'system', 'Автоматически выставить и отправить счёт', 'Issue and send the invoice automatically'),
    node('gwWait', 'eventBasedGateway', 'system', 'Ожидание оплаты', 'Waiting for payment'),
    node('paid', 'intermediateMessageCatchEvent', 'system', 'Платёж найден в выписке банка', 'Payment found in the bank statement'),
    node('timeout', 'intermediateTimerEvent', 'system', 'Прошло 3 рабочих дня', '3 working days have passed'),
    node('match', 'serviceTask', 'system', 'Сопоставить платёж со счётом', 'Match the payment with the invoice'),
    node('confirm', 'userTask', 'accounting', 'Подтвердить сопоставленный платёж', 'Confirm the matched payment'),
    node('ship', 'userTask', 'warehouse', 'Отгрузить зарезервированный товар и отметить отгрузку в системе', 'Ship the reserved goods and mark the shipment in the system'),
    node('done', 'serviceTask', 'system', 'Закрыть заказ и уведомить клиента о выполнении', 'Close the order and notify the customer of fulfilment'),
    node('endDone', 'endEvent', 'system', 'Заказ выполнен', 'Order fulfilled'),
    node('cancelNoPay', 'serviceTask', 'system', 'Отменить заказ и снять резерв', 'Cancel the order and release the reserve'),
    node('notifyCancel', 'sendTask', 'system', 'Автоматически уведомить клиента об отмене', 'Notify the customer of the cancellation automatically'),
    node('endNoPay', 'endEvent', 'system', 'Заказ отменён: нет оплаты', 'Order cancelled: no payment'),
  ],
  edges: [
    ...customerEdges('cSend'),
    flow('start', 'register'),
    flow('register', 'reserve'),
    flow('reserve', 'gwStock'),
    flow('gwStock', 'notifyAbsent', { ru: 'Нет', en: 'No' }),
    flow('notifyAbsent', 'cancelNoStock'),
    flow('cancelNoStock', 'endNoStock'),
    flow('gwStock', 'invoice', { ru: 'Да', en: 'Yes' }),
    flow('invoice', 'gwWait'),
    flow('gwWait', 'paid'),
    flow('gwWait', 'timeout'),
    flow('paid', 'match'),
    flow('match', 'confirm'),
    flow('confirm', 'ship'),
    flow('ship', 'done'),
    flow('done', 'endDone'),
    flow('timeout', 'cancelNoPay'),
    flow('cancelNoPay', 'notifyCancel'),
    flow('notifyCancel', 'endNoPay'),
    message('cSend', 'start', 'Заказ', 'Order'),
    message('notifyAbsent', 'cAbsent', 'Отсутствие товара', 'Out of stock'),
    message('invoice', 'cInvoice', 'Счёт', 'Invoice'),
    message('cPay', 'paid', 'Оплата', 'Payment'),
    message('done', 'cDone', 'Заказ выполнен', 'Order fulfilled'),
    message('notifyCancel', 'cCancelled', 'Заказ отменён', 'Order cancelled'),
  ],
};
