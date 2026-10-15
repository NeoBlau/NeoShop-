/**
 * Customer journey of a WEG buyer, as is and to be.
 *
 * The buyer is an industrial customer - a purchasing or maintenance engineer
 * - who selects, orders, receives, pays for, runs and services standard
 * motors. The path follows the processes of the library: order to cash (1)
 * covers the stages from the order to the payment, service and repair (6) the
 * stages after delivery. Selection, quotation and operation are not modelled
 * in the library and say so.
 *
 * What is in a cell:
 *  - customer rows (goal, actions, touchpoints, doubts, pain) are hypotheses
 *    from the logic of the processes, not interviews;
 *  - the internal-process row and the metric row quote the models: durations
 *    and shares are read from the specifications and the analysis, so they
 *    cannot drift from the diagrams;
 *  - the emotion curve (−2 … +2) is an expert judgement.
 */
import { WEG_AS_IS, WEG_TO_BE } from '../index.js';
import { JOURNEY_ROWS } from '../../../notations/sheet/templates.js';
import { analyse, flowShare, stepLoad, stepRow } from './engine.js';

const asisOf = (id) => WEG_AS_IS.find((process) => process.id === id);
const tobeOf = (id) => WEG_TO_BE.find((process) => process.id === id);

export const JOURNEY_STAGES = [
  { ru: 'Потребность и подбор', en: 'Need and selection' },
  { ru: 'Запрос и предложение', en: 'Enquiry and quotation' },
  { ru: 'Заказ и проверка кредита', en: 'Order and credit check' },
  { ru: 'Ожидание и отгрузка', en: 'Waiting and shipment' },
  { ru: 'Получение и монтаж', en: 'Receipt and installation' },
  { ru: 'Оплата', en: 'Payment' },
  { ru: 'Эксплуатация', en: 'Operation' },
  { ru: 'Сервис и ремонт', en: 'Service and repair' },
  { ru: 'Повторный заказ', en: 'Reorder' },
];

/** Emotion by stage, −2 … +2: an expert judgement, flagged on the sheet. */
export const EMOTIONS = {
  'as-is': [0, -1, -1, -2, 1, 0, 1, -2, 0],
  'to-be': [1, 1, 1, 1, 1, 0, 1, 0, 1],
};

const GOALS = [
  { ru: 'Подобрать двигатель под нагрузку, КПД и условия площадки.', en: 'Find a motor that fits the load, efficiency class and site conditions.' },
  { ru: 'Получить цену, срок и условия, которые можно сравнить с другими поставщиками.', en: 'Get a price, lead time and terms that can be compared with other suppliers.' },
  { ru: 'Оформить заказ без ошибок и быстро получить подтверждение.', en: 'Place the order without errors and get a quick confirmation.' },
  { ru: 'Получить товар к обещанному сроку и знать, где он.', en: 'Receive the goods by the promised date and know where they are.' },
  { ru: 'Принять поставку без расхождений и быстро запустить оборудование.', en: 'Accept the delivery without discrepancies and put the equipment into service quickly.' },
  { ru: 'Заплатить в удобный срок и без споров по счёту.', en: 'Pay at a convenient time and without disputes over the invoice.' },
  { ru: 'Чтобы двигатель работал без остановок и с ожидаемым КПД.', en: 'Keep the motor running without stoppages and at the expected efficiency.' },
  { ru: 'Вернуть оборудование в работу быстро и с понятной стоимостью.', en: 'Get the equipment back to work quickly and at a clear cost.' },
  { ru: 'Купить то же самое снова без лишних согласований или заменить на лучшее.', en: 'Buy the same again without extra approvals, or replace it with something better.' },
];

/** `{ru, en}` shorthand. */
const t = (ru, en) => ({ ru, en });

/* ------------------------------------------------------------ AS-IS rows */

const AS_IS = {
  actions: [
    t('Листает каталог и листы данных, сверяет мощность, КПД и исполнение, уточняет у менеджера или дистрибьютора.', 'Browses the catalogue and data sheets, checks power, efficiency class and enclosure, then asks a salesperson or distributor.'),
    t('Отправляет запрос письмом или через дистрибьютора, ждёт коммерческое предложение и сравнивает его с конкурентами.', 'Sends an enquiry by e-mail or through a distributor, waits for the quotation and compares it with competitors.'),
    t('Присылает заказ письмом или таблицей, отвечает на вопросы по артикулам и условиям; при нехватке лимита вносит предоплату.', 'Sends the order as a letter or a spreadsheet, answers questions on part numbers and terms; prepays when the credit limit is short.'),
    t('Ждёт, звонит или пишет, чтобы узнать статус, планирует приёмку на своём складе.', 'Waits, calls or writes to ask for the status, plans receiving at their own warehouse.'),
    t('Принимает груз, сверяет с накладной и заказом, монтирует двигатель; при расхождении пишет менеджеру.', 'Receives the load, checks it against the delivery note and the order, installs the motor; writes to the salesperson on a discrepancy.'),
    t('Получает счёт и NF-e, платит через 30 дней по договору; при ошибке в счёте согласует исправление.', 'Receives the invoice and the NF-e, pays after 30 days under the contract; agrees a correction if the invoice is wrong.'),
    t('Эксплуатирует по регламенту, ремонтная служба обходит оборудование; о проблеме узнаёт после отказа.', 'Runs it by the schedule, the maintenance crew walks the plant; learns of a problem after a failure.'),
    t('Звонит в сервис, ждёт диагностику, согласует смету, ждёт вывоз двигателя и его возврат.', 'Phones the service desk, waits for the diagnosis, approves the quotation, waits for the motor to be collected and returned.'),
    t('Повторяет заказ по старому письму, запрашивает цену заново, сравнивает с другими поставщиками.', 'Repeats the order from an old e-mail, asks for the price again, compares with other suppliers.'),
  ],
  touch: [
    t('Сайт и каталог, телефон менеджера, дистрибьютор.', 'Website and catalogue, the salesperson’s phone, the distributor.'),
    t('Электронная почта, телефон, дистрибьютор.', 'E-mail, phone, the distributor.'),
    t('Почта, телефон отдела заказов, письмо с просьбой о предоплате.', 'E-mail, the order desk’s phone, a letter asking for prepayment.'),
    t('Звонок в отдел заказов, уведомление об отгрузке по почте, перевозчик.', 'A call to the order desk, a shipping notice by e-mail, the carrier.'),
    t('Накладная и NF-e, шильдик на двигателе, бумажная инструкция.', 'Delivery note and NF-e, the nameplate, a printed manual.'),
    t('Счёт и NF-e по почте, финансовый отдел поставщика.', 'Invoice and NF-e by e-mail, the supplier’s finance department.'),
    t('Регламент ТО клиента, руководство по эксплуатации, сервис по звонку.', 'The customer’s maintenance schedule, the operating manual, service on request.'),
    t('Телефон сервиса, партнёр из сети ASTEC, письмо со сметой.', 'The service phone, an ASTEC partner, a quotation by e-mail.'),
    t('Старая переписка, менеджер по продажам, запрос оценки сервиса.', 'Old correspondence, the salesperson, a service rating request.'),
  ],
  doubts: [
    t('Подойдёт ли этот типоразмер? Есть ли он в наличии? Кого спросить, если нужного исполнения нет в каталоге?', 'Will this frame size do? Is it in stock? Whom to ask if the execution is not in the catalogue?'),
    t('Цена актуальна? Сохранится ли скидка за объём? Почему срок «уточняется»?', 'Is the price current? Will the volume discount hold? Why is the lead time “to be confirmed”?'),
    t('Принят ли заказ? Нет ли ошибки в артикуле? Почему просят предоплату, мы давно работаем?', 'Was the order accepted? Is the part number right? Why prepay when we have worked together for years?'),
    t('Когда отгрузят? Почему «в производстве», если в каталоге было «в наличии»?', 'When will it ship? Why “in production” if the catalogue said “in stock”?'),
    t('Всё ли привезли? Где протокол испытаний этого двигателя?', 'Is everything here? Where are the test records of this motor?'),
    t('Совпадает ли счёт с заказом? Что будет при просрочке?', 'Does the invoice match the order? What happens if we are late?'),
    t('Сколько ещё прослужит подшипник? Не пора ли менять?', 'How long will the bearing last? Is it time to replace it?'),
    t('Это гарантийный случай? Сколько стоит ремонт? Сколько простоит линия?', 'Is this a warranty case? How much will the repair cost? How long will the line stand?'),
    t('Остались ли прежние условия? Не попробовать ли другого поставщика?', 'Are the old terms still valid? Should we try another supplier?'),
  ],
  pain: [
    t('Наличие и срок в каталоге не видны, узнаёт только после запроса; ответ ждёт, пока менеджер освободится.', 'Stock and lead time are not visible in the catalogue, only after an enquiry; the answer waits until the salesperson is free.'),
    t('Предложение приходит через часы или дни, цену и срок приходится подтверждать повторно.', 'The quotation arrives hours or days later; price and lead time have to be confirmed again.'),
    t('Ошибки в артикулах находят после отправки; запрос предоплаты задерживает ≈ {prepay} заказов на 2 дня.', 'Part-number errors surface after sending; a prepayment request holds ≈ {prepay} of orders for 2 days.'),
    t('Для ≈ {offstock} заказов склада нет, партия ждёт плана производства до 9 дней; статус клиент узнаёт, только позвонив.', 'For ≈ {offstock} of orders there is no stock; the batch waits up to 9 days for the production plan; the customer learns the status only by calling.'),
    t('Протокол испытаний и сертификаты запрашивают отдельно; расхождения по комплектности решаются письмами.', 'Test records and certificates are requested separately; shortages are settled by letters.'),
    t('У ≈ {dunning} заказов бывают напоминания и звонки по просрочке; сроки платежа оспариваются.', 'About {dunning} of orders get reminders and calls about late payment; payment dates are disputed.'),
    t('Об отказе узнаёт, когда оборудование уже стоит; остановки на ТО назначаются по календарю, а не по состоянию.', 'Learns of a failure when the equipment already stands; maintenance stops follow the calendar, not the condition.'),
    t('Диагностика по звонку закрывает {remote} случаев; остальным вывоз (2 дня), согласование сметы (3 дня), запчасти (4 дня).', 'A call-in diagnosis closes {remote} of cases; the rest wait for collection (2 days), quotation approval (3 days) and parts (4 days).'),
    t('Всё нужно подтверждать заново; история обслуживания у WEG и у клиента не совпадает.', 'Everything has to be confirmed again; the service history at WEG and at the customer does not match.'),
  ],
  inside: [
    t('Менеджер подбирает вручную и консультируется с инженером; данные о складе в ERP, клиенту не открыты.', 'A salesperson selects by hand and consults an engineer; stock data sits in ERP, closed to the customer.'),
    t('Менеджер собирает цену из прайса и условий вручную; запросы не из каталога уходят инженеру ({eto} заказов).', 'A salesperson builds the price from the list and terms by hand; enquiries outside the catalogue go to an engineer ({eto} of orders).'),
    t('Менеджер регистрирует заказ в ERP (4 мин) и проверяет артикулы (12 мин), аналитик проверяет кредитный лимит (8 мин).', 'A salesperson registers the order in ERP (4 min) and checks part numbers (12 min); an analyst checks the credit limit (8 min).'),
    t('Подбор, упаковка, NF-e, передача перевозчику, уведомление и счёт делаются вручную: {shipWork} работы на заказ.', 'Picking, packing, the NF-e, the carrier handover, the notice and the invoice are done by hand: {shipWork} of work per order.'),
    t('В модели нет шага, который фиксирует, где установлен каждый двигатель.', 'The model has no step that records where each motor is installed.'),
    t('Дебиторка заводится вручную, платёж разносится вручную; взыскание ручное ({dunning} заказов).', 'The receivable is posted by hand, the payment is applied by hand; collections are manual ({dunning} of orders).'),
    t('Обращение начинается со звонка клиента; состояние установленных двигателей WEG не видит.', 'A case starts with the customer’s call; WEG does not see the state of installed motors.'),
    t('Техник регистрирует обращение (8 мин), диагностирует по данным привода (35 мин), определяет гарантию вручную (15 мин).', 'A technician logs the case (8 min), diagnoses from drive data (35 min), determines the warranty by hand (15 min).'),
    t('История заказов и обращений лежит в разных системах; отчёт и запрос оценки оформляются вручную (30 + 6 мин).', 'Order and case history sits in different systems; the report and the rating request are done by hand (30 + 6 min).'),
  ],
  ideas: [
    t('Открыть клиенту наличие и срок прямо в каталоге.', 'Show the customer stock and lead time right in the catalogue.'),
    t('Показывать цену по договору сразу после входа.', 'Show the contract price right after login.'),
    t('Принимать структурированный заказ из портала и по EDI, проверять строки правилами.', 'Accept a structured order from a portal and via EDI, check the lines by rules.'),
    t('Показывать статус и трек-номер без звонка; планировать склад по спросу портала.', 'Show the status and tracking number without a call; plan stock from portal demand.'),
    t('Прикладывать протокол испытаний к отгрузке автоматически.', 'Attach the test record to the shipment automatically.'),
    t('Предложить выбор срока оплаты и показать цену каждого варианта.', 'Offer a choice of payment term and show the price of each option.'),
    t('Предложить датчики и подписку на мониторинг.', 'Offer sensors and a monitoring subscription.'),
    t('Телеметрия для удалённой диагностики, запчасти на региональном складе, смета в портале.', 'Telemetry for remote diagnosis, parts on a regional shelf, the quotation in the portal.'),
    t('Связать историю заказов и обращений в одну карточку клиента.', 'Tie order and case history into one customer record.'),
  ],
};

/* ------------------------------------------------------------ TO-BE rows */

const TO_BE = {
  actions: [
    t('Вводит нагрузку и условия в подборщик на портале, видит подходящие двигатели, наличие на складе и срок.', 'Enters the load and conditions in a selector on the portal and sees the matching motors, stock and delivery date.'),
    t('Видит цену по своему договору и срок прямо в корзине портала; нестандартное запрашивает кнопкой.', 'Sees the price under their own contract and the date in the portal basket; asks for anything non-standard with a button.'),
    t('Загружает заказ на портале или по EDI, система сразу показывает ошибки в строках и дату отгрузки.', 'Uploads the order on the portal or via EDI; the system shows line errors and the shipping date at once.'),
    t('Следит за статусом в портале, получает трек-номер при передаче перевозчику.', 'Follows the status in the portal and gets the tracking number when the carrier takes over.'),
    t('Сканирует груз по уведомлению об отгрузке, открывает цифровой паспорт двигателя в портале, монтирует.', 'Scans the load against the despatch notice, opens the motor’s digital passport in the portal, installs.'),
    t('Выбирает срок: 30 дней или 7 дней со скидкой 1,5 %; платит по ссылке в портале.', 'Chooses the term: 30 days, or 7 days at a 1.5% discount; pays through a link in the portal.'),
    t('Подключает мониторинг вибрации, температуры и тока, получает оповещение об отклонении до отказа.', 'Connects monitoring of vibration, temperature and current and is alerted to a deviation before a failure.'),
    t('Получает диагноз по телеметрии, одобряет смету в портале, согласует окно остановки для вывоза.', 'Gets the diagnosis from telemetry, approves the quotation in the portal, agrees a shutdown window for collection.'),
    t('Повторяет заказ из истории портала одним нажатием, получает предложение заменить модель на более эффективную.', 'Repeats the order from the portal history in one click and gets an offer to swap to a more efficient model.'),
  ],
  touch: [
    t('Портал с подборщиком; чат с инженером для нестандартного случая.', 'A portal with a selector; a chat with an engineer for a non-standard case.'),
    t('Портал: личные цены и рамочный договор, уведомления.', 'The portal: personal prices and the framework agreement, notifications.'),
    t('Портал и EDI, автоматическое подтверждение, звонок только при исключении.', 'Portal and EDI, automatic confirmation, a call only on an exception.'),
    t('Портал со статусами, push-уведомление, сайт перевозчика.', 'Portal with statuses, a push notification, the carrier’s site.'),
    t('QR-код на шильдике ведёт к цифровому паспорту, уведомление об отгрузке.', 'A QR code on the nameplate opens the digital passport, the despatch notice.'),
    t('Портал: счета, выбор срока оплаты, напоминания.', 'The portal: invoices, choice of payment term, reminders.'),
    t('Система мониторинга, оповещения, портал сервиса.', 'The monitoring system, alerts, the service portal.'),
    t('Портал сервиса, смета в личном кабинете, партнёр ASTEC.', 'The service portal, the quotation in the customer account, an ASTEC partner.'),
    t('Портал: история заказов; оценка сервиса одним касанием; письма менеджера.', 'The portal: order history; a one-tap service rating; the salesperson’s e-mails.'),
  ],
  doubts: [
    t('Достаточен ли запас по мощности? Что делать с нестандартным исполнением? (портал передаёт такой запрос инженеру)', 'Is the power margin enough? What about a non-standard execution? (the portal passes such a request to an engineer)'),
    t('Можно ли получить ещё скидку за раннюю оплату? Что входит в цену?', 'Can I get a further discount for paying early? What does the price include?'),
    t('Почему строку отклонили? (портал называет причину)', 'Why was a line rejected? (the portal gives the reason)'),
    t('Не сдвинется ли дата? (портал показывает причину и новую дату)', 'Will the date slip? (the portal shows the reason and the new date)'),
    t('Подходит ли двигатель к приводу? (паспорт показывает параметры и протокол)', 'Does the motor suit the drive? (the passport shows the parameters and the record)'),
    t('Выгодна ли скидка 1,5 % по сравнению с нашей стоимостью денег?', 'Is a 1.5% discount worth it against our cost of money?'),
    t('Правильно ли система оценивает остаточный ресурс?', 'Does the system judge the remaining life correctly?'),
    t('Можно ли обойтись без вывоза? Когда лучше остановить линию?', 'Can we avoid collection? When is the best time to stop the line?'),
    t('Окупится ли замена на двигатель более высокого класса КПД?', 'Will switching to a higher efficiency class pay back?'),
  ],
  pain: [
    t('Нестандартное исполнение подборщик всё равно передаёт инженеру ({eto} заказов в модели).', 'The selector still hands a non-standard execution to an engineer ({eto} of orders in the model).'),
    t('Скидки сверх каталога по-прежнему согласуются вручную.', 'Discounts beyond the catalogue are still approved by hand.'),
    t('У {fix} заказов есть строки, которые нужно уточнить; {review} заказов ждут ручной проверки лимита.', '{fix} of orders have lines to clear with the customer; {review} of orders wait for a manual limit review.'),
    t('Для ≈ {offstock} заказов склада всё равно нет: ожидание партии сокращено до 3 дней.', 'For ≈ {offstock} of orders there is still no stock: the batch wait is cut to 3 days.'),
    t('Паспорт полезен, только если клиент им пользуется; монтаж остаётся на стороне клиента.', 'The passport helps only if the customer uses it; installation remains the customer’s job.'),
    t('Не каждому клиенту ранняя оплата выгодна; для остальных срок прежний, 30 дней.', 'Early payment does not suit every customer; for the others the term is unchanged, 30 days.'),
    t('Мониторинг нужно подключить и обслуживать; ложные тревоги подрывают доверие.', 'Monitoring has to be connected and maintained; false alarms erode trust.'),
    t('До физического ремонта всё равно доходит {repair} случаев; запчасти по прогнозу не всегда совпадают с фактом.', 'A physical repair is still needed in {repair} of cases; parts staged by forecast do not always match the fact.'),
    t('Рекомендации должны быть точными, иначе выглядят навязчивыми.', 'Recommendations must be accurate or they look pushy.'),
  ],
  inside: [
    t('Каталог, цены и склад доступны из портала; подбор идёт по правилам, человек подключается к исключениям.', 'Catalogue, prices and stock are reachable from the portal; selection runs by rules and a person joins for exceptions.'),
    t('Цена и условия берутся из каталога по правилам; вручную согласуются только скидки сверх лимита.', 'Price and terms come from the catalogue by rules; only discounts above the limit are approved by hand.'),
    t('Автоматическая проверка строк (0,5 мин) и скоринг по правилам (0,3 мин); люди разбирают только исключения.', 'Automatic line check (0.5 min) and rule-based scoring (0.3 min); people handle only exceptions.'),
    t('Маршрут на автоматизированном складе, NF-e и уведомление формируются сами: {shipWork} работы на заказ.', 'A route on the automated warehouse, the NF-e and the notice generate themselves: {shipWork} of work per order.'),
    t('Цифровой паспорт двигателя (протоколы испытаний, серийный номер) создаётся при выпуске: в модели производства такой шаг есть.', 'The motor’s digital passport (test records, serial number) is created at release: the manufacturing model has this step.'),
    t('Счёт и дебиторка формируются сами, платёж разносится автоматически, напоминания уходят по правилам.', 'The invoice and receivable generate themselves, the payment is applied automatically, reminders go out by rules.'),
    t('В модели {monitor} обращений открывает сама система мониторинга по отклонению вибрации, температуры и тока (допущение).', 'In the model {monitor} of cases are opened by the monitoring system itself on a deviation in vibration, temperature or current (an assumption).'),
    t('Телеметрия уже есть: диагностика 18 мин, {remote} случаев закрываются удалённо; гарантия по цифровому паспорту за 0,4 мин.', 'Telemetry is already there: diagnosis 18 min, {remote} of cases close remotely; warranty from the digital passport in 0.4 min.'),
    t('Цифровой паспорт и история связаны; отчёт и запрос оценки формируются сами (≈ 1 мин).', 'The digital passport and the history are linked; the report and the rating request generate themselves (≈ 1 min).'),
  ],
  ideas: [
    t('Предлагать модель с более высоким КПД и расчётом окупаемости по тарифу на электроэнергию.', 'Suggest a higher-efficiency model with a payback calculation at the power tariff.'),
    t('Цены, зависящие от годовой потребности клиента.', 'Prices tied to the customer’s annual need.'),
    t('Подсказывать повторяющиеся заказы одним нажатием.', 'Suggest recurring orders in one tap.'),
    t('Прогноз прибытия, уточняемый по данным перевозчика.', 'An arrival forecast refined with the carrier’s data.'),
    t('Мастер подключения в портале для типовых приводов.', 'A set-up wizard in the portal for typical drives.'),
    t('Скидка, зависящая от дня оплаты.', 'A discount that depends on the payment day.'),
    t('Прогноз остаточного ресурса в портале вместе с планом запчастей.', 'A remaining-life forecast in the portal together with a spare-parts plan.'),
    t('Резервный двигатель на время ремонта по подписке.', 'A loan motor for the repair period, by subscription.'),
    t('Предложение замены по фактической загрузке двигателя из мониторинга.', 'A replacement offer based on the motor’s actual load from monitoring.'),
  ],
};

/* ----------------------------------------------------------- the numbers */

/** Durations in minutes, hours or working days - never months, so a path reads in one unit. */
function span(minutes, locale) {
  const ru = locale === 'ru';
  const value = Math.abs(minutes);
  const round = (x) => (Math.round(x * 10) / 10).toString().replace('.', ru ? ',' : '.');
  if (value < 60) return `${round(minutes)} ${ru ? 'мин' : 'min'}`;
  if (value < 480) return `${round(minutes / 60)} ${ru ? 'ч' : 'h'}`;
  return `${round(minutes / 480)} ${ru ? 'раб. дн.' : 'working days'}`;
}

const pctOf = (value) => `${Math.round(value)} %`;

function figures(variant) {
  const o2c = variant === 'as-is' ? asisOf('weg-o2c') : tobeOf('weg-o2c-tobe');
  const svc = variant === 'as-is' ? asisOf('weg-service') : tobeOf('weg-service-tobe');
  const run = (process, id) => stepRow(process, id).runs;
  const handling = ['pick', 'pack', 'nfe', 'ship', 'notify', 'invoice'];
  const shipWork = stepLoad(o2c, handling).work;
  const values = {
    o2c,
    svc,
    offstock: pctOf(100 - flowShare(o2c, 'gwStock', 'pick')),
    eto: pctOf(flowShare(o2c, 'gwStd', 'toEto')),
    remote: pctOf(flowShare(svc, 'gwRemote', 'closeRemote')),
    repair: pctOf(run(svc, 'inspect') * 100),
    shipWork: { ru: span(shipWork, 'ru'), en: span(shipWork, 'en') },
  };
  if (variant === 'as-is') {
    values.prepay = pctOf(run(o2c, 'prepay') * 100);
    values.dunning = pctOf(100 - flowShare(o2c, 'gwCash', 'close'));
  } else {
    values.fix = pctOf(flowShare(o2c, 'gwValid', 'fix'));
    values.review = pctOf(flowShare(o2c, 'gwScore', 'review'));
    values.monitor = pctOf(flowShare(svc, 'gwSource', 'predict'));
  }
  return values;
}

function fill(text, values, locale) {
  return text.replace(/\{(\w+)\}/g, (match, key) => {
    const value = values[key];
    if (value === undefined) return match;
    return typeof value === 'object' ? value[locale] : value;
  });
}

/** The metric row: numbers from the order-to-cash and service models. */
function metrics(variant) {
  const f = figures(variant);
  const asis = variant === 'as-is';
  const o2c = f.o2c;
  const svc = f.svc;
  const ru = (value) => span(value, 'ru');
  const en = (value) => span(value, 'en');

  const confirmId = asis ? 'reserve' : 'atp';
  const work = stepLoad(o2c, asis ? ['register', 'check', 'credit', 'prepay'] : ['validate', 'fix', 'score', 'review']).work;
  const confirm = stepRow(o2c, confirmId).finish;
  const handover = stepRow(o2c, 'ship').finish;
  const cash = stepRow(o2c, 'close').finish;
  const done = analyse(o2c).done;
  const svcLead = analyse(svc).lead;
  const svcRepair = f.repair;

  const unmodelled = t(
    'Вне моделей библиотеки WEG: измеряется отдельно (время подбора, доля запросов без ответа).',
    'Outside the WEG library models: measure it separately (selection time, share of unanswered enquiries).'
  );
  return [
    unmodelled,
    t('Вне моделей: модель начинается с заказа. Мерьте время от запроса до предложения.', 'Outside the models: the model starts at the order. Measure the time from enquiry to quotation.'),
    { ru: `Подтверждение через ${ru(confirm)}; работа людей на заказ ${ru(work)}.`, en: `Confirmed after ${en(confirm)}; people’s work per order ${en(work)}.` },
    { ru: `Передача перевозчику через ${ru(handover)} после заказа; со склада ${pctOf(flowShare(o2c, 'gwStock', 'pick'))}.`, en: `Handed to the carrier ${en(handover)} after the order; ${pctOf(flowShare(o2c, 'gwStock', 'pick'))} from stock.` },
    t('Вне моделей: мерьте долю поставок без расхождений и время запуска.', 'Outside the models: measure the share of deliveries without discrepancies and the start-up time.'),
    { ru: `Деньги через ${ru(cash)} после заказа; до оплаты доходит ${pctOf(done * 100)} заказов.`, en: `Cash ${en(cash)} after the order; ${pctOf(done * 100)} of orders reach payment.` },
    asis
      ? t('Обращений от мониторинга: 0 (в модели обращение начинается с клиента).', 'Cases opened by monitoring: 0 (in the model a case starts with the customer).')
      : { ru: `Обращений от мониторинга: ${f.monitor} (допущение модели).`, en: `Cases opened by monitoring: ${f.monitor} (a model assumption).` },
    { ru: `Срок обращения ${ru(svcLead)}; до физического ремонта доходит ${svcRepair}.`, en: `Case lead time ${en(svcLead)}; ${svcRepair} reach a physical repair.` },
    t('Вне моделей: мерьте долю повторных заказов и NPS.', 'Outside the models: measure the reorder share and NPS.'),
  ];
}

const ROW_HEIGHT = { goal: 92, actions: 138, touch: 100, doubts: 126, emotion: 160, pain: 138, inside: 152, metric: 112, ideas: 112 };

/**
 * Specification of one journey sheet, ready for `buildSheetDiagrams`.
 * `variant` is 'as-is' or 'to-be'.
 */
export function journeySpec(variant, locale = 'ru') {
  const asis = variant === 'as-is';
  const values = figures(variant);
  const rows = asis ? AS_IS : TO_BE;
  const cell = (entry, tone) => ({ ...entry, tone });
  const filled = (list, tone) => list.map((entry) => cell({ ru: fill(entry.ru, values, 'ru'), en: fill(entry.en, values, 'en') }, tone));

  const titleRu = asis ? 'Путь покупателя WEG — как есть (AS-IS)' : 'Путь покупателя WEG — как будет (TO-BE)';
  const titleEn = asis ? 'WEG customer journey — as is (AS-IS)' : 'WEG customer journey — to be (TO-BE)';
  return {
    notation: 'sheet',
    kind: 'journey',
    name: { ru: titleRu, en: titleEn },
    title: { ru: titleRu, en: titleEn },
    kicker: {
      ru: 'Покупатель — промышленный заказчик серийных двигателей · гипотеза по логике процессов, не опрос клиентов · эмоции −2 … +2 — экспертная оценка',
      en: 'The buyer is an industrial customer of standard motors · a hypothesis from the logic of the processes, not a customer survey · emotions −2 … +2 are a judgement',
    },
    description: {
      ru: asis
        ? 'Девять этапов пути покупателя серийного двигателя WEG сегодня: что делает клиент, где болит и что происходит внутри компании.'
        : 'Девять этапов пути покупателя серийного двигателя WEG после изменений: что делает клиент, что остаётся неудобным и что происходит внутри.',
      en: asis
        ? 'The nine stages of a standard-motor buyer’s path at WEG today: what the customer does, where it hurts and what happens inside the company.'
        : 'The nine stages of a standard-motor buyer’s path at WEG after the changes: what the customer does, what stays inconvenient and what happens inside.',
    },
    stages: JOURNEY_STAGES.map((name, index) => ({ name, emotion: EMOTIONS[variant][index] })),
    rows: [
      { ...JOURNEY_ROWS.goal, height: ROW_HEIGHT.goal, cells: GOALS.map((entry) => cell(entry, 'neutral')) },
      { ...JOURNEY_ROWS.actions, height: ROW_HEIGHT.actions, cells: filled(rows.actions, 'neutral') },
      { ...JOURNEY_ROWS.touch, height: ROW_HEIGHT.touch, cells: filled(rows.touch, 'neutral') },
      { ...JOURNEY_ROWS.doubts, height: ROW_HEIGHT.doubts, cells: filled(rows.doubts, 'neutral') },
      { ...JOURNEY_ROWS.emotion, height: ROW_HEIGHT.emotion },
      {
        ...JOURNEY_ROWS.pain,
        label: asis ? JOURNEY_ROWS.pain.label : { ru: 'Что остаётся неудобным', en: 'What stays inconvenient' },
        height: ROW_HEIGHT.pain,
        cells: filled(rows.pain, 'pain'),
      },
      { ...JOURNEY_ROWS.inside, height: ROW_HEIGHT.inside, cells: filled(rows.inside, 'neutral') },
      { ...JOURNEY_ROWS.metric, height: ROW_HEIGHT.metric, cells: metrics(variant).map((entry) => cell(entry, 'neutral')) },
      {
        ...JOURNEY_ROWS.ideas,
        label: asis ? JOURNEY_ROWS.ideas.label : { ru: 'Что улучшать дальше', en: 'What to improve next' },
        height: ROW_HEIGHT.ideas,
        cells: filled(rows.ideas, 'gain'),
      },
    ],
  };
}
