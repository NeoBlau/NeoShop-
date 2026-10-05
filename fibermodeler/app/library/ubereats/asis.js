/**
 * Uber Eats, Dubai - ordering from McDonald's, AS-IS (current state).
 *
 * Seen from the platform: the customer, the restaurant and the courier are
 * actors the platform coordinates, and the lanes below show who does what.
 */
import { auto, flow, node, wait, work } from '../kit.js';
import { ORDERS_PER_YEAR, ROLE, conventionsBlock, contextBlock, dataNote, roles } from './facts.js';

export const LANES = [
  { id: 'customer', label: { ru: 'Клиент (приложение)', en: 'Customer (app)' } },
  { id: 'platform', label: { ru: 'Платформа Uber Eats (автоматика)', en: 'Uber Eats platform (automated)' } },
  { id: 'support', label: { ru: 'Поддержка и антифрод Uber', en: 'Uber support and fraud' } },
  { id: 'merchant', label: { ru: 'Ресторан McDonald\'s (партнёр)', en: 'McDonald\'s restaurant (partner)' } },
  { id: 'courier', label: { ru: 'Курьер-партнёр', en: 'Courier partner' } },
  { id: 'finance', label: { ru: 'Платежи и расчёты Uber', en: 'Uber payments and settlements' } },
];

export const uberAsIs = {
  id: 'uber-dubai-order',
  order: 1,
  variant: 'as-is',
  name: {
    ru: 'Заказ еды из McDonald\'s в Дубае — как есть',
    en: 'Ordering food from McDonald\'s in Dubai — as is',
  },
  description: {
    ru: 'От открытия приложения до расчётов и разбора проблем после доставки: наличие ресторана, корзина и цена, антифрод и оплата, передача ресторану, диспетчеризация курьера, выдача и доставка в башню, наличные, закрытие заказа, начисления и обращения в поддержку.',
    en: 'From opening the app to settlement and after-sale issues: restaurant availability, basket and price, fraud and payment, hand-off to the restaurant, courier dispatch, pickup and delivery to a tower, cash, order close, accruals and support cases.',
  },
  analysis: {
    currency: 'AED',
    volumePerYear: ORDERS_PER_YEAR,
    hoursPerFte: 1800,
    workingDays: 365,
    roles: roles('support', 'fraud', 'courier', 'settlements'),
  },
  documentation: {
    ru: `Заказ еды из McDonald's в Дубае через приложение Uber Eats — процесс «как есть», описанный со стороны платформы (компании Uber).

${dataNote('ru')}

${conventionsBlock('ru')}

Границы процесса. Начало — клиент открыл приложение. Конец — заказ доставлен и закрыт, включая начисления и разбор проблемы, если она возникла. Выплаты ресторану и курьеру по расписанию (недельные, мгновенные) — отдельный процесс; здесь они представлены начислением по заказу.

Участники (дорожки):
1. Клиент — выбирает, платит, ждёт, принимает заказ, оценивает.
2. Платформа Uber Eats — автоматические шаги: зона доставки, расчёт цены, антифрод, авторизация карты, передача заказа, диспетчеризация, ETA, закрытие.
3. Поддержка и антифрод Uber — люди: ручная проверка подозрительных заказов, звонки в ресторан, ответы «где мой заказ», разбор жалоб.
4. Ресторан McDonald's — партнёр, а не сотрудник: принимает заказ на планшете и готовит.
5. Курьер-партнёр — независимый исполнитель: получает предложение, едет, забирает, доставляет, принимает наличные.
6. Платежи и расчёты Uber — списание, возврат, учёт наличных у курьера, начисление комиссии, выплаты курьеру и VAT.

Описание этапов.
1) Доступность. По геопозиции платформа определяет зону доставки и решает, принимает ли McDonald's заказы по этому адресу (закрыт, перегружен, вне зоны). Если нет — клиенту показываются альтернативы, заказ не создаётся.
2) Корзина и цена. Клиент выбирает позиции и модификаторы, применяется промокод или скидка Uber One (за счёт Uber), платформа считает итог: позиции, сбор за доставку, сервисный сбор, надбавку за малый заказ, динамику цены и VAT 5 %.
3) Адрес и оплата. Клиент вводит адрес вручную (пин, здание, этаж, квартира) и выбирает способ оплаты. Антифрод оценивает заказ; подозрительные уходят аналитику.
4) Платёж. Карта или Apple Pay — авторизация (холд суммы), при отказе клиент выбирает другой способ. Наличные — проверка лимита; при отказе клиент возвращается к выбору способа.
5) Передача ресторану. Заказ уходит на планшет ресторана. Платформа ждёт ответа: принял, отклонил или тишина в течение 3 минут (событийный шлюз). Если ресторан не принял, агент звонит в ресторан; если договориться не удалось, заказ отменяется, деньги возвращаются, клиент получает кредит.
6) Параллельно после принятия. Кухня собирает заказ; одновременно платформа подбирает курьера. Диспетчеризация запускается сразу при принятии, а не к моменту готовности, поэтому курьер часто приезжает раньше еды и ждёт. Если курьер не найден, радиус и бонус растут; если курьер отказался, предложение уходит следующему.
7) Выдача. Заказ готов и курьер на месте (параллельное слияние). Курьер называет код, сверяет пакеты, напитки и соусы по памяти и на глаз. Платформа фиксирует выдачу, строит маршрут и ETA, уведомляет клиента.
8) Доставка. Курьер едет к клиенту. Часть клиентов пишет «где мой заказ» — отвечает агент. В башне курьеру нужно найти вход, парковку, консьержа, этаж и квартиру. Если клиент не отвечает, курьер звонит и ждёт; если клиент так и не вышел, заказ считается недоставленным, оплата удерживается.
9) Вручение и оплата. Передача заказа, фото или PIN. При оплате наличными курьер принимает деньги и даёт сдачу, платформа учитывает наличные у курьера и удерживает из его выплаты; при карте — capture суммы.
10) Закрытие и начисления. Заказ закрывается, начисляются комиссия ресторана, выплата курьеру и VAT.
11) После доставки. Часть клиентов сообщает о проблеме (недовложение, не тот заказ, холодный, просрочка). Агент разбирает фото, состав, маршрут курьера и историю ресторана: полный возврат, частичный кредит или отказ. Затем клиент оценивает заказ, платформа обновляет рейтинги ресторана и курьера.

Слабые места, которые целевая схема адресует:
• Ручное принятие заказа на планшете: 10 % заказов не приняты сразу, и агент звонит в ресторан.
• Диспетчеризация при принятии, а не к готовности: курьер простаивает у стойки в среднем 4 минуты — это занятое время, оплаченное впустую.
• Ручной ввод адреса и поиск входа в башне: 3,5 минуты на поиск и 9 % недозвонов.
• Статичный ETA: 11 % клиентов пишут «где мой заказ».
• Сверка пакета на глаз: 6,5 % заказов заканчиваются жалобой, и каждую разбирает человек.
• Наличные у 26 % заказов: время на сдачу, учёт и риск у курьера.
• 6 % отказов карты возвращают клиента на шаг оплаты.

${contextBlock('ru')}`,
    en: `Ordering food from McDonald's in Dubai through the Uber Eats app - the as-is process, described from the platform's side (Uber, the company).

${dataNote('en')}

${conventionsBlock('en')}

Scope. It starts when the customer opens the app and ends when the order is delivered and closed, including accruals and the case handling if a problem arises. Scheduled payouts to the restaurant and the courier (weekly or instant) are a separate process; here they appear as the accrual per order.

Actors (lanes): the customer; the Uber Eats platform (automated steps: delivery zone, pricing, fraud, card authorisation, hand-off, dispatch, ETA, close); Uber support and fraud (people: manual review of suspicious orders, calls to the restaurant, "where is my order" replies, complaint handling); the McDonald's restaurant (a partner, not an employee: accepts the order on the tablet and cooks); the courier partner (an independent contractor: receives the offer, rides, collects, delivers, takes cash); and Uber payments and settlements (charge, refund, courier cash accounting, commission accrual, courier earnings and VAT).

Stages. 1) Availability: from the location the platform finds the delivery zone and decides whether McDonald's takes orders for this address; if not, alternatives are shown and no order is created. 2) Basket and price: items and modifiers, a promo or Uber One discount funded by Uber, then the total with items, delivery fee, service fee, small-order surcharge, dynamic pricing and 5% VAT. 3) Address and payment: the address is typed by hand (pin, building, floor, apartment) and the payment method chosen; fraud scoring sends suspicious orders to an analyst. 4) Payment: card or Apple Pay is authorised (a hold), on a decline the customer picks another method; cash passes a limit check and falls back to the same choice. 5) Hand-off to the restaurant: the order goes to the restaurant tablet and the platform waits for accepted, rejected or silence for 3 minutes (an event-based gateway); if the restaurant did not accept, an agent calls it, and if that fails the order is cancelled, the money returned and a credit issued. 6) After acceptance, in parallel: the kitchen assembles the order while the platform finds a courier; dispatch starts at acceptance, not at food-ready time, so the courier often arrives early and waits; if no courier is found the radius and bonus grow, and a declined offer goes to the next courier. 7) Pickup: the order is ready and the courier is there (a parallel join); the courier states the code and checks bags, drinks and sauces by eye; the platform records the pickup, builds the route and ETA and notifies the customer. 8) Delivery: the courier rides to the customer; some customers ask "where is my order" and an agent answers; in a tower the courier has to find the entrance, parking, concierge, floor and apartment; if the customer does not answer the courier calls and waits, and if the customer never comes out the order is a failed delivery with payment retained. 9) Hand-over and payment: hand-over with a photo or PIN; for cash the courier takes the money and gives change and the platform books the cash against the courier's earnings, for card the amount is captured. 10) Close and accruals: the order closes and the restaurant commission, the courier earnings and VAT are accrued. 11) After delivery: some customers report a problem (missing item, wrong order, cold food, lateness) and an agent reviews photo, contents, courier route and the restaurant's history: a full refund, a partial credit or a rejection; then the customer rates and the platform updates restaurant and courier ratings.

Weak spots the target diagram addresses: manual acceptance on the tablet (10% not accepted at once, then an agent phones the restaurant); dispatch at acceptance rather than at readiness (the courier idles at the counter for 4 minutes on average - occupied time paid for nothing); manual address entry and entrance search in a tower (3.5 minutes and 9% unreachable); a static ETA (11% ask where the order is); bag checks by eye (6.5% of orders end in a complaint, each handled by a person); cash on 26% of orders; and 6% card declines that send the customer back to the payment step.

${contextBlock('en')}`,
  },
  spec: {
    notation: 'bpmn',
    name: { ru: 'Заказ из McDonald\'s в Дубае — как есть', en: 'McDonald\'s order in Dubai — as is' },
    lanes: LANES,
    nodes: [
      /* 1. availability */
      node('start', 'startEvent', 'customer', 'Клиент открыл приложение Uber Eats в Дубае', 'Customer opens the Uber Eats app in Dubai'),
      node('zone', 'businessRuleTask', 'platform', 'Определить зону доставки по геопозиции и показать доступные рестораны', 'Resolve the delivery zone from the location and show available restaurants', auto(0.1, { cost: 0.03 })),
      node('gwOpen', 'exclusiveGateway', 'platform', 'McDonald\'s принимает заказы по этому адресу?', 'Does McDonald\'s take orders for this address?'),
      node('closed', 'serviceTask', 'platform', 'Показать «ресторан закрыт или перегружен» и предложить альтернативы', 'Show "restaurant closed or busy" and suggest alternatives', auto(0.1)),
      node('endClosed', 'endEvent', 'platform', 'Заказ не оформлен: McDonald\'s недоступен', 'No order: McDonald\'s unavailable'),

      /* 2. basket and price */
      node('browse', 'userTask', 'customer', 'Выбрать McDonald\'s, просмотреть меню и состав позиций', 'Pick McDonald\'s and browse the menu and item details', wait(2.5)),
      node('cart', 'userTask', 'customer', 'Собрать корзину, выбрать модификаторы, ввести промокод', 'Build the basket, choose modifiers, enter a promo code', wait(2)),
      node('promo', 'serviceTask', 'platform', 'Применить промокод и скидки Uber One (за счёт Uber)', 'Apply the promo code and Uber One discounts (funded by Uber)', auto(0.1, { cost: 4.2 })),
      node('price', 'businessRuleTask', 'platform', 'Рассчитать итог: позиции, доставка, сервисный сбор, малый заказ, динамика цены, VAT 5 %', 'Compute the total: items, delivery, service fee, small order, dynamic price, 5% VAT', auto(0.2, { cost: 0.05 })),

      /* 3. address, fraud */
      node('checkout', 'userTask', 'customer', 'Ввести адрес вручную (пин, здание, этаж, квартира) и выбрать способ оплаты', 'Type the address (pin, building, floor, apartment) and choose the payment method', wait(1.8)),
      node('fraud', 'businessRuleTask', 'platform', 'Антифрод-скоринг: устройство, история, адрес, состав заказа', 'Fraud scoring: device, history, address, basket', auto(0.2, { cost: 0.06 })),
      node('gwFraud', 'exclusiveGateway', 'platform', 'Заказ выглядит подозрительным?', 'Does the order look suspicious?'),
      node('review', 'userTask', 'support', 'Проверить заказ вручную: история клиента, адрес, состав', 'Review manually: customer history, address, basket', work(6, ROLE.fraud)),
      node('gwReview', 'exclusiveGateway', 'support', 'Заказ допустим?', 'Order acceptable?'),
      node('blocked', 'endErrorEvent', 'support', 'Заказ заблокирован антифродом', 'Order blocked by fraud control'),

      /* 4. payment */
      node('gwPay', 'exclusiveGateway', 'platform', 'Способ оплаты?', 'Payment method?'),
      node('card', 'serviceTask', 'platform', 'Авторизовать карту или Apple Pay (холд суммы)', 'Authorise the card or Apple Pay (hold the amount)', auto(0.3, { cost: 0.35 })),
      node('gwAuth', 'exclusiveGateway', 'platform', 'Авторизация прошла?', 'Authorisation approved?'),
      node('cod', 'businessRuleTask', 'platform', 'Проверить лимит наличных для клиента и района', 'Check the cash limit for the customer and area', auto(0.1)),
      node('gwCod', 'exclusiveGateway', 'platform', 'Наличные разрешены?', 'Cash allowed?'),
      node('payFail', 'userTask', 'customer', 'Выбрать другую карту или способ оплаты', 'Choose another card or payment method', wait(1.6)),
      node('gwPayJoin', 'exclusiveGateway', 'platform', 'Оплата обеспечена', 'Payment secured'),

      /* 5. hand-off to the restaurant */
      node('place', 'serviceTask', 'platform', 'Создать заказ и передать в McDonald\'s на планшет', 'Create the order and send it to the McDonald\'s tablet', auto(0.2, { cost: 0.04 })),
      node('gwResp', 'eventBasedGateway', 'platform', 'Ожидание ответа ресторана', 'Waiting for the restaurant\'s answer'),
      node('accepted', 'intermediateMessageCatchEvent', 'merchant', 'Ресторан принял заказ на планшете', 'Restaurant accepts on the tablet', wait(1.4)),
      node('rejected', 'intermediateMessageCatchEvent', 'merchant', 'Ресторан отклонил заказ', 'Restaurant rejects the order', wait(1)),
      node('timeout', 'intermediateTimerEvent', 'platform', 'Нет ответа 3 минуты', 'No answer for 3 minutes', wait(3)),
      node('callRest', 'userTask', 'support', 'Позвонить в ресторан: причина, наличие позиций, загрузка кухни', 'Call the restaurant: reason, item availability, kitchen load', work(5, ROLE.support)),
      node('gwCall', 'exclusiveGateway', 'support', 'Удалось договориться?', 'Resolved with the restaurant?'),
      node('cancel', 'serviceTask', 'platform', 'Отменить заказ, извиниться и выдать кредит клиенту', 'Cancel the order, apologise and give the customer a credit', auto(0.2, { cost: 3.2 })),
      node('refund', 'serviceTask', 'finance', 'Снять холд по карте', 'Release the card hold', auto(0.3)),
      node('endCancel', 'endEvent', 'platform', 'Заказ отменён: ресторан не принял', 'Order cancelled: restaurant did not accept'),
      node('gwAcceptJoin', 'exclusiveGateway', 'platform', 'Ресторан принял заказ', 'Restaurant has the order'),

      /* 6. kitchen and dispatch in parallel */
      node('pgSplit', 'parallelGateway', 'platform', 'Кухня и доставка запускаются параллельно', 'Kitchen and delivery start in parallel'),
      node('prepare', 'manualTask', 'merchant', 'Кухня собирает заказ: жарка, сборка, упаковка', 'The kitchen prepares the order: cook, assemble, pack', wait(13)),
      node('dispatch', 'businessRuleTask', 'platform', 'Диспетчеризация: подобрать курьера по расстоянию, загрузке и рейтингу', 'Dispatch: pick a courier by distance, load and rating', auto(0.4, { cost: 0.08 })),
      node('gwFound', 'exclusiveGateway', 'platform', 'Курьер найден?', 'Courier found?'),
      node('boost', 'serviceTask', 'platform', 'Расширить радиус поиска и поднять бонус за заказ', 'Widen the search radius and raise the order bonus', auto(0.2, { waitTime: 4, cost: 4.5 })),
      node('offer', 'userTask', 'courier', 'Курьер получает предложение и решает, принять ли', 'The courier gets the offer and decides', wait(0.7)),
      node('gwOffer', 'exclusiveGateway', 'courier', 'Курьер принял?', 'Courier accepted?'),
      node('redispatch', 'serviceTask', 'platform', 'Отметить отказ и передать предложение следующему курьеру', 'Record the decline and pass the offer to the next courier', auto(0.1)),
      node('toRest', 'manualTask', 'courier', 'Ехать к McDonald\'s (трафик, жара, ограничения RTA)', 'Ride to McDonald\'s (traffic, heat, RTA restrictions)', work(8, ROLE.courier)),
      node('idle', 'manualTask', 'courier', 'Ждать готовности заказа у стойки (простой)', 'Wait for the order at the counter (idle)', work(4, ROLE.courier)),
      node('pgJoin', 'parallelGateway', 'merchant', 'Заказ готов и курьер на месте', 'Order ready and courier present'),

      /* 7. pickup */
      node('verify', 'manualTask', 'courier', 'Забрать заказ: назвать код, сверить пакеты, напитки и соусы на глаз', 'Collect the order: state the code, check bags, drinks and sauces by eye', work(1.8, ROLE.courier)),
      node('picked', 'serviceTask', 'platform', 'Зафиксировать выдачу, построить маршрут, запустить ETA', 'Record the pickup, build the route, start the ETA', auto(0.15, { cost: 0.22 })),
      node('notifyTransit', 'sendTask', 'platform', 'Сообщить клиенту: заказ в пути, ориентировочное время', 'Tell the customer: on the way, estimated time', auto(0.1, { cost: 0.03 })),

      /* 8. delivery */
      node('gwWismo', 'exclusiveGateway', 'platform', 'Клиент спрашивает «где мой заказ»?', 'Does the customer ask "where is my order"?'),
      node('wismo', 'userTask', 'support', 'Ответить клиенту: положение курьера, причина задержки', 'Answer the customer: courier position, reason for the delay', work(3.2, ROLE.support)),
      node('gwWismoJoin', 'exclusiveGateway', 'platform', 'Доставка продолжается', 'Delivery continues'),
      node('toCust', 'manualTask', 'courier', 'Везти заказ клиенту (жара, пробки, парковка)', 'Carry the order to the customer (heat, traffic, parking)', work(14, ROLE.courier)),
      node('arrive', 'manualTask', 'courier', 'Найти вход: башня, парковка, консьерж, этаж и квартира', 'Find the entrance: tower, parking, concierge, floor and apartment', work(3.5, ROLE.courier)),
      node('gwReach', 'exclusiveGateway', 'courier', 'Клиент на связи и встречает?', 'Customer reachable and meeting the courier?'),
      node('callCust', 'userTask', 'courier', 'Позвонить клиенту и ждать у входа', 'Call the customer and wait at the entrance', work(3, ROLE.courier)),
      node('gwReach2', 'exclusiveGateway', 'courier', 'Клиент вышел?', 'Customer came out?'),
      node('noShow', 'serviceTask', 'platform', 'Зафиксировать неудачную доставку, удержать оплату, вернуть заказ', 'Record the failed delivery, retain payment, return the order', auto(0.3, { cost: 6 })),
      node('endNoShow', 'endEvent', 'platform', 'Заказ не вручён: клиент недоступен, оплата удержана', 'Not delivered: customer unreachable, payment retained'),

      /* 9. hand-over and payment */
      node('handoff', 'manualTask', 'courier', 'Передать заказ клиенту, сделать фото или проверить PIN', 'Hand the order over, take a photo or check the PIN', work(1.2, ROLE.courier)),
      node('gwCash', 'exclusiveGateway', 'courier', 'Оплата наличными?', 'Paid in cash?'),
      node('cash', 'manualTask', 'courier', 'Принять наличные, выдать сдачу, подтвердить в приложении', 'Take the cash, give change, confirm in the app', work(1.6, ROLE.courier)),
      node('cashSettle', 'serviceTask', 'finance', 'Учесть наличные у курьера и удержать из его выплаты', 'Book the cash against the courier\'s earnings', auto(0.3)),
      node('capture', 'serviceTask', 'finance', 'Списать сумму с карты (capture), комиссия эквайера', 'Capture the card amount, acquirer fee', auto(0.3, { cost: 2.15 })),
      node('gwPaid', 'exclusiveGateway', 'finance', 'Расчёт с клиентом завершён', 'Customer payment settled'),

      /* 10. close and accruals */
      node('complete', 'serviceTask', 'platform', 'Закрыть заказ: статус «доставлен», время и GPS', 'Close the order: "delivered", time and GPS', auto(0.2)),
      node('ledger', 'serviceTask', 'finance', 'Начислить комиссию ресторана, выплату курьеру и VAT 5 %', 'Accrue the restaurant commission, the courier earnings and 5% VAT', auto(0.5, { cost: 0.3 })),

      /* 11. after delivery */
      node('gwIssue', 'exclusiveGateway', 'platform', 'Клиент сообщил о проблеме с заказом?', 'Did the customer report a problem?'),
      node('issueChat', 'userTask', 'customer', 'Написать в чат: что не так, приложить фото', 'Write in the chat: what is wrong, attach a photo', wait(2.2)),
      node('issueReview', 'userTask', 'support', 'Разобрать обращение: фото, состав, маршрут курьера, история ресторана', 'Review the case: photo, basket, courier route, restaurant history', work(7.5, ROLE.support)),
      node('gwIssueType', 'exclusiveGateway', 'support', 'Решение по обращению?', 'Case decision?'),
      node('refundFull', 'serviceTask', 'finance', 'Вернуть полную сумму заказа', 'Refund the full order amount', auto(0.3, { cost: 62 })),
      node('refundPart', 'serviceTask', 'finance', 'Выдать частичный возврат или кредит', 'Give a partial refund or a credit', auto(0.3, { cost: 18 })),
      node('rejectIssue', 'sendTask', 'support', 'Отказать с объяснением', 'Decline with an explanation', work(2, ROLE.support)),
      node('gwIssueJoin', 'exclusiveGateway', 'support', 'Обращение закрыто', 'Case closed'),
      node('rate', 'userTask', 'customer', 'Оценить заказ и курьера', 'Rate the order and the courier', wait(0.8)),
      node('rating', 'serviceTask', 'platform', 'Обновить рейтинги ресторана и курьера', 'Update the restaurant and courier ratings', auto(0.1)),
      node('end', 'endEvent', 'platform', 'Заказ доставлен и закрыт', 'Order delivered and closed', { completes: true }),

      /* data and notes */
      node('orderData', 'dataObject', 'platform', 'Заказ и состояние: статусы, ETA, GPS', 'Order and its state: statuses, ETA, GPS'),
      node('riskData', 'dataStore', 'platform', 'Правила антифрода и профили клиентов', 'Fraud rules and customer profiles'),
      node('ledgerData', 'dataStore', 'finance', 'Книга расчётов: заказы, комиссии, выплаты, VAT', 'Settlement ledger: orders, commissions, payouts, VAT'),
      node('idleNote', 'textAnnotation', 'courier', 'Простой курьера оплачен впустую: он занят и не может взять другой заказ', 'The courier\'s idle time is paid for nothing: they are busy and cannot take another order'),
      node('addrNote', 'textAnnotation', 'courier', 'В Дубае адрес — пин + здание + этаж + квартира; код Makani помогает, но клиент вводит всё вручную', 'In Dubai an address is pin + building + floor + apartment; the Makani code helps but the customer types it all'),
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
      flow('checkout', 'fraud'),
      flow('fraud', 'gwFraud'),
      flow('gwFraud', 'gwPay', { share: 97, ru: 'нет', en: 'no' }),
      flow('gwFraud', 'review', { share: 3, ru: 'да', en: 'yes' }),
      flow('review', 'gwReview'),
      flow('gwReview', 'gwPay', { share: 55, ru: 'допустим', en: 'acceptable' }),
      flow('gwReview', 'blocked', { share: 45, ru: 'блок', en: 'block' }),
      flow('gwPay', 'card', { share: 72, ru: 'карта или Apple Pay', en: 'card or Apple Pay' }),
      flow('gwPay', 'cod', { share: 28, ru: 'наличные', en: 'cash' }),
      flow('card', 'gwAuth'),
      flow('gwAuth', 'gwPayJoin', { share: 94, ru: 'одобрено', en: 'approved' }),
      flow('gwAuth', 'payFail', { share: 6, ru: 'отказ', en: 'declined' }),
      flow('cod', 'gwCod'),
      flow('gwCod', 'gwPayJoin', { share: 92, ru: 'разрешены', en: 'allowed' }),
      flow('gwCod', 'payFail', { share: 8, ru: 'лимит', en: 'limit' }),
      flow('payFail', 'gwPay'),
      flow('gwPayJoin', 'place'),
      flow('place', 'gwResp'),
      flow('gwResp', 'accepted', { share: 90, ru: 'принял', en: 'accepted' }),
      flow('gwResp', 'rejected', { share: 4, ru: 'отклонил', en: 'rejected' }),
      flow('gwResp', 'timeout', { share: 6, ru: 'тишина', en: 'silence' }),
      flow('accepted', 'gwAcceptJoin'),
      flow('rejected', 'callRest'),
      flow('timeout', 'callRest'),
      flow('callRest', 'gwCall'),
      flow('gwCall', 'gwAcceptJoin', { share: 35, ru: 'принял или замена', en: 'accepted or substituted' }),
      flow('gwCall', 'cancel', { share: 65, ru: 'не вышло', en: 'failed' }),
      flow('cancel', 'refund'),
      flow('refund', 'endCancel'),
      flow('gwAcceptJoin', 'pgSplit'),
      flow('pgSplit', 'prepare'),
      flow('pgSplit', 'dispatch'),
      flow('prepare', 'pgJoin'),
      flow('dispatch', 'gwFound'),
      flow('gwFound', 'offer', { share: 95, ru: 'найден', en: 'found' }),
      flow('gwFound', 'boost', { share: 5, ru: 'нет свободных', en: 'none free' }),
      flow('boost', 'dispatch'),
      flow('offer', 'gwOffer'),
      flow('gwOffer', 'toRest', { share: 78, ru: 'принял', en: 'accepted' }),
      flow('gwOffer', 'redispatch', { share: 22, ru: 'отказ или тишина', en: 'declined or silent' }),
      flow('redispatch', 'dispatch'),
      flow('toRest', 'idle'),
      flow('idle', 'pgJoin'),
      flow('pgJoin', 'verify'),
      flow('verify', 'picked'),
      flow('picked', 'notifyTransit'),
      flow('notifyTransit', 'gwWismo'),
      flow('gwWismo', 'wismo', { share: 11, ru: 'спрашивает', en: 'asks' }),
      flow('gwWismo', 'gwWismoJoin', { share: 89, ru: 'нет', en: 'no' }),
      flow('wismo', 'gwWismoJoin'),
      flow('gwWismoJoin', 'toCust'),
      flow('toCust', 'arrive'),
      flow('arrive', 'gwReach'),
      flow('gwReach', 'handoff', { share: 91, ru: 'встречает', en: 'meets' }),
      flow('gwReach', 'callCust', { share: 9, ru: 'не отвечает', en: 'no answer' }),
      flow('callCust', 'gwReach2'),
      flow('gwReach2', 'handoff', { share: 70, ru: 'вышел', en: 'came out' }),
      flow('gwReach2', 'noShow', { share: 30, ru: 'не вышел', en: 'did not' }),
      flow('noShow', 'endNoShow'),
      flow('handoff', 'gwCash'),
      flow('gwCash', 'cash', { share: 26, ru: 'наличные', en: 'cash' }),
      flow('gwCash', 'capture', { share: 74, ru: 'карта', en: 'card' }),
      flow('cash', 'cashSettle'),
      flow('cashSettle', 'gwPaid'),
      flow('capture', 'gwPaid'),
      flow('gwPaid', 'complete'),
      flow('complete', 'ledger'),
      flow('ledger', 'gwIssue'),
      flow('gwIssue', 'rate', { share: 93.5, ru: 'нет', en: 'no' }),
      flow('gwIssue', 'issueChat', { share: 6.5, ru: 'есть проблема', en: 'problem' }),
      flow('issueChat', 'issueReview'),
      flow('issueReview', 'gwIssueType'),
      flow('gwIssueType', 'refundFull', { share: 38, ru: 'полный возврат', en: 'full refund' }),
      flow('gwIssueType', 'refundPart', { share: 42, ru: 'частичный кредит', en: 'partial credit' }),
      flow('gwIssueType', 'rejectIssue', { share: 20, ru: 'отказ', en: 'decline' }),
      flow('refundFull', 'gwIssueJoin'),
      flow('refundPart', 'gwIssueJoin'),
      flow('rejectIssue', 'gwIssueJoin'),
      flow('gwIssueJoin', 'rate'),
      flow('rate', 'rating'),
      flow('rating', 'end'),
      { source: 'place', target: 'orderData', type: 'dataAssociation' },
      { source: 'fraud', target: 'riskData', type: 'dataAssociation' },
      { source: 'ledger', target: 'ledgerData', type: 'dataAssociation' },
      { source: 'idle', target: 'idleNote', type: 'association' },
      { source: 'arrive', target: 'addrNote', type: 'association' },
    ],
  },
};
