/**
 * Uber Eats, Dubai - ordering from McDonald's, TO-BE (target state).
 *
 * Same actors and the same demand as the AS-IS model. What changes is how the
 * platform handles the restaurant, the courier, the address, the proof of
 * hand-over and the complaint.
 */
import { auto, flow, node, wait, work } from '../kit.js';
import { ORDERS_PER_YEAR, ROLE, conventionsBlock, contextBlock, dataNote, roles } from './facts.js';
import { LANES } from './asis.js';

export const uberToBe = {
  id: 'uber-dubai-order-tobe',
  order: 1,
  variant: 'to-be',
  baselineId: 'uber-dubai-order',
  name: {
    ru: 'Заказ еды из McDonald\'s в Дубае — как будет',
    en: 'Ordering food from McDonald\'s in Dubai — to be',
  },
  description: {
    ru: 'Интеграция с кассой вместо ручного принятия, диспетчеризация к моменту готовности вместо простоя курьера, проверенный адрес Дубая с кодом Makani, QR-сверка пакета и PIN при вручении, проактивный ETA и автоматическое решение по малым жалобам.',
    en: 'A point-of-sale integration instead of manual acceptance, dispatch timed to food-ready instead of an idle courier, a verified Dubai address with the Makani code, a QR bag check and a PIN at hand-over, a proactive ETA and automatic resolution of small complaints.',
  },
  analysis: {
    currency: 'AED',
    volumePerYear: ORDERS_PER_YEAR,
    hoursPerFte: 1800,
    workingDays: 365,
    roles: roles('support', 'fraud', 'courier', 'settlements'),
  },
  documentation: {
    ru: `Заказ еды из McDonald's в Дубае через Uber Eats — целевое состояние (TO-BE), описанное со стороны платформы.

${dataNote('ru')}

${conventionsBlock('ru')}

Что меняется по сравнению с «как есть».
1) Приём заказа. Заказ передаётся напрямую в кассовую систему McDonald's (интеграция POS) и на экран кухни, остатки и загрузка сверяются до отправки. Ответ приходит автоматически: принято 97 % вместо 90 %, отказ 1,5 %, тишина 1,5 % вместо 6 %, и ждать больше 1,5 минут не нужно. Звонков в ресторан становится меньше, а доля договорённостей при звонке выше (45 % вместо 35 %), потому что причина уже видна в данных.
2) Диспетчеризация к готовности. Платформа прогнозирует время готовности по загрузке кухни и составу заказа и откладывает вызов курьера до момента «готовность минус время в пути». Курьер приезжает к выдаче, а не к очереди: простой у стойки падает с 4 до 1 минуты, а время до отправки курьера он свободен для другого заказа. Срок доставки при этом почти не меняется — кухня готовит те же 12,5 минут. Выигрыш — в занятом времени курьера.
3) Адрес. Сохранённые адреса и проверка пина по коду Makani с подсказками по зданию (вход, парковка, консьерж). Ввод адреса занимает 0,9 минуты вместо 1,8, поиск входа — 2 вместо 3,5, недозвонов 4 % вместо 9 %, а доля вышедших после звонка выше (78 % вместо 70 %).
4) Оплата. Карта или Apple Pay предлагаются по умолчанию с небольшим кэшбэком за счёт Uber (затрата 0,9 AED на заказ): наличных 15 % вместо 28 %, меньше времени курьера на сдачу и учёт. Мягкие отказы карты повторяются автоматически: возвращаются к выбору способа 3 % вместо 6 %.
5) Выдача и вручение. QR-код на пломбе пакета и сверка по списку вместо проверки на глаз; PIN в приложении при вручении вместо фото. Доля жалоб падает с 6,5 до 4 %.
6) ETA. Предиктивный ETA с поправкой на трафик и жару и проактивные уведомления об изменениях: вопросов «где мой заказ» 4 % вместо 11 %, и на ответ уходит 2,2 минуты вместо 3,2.
7) Жалобы. Решения по малым суммам (до 40 AED) принимаются автоматически по фото, GPS курьера, QR-сверке и оценке риска злоупотребления: 65 % случаев закрываются без человека, у остальных разбор занимает 5,5 минуты вместо 7,5.
8) Антифрод. Модель точнее: ручная проверка у 1,5 % заказов вместо 3 %, и она короче (4,5 минуты вместо 6).

Чего я НЕ засчитываю как улучшение — это сделано намеренно, как и в моделях WEG.
• Спрос и конверсия: доля закрытых или перегруженных ресторанов (6 %), время, которое клиент тратит на выбор блюд и корзину, и стоимость акций остаются прежними. Рост конверсии поднял бы стоимость «на один начатый заказ» только потому, что больше заказов доходило бы до дорогих шагов, и сравнение перестало бы показывать эффективность процесса.
• Дорога и кухня: 8 + 14 минут пути и почти все 12,5 минут готовки — физика процесса.
• Групповая доставка: два заказа одному курьеру могли бы снизить занятое время ещё сильнее, но она не смоделирована, поэтому выгода от неё не включена.

Новые затраты тоже учтены: интеграция с кассой, прогноз готовности, проверка адреса, кэшбэк за оплату картой, автоматическое решение по жалобам.

${contextBlock('ru')}`,
    en: `Ordering food from McDonald's in Dubai through Uber Eats - the target state (TO-BE), described from the platform's side.

${dataNote('en')}

${conventionsBlock('en')}

What changes against the as-is model. 1) Order acceptance: the order goes straight into McDonald's point-of-sale system and the kitchen display, with stock and kitchen load checked before sending; the answer comes automatically - 97% accepted instead of 90%, 1.5% rejected, 1.5% silence instead of 6%, and the wait is at most 1.5 minutes; fewer calls to the restaurant, and a higher resolution rate on a call (45% instead of 35%) because the cause is already visible in the data. 2) Dispatch timed to readiness: the platform predicts the ready time from kitchen load and basket and delays the courier call until "ready minus travel time"; the courier arrives at the hand-over, not at a queue, so idling at the counter falls from 4 to 1 minute and the courier is free for another order until then; the delivery lead time hardly moves - the kitchen cooks for the same 12.5 minutes - and the gain is in the courier's occupied time. 3) Address: saved addresses and pin checks against the Makani code with building hints (entrance, parking, concierge); address entry takes 0.9 minutes instead of 1.8, finding the entrance 2 instead of 3.5, unreachable customers fall to 4% from 9% and the share who come out after a call rises to 78% from 70%. 4) Payment: card or Apple Pay is the default with a small Uber-funded cashback (0.9 AED an order); cash falls to 15% from 28%, which saves courier time on change and accounting; soft card declines are retried automatically, so 3% return to the payment step instead of 6%. 5) Hand-over: a QR code on the bag seal and a check against the list instead of a look; a PIN in the app instead of a photo; complaints fall from 6.5% to 4%. 6) ETA: a predictive ETA corrected for traffic and heat and proactive notifications; "where is my order" falls to 4% from 11% and takes 2.2 minutes instead of 3.2. 7) Complaints: decisions on small amounts (up to 40 AED) are made automatically from the photo, the courier GPS, the QR check and an abuse-risk score; 65% of cases close without a person and the rest take 5.5 minutes instead of 7.5. 8) Fraud: a sharper model - manual review on 1.5% of orders instead of 3%, and it is shorter (4.5 minutes instead of 6).

What I do NOT count as an improvement - deliberately, as in the WEG models. Demand and conversion: the share of closed or overloaded restaurants (6%), the time the customer spends choosing and building the basket, and the cost of promotions stay as they were; a higher conversion would raise the cost per started order only because more orders reach the expensive steps, and the comparison would stop measuring process efficiency. The road and the kitchen: the 8 + 14 minutes of riding and almost all of the 12.5 minutes of cooking are the physics of the process. Batched delivery: two orders to one courier could cut the occupied time further, but it is not modelled, so its gain is not included.

The new costs are counted too: the POS integration, the ready-time prediction, the address check, the cashback for card payment and the automatic complaint resolution.

${contextBlock('en')}`,
  },
  spec: {
    notation: 'bpmn',
    name: { ru: 'Заказ из McDonald\'s в Дубае — как будет', en: 'McDonald\'s order in Dubai — to be' },
    lanes: LANES,
    nodes: [
      /* 1. availability - unchanged */
      node('start', 'startEvent', 'customer', 'Клиент открыл приложение Uber Eats в Дубае', 'Customer opens the Uber Eats app in Dubai'),
      node('zone', 'businessRuleTask', 'platform', 'Определить зону доставки по геопозиции и показать доступные рестораны', 'Resolve the delivery zone from the location and show available restaurants', auto(0.1, { cost: 0.03 })),
      node('gwOpen', 'exclusiveGateway', 'platform', 'McDonald\'s принимает заказы по этому адресу?', 'Does McDonald\'s take orders for this address?'),
      node('closed', 'serviceTask', 'platform', 'Показать «ресторан закрыт или перегружен» и предложить альтернативы', 'Show "restaurant closed or busy" and suggest alternatives', auto(0.1)),
      node('endClosed', 'endEvent', 'platform', 'Заказ не оформлен: McDonald\'s недоступен', 'No order: McDonald\'s unavailable'),

      /* 2. basket and price - customer behaviour unchanged */
      node('browse', 'userTask', 'customer', 'Выбрать McDonald\'s, просмотреть меню и состав позиций', 'Pick McDonald\'s and browse the menu and item details', wait(2.5)),
      node('cart', 'userTask', 'customer', 'Собрать корзину, выбрать модификаторы, ввести промокод', 'Build the basket, choose modifiers, enter a promo code', wait(2)),
      node('promo', 'serviceTask', 'platform', 'Применить промокод и скидки Uber One (за счёт Uber)', 'Apply the promo code and Uber One discounts (funded by Uber)', auto(0.1, { cost: 4.2 })),
      node('price', 'businessRuleTask', 'platform', 'Рассчитать итог: позиции, доставка, сервисный сбор, малый заказ, динамика цены, VAT 5 %', 'Compute the total: items, delivery, service fee, small order, dynamic price, 5% VAT', auto(0.2, { cost: 0.05 })),

      /* 3. address and fraud */
      node('checkout', 'userTask', 'customer', 'Подтвердить сохранённый адрес и способ оплаты (Apple Pay по умолчанию)', 'Confirm the saved address and payment method (Apple Pay by default)', wait(0.9)),
      node('geocode', 'businessRuleTask', 'platform', 'Проверить пин по коду Makani, подставить вход, парковку и подсказки по зданию', 'Check the pin against the Makani code, add entrance, parking and building hints', auto(0.2, { cost: 0.05 })),
      node('fraud', 'businessRuleTask', 'platform', 'Антифрод-скоринг: устройство, история, адрес, состав заказа', 'Fraud scoring: device, history, address, basket', auto(0.2, { cost: 0.06 })),
      node('gwFraud', 'exclusiveGateway', 'platform', 'Заказ выглядит подозрительным?', 'Does the order look suspicious?'),
      node('review', 'userTask', 'support', 'Проверить заказ вручную по подготовленной сводке риска', 'Review manually from the prepared risk summary', work(4.5, ROLE.fraud)),
      node('gwReview', 'exclusiveGateway', 'support', 'Заказ допустим?', 'Order acceptable?'),
      node('blocked', 'endErrorEvent', 'support', 'Заказ заблокирован антифродом', 'Order blocked by fraud control'),

      /* 4. payment */
      node('nudge', 'serviceTask', 'platform', 'Предложить оплату картой или Apple Pay с кэшбэком вместо наличных', 'Suggest card or Apple Pay with cashback instead of cash', auto(0.1, { cost: 0.9 })),
      node('gwPay', 'exclusiveGateway', 'platform', 'Способ оплаты?', 'Payment method?'),
      node('card', 'serviceTask', 'platform', 'Авторизовать карту или Apple Pay; при мягком отказе повторить автоматически', 'Authorise the card or Apple Pay; retry automatically on a soft decline', auto(0.4, { cost: 0.4 })),
      node('gwAuth', 'exclusiveGateway', 'platform', 'Авторизация прошла?', 'Authorisation approved?'),
      node('cod', 'businessRuleTask', 'platform', 'Проверить лимит наличных для клиента и района', 'Check the cash limit for the customer and area', auto(0.1)),
      node('gwCod', 'exclusiveGateway', 'platform', 'Наличные разрешены?', 'Cash allowed?'),
      node('payFail', 'userTask', 'customer', 'Выбрать другую карту или способ оплаты', 'Choose another card or payment method', wait(1.6)),
      node('gwPayJoin', 'exclusiveGateway', 'platform', 'Оплата обеспечена', 'Payment secured'),

      /* 5. hand-off to the restaurant */
      node('place', 'serviceTask', 'platform', 'Передать заказ в кассу McDonald\'s и на экран кухни (интеграция POS), сверить остатки', 'Send the order to McDonald\'s POS and the kitchen display, check stock', auto(0.25, { cost: 0.16 })),
      node('gwResp', 'eventBasedGateway', 'platform', 'Ожидание ответа ресторана', 'Waiting for the restaurant\'s answer'),
      node('accepted', 'intermediateMessageCatchEvent', 'merchant', 'Касса принимает заказ автоматически', 'The POS accepts the order automatically', wait(0.15)),
      node('rejected', 'intermediateMessageCatchEvent', 'merchant', 'Ресторан отклонил заказ', 'Restaurant rejects the order', wait(0.15)),
      node('timeout', 'intermediateTimerEvent', 'platform', 'Нет ответа 1,5 минуты', 'No answer for 1.5 minutes', wait(1.5)),
      node('callRest', 'userTask', 'support', 'Позвонить в ресторан: причина уже видна в данных кассы', 'Call the restaurant: the cause is already visible in the POS data', work(3.5, ROLE.support)),
      node('gwCall', 'exclusiveGateway', 'support', 'Удалось договориться?', 'Resolved with the restaurant?'),
      node('cancel', 'serviceTask', 'platform', 'Отменить заказ, извиниться и выдать кредит клиенту', 'Cancel the order, apologise and give the customer a credit', auto(0.2, { cost: 3.2 })),
      node('refund', 'serviceTask', 'finance', 'Снять холд по карте', 'Release the card hold', auto(0.3)),
      node('endCancel', 'endEvent', 'platform', 'Заказ отменён: ресторан не принял', 'Order cancelled: restaurant did not accept'),
      node('gwAcceptJoin', 'exclusiveGateway', 'platform', 'Ресторан принял заказ', 'Restaurant has the order'),

      /* 6. kitchen and dispatch in parallel */
      node('pgSplit', 'parallelGateway', 'platform', 'Кухня и доставка запускаются параллельно', 'Kitchen and delivery start in parallel'),
      node('prepare', 'manualTask', 'merchant', 'Кухня собирает заказ по экрану кухни', 'The kitchen prepares the order from the kitchen display', wait(12.5)),
      node('predict', 'businessRuleTask', 'platform', 'Спрогнозировать время готовности по загрузке кухни и составу заказа', 'Predict the ready time from kitchen load and basket', auto(0.2, { cost: 0.04 })),
      node('hold', 'intermediateTimerEvent', 'platform', 'Отложить вызов курьера до «готовность минус время в пути»', 'Hold the courier call until "ready minus travel time"', wait(2.4)),
      node('dispatch', 'businessRuleTask', 'platform', 'Диспетчеризация: подобрать курьера по расстоянию, загрузке и рейтингу', 'Dispatch: pick a courier by distance, load and rating', auto(0.4, { cost: 0.08 })),
      node('gwFound', 'exclusiveGateway', 'platform', 'Курьер найден?', 'Courier found?'),
      node('boost', 'serviceTask', 'platform', 'Расширить радиус поиска и поднять бонус за заказ', 'Widen the search radius and raise the order bonus', auto(0.2, { waitTime: 3, cost: 4.5 })),
      node('offer', 'userTask', 'courier', 'Курьер получает предложение с прогнозом заработка', 'The courier gets the offer with an earnings forecast', wait(0.5)),
      node('gwOffer', 'exclusiveGateway', 'courier', 'Курьер принял?', 'Courier accepted?'),
      node('redispatch', 'serviceTask', 'platform', 'Отметить отказ и передать предложение следующему курьеру', 'Record the decline and pass the offer to the next courier', auto(0.1)),
      node('toRest', 'manualTask', 'courier', 'Ехать к McDonald\'s (трафик, жара, ограничения RTA)', 'Ride to McDonald\'s (traffic, heat, RTA restrictions)', work(8, ROLE.courier)),
      node('idle', 'manualTask', 'courier', 'Дождаться выдачи заказа у стойки (короткий простой)', 'Wait briefly for the hand-over at the counter', work(1, ROLE.courier)),
      node('pgJoin', 'parallelGateway', 'merchant', 'Заказ готов и курьер на месте', 'Order ready and courier present'),

      /* 7. pickup */
      node('verify', 'manualTask', 'courier', 'Забрать заказ: сканировать QR пломбы пакета, сверить по списку', 'Collect the order: scan the bag-seal QR, check against the list', work(1.3, ROLE.courier)),
      node('picked', 'serviceTask', 'platform', 'Зафиксировать выдачу, построить маршрут, рассчитать предиктивный ETA', 'Record the pickup, build the route, compute the predictive ETA', auto(0.2, { cost: 0.27 })),
      node('notifyTransit', 'sendTask', 'platform', 'Проактивно сообщить клиенту ETA и любые изменения', 'Proactively tell the customer the ETA and any change', auto(0.1, { cost: 0.03 })),

      /* 8. delivery */
      node('gwWismo', 'exclusiveGateway', 'platform', 'Клиент спрашивает «где мой заказ»?', 'Does the customer ask "where is my order"?'),
      node('wismo', 'userTask', 'support', 'Ответить клиенту: положение курьера, причина задержки', 'Answer the customer: courier position, reason for the delay', work(2.2, ROLE.support)),
      node('gwWismoJoin', 'exclusiveGateway', 'platform', 'Доставка продолжается', 'Delivery continues'),
      node('toCust', 'manualTask', 'courier', 'Везти заказ клиенту (жара, пробки, парковка)', 'Carry the order to the customer (heat, traffic, parking)', work(14, ROLE.courier)),
      node('arrive', 'manualTask', 'courier', 'Пройти к входу по подсказкам: код Makani, парковка, консьерж, этаж', 'Reach the entrance from the hints: Makani code, parking, concierge, floor', work(2, ROLE.courier)),
      node('gwReach', 'exclusiveGateway', 'courier', 'Клиент на связи и встречает?', 'Customer reachable and meeting the courier?'),
      node('callCust', 'userTask', 'courier', 'Позвонить клиенту и ждать у входа', 'Call the customer and wait at the entrance', work(2, ROLE.courier)),
      node('gwReach2', 'exclusiveGateway', 'courier', 'Клиент вышел?', 'Customer came out?'),
      node('noShow', 'serviceTask', 'platform', 'Зафиксировать неудачную доставку, удержать оплату, вернуть заказ', 'Record the failed delivery, retain payment, return the order', auto(0.3, { cost: 6 })),
      node('endNoShow', 'endEvent', 'platform', 'Заказ не вручён: клиент недоступен, оплата удержана', 'Not delivered: customer unreachable, payment retained'),

      /* 9. hand-over and payment */
      node('handoff', 'manualTask', 'courier', 'Передать заказ клиенту, проверить PIN в приложении', 'Hand the order over, check the PIN in the app', work(0.9, ROLE.courier)),
      node('gwCash', 'exclusiveGateway', 'courier', 'Оплата наличными?', 'Paid in cash?'),
      node('cash', 'manualTask', 'courier', 'Принять наличные, выдать сдачу, подтвердить в приложении', 'Take the cash, give change, confirm in the app', work(1.6, ROLE.courier)),
      node('cashSettle', 'serviceTask', 'finance', 'Учесть наличные у курьера и удержать из его выплаты', 'Book the cash against the courier\'s earnings', auto(0.3)),
      node('capture', 'serviceTask', 'finance', 'Списать сумму с карты (capture), комиссия эквайера', 'Capture the card amount, acquirer fee', auto(0.3, { cost: 2.15 })),
      node('gwPaid', 'exclusiveGateway', 'finance', 'Расчёт с клиентом завершён', 'Customer payment settled'),

      /* 10. close and accruals */
      node('complete', 'serviceTask', 'platform', 'Закрыть заказ: статус «доставлен», время и GPS', 'Close the order: "delivered", time and GPS', auto(0.2)),
      node('ledger', 'serviceTask', 'finance', 'Начислить комиссию ресторана, выплату курьеру и VAT 5 %', 'Accrue the restaurant commission, the courier earnings and 5% VAT', auto(0.4, { cost: 0.3 })),

      /* 11. after delivery */
      node('gwIssue', 'exclusiveGateway', 'platform', 'Клиент сообщил о проблеме с заказом?', 'Did the customer report a problem?'),
      node('issueChat', 'userTask', 'customer', 'Заполнить форму в чате: что не так, фото по подсказке', 'Fill in the chat form: what is wrong, a photo as prompted', wait(1.5)),
      node('autoRule', 'businessRuleTask', 'platform', 'Решить по правилам: фото, GPS курьера, QR-сверка, сумма до 40 AED, риск злоупотребления', 'Decide by rule: photo, courier GPS, QR check, amount up to 40 AED, abuse risk', auto(0.3, { cost: 0.06 })),
      node('gwAuto', 'exclusiveGateway', 'platform', 'Решено автоматически?', 'Resolved automatically?'),
      node('refundAuto', 'serviceTask', 'finance', 'Выдать возврат или кредит по правилу', 'Issue the refund or credit by rule', auto(0.3, { cost: 16 })),
      node('issueReview', 'userTask', 'support', 'Разобрать обращение по подготовленной сводке: фото, состав, маршрут, история', 'Review the case from the prepared summary: photo, basket, route, history', work(5.5, ROLE.support)),
      node('gwIssueType', 'exclusiveGateway', 'support', 'Решение по обращению?', 'Case decision?'),
      node('refundFull', 'serviceTask', 'finance', 'Вернуть полную сумму заказа', 'Refund the full order amount', auto(0.3, { cost: 62 })),
      node('refundPart', 'serviceTask', 'finance', 'Выдать частичный возврат или кредит', 'Give a partial refund or a credit', auto(0.3, { cost: 18 })),
      node('rejectIssue', 'sendTask', 'support', 'Отказать с объяснением', 'Decline with an explanation', work(2, ROLE.support)),
      node('gwIssueJoin', 'exclusiveGateway', 'support', 'Обращение закрыто', 'Case closed'),
      node('rate', 'userTask', 'customer', 'Оценить заказ и курьера', 'Rate the order and the courier', wait(0.8)),
      node('rating', 'serviceTask', 'platform', 'Обновить рейтинги ресторана и курьера', 'Update the restaurant and courier ratings', auto(0.1)),
      node('end', 'endEvent', 'platform', 'Заказ доставлен и закрыт', 'Order delivered and closed', { completes: true }),

      /* data and notes */
      node('orderData', 'dataObject', 'platform', 'Заказ и состояние: статусы, ETA, GPS, прогноз готовности', 'Order and its state: statuses, ETA, GPS, ready-time forecast'),
      node('riskData', 'dataStore', 'platform', 'Правила антифрода и профили клиентов', 'Fraud rules and customer profiles'),
      node('addrData', 'dataStore', 'platform', 'Сохранённые адреса, коды Makani и подсказки по зданиям', 'Saved addresses, Makani codes and building hints'),
      node('ledgerData', 'dataStore', 'finance', 'Книга расчётов: заказы, комиссии, выплаты, VAT', 'Settlement ledger: orders, commissions, payouts, VAT'),
      node('holdNote', 'textAnnotation', 'platform', 'Курьер вызывается к готовности: он свободен, пока заказ готовится, а срок доставки почти не меняется', 'The courier is called at readiness: free while the order cooks, and the delivery lead time hardly moves'),
      node('qrNote', 'textAnnotation', 'courier', 'QR пломбы и PIN при вручении дают данные для автоматического решения по жалобам', 'The seal QR and the PIN at hand-over give the data for automatic complaint decisions'),
    ],
    edges: [
      flow('start', 'zone'),
      flow('zone', 'gwOpen'),
      flow('gwOpen', 'browse', { share: 94, ru: 'принимает', en: 'open' }),
      flow('gwOpen', 'closed', { share: 6, ru: 'закрыт или перегружен', en: 'closed or busy' }),
      flow('closed', 'endClosed'),
      flow('browse', 'cart'),
      flow('cart', 'promo'),
      flow('promo', 'price'),
      flow('price', 'checkout'),
      flow('checkout', 'geocode'),
      flow('geocode', 'fraud'),
      flow('fraud', 'gwFraud'),
      flow('gwFraud', 'nudge', { share: 98.5, ru: 'нет', en: 'no' }),
      flow('gwFraud', 'review', { share: 1.5, ru: 'да', en: 'yes' }),
      flow('review', 'gwReview'),
      flow('gwReview', 'nudge', { share: 55, ru: 'допустим', en: 'acceptable' }),
      flow('gwReview', 'blocked', { share: 45, ru: 'блок', en: 'block' }),
      flow('nudge', 'gwPay'),
      flow('gwPay', 'card', { share: 85, ru: 'карта или Apple Pay', en: 'card or Apple Pay' }),
      flow('gwPay', 'cod', { share: 15, ru: 'наличные', en: 'cash' }),
      flow('card', 'gwAuth'),
      flow('gwAuth', 'gwPayJoin', { share: 97, ru: 'одобрено', en: 'approved' }),
      flow('gwAuth', 'payFail', { share: 3, ru: 'отказ', en: 'declined' }),
      flow('cod', 'gwCod'),
      flow('gwCod', 'gwPayJoin', { share: 92, ru: 'разрешены', en: 'allowed' }),
      flow('gwCod', 'payFail', { share: 8, ru: 'лимит', en: 'limit' }),
      flow('payFail', 'gwPay'),
      flow('gwPayJoin', 'place'),
      flow('place', 'gwResp'),
      flow('gwResp', 'accepted', { share: 97, ru: 'принято кассой', en: 'accepted by POS' }),
      flow('gwResp', 'rejected', { share: 1.5, ru: 'отклонил', en: 'rejected' }),
      flow('gwResp', 'timeout', { share: 1.5, ru: 'тишина', en: 'silence' }),
      flow('accepted', 'gwAcceptJoin'),
      flow('rejected', 'callRest'),
      flow('timeout', 'callRest'),
      flow('callRest', 'gwCall'),
      flow('gwCall', 'gwAcceptJoin', { share: 45, ru: 'принял или замена', en: 'accepted or substituted' }),
      flow('gwCall', 'cancel', { share: 55, ru: 'не вышло', en: 'failed' }),
      flow('cancel', 'refund'),
      flow('refund', 'endCancel'),
      flow('gwAcceptJoin', 'pgSplit'),
      flow('pgSplit', 'prepare'),
      flow('pgSplit', 'predict'),
      flow('prepare', 'pgJoin'),
      flow('predict', 'hold'),
      flow('hold', 'dispatch'),
      flow('dispatch', 'gwFound'),
      flow('gwFound', 'offer', { share: 97, ru: 'найден', en: 'found' }),
      flow('gwFound', 'boost', { share: 3, ru: 'нет свободных', en: 'none free' }),
      flow('boost', 'dispatch'),
      flow('offer', 'gwOffer'),
      flow('gwOffer', 'toRest', { share: 86, ru: 'принял', en: 'accepted' }),
      flow('gwOffer', 'redispatch', { share: 14, ru: 'отказ или тишина', en: 'declined or silent' }),
      flow('redispatch', 'dispatch'),
      flow('toRest', 'idle'),
      flow('idle', 'pgJoin'),
      flow('pgJoin', 'verify'),
      flow('verify', 'picked'),
      flow('picked', 'notifyTransit'),
      flow('notifyTransit', 'gwWismo'),
      flow('gwWismo', 'wismo', { share: 4, ru: 'спрашивает', en: 'asks' }),
      flow('gwWismo', 'gwWismoJoin', { share: 96, ru: 'нет', en: 'no' }),
      flow('wismo', 'gwWismoJoin'),
      flow('gwWismoJoin', 'toCust'),
      flow('toCust', 'arrive'),
      flow('arrive', 'gwReach'),
      flow('gwReach', 'handoff', { share: 96, ru: 'встречает', en: 'meets' }),
      flow('gwReach', 'callCust', { share: 4, ru: 'не отвечает', en: 'no answer' }),
      flow('callCust', 'gwReach2'),
      flow('gwReach2', 'handoff', { share: 78, ru: 'вышел', en: 'came out' }),
      flow('gwReach2', 'noShow', { share: 22, ru: 'не вышел', en: 'did not' }),
      flow('noShow', 'endNoShow'),
      flow('handoff', 'gwCash'),
      flow('gwCash', 'cash', { share: 14, ru: 'наличные', en: 'cash' }),
      flow('gwCash', 'capture', { share: 86, ru: 'карта', en: 'card' }),
      flow('cash', 'cashSettle'),
      flow('cashSettle', 'gwPaid'),
      flow('capture', 'gwPaid'),
      flow('gwPaid', 'complete'),
      flow('complete', 'ledger'),
      flow('ledger', 'gwIssue'),
      flow('gwIssue', 'rate', { share: 96, ru: 'нет', en: 'no' }),
      flow('gwIssue', 'issueChat', { share: 4, ru: 'есть проблема', en: 'problem' }),
      flow('issueChat', 'autoRule'),
      flow('autoRule', 'gwAuto'),
      flow('gwAuto', 'refundAuto', { share: 65, ru: 'решено правилом', en: 'resolved by rule' }),
      flow('gwAuto', 'issueReview', { share: 35, ru: 'нужен человек', en: 'needs a person' }),
      flow('refundAuto', 'gwIssueJoin'),
      flow('issueReview', 'gwIssueType'),
      flow('gwIssueType', 'refundFull', { share: 30, ru: 'полный возврат', en: 'full refund' }),
      flow('gwIssueType', 'refundPart', { share: 40, ru: 'частичный кредит', en: 'partial credit' }),
      flow('gwIssueType', 'rejectIssue', { share: 30, ru: 'отказ', en: 'decline' }),
      flow('refundFull', 'gwIssueJoin'),
      flow('refundPart', 'gwIssueJoin'),
      flow('rejectIssue', 'gwIssueJoin'),
      flow('gwIssueJoin', 'rate'),
      flow('rate', 'rating'),
      flow('rating', 'end'),
      { source: 'place', target: 'orderData', type: 'dataAssociation' },
      { source: 'fraud', target: 'riskData', type: 'dataAssociation' },
      { source: 'geocode', target: 'addrData', type: 'dataAssociation' },
      { source: 'ledger', target: 'ledgerData', type: 'dataAssociation' },
      { source: 'hold', target: 'holdNote', type: 'association' },
      { source: 'verify', target: 'qrNote', type: 'association' },
    ],
  },
};
