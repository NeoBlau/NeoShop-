/**
 * The tables and the short report of the case, as worksheets.
 *
 *  - Table 1 of the task: the diagnosis of the source model, filled in;
 *  - the reasoning for the TO-BE changes (problem, change, BPMN, result, indicator);
 *  - the walk through the three scenarios;
 *  - a short report to hand in, with the group composition left for the group.
 */
const t = (ru, en) => ({ ru, en });

/** A row height that fits the longest cell, at about 6 px per character. */
function heightOf(cells, widths, locale = 'ru') {
  const lines = cells.map((cell, index) => {
    const text = typeof cell === 'string' ? cell : cell[locale] || cell.ru;
    return Math.ceil((text.length * 6.2) / Math.max(40, widths[index] - 22)) + (text.split('\n').length - 1);
  });
  return Math.max(70, Math.max(...lines) * 15 + 26);
}

export const DIAGNOSIS = [
  {
    fragment: t('«Направить заказ» → «Зарегистрировать заказ»: сплошная стрелка из пула «Клиент» в пул «Торговая компания»', '"Send the order" → "Register the order": a solid arrow from the "Customer" pool to the "Trading company" pool'),
    error: t('Поток управления пересекает границу пула. В BPMN 2.0 поток управления остаётся внутри пула, а участники обмениваются сообщениями. Заказ клиента — именно сообщение.', 'A sequence flow crosses a pool boundary. In BPMN 2.0 a sequence flow stays inside a pool and participants exchange messages. The customer\'s order is exactly a message.'),
    effect: t('Схема читается как один процесс без границы между клиентом и компанией; у процесса компании нет собственного старта. Проверка программы отмечает это как ошибку.', 'The diagram reads as one process with no boundary between the customer and the company; the company\'s process has no start of its own. The program\'s check flags it as an error.'),
    fix: t('Заменить стрелку потоком сообщений от пула «Клиент» к стартовому событию-сообщению «Заказ получен» в пуле компании.', 'Replace the arrow with a message flow from the "Customer" pool to a message start event "Order received" in the company pool.'),
  },
  {
    fragment: t('«Зарегистрировать заказ» → «Проверить наличие товара»: пунктир с кружком, соединяющий дорожки «Менеджер» и «Склад»', '"Register the order" → "Check the stock": a dashed line with a circle between the "Manager" and "Warehouse" lanes'),
    error: t('Поток сообщений внутри одного пула. Поток сообщений соединяет разные пулы; дорожки одного пула передают управление потоком управления.', 'A message flow inside one pool. A message flow joins different pools; lanes of one pool hand over with a sequence flow.'),
    effect: t('У «Зарегистрировать заказ» нет исходящего, а у «Проверить наличие товара» нет входящего потока управления: управление не передаётся, процесс обрывается после регистрации.', '"Register the order" has no outgoing and "Check the stock" no incoming sequence flow: control is not handed over and the process breaks off after registration.'),
    fix: t('Заменить пунктир сплошной стрелкой потока управления от менеджера к складу.', 'Replace the dashed line with a solid sequence flow from the manager to the warehouse.'),
  },
  {
    fragment: t('Исключающий шлюз «Товар есть?» и параллельный шлюз «+», в который сходятся обе ветки', 'The exclusive gateway "In stock?" and the parallel gateway "+" in which both branches meet'),
    error: t('Тип шлюза слияния не соответствует разветвлению. Исключающий шлюз пускает процесс по одной ветке, а параллельное слияние ждёт обе.', 'The merging gateway does not match the split. An exclusive gateway sends the process down one branch while a parallel join waits for both.'),
    effect: t('Взаимоблокировка: у «+» никогда не будет обоих входов, поэтому заказ не закрывается и не отгружается ни при наличии товара, ни при его отсутствии. Проверка программы выдаёт предупреждение.', 'A deadlock: "+" never gets both inputs, so the order is neither closed nor shipped, whether the goods are in stock or not. The program\'s check raises a warning.'),
    fix: t('Убрать слияние: у веток разные исходы, каждая заканчивается своим конечным событием.', 'Remove the merge: the branches have different outcomes and each ends in its own end event.'),
  },
  {
    fragment: t('Ветка «Нет»: «Сообщить клиенту об отсутствии» → слияние → «Закрыть заказ» → «Отгрузить товар»', 'The "No" branch: "Tell the customer it is out of stock" → merge → "Close the order" → "Ship the goods"'),
    error: t('Нарушено условие кейса: при отсутствии товара заказ отменяется. В модели же после уведомления заказ идёт на закрытие и отгрузку.', 'A case condition is broken: if the goods are missing the order is cancelled. The model instead sends it on to closing and shipping after the notice.'),
    effect: t('Модель предусматривает отгрузку товара, которого нет, а отмена заказа нигде не происходит.', 'The model provides for shipping goods that are not there, and the order is cancelled nowhere.'),
    fix: t('После уведомления клиента завершить ветку событием «Заказ отменён: товара нет» вместо закрытия и отгрузки.', 'After notifying the customer end the branch with "Order cancelled: out of stock" instead of closing and shipping.'),
  },
  {
    fragment: t('«Выставить счёт» → событие «Оплата получена»', '"Issue the invoice" → the event "Payment received"'),
    error: t('Нет срока и нет ветки неоплаты. Условия кейса: срок оплаты 3 рабочих дня, при неоплате заказ отменяется. Процесс ждёт только одного события.', 'There is no deadline and no non-payment branch. The case says: 3 working days to pay, an order that is not paid is cancelled. The process waits for one event only.'),
    effect: t('Если клиент не платит, процесс ждёт бесконечно: заказ не отменяется и «висит» без исхода.', 'If the customer does not pay the process waits forever: the order is not cancelled and hangs with no outcome.'),
    fix: t('Поставить событийный шлюз «Ожидание оплаты» с двумя ветками: «Оплата получена» и таймер «Прошло 3 рабочих дня» → «Отменить заказ» и уведомление клиента.', 'Put an event-based gateway "Waiting for payment" with two branches: "Payment received" and the timer "3 working days have passed" → "Cancel the order" and a notice to the customer.'),
  },
  {
    fragment: t('Событие «Оплата получена» и пул «Клиент»', 'The event "Payment received" and the "Customer" pool'),
    error: t('Сообщение о получении оплаты ни от кого не приходит, а у клиента нет задач «Получить счёт» и «Оплатить счёт». Взаимодействие участников описано только с одной стороны.', 'The message about the payment comes from nobody and the customer has no tasks "Receive the invoice" and "Pay the invoice". The interaction of the participants is described from one side only.'),
    effect: t('Непонятно, кто и что сообщает бухгалтерии; нет ни счёта клиенту, ни его оплаты, хотя от них зависит исход процесса.', 'It is unclear who tells accounting what; there is neither an invoice to the customer nor its payment, although the outcome depends on both.'),
    fix: t('Показать счёт потоком сообщений от бухгалтерии к пулу клиента и оплату потоком сообщений от пула клиента к событию «Оплата получена».', 'Show the invoice as a message flow from accounting to the customer pool and the payment as a message flow from the customer pool to the event "Payment received".'),
  },
  {
    fragment: t('Порядок задач: «Закрыть заказ» выполняется раньше «Отгрузить товар»', 'The order of tasks: "Close the order" comes before "Ship the goods"'),
    error: t('Условие кейса: заказ закрывается после отгрузки товара.', 'The case condition: an order is closed after the goods are shipped.'),
    effect: t('Заказ закрыт до отгрузки: статус не соответствует фактам, и закрытый заказ можно так и не отгрузить.', 'The order is closed before shipping: the status does not match the facts and a closed order may never be shipped.'),
    fix: t('Поставить «Отгрузить товар» перед «Закрыть заказ».', 'Put "Ship the goods" before "Close the order".'),
  },
  {
    fragment: t('Единственное конечное событие «Заказ выполнен» для всех путей', 'The single end event "Order fulfilled" for every path'),
    error: t('У процесса три исхода: заказ выполнен, отменён из-за отсутствия товара, отменён из-за неоплаты. Один конец не различает их.', 'The process has three outcomes: fulfilled, cancelled because the goods are missing, cancelled for non-payment. One end does not tell them apart.'),
    effect: t('Отменённые заказы выглядят выполненными, по модели нельзя посчитать, сколько заказов отменено и почему.', 'Cancelled orders look fulfilled and the model cannot say how many orders were cancelled and why.'),
    fix: t('Завести три конечных события: «Заказ выполнен», «Заказ отменён: товара нет», «Заказ отменён: нет оплаты».', 'Use three end events: "Order fulfilled", "Order cancelled: out of stock", "Order cancelled: no payment".'),
  },
  {
    fragment: t('Задача «Сообщить клиенту об отсутствии» и отсутствие других уведомлений клиенту', 'The task "Tell the customer it is out of stock" and the lack of other notices to the customer'),
    error: t('Менеджер сообщает клиенту результат обработки, но связи с клиентом на схеме нет, а о выполнении и об отмене из-за неоплаты клиент вообще не узнаёт.', 'The manager tells the customer the result, but the diagram has no link to the customer, and the customer is never told about fulfilment or a cancellation for non-payment.'),
    effect: t('Часть условий кейса не выполнена: клиент не знает итога своего заказа.', 'Part of the case conditions is not met: the customer does not know the result of the order.'),
    fix: t('Показать три уведомления потоками сообщений от менеджера к пулу клиента: «Нет товара», «Выполнен», «Отменён».', 'Show three notices as message flows from the manager to the customer pool: "Out of stock", "Fulfilled", "Cancelled".'),
  },
  {
    fragment: t('Пул «Клиент» состоит из старта и одной задачи', 'The "Customer" pool is a start and one task'),
    error: t('Поведение клиента не доведено до конца: нет ожидания ответа, решения об оплате и получения итога. Клиент влияет на исход (платит или нет), но на схеме этого не видно.', 'The customer\'s behaviour is not carried through: there is no wait for an answer, no decision to pay and no receipt of the outcome. The customer affects the outcome (pays or not) but the diagram does not show it.'),
    effect: t('Без поведения клиента нельзя проверить ни сценарий «оплата не поступила в срок», ни то, как каждый сценарий завершается для клиента.', 'Without the customer\'s behaviour neither the "payment not received in time" scenario nor how each scenario ends for the customer can be checked.'),
    fix: t('Свернуть пул «Клиент» в «чёрный ящик»: подробное поведение клиента в кейсе не нужно, достаточно сообщений, которыми он обменивается с компанией (заказ, счёт, оплата, три уведомления).', 'Collapse the "Customer" pool into a black box: the case does not need the customer\'s detailed behaviour, only the messages exchanged with the company (order, invoice, payment, three notices).'),
  },
  {
    fragment: t('Все задачи — обычные «task» без типа', 'All tasks are plain "task" with no type'),
    error: t('Не различены задачи, которые выполняет человек, и задачи, которые отправляют сообщение. Это замечание по читаемости, а не по логике.', 'Tasks done by a person and tasks that send a message are not told apart. This is a remark on readability, not on logic.'),
    effect: t('Из схемы не видно, где происходит обмен с клиентом и какие шаги можно автоматизировать позже.', 'The diagram does not show where the exchange with the customer happens or which steps could be automated later.'),
    fix: t('Использовать пользовательские задачи для работы людей и задачи отправки там, где отправляется сообщение клиенту.', 'Use user tasks for people\'s work and send tasks where a message goes to the customer.'),
  },
];

export function diagnosisSpec() {
  const widths = [46, 240, 400, 330, 350];
  return {
    notation: 'sheet',
    kind: 'table',
    name: t('Таблица 1. Диагностика исходной модели', 'Table 1. Diagnosis of the source model'),
    title: t('Таблица 1 — Результаты диагностики исходной модели', 'Table 1 — Results of the diagnosis of the source model'),
    kicker: t('Кейс: торговая компания · по условиям кейса и правилам BPMN 2.0', 'Case: trading company · by the case conditions and the BPMN 2.0 rules'),
    description: t('Одиннадцать замечаний к модели с рисунка 1: фрагмент, ошибка и основание, последствие, исправление.', 'Eleven remarks on the model of figure 1: the fragment, the mistake and its ground, the consequence, the fix.'),
    columns: [
      { name: t('№', '#'), w: widths[0] },
      { name: t('Фрагмент модели', 'Model fragment'), w: widths[1] },
      { name: t('Ошибка и основание', 'Mistake and ground'), w: widths[2] },
      { name: t('Последствие', 'Consequence'), w: widths[3] },
      { name: t('Исправление', 'Fix'), w: widths[4] },
    ],
    rows: DIAGNOSIS.map((row, index) => ({
      get height() {
        return Math.max(heightOf([row.fragment, row.error, row.effect, row.fix], widths.slice(1), 'ru'), heightOf([row.fragment, row.error, row.effect, row.fix], widths.slice(1), 'en'));
      },
      cells: [String(index + 1), row.fragment, row.error, row.effect, row.fix],
    })),
    footer: t(
      'Замечания сгруппированы по списку из задания: типы связей (1, 2), шлюзы (3), порядок задач (7), альтернативные ситуации (4, 5, 8), взаимодействие участников (6, 9, 10), читаемость (11). Проверка программы сама находит замечания 1, 2 и 3 и их следствия (пропущенные входящие и исходящие потоки).',
      'The remarks follow the list in the task: types of flows (1, 2), gateways (3), order of tasks (7), alternative situations (4, 5, 8), interaction of participants (6, 9, 10), readability (11). The program\'s check finds remarks 1, 2 and 3 itself, with their consequences (missing incoming and outgoing flows).'
    ),
    footerHeight: 84,
  };
}

export const CHANGES = [
  {
    problem: t('Заказ регистрируется вручную менеджером из произвольного сообщения клиента: возможны ошибки и неполные данные, регистрация зависит от занятости менеджера.', 'The manager registers the order by hand from a free-form customer message: errors and incomplete data are possible and registration depends on the manager being free.'),
    change: t('Электронная форма заказа с обязательными полями; заказ регистрируется в информационной системе автоматически.', 'An electronic order form with required fields; the order is registered in the information system automatically.'),
    bpmn: t('Стартовое событие-сообщение «Заказ из электронной формы» и служебная задача «Зарегистрировать заказ автоматически» в дорожке системы вместо пользовательской задачи менеджера.', 'The message start event "Order from the electronic form" and the service task "Register the order automatically" in the system lane instead of the manager\'s user task.'),
    result: t('Меньше ручных операций и ошибок при вводе, регистрация не ждёт менеджера.', 'Fewer manual operations and entry errors; registration does not wait for the manager.'),
    indicator: t('Число ручных операций на один заказ; доля заказов, исправленных после регистрации; время от получения заказа до регистрации.', 'The number of manual operations per order; the share of orders corrected after registration; the time from receiving the order to registering it.'),
  },
  {
    problem: t('Наличие проверяет склад вручную, и товар не закреплён за заказом. Пока клиент оплачивает счёт, товар может закончиться: счёт выставлен, а отгружать нечего.', 'The warehouse checks the stock by hand and the goods are not tied to the order. While the customer pays, the goods may run out: the invoice is issued and there is nothing to ship.'),
    change: t('Система проверяет остатки по правилу и резервирует товар на срок оплаты (3 рабочих дня); при отмене резерв снимается.', 'The system checks the stock by a rule and reserves the goods for the payment term (3 working days); the reserve is released on cancellation.'),
    bpmn: t('Задача-правило «Проверить остатки и зарезервировать товар» перед шлюзом «Товар есть?»; в ветке неоплаты служебная задача «Отменить заказ, снять резерв, уведомить клиента»; склад выполняет только «Отгрузить зарезервированный товар».', 'The business rule task "Check the stock and reserve the goods" before the gateway "In stock?"; in the non-payment branch the service task "Cancel the order, release the reserve, notify the customer"; the warehouse only does "Ship the reserved goods".'),
    result: t('Оплаченный заказ не остаётся без товара; склад не тратит время на проверку каждого заказа.', 'A paid order is not left without goods; the warehouse does not spend time checking every order.'),
    indicator: t('Число оплаченных заказов, которые не удалось отгрузить из-за отсутствия товара; время от регистрации до ответа о наличии.', 'The number of paid orders that could not be shipped because the goods were missing; the time from registration to the answer about the stock.'),
  },
  {
    problem: t('Счёт выставляется вручную, поступление оплаты бухгалтерия ищет в выписке, а срок в 3 рабочих дня контролируется вручную.', 'The invoice is issued by hand, accounting looks for the payment in the statement and the 3-working-day term is watched by hand.'),
    change: t('Счёт формируется и отправляется системой автоматически; система сопоставляет платёж из выписки со счётом, бухгалтерия подтверждает совпадение; срок оплаты отслеживает таймер.', 'The system issues and sends the invoice automatically, matches the payment from the statement with the invoice and accounting confirms the match; a timer watches the payment term.'),
    bpmn: t('Служебная задача «Выставить и отправить счёт автоматически»; событийный шлюз с событием «Платёж найден в выписке» и таймером «3 рабочих дня»; у бухгалтерии одна задача «Подтвердить платёж».', 'The service task "Issue and send the invoice automatically"; an event-based gateway with the event "Payment found in the statement" and the timer "3 working days"; accounting has one task "Confirm the payment".'),
    result: t('Быстрее передача оплаченного заказа в отгрузку, меньше ошибок при сопоставлении, срок оплаты не пропускается.', 'A paid order reaches shipping faster, there are fewer matching errors and the payment term is not missed.'),
    indicator: t('Время от поступления платежа до его подтверждения; доля платежей, сопоставленных автоматически; число заказов, не отменённых в срок.', 'The time from the payment arriving to its confirmation; the share of payments matched automatically; the number of orders not cancelled on time.'),
  },
  {
    problem: t('Клиенту сообщают результат вручную, и пока менеджер занят, клиент не знает статуса; закрытие заказа тоже делается вручную и забывается.', 'The customer is told the result by hand and, while the manager is busy, does not know the status; closing the order is also manual and gets forgotten.'),
    change: t('Статусные уведомления (счёт, выполнение, отмена) отправляет система; заказ закрывается автоматически по отметке склада об отгрузке. Менеджер остаётся только в случае отсутствия товара.', 'The system sends the status notices (invoice, fulfilment, cancellation); the order closes automatically on the warehouse\'s shipment mark. The manager stays only for the out-of-stock case.'),
    bpmn: t('Служебные задачи «Закрыть заказ и уведомить клиента» и «Отменить заказ, снять резерв, уведомить клиента» с потоками сообщений к пулу клиента; задача менеджера «Сообщить клиенту об отсутствии товара» сохранена.', 'The service tasks "Close the order and notify the customer" and "Cancel the order, release the reserve, notify the customer" with message flows to the customer pool; the manager\'s task "Tell the customer the goods are out of stock" is kept.'),
    result: t('Быстрее обмен информацией, меньше обращений клиентов «где мой заказ», нет незакрытых отгруженных заказов.', 'Faster exchange of information, fewer "where is my order" enquiries, no shipped orders left open.'),
    indicator: t('Время от решения (отгрузка, отмена) до уведомления клиента; число обращений клиентов о статусе заказа; число отгруженных, но не закрытых заказов.', 'The time from the decision (shipment, cancellation) to the notice to the customer; the number of customer enquiries about order status; the number of shipped orders not closed.'),
  },
];

export function changesSpec() {
  const widths = [300, 300, 380, 270, 300];
  return {
    notation: 'sheet',
    kind: 'table',
    name: t('Обоснование изменений TO-BE', 'TO-BE changes: reasoning'),
    title: t('Модель TO-BE: проблема, изменение, BPMN, результат и показатель', 'The TO-BE model: problem, change, BPMN, result and indicator'),
    kicker: t('Кейс: торговая компания · четыре изменения организации процесса', 'Case: trading company · four changes to how the process is organised'),
    description: t('Для каждого изменения: какую проблему решает, как отражается в BPMN, ожидаемый результат и показатель проверки.', 'For each change: the problem it solves, how it shows in BPMN, the expected result and the indicator for checking it.'),
    columns: [
      { name: t('Проблема', 'Problem'), w: widths[0] },
      { name: t('Предлагаемое изменение', 'Proposed change'), w: widths[1] },
      { name: t('Как отражается в BPMN', 'How it shows in BPMN'), w: widths[2] },
      { name: t('Ожидаемый результат', 'Expected result'), w: widths[3] },
      { name: t('Показатель проверки', 'Indicator'), w: widths[4] },
    ],
    rows: CHANGES.map((row) => {
      const cells = [row.problem, row.change, row.bpmn, row.result, row.indicator];
      return {
        get height() {
          return Math.max(heightOf(cells, widths, 'ru'), heightOf(cells, widths, 'en'));
        },
        cells,
      };
    }),
    footerTitle: t('Допущения и границы', 'Assumptions and limits'),
    footer: t(
      'Все изменения делаются настройкой имеющейся информационной системы (форма заказа, остатки и резерв, шаблон счёта, сопоставление платежей, статусные уведомления): это явное допущение, штат не растёт. Числовые эффекты не рассчитывались, потому что исходных данных нет: показатели нужно измерить до и после изменений. Бизнес-правила кейса сохранены: предоплата, отмена при отсутствии товара, срок оплаты 3 рабочих дня, закрытие после отгрузки.',
      'Every change is made by configuring the existing information system (order form, stock and reserve, invoice template, payment matching, status notices): this is an explicit assumption and the staff does not grow. No numeric effects were calculated because there is no source data: the indicators have to be measured before and after the changes. The case\'s business rules are kept: prepayment, cancellation when the goods are missing, the 3-working-day payment term, closing after shipment.'
    ),
    footerHeight: 120,
  };
}

export const SCENARIOS = [
  {
    name: t('1. Товар есть, оплата поступила вовремя', '1. The goods are in stock and the payment arrives in time'),
    asis: t('Клиент присылает заказ → менеджер регистрирует → склад проверяет наличие → «Товар есть?»: да → бухгалтерия выставляет счёт → событийный шлюз: «Оплата получена» раньше таймера → бухгалтерия подтверждает поступление → склад отгружает → менеджер сообщает клиенту о выполнении → закрывает заказ.', 'The customer sends the order → the manager registers it → the warehouse checks the stock → "In stock?": yes → accounting issues the invoice → event-based gateway: "Payment received" before the timer → accounting confirms the receipt → the warehouse ships → the manager tells the customer it is fulfilled → closes the order.'),
    tobe: t('Заказ приходит из электронной формы → система регистрирует его, проверяет остатки и резервирует товар → «Товар есть?»: да → система выставляет и отправляет счёт → платёж найден в выписке → бухгалтерия подтверждает → склад отгружает зарезервированный товар → система закрывает заказ и уведомляет клиента.', 'The order arrives from the electronic form → the system registers it, checks the stock and reserves the goods → "In stock?": yes → the system issues and sends the invoice → the payment is found in the statement → accounting confirms → the warehouse ships the reserved goods → the system closes the order and notifies the customer.'),
    end: t('Конец «Заказ выполнен». Клиенту уходит сообщение «Выполнен».', 'End "Order fulfilled". The customer gets the message "Fulfilled".'),
  },
  {
    name: t('2. Товара нет', '2. The goods are not in stock'),
    asis: t('Клиент присылает заказ → менеджер регистрирует → склад проверяет наличие → «Товар есть?»: нет → менеджер сообщает клиенту об отсутствии товара → заказ отменён. Счёт не выставляется.', 'The customer sends the order → the manager registers it → the warehouse checks the stock → "In stock?": no → the manager tells the customer the goods are out of stock → the order is cancelled. No invoice is issued.'),
    tobe: t('Заказ приходит из электронной формы → система регистрирует его и проверяет остатки → «Товар есть?»: нет (резерв не создаётся) → менеджер сообщает клиенту об отсутствии товара → заказ отменён.', 'The order arrives from the electronic form → the system registers it and checks the stock → "In stock?": no (no reserve is made) → the manager tells the customer the goods are out of stock → the order is cancelled.'),
    end: t('Конец «Заказ отменён: товара нет». Клиенту уходит сообщение «Нет товара».', 'End "Order cancelled: out of stock". The customer gets the message "Out of stock".'),
  },
  {
    name: t('3. Товар есть, но оплата не поступила в срок', '3. The goods are in stock but the payment does not arrive in time'),
    asis: t('Как в сценарии 1 до счёта: бухгалтерия выставляет счёт, клиент не платит → событийный шлюз «Ожидание оплаты»: срабатывает таймер «3 рабочих дня» → менеджер сообщает клиенту об отмене → заказ отменён.', 'As in scenario 1 up to the invoice: accounting issues the invoice and the customer does not pay → event-based gateway "Waiting for payment": the timer "3 working days" fires → the manager tells the customer the order is cancelled → the order is cancelled.'),
    tobe: t('Как в сценарии 1 до счёта (товар зарезервирован): клиент не платит → срабатывает таймер «3 рабочих дня» → система отменяет заказ, снимает резерв и уведомляет клиента.', 'As in scenario 1 up to the invoice (the goods are reserved): the customer does not pay → the timer "3 working days" fires → the system cancels the order, releases the reserve and notifies the customer.'),
    end: t('Конец «Заказ отменён: нет оплаты». Клиенту уходит сообщение «Отменён».', 'End "Order cancelled: no payment". The customer gets the message "Cancelled".'),
  },
];

export function scenariosSpec() {
  const widths = [250, 520, 520, 330];
  return {
    notation: 'sheet',
    kind: 'table',
    name: t('Прохождение трёх сценариев', 'Walk through three scenarios'),
    title: t('Прохождение трёх сценариев и завершение каждого', 'The three scenarios and how each one ends'),
    kicker: t('Кейс: торговая компания · исправленная AS-IS и TO-BE', 'Case: trading company · the corrected AS-IS and the TO-BE'),
    description: t('Три сценария по условиям кейса: путь по каждой модели и конечное событие компании и клиента.', 'Three scenarios from the case conditions: the path through each model and the end event of the company and of the customer.'),
    columns: [
      { name: t('Сценарий', 'Scenario'), w: widths[0] },
      { name: t('Прохождение по исправленной модели AS-IS', 'Walk through the corrected AS-IS model'), w: widths[1] },
      { name: t('Прохождение по модели TO-BE', 'Walk through the TO-BE model'), w: widths[2] },
      { name: t('Как завершается', 'How it ends'), w: widths[3] },
    ],
    rows: SCENARIOS.map((row) => {
      const cells = [row.name, row.asis, row.tobe, row.end];
      return {
        get height() {
          return Math.max(heightOf(cells, widths, 'ru'), heightOf(cells, widths, 'en'));
        },
        cells,
        tone: 'neutral',
      };
    }),
    footer: t(
      'Конечное событие у каждого сценария своё: так по модели видно, чем закончился заказ. Клиент в обеих моделях показан свёрнутым пулом, поэтому его исход видно по сообщению, которое он получает.',
      'Every scenario has its own end event, so the model shows how an order ended. In both models the customer is a collapsed pool, so its outcome shows in the message it receives.'
    ),
    footerHeight: 64,
  };
}

export function reportSpec(counts) {
  const text = {
    group: t('', ''),
    diagnosis: t(
      `Проверена исходная модель (рисунок 1). Найдено замечаний: ${counts.remarks}. По списку задания: типы связей — 2, шлюзы — 1, порядок задач — 1, альтернативные ситуации — 3, взаимодействие участников — 3, читаемость — 1 (одно замечание может относиться к нескольким группам). Три из них программа находит сама. Подробности в таблице 1.`,
      `The source model (figure 1) was checked. Remarks found: ${counts.remarks}. By the task's list: types of flows 2, gateways 1, order of tasks 1, alternative situations 3, interaction of participants 3, readability 1 (one remark may belong to several groups). The program finds three of them itself. Details are in table 1.`
    ),
    models: t(
      `Исправленная модель AS-IS: ${counts.asis} элементов, два пула (клиент — свёрнутый «чёрный ящик» — и торговая компания с дорожками менеджера, склада и бухгалтерии), шесть потоков сообщений, три исхода. Модель TO-BE: ${counts.tobe} элементов, добавлена дорожка настроенной информационной системы. Обе модели в папке этого кейса; редактируемые файлы получаются командой экспорта BPMN 2.0 XML, их можно открыть в Bizagi Modeler через импорт.`,
      `The corrected AS-IS model: ${counts.asis} elements, two pools (the customer as a collapsed black box and the trading company with the manager, warehouse and accounting lanes), six message flows, three outcomes. The TO-BE model: ${counts.tobe} elements, with a lane for the configured information system added. Both models are in this case's folder; editable files come from the BPMN 2.0 XML export command and can be opened in Bizagi Modeler through its import.`
    ),
    changes: t(
      'Предложено четыре изменения: электронная форма заказа с автоматической регистрацией, автоматическая проверка остатков с резервом на срок оплаты, автоматический счёт и сопоставление платежей с таймером срока, автоматические статусные уведомления и закрытие заказа. Для каждого указаны проблема, отражение в BPMN, ожидаемый результат и показатель. Числовые эффекты не рассчитывались: нет исходных данных. Допущение: настройка имеющейся информационной системы, штат не растёт.',
      'Four changes are proposed: an electronic order form with automatic registration, an automatic stock check with a reserve for the payment term, an automatic invoice and payment matching with a term timer, and automatic status notices with automatic closing. For each the problem, the BPMN reflection, the expected result and the indicator are given. No numeric effects were calculated: there is no source data. Assumption: the existing information system is configured and the staff does not grow.'
    ),
    scenarios: t(
      'Три сценария проходят по обеим моделям и заканчиваются разными событиями: «Заказ выполнен», «Заказ отменён: товара нет», «Заказ отменён: нет оплаты»; клиент получает своё сообщение в каждом случае. Таблица «Прохождение трёх сценариев».',
      'The three scenarios run through both models and end with different events: "Order fulfilled", "Order cancelled: out of stock", "Order cancelled: no payment"; the customer gets its own message in each case. See the table "Walk through three scenarios".'
    ),
  };
  return {
    notation: 'sheet',
    kind: 'form',
    name: t('Краткий отчёт', 'Short report'),
    title: t('Краткий отчёт группы', 'The group\'s short report'),
    kicker: t('Кейс: торговая компания · состав группы впишите сами', 'Case: trading company · fill in the group composition yourself'),
    description: t('Состав группы, итоги диагностики, модели, обоснование изменений и сценарии.', 'The group composition, the results of the diagnosis, the models, the reasoning for the changes and the scenarios.'),
    changeTitle: t('Что сдаём', 'What is handed in'),
    change: t(
      'Один краткий отчёт: состав группы, заполненная таблица ошибок, модели AS-IS и TO-BE, обоснование изменений; плюс редактируемые файлы моделей.',
      'One short report: the group composition, the filled table of mistakes, the AS-IS and TO-BE models, the reasoning for the changes; plus the editable model files.'
    ),
    changeHeight: 84,
    questions: [
      { question: t('Состав группы (впишите)', 'Group composition (fill in)'), answer: text.group, height: 96, tone: 'orange' },
      { question: t('Диагностика исходной модели', 'Diagnosis of the source model'), answer: text.diagnosis, height: 150, tone: 'teal' },
      { question: t('Модели AS-IS и TO-BE', 'The AS-IS and TO-BE models'), answer: text.models, height: 190, tone: 'violet' },
      { question: t('Обоснование изменений TO-BE', 'Reasoning for the TO-BE changes'), answer: text.changes, height: 190, tone: 'teal' },
      { question: t('Три сценария', 'Three scenarios'), answer: text.scenarios, height: 150, tone: 'orange' },
    ],
  };
}
