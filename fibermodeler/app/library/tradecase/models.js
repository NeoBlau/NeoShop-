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

/*
 * The customer is a collapsed pool (a black box): the case is about the
 * company's process, and every exchange with the customer is a message flow
 * to or from the pool. That keeps the corrected models as small as the
 * source model while staying correct.
 */

export const AS_IS_SPEC = {
  notation: 'bpmn',
  name: t('Обработка и выполнение заказа покупателя: исправленная модель AS-IS', 'Customer order processing: the corrected AS-IS model'),
  pools: POOLS,
  lanes: LANES,
  nodes: [
    node('start', 'startMessageEvent', 'manager', 'Заказ получен', 'Order received'),
    node('register', 'userTask', 'manager', 'Зарегистрировать заказ', 'Register the order'),
    node('check', 'userTask', 'warehouse', 'Проверить наличие товара', 'Check the stock'),
    node('gwStock', 'exclusiveGateway', 'warehouse', 'Товар есть?', 'In stock?'),
    node('notifyAbsent', 'sendTask', 'manager', 'Сообщить клиенту об отсутствии товара', 'Tell the customer the goods are out of stock'),
    node('endNoStock', 'endEvent', 'manager', 'Заказ отменён: товара нет', 'Order cancelled: out of stock'),
    node('invoice', 'sendTask', 'accounting', 'Выставить счёт', 'Issue the invoice'),
    node('gwWait', 'eventBasedGateway', 'accounting', 'Ожидание оплаты', 'Waiting for payment'),
    node('paid', 'intermediateMessageCatchEvent', 'accounting', 'Оплата получена', 'Payment received'),
    node('timeout', 'intermediateTimerEvent', 'accounting', '3 рабочих дня', '3 working days'),
    node('confirm', 'userTask', 'accounting', 'Подтвердить поступление оплаты', 'Confirm the receipt of payment'),
    node('ship', 'userTask', 'warehouse', 'Отгрузить товар', 'Ship the goods'),
    node('notifyDone', 'sendTask', 'manager', 'Сообщить клиенту о выполнении', 'Tell the customer it is fulfilled'),
    node('close', 'userTask', 'manager', 'Закрыть заказ', 'Close the order'),
    node('endDone', 'endEvent', 'manager', 'Заказ выполнен', 'Order fulfilled'),
    node('notifyCancel', 'sendTask', 'manager', 'Сообщить клиенту об отмене заказа', 'Tell the customer the order is cancelled'),
    node('endNoPay', 'endEvent', 'manager', 'Заказ отменён: нет оплаты', 'Order cancelled: no payment'),
  ],
  edges: [
    flow('start', 'register'),
    flow('register', 'check'),
    flow('check', 'gwStock'),
    flow('gwStock', 'notifyAbsent', { ru: 'Нет', en: 'No' }),
    flow('notifyAbsent', 'endNoStock'),
    flow('gwStock', 'invoice', { ru: 'Да', en: 'Yes' }),
    flow('invoice', 'gwWait'),
    flow('gwWait', 'paid'),
    flow('gwWait', 'timeout'),
    flow('paid', 'confirm'),
    flow('confirm', 'ship'),
    flow('ship', 'notifyDone'),
    flow('notifyDone', 'close'),
    flow('close', 'endDone'),
    { ...flow('timeout', 'notifyCancel'), sourceSide: 'right', targetSide: 'left' },
    flow('notifyCancel', 'endNoPay'),
    message('client', 'start', 'Заказ', 'Order'),
    message('notifyAbsent', 'client', 'Нет товара', 'Out of stock'),
    message('invoice', 'client', 'Счёт', 'Invoice'),
    message('client', 'paid', 'Оплата', 'Payment'),
    message('notifyDone', 'client', 'Выполнен', 'Fulfilled'),
    message('notifyCancel', 'client', 'Отменён', 'Cancelled'),
  ],
};

/* ------------------------------------------------------------------- 3. TO-BE */

export const TO_BE_SPEC = {
  notation: 'bpmn',
  name: t('Обработка и выполнение заказа покупателя: модель TO-BE', 'Customer order processing: the TO-BE model'),
  pools: POOLS,
  lanes: [LANES[0], LANES[1], LANES[2], SYSTEM_LANE],
  nodes: [
    node('start', 'startMessageEvent', 'system', 'Заказ из электронной формы', 'Order from the electronic form'),
    node('register', 'serviceTask', 'system', 'Зарегистрировать заказ автоматически', 'Register the order automatically'),
    node('reserve', 'businessRuleTask', 'system', 'Проверить остатки и зарезервировать товар', 'Check the stock and reserve the goods'),
    node('gwStock', 'exclusiveGateway', 'system', 'Товар есть?', 'In stock?'),
    node('notifyAbsent', 'sendTask', 'manager', 'Сообщить клиенту об отсутствии товара', 'Tell the customer the goods are out of stock'),
    node('endNoStock', 'endEvent', 'manager', 'Заказ отменён: товара нет', 'Order cancelled: out of stock'),
    node('invoice', 'serviceTask', 'system', 'Выставить и отправить счёт автоматически', 'Issue and send the invoice automatically'),
    node('gwWait', 'eventBasedGateway', 'system', 'Ожидание оплаты', 'Waiting for payment'),
    node('paid', 'intermediateMessageCatchEvent', 'system', 'Платёж найден в выписке', 'Payment found in the statement'),
    node('timeout', 'intermediateTimerEvent', 'system', '3 рабочих дня', '3 working days'),
    node('confirm', 'userTask', 'accounting', 'Подтвердить платёж', 'Confirm the payment'),
    node('ship', 'userTask', 'warehouse', 'Отгрузить зарезервированный товар', 'Ship the reserved goods'),
    node('done', 'serviceTask', 'system', 'Закрыть заказ и уведомить клиента', 'Close the order and notify the customer'),
    node('endDone', 'endEvent', 'system', 'Заказ выполнен', 'Order fulfilled'),
    node('cancelNoPay', 'serviceTask', 'system', 'Отменить заказ, снять резерв, уведомить клиента', 'Cancel the order, release the reserve, notify the customer'),
    node('endNoPay', 'endEvent', 'system', 'Заказ отменён: нет оплаты', 'Order cancelled: no payment'),
  ],
  edges: [
    flow('start', 'register'),
    flow('register', 'reserve'),
    flow('reserve', 'gwStock'),
    flow('gwStock', 'notifyAbsent', { ru: 'Нет', en: 'No' }),
    flow('notifyAbsent', 'endNoStock'),
    flow('gwStock', 'invoice', { ru: 'Да', en: 'Yes' }),
    flow('invoice', 'gwWait'),
    flow('gwWait', 'paid'),
    flow('gwWait', 'timeout'),
    flow('paid', 'confirm'),
    flow('confirm', 'ship'),
    flow('ship', 'done'),
    flow('done', 'endDone'),
    flow('timeout', 'cancelNoPay'),
    flow('cancelNoPay', 'endNoPay'),
    message('client', 'start', 'Заказ', 'Order'),
    message('notifyAbsent', 'client', 'Нет товара', 'Out of stock'),
    message('invoice', 'client', 'Счёт', 'Invoice'),
    message('client', 'paid', 'Оплата', 'Payment'),
    message('done', 'client', 'Выполнен', 'Fulfilled'),
    message('cancelNoPay', 'client', 'Отменён', 'Cancelled'),
  ],
};
