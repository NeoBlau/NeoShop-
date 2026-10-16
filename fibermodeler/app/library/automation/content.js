/**
 * The seminar "choosing and defending an automation technology", filled in for
 * every library process, as is and to be.
 *
 * For each process the content holds five steps (the five changes of the
 * impact / effort matrix for WEG; the main changes of the target model for the
 * others) and, per step:
 *   - tobe: the technology class that solves the TO-BE step and why;
 *   - asis: what the same step looks like today, what automating it as it is
 *     would bring and why that is not enough ("do not automate the mess").
 * Then one risk (type, description, first-week measure) and one pilot (scale,
 * indicator, target) for the version.
 *
 * The AS-IS rows deliberately argue against automating first: the facts they
 * quote ({waitShare}, {autoLead}, {autoCost}, {tobeLead}, {tobeCost}) are
 * computed from the models - see `facts.js` - so the argument is a measurement,
 * not an opinion. The TO-BE choices, the risks and the pilot targets are the
 * author's proposals, not results of any pilot.
 *
 * `step` of a TO-BE row is taken from the impact / effort matrix of the same
 * process; `riskStep` and `pilotStep` name the step the risk and the pilot are
 * about.
 */

const t = (ru, en) => ({ ru, en });

export const AUTOMATION = [
  /* ------------------------------------------------------ 1. order to cash */
  {
    key: 'weg-o2c',
    matrix: 'weg-o2c-tobe',
    steps: [
      {
        id: 'early',
        tobe: { tech: ['NONE', 'ERP'], why: t('Это пункт договора, а не операция: ERP лишь выставляет счёт с нужным сроком и скидкой.', 'It is a contract clause, not an operation: ERP only issues the invoice with the right term and discount.') },
        asis: {
          step: t('Счёт всегда выставляется на 30 дней, другого варианта оплаты нет', 'The invoice is always issued for 30 days, there is no other payment option'),
          tech: ['ERP'],
          why: t('Хоть полностью автоматизируйте выставление счёта: деньги придут через те же 30 дней, потому что срок записан в условиях.', 'Automate invoicing completely and the money still comes after the same 30 days, because the term is written into the conditions.'),
        },
      },
      {
        id: 'docs',
        tobe: { tech: ['ERP'], why: t('Штатная функция ERP: NF-e, трек-номер, счёт и закрытие формируются из данных заказа без повторного ввода.', 'A standard ERP function: NF-e, tracking number, invoice and closing are generated from the order with no re-keying.') },
        asis: {
          step: t('NF-e, уведомление, счёт и закрытие вводят вручную из заказа', 'NF-e, notice, invoice and closing are keyed in by hand from the order'),
          tech: ['RPA'],
          why: t('Робот перенесёт данные между экранами, но ввод в нескольких местах останется; надёжнее убрать дубли в самом ERP.', 'A robot would copy data between screens, but the multiple entry stays; it is sturdier to remove the duplication in ERP itself.'),
        },
      },
      {
        id: 'scoring',
        tobe: { tech: ['BPM'], why: t('Правила «лимит, история платежей, страховка» — чёткая логика; BPM ведёт маршрут, а человек получает только исключения.', 'The rules "limit, payment history, insurance" are clear logic; BPM runs the route and a person gets only the exceptions.') },
        asis: {
          step: t('Аналитик вручную проверяет лимит и страховку по каждому заказу', 'An analyst checks the limit and the insurance by hand on every order'),
          tech: ['RPA'],
          why: t('Робот откроет те же экраны быстрее, но правило проверки не изменится: каждый заказ по-прежнему идёт через проверку.', 'A robot would open the same screens faster, but the rule stays the same: every order still goes through the check.'),
        },
      },
      {
        id: 'portal',
        tobe: { tech: ['ERP', 'API', 'RPA'], why: t('Структурированный заказ приходит в ERP через портал или EDI; RPA нужен только там, где у клиента нет EDI.', 'A structured order reaches ERP through the portal or EDI; RPA is only for customers without EDI.') },
        asis: {
          step: t('Заказ приходит письмом или таблицей, менеджер вводит его в ERP', 'The order arrives as a letter or a spreadsheet and a salesperson keys it into ERP'),
          tech: ['IDP'],
          why: t('IDP прочитает письмо, но пересылка и исправление ошибок после отправки останутся: заказ нужно принимать сразу в виде структуры.', 'IDP would read the letter, but the forwarding and the fixing of errors after sending stay: the order should arrive as a structure.'),
        },
      },
      {
        id: 'atp',
        tobe: { tech: ['ERP', 'PRED'], why: t('Срок отгрузки считает ERP по остаткам; прогноз спроса портала поднимает долю отгрузок со склада (78 → 92 %, допущение).', 'ERP works out the ship date from stock; the portal demand forecast lifts the share shipped from stock (78% → 92%, an assumption).') },
        asis: {
          step: t('Клиент не видит срок отгрузки, склад планируется по плану производства', 'The customer cannot see the ship date, stock is planned from the production plan'),
          tech: ['PRED'],
          why: t('Прогноз без открытых остатков не изменит главного: клиент всё равно ждёт ответа. Сначала нужно показать наличие.', 'A forecast without visible stock changes nothing: the customer still waits for an answer. Show the stock first.'),
        },
      },
    ],
    risk: {
      step: 'scoring',
      tobe: {
        type: 'org',
        desc: t('Аналитики кредитного контроля боятся потерять контроль и работу: скоринг решает за них. Они продолжат перепроверять его решения вручную, и 96 % заказов, которые модель отпускает сама, снова пойдут через проверку.', 'Credit-control analysts fear losing control and work: scoring decides in their place. They will keep re-checking its decisions by hand, and the 96% of orders the model releases by itself will go through a check again.'),
        measure: t('В первую неделю прогнать скоринг параллельно с ручной проверкой на реальных заказах, показать аналитикам все расхождения и поручить им владение правилами: исключения (4 %) остаются у них.', 'In the first week run scoring in parallel with the manual check on real orders, show the analysts every disagreement and give them ownership of the rules: the exceptions (4%) stay with them.'),
      },
      asis: {
        type: 'mess',
        desc: t('Если автоматизировать ручную проверку лимита как есть, робот будет проверять 100 % заказов быстрее, но само правило «проверять всё» останется. Ожидание в этом процессе — {waitShare} % срока, и робот на него не повлияет.', 'If the manual limit check is automated as it is, a robot will check 100% of orders faster, but the rule "check everything" stays. Waiting is {waitShare}% of this process\'s lead time and a robot does not touch it.'),
        measure: t('Не автоматизировать. В первую неделю замерить, сколько заказов проверка действительно отклоняет и сколько минут она занимает, и только тогда решать, что убрать.', 'Do not automate. In the first week measure how many orders the check really rejects and how many minutes it takes, and only then decide what to remove.'),
      },
    },
    pilot: {
      tobe: {
        scale: t('Один региональный менеджер по заказам и три клиента с чистой платёжной историей, 2 недели, скоринг работает параллельно с ручной проверкой.', 'One regional order manager and three customers with a clean payment history, 2 weeks, scoring runs in parallel with the manual check.'),
        kpi: t('Доля заказов, закрытых скорингом без ручной проверки.', 'The share of orders closed by scoring without a manual check.'),
        target: t('Не ниже 95 % (в модели 96 %), решения скоринга и аналитика расходятся не более чем в 2 % заказов. Стартовая цель, уточните по данным.', 'At least 95% (the model has 96%), scoring and analyst disagree on no more than 2% of orders. A starting target: refine it with data.'),
      },
      asis: {
        tech: ['DASH'],
        scale: t('Замер на последних 30 заказах одного менеджера за 2 недели, без изменения процесса.', 'Measure the last 30 orders of one manager over 2 weeks, without changing the process.'),
        kpi: t('Фактическое время проверки лимита и доля заказов с запросом предоплаты.', 'The actual time of the limit check and the share of orders with a prepayment request.'),
        target: t('Допущения модели (8 мин, 7 %) заменены замером; расхождение записано в документацию схемы.', 'The model\'s assumptions (8 min, 7%) are replaced by measurements; the gap is recorded in the diagram documentation.'),
      },
    },
  },

  /* ------------------------------------------------------------- 2. the motor */
  {
    key: 'weg-make-motor',
    matrix: 'weg-make-motor-tobe',
    steps: [
      {
        id: 'winding',
        tobe: { tech: ['EQUIP'], why: t('Это станок, а не программа: RPA и BPM здесь нечего делать; ПО нужно только для передачи рецепта намотки из ERP.', 'This is a machine, not software: RPA and BPM have nothing to do here; software is only for passing the winding recipe from ERP.') },
        asis: {
          step: t('Ручная намотка катушек, 6 мин на двигатель', 'Manual coil winding, 6 min per motor'),
          tech: ['EQUIP'],
          why: t('Автоматизировать здесь можно только оборудованием; программы вокруг учётных шагов дадут копейки.', 'Only equipment can automate this; software around the bookkeeping steps would give pennies.'),
        },
      },
      {
        id: 'uv',
        tobe: { tech: ['EQUIP'], why: t('Замена печи на УФ — технологический переход; ПО нужно только для рецепта и контроля режима.', 'Swapping the oven for UV is a process change; software only holds the recipe and the mode control.') },
        asis: {
          step: t('Пропитка с печной сушкой: 40 мин ожидания', 'Impregnation with oven drying: 40 min of waiting'),
          tech: ['NONE'],
          why: t('Никакая программа не ускорит печь: это ожидание физики процесса, а не работа человека.', 'No software speeds up an oven: it is the physics of the process waiting, not a person working.'),
        },
      },
      {
        id: 'powder',
        tobe: { tech: ['EQUIP'], why: t('Новая линия окраски; ПО лишь ведёт заказ через неё.', 'A new paint line; software only routes the order through it.') },
        asis: {
          step: t('Жидкая окраска: 25 мин ожидания высыхания', 'Liquid painting: 25 min of waiting for it to dry'),
          tech: ['NONE'],
          why: t('Время высыхания не зависит от автоматизации: нужно менять способ окраски, а не оформление заказа.', 'Drying time does not depend on automation: the painting method has to change, not the paperwork.'),
        },
      },
      {
        id: 'surge',
        tobe: { tech: ['EQUIP', 'BPM'], why: t('Датчик теста встроен в линию, а правило «остановить партию при отклонении» ведёт BPM-маршрут: человек подключается только к исключению.', 'The test sensor sits in the line and a BPM route runs the rule "stop the batch on a deviation": a person joins only on an exception.') },
        asis: {
          step: t('Контроль изоляции отдельным постом после укладки', 'Insulation test at a separate post after winding'),
          tech: ['RPA'],
          why: t('Робот перенесёт результат теста в учёт, но дефект по-прежнему находят после пропитки; нужно перенести тест раньше.', 'A robot would copy the test result into the records, but the defect is still found after impregnation; the test has to move earlier.'),
        },
      },
      {
        id: 'spc',
        tobe: { tech: ['PRED'], why: t('Статистический контроль по телеметрии смотрит вперёд: сигнал приходит до отклонения, а не акт после испытаний.', 'Statistical control on telemetry looks ahead: the signal comes before the deviation, not a report after the tests.') },
        asis: {
          step: t('Контроль КПД на финальных испытаниях: отклонение видно, когда двигатель уже собран', 'Efficiency control at the final tests: the deviation shows when the motor is already assembled'),
          tech: ['DASH'],
          why: t('Дашборд KPI смотрит назад и фиксирует факт: брак уже собран, остаётся его посчитать.', 'A KPI dashboard looks back and records a fact: the faulty motor is already assembled, all that is left is to count it.'),
        },
      },
    ],
    risk: {
      step: 'spc',
      tobe: {
        type: 'tech',
        desc: t('Телеметрия линий собирается в разных системах и разных форматах; интеграция с ними окажется сложнее, чем на бумаге, а ложные срабатывания подорвут доверие операторов в первые же недели.', 'Line telemetry sits in different systems and formats; integrating it will be harder than on paper, and false alarms will undermine the operators\' trust within the first weeks.'),
        measure: t('В первую неделю подключить одну линию и выгрузить данные за последние 3 месяца, чтобы настроить пределы на истории; сигналы показывать только мастеру смены и не останавливать линию автоматически.', 'In the first week connect one line and export the last 3 months of data to set the limits on history; show signals to the shift supervisor only and do not stop the line automatically.'),
      },
      asis: {
        type: 'mess',
        desc: t('Автоматизировать учёт результатов финальных испытаний как есть значит быстрее фиксировать брак, который уже собран. Ожидание составляет {waitShare} % времени на линии, а работа людей на ней — минуты.', 'Automating the records of the final tests as they are means recording faster a defect that is already assembled. Waiting is {waitShare}% of the time on the line and people\'s work on it is minutes.'),
        measure: t('Не автоматизировать. В первую неделю замерить долю двигателей, которые не проходят КПД с первого раза, и на каком посту дефект впервые виден.', 'Do not automate. In the first week measure the share of motors that fail efficiency at the first attempt and at which post the defect first shows.'),
      },
    },
    pilot: {
      tobe: {
        scale: t('Одна линия, одна смена, 2 недели; сигнал видит мастер смены, линия не останавливается автоматически.', 'One line, one shift, 2 weeks; the shift supervisor sees the signal and the line does not stop automatically.'),
        kpi: t('Доля двигателей с отклонением КПД на испытаниях, у которых раньше был сигнал контроля.', 'The share of motors with an efficiency deviation at the tests that had a control signal earlier.'),
        target: t('Сигнал предшествует не менее чем 60 % отклонений при не более чем одном ложном сигнале на смену. Стартовая цель, уточните по данным линии.', 'The signal precedes at least 60% of deviations with no more than one false signal per shift. A starting target: refine it with the line\'s data.'),
      },
      asis: {
        tech: ['DASH'],
        scale: t('Замер на одной линии за 2 недели: где и когда дефект виден впервые.', 'Measure one line for 2 weeks: where and when a defect first shows.'),
        kpi: t('Доля двигателей, не прошедших КПД с первого раза, и пост, на котором виден дефект.', 'The share of motors failing efficiency at the first attempt, and the post where the defect shows.'),
        target: t('Допущение модели (2,5 % несоответствий по КПД) заменено замером.', 'The model\'s assumption (2.5% efficiency non-conformities) is replaced by a measurement.'),
      },
    },
  },

  /* ------------------------------------------------------------ 3. sourcing */
  {
    key: 'weg-procurement',
    matrix: 'weg-procurement-tobe',
    steps: [
      {
        id: 'vmi',
        tobe: { tech: ['ERP', 'API'], why: t('Сигнал о расходе уходит в портал поставщика сам; заказ на каждую партию не оформляется вовсе.', 'The consumption signal goes to the supplier portal by itself; no order is placed for each batch at all.') },
        asis: {
          step: t('Заказ и приёмка на каждую партию крепежа, расходников и упаковки', 'An order and a receipt for every batch of fasteners, consumables and packaging'),
          tech: ['RPA'],
          why: t('Робот будет оформлять те же мелкие заказы быстрее, но их не должно быть вовсе: нужно убрать шаг, а не ускорить его.', 'A robot would place the same small orders faster, but there should be none: remove the step instead of speeding it up.'),
        },
      },
      {
        id: 'hedge',
        tobe: { tech: ['BPM'], why: t('Решение переносится в правило (доля биржевой составляющей, горизонт), BPM ведёт пакетное подтверждение казначейства.', 'The decision moves into a rule (exchange-linked share, horizon) and BPM runs the treasury\'s batch confirmation.') },
        asis: {
          step: t('Хедж по каждой позиции решают вручную, 30 мин', 'The hedge is decided by hand for every item, 30 min'),
          tech: ['RPA'],
          why: t('Робот не принимает решений в неопределённости; решение сначала нужно превратить в правило, и только его можно автоматизировать.', 'A robot does not decide under uncertainty; the decision first has to become a rule, and only a rule can be automated.'),
        },
      },
      {
        id: 'sample',
        tobe: { tech: ['IDP', 'ERP'], why: t('IDP читает электронный сертификат до прихода груза, ERP выбирает партии в выборку контроля.', 'IDP reads the electronic certificate before the goods arrive and ERP picks the batches into the inspection sample.') },
        asis: {
          step: t('Входной контроль каждой партии и бумажные сертификаты', 'Incoming inspection of every batch and paper certificates'),
          tech: ['IDP'],
          why: t('IDP прочитает бумажный сертификат, но контроль 100 % партий останется: выборка — организационное решение, а не функция чтения.', 'IDP would read a paper certificate, but 100% inspection stays: sampling is an organisational decision, not a reading function.'),
        },
      },
      {
        id: 'match',
        tobe: { tech: ['ERP', 'RPA'], why: t('Трёхсторонняя сверка — штатная функция ERP; RPA нужен только если счёт приходит вне ERP.', 'Three-way matching is a standard ERP function; RPA is only needed if the invoice arrives outside ERP.') },
        asis: {
          step: t('Сверка заказ — приёмка — счёт вручную, 10 мин', 'Order–receipt–invoice matching by hand, 10 min'),
          tech: ['RPA'],
          why: t('Робот сверит быстро, но расхождения (в модели 7 %) всё равно потребуют человека: нужен регламент их разбора.', 'A robot would match quickly, but the mismatches (7% in the model) still need a person: a handling procedure is needed.'),
        },
      },
      {
        id: 'qualify',
        tobe: { tech: ['BPM', 'ERP'], why: t('Реестр квалифицированных поставщиков — справочник в ERP, а первичный аудит идёт по BPM-маршруту.', 'The register of qualified suppliers is a reference table in ERP and the first audit runs on a BPM route.') },
        asis: {
          step: t('Полный аудит поставщика на 12 % заказов: 240 мин и R$ 3,8 тыс.', 'A full supplier audit on 12% of orders: 240 min and R$ 3.8k'),
          tech: ['BPM'],
          why: t('Маршрут аудита ускорит бумаги, но аудит останется при каждом новом заказе; правило «один раз при входе в реестр» важнее инструмента.', 'An audit route would speed up the paperwork, but the audit stays on every new order; the rule "once, on entry to the register" matters more than the tool.'),
        },
      },
    ],
    risk: {
      step: 'match',
      tobe: {
        type: 'tech',
        desc: t('Счета приходят из нескольких систем и в разных форматах, интеграция с унаследованным ERP сложнее, чем планировали, а 7 % расхождений без отлаженного регламента просто переедут в очередь к финансам.', 'Invoices come from several systems in different formats, integration with the legacy ERP is harder than planned, and without a tuned procedure the 7% mismatches will simply move into finance\'s queue.'),
        measure: t('В первую неделю взять одного крупного поставщика, прогнать сверку на его счетах за последний квартал и записать типы расхождений: из них получится регламент разбора.', 'In the first week take one large supplier, run the matching on its invoices for the last quarter and write down the types of mismatch: they become the handling procedure.'),
      },
      asis: {
        type: 'mess',
        desc: t('Автоматизировать ручную сверку как есть значит быстрее разбирать мелкие заказы, которых не должно быть. Срок закупки в основном ожидание поставщика ({waitShare} %), и сверка на него не влияет.', 'Automating manual matching as it is means handling faster small orders that should not exist. The lead time is mostly waiting for the supplier ({waitShare}%) and matching does not affect it.'),
        measure: t('Не автоматизировать. В первую неделю посчитать, какая доля заказов приходится на класс C и сколько из них можно убрать консигнацией.', 'Do not automate. In the first week count what share of orders falls on C-class items and how many of them consignment could remove.'),
      },
    },
    pilot: {
      tobe: {
        scale: t('Один поставщик с самым большим числом счетов, 2 недели, автоматическая сверка идёт параллельно с ручной.', 'One supplier with the most invoices, 2 weeks, automatic matching runs in parallel with the manual one.'),
        kpi: t('Доля счетов, прошедших сверку без вмешательства человека.', 'The share of invoices that pass matching without a person.'),
        target: t('Не ниже 90 % (в модели 93 %), расхождения классифицированы по типам. Стартовая цель, уточните по данным.', 'At least 90% (the model has 93%), mismatches classified by type. A starting target: refine it with data.'),
      },
      asis: {
        tech: ['DASH'],
        scale: t('Замер на заказах одного закупщика за 2 недели.', 'Measure one buyer\'s orders over 2 weeks.'),
        kpi: t('Доля заказов класса C и доля заказов с полным аудитом поставщика.', 'The share of C-class orders and the share of orders with a full supplier audit.'),
        target: t('Допущения модели (34 % и 12 %) заменены замером.', 'The model\'s assumptions (34% and 12%) are replaced by measurements.'),
      },
    },
  },

  /* ----------------------------------------------------- 4. engineer to order */
  {
    key: 'weg-eto',
    matrix: 'weg-eto-tobe',
    steps: [
      {
        id: 'parallel',
        tobe: { tech: ['BPM'], why: t('Один маршрут одновременно запускает закупку длинных позиций и проектирование, а BPM следит, чтобы ветки сошлись.', 'One route starts long-lead procurement and design at once, and BPM makes sure the branches meet again.') },
        asis: {
          step: t('Закупка длинных позиций стартует после окончания проектирования', 'Long-lead procurement starts after the design is finished'),
          tech: ['BPM'],
          why: t('BPM и сейчас мог бы вести такой маршрут, но порядок работ — решение, а не инструмент: сначала поменять порядок.', 'BPM could run this route as it is, but the order of work is a decision, not a tool: change the order first.'),
        },
      },
      {
        id: 'fat',
        tobe: { tech: ['NONE'], why: t('Видеоканал и запись — готовые сервисы; автоматизировать нечего, меняется формат приёмки.', 'A video link and a recording are ready-made services; there is nothing to automate, the format of acceptance changes.') },
        asis: {
          step: t('FAT с выездом заказчика: R$ 8,5 тыс. на испытание', 'A FAT with the customer travelling: R$ 8.5k per test'),
          tech: ['NONE'],
          why: t('Автоматизировать нечего: расход — это поездки, а не ввод данных.', 'There is nothing to automate: the cost is travel, not data entry.'),
        },
      },
      {
        id: 'configurator',
        tobe: { tech: ['CRM', 'ERP'], why: t('Конфигуратор с правилами и библиотекой исполнений даёт характеристики и цену за минуты; сложные случаи остаются у инженера.', 'A configurator with rules and a library of executions gives the specification and price in minutes; complex cases stay with the engineer.') },
        asis: {
          step: t('Инженер вручную рассчитывает исполнение (7 ч) и менеджер считает цену (2 ч)', 'An engineer sizes the execution by hand (7 h) and a salesperson works out the price (2 h)'),
          tech: ['RPA'],
          why: t('Робот перенесёт цифры между файлами, а расчёт всё равно делает инженер: нужна библиотека исполнений, а не робот.', 'A robot would move numbers between files, but the engineer still does the calculation: what is needed is a library of executions, not a robot.'),
        },
      },
      {
        id: 'modular',
        tobe: { tech: ['NONE', 'ERP'], why: t('Это конструкторская работа (модули); ERP лишь хранит библиотеку узлов.', 'This is design work (modules); ERP only stores the library of units.') },
        asis: {
          step: t('Рабочий проект с нуля: 2400 мин конструктора', 'A working design from scratch: 2,400 min of a designer'),
          tech: ['NONE'],
          why: t('Сокращение даёт повторное использование узлов, а не программа: автоматизировать нечего.', 'The reduction comes from reusing units, not from software: there is nothing to automate.'),
        },
      },
      {
        id: 'twin',
        tobe: { tech: ['PRED'], why: t('Цифровой двойник — расчётная модель, близкая к предиктивной аналитике: режимы проверяются до сборки.', 'A digital twin is a calculation model close to predictive analytics: the duty points are checked before assembly.') },
        asis: {
          step: t('Режимы проверяют на стенде при испытаниях', 'The duty points are checked on the test bench at the tests'),
          tech: ['PRED'],
          why: t('В модели двойник стоит R$ 9 тыс. на заказ и окупается только качеством поставки, которое процесс не считает; решать по пилоту на одном заказе.', 'In the model the twin costs R$ 9k per order and pays back only through delivery quality, which the process does not count; decide on a pilot with one order.'),
        },
      },
    ],
    risk: {
      step: 'configurator',
      tobe: {
        type: 'mess',
        desc: t('Исполнения у WEG делались проект за проектом, и единой библиотеки нет. Если конфигуратор строить на неупорядоченных данных, он быстро выдаст неверные цены, а продавцы и инженеры перестанут ему верить.', 'Executions were built project by project and there is no single library. A configurator built on unordered data will quickly produce wrong prices, and salespeople and engineers will stop trusting it.'),
        measure: t('В первую неделю собрать 20 последних выполненных заказов в один шаблон исполнения, сравнить расчётную цену с фактической и выбрать три исполнения, которые покрывают больше всего запросов.', 'In the first week collect the 20 latest completed orders into one execution template, compare the calculated price with the actual one and pick the three executions that cover the most enquiries.'),
      },
      asis: {
        type: 'mess',
        desc: t('Автоматизировать ручной расчёт исполнения как есть значит быстрее считать каждую машину с нуля. Ожидание — {waitShare} % срока, а работа людей — остальное, и ускорять её без библиотеки исполнений можно разве что чуть-чуть.', 'Automating the manual sizing as it is means working out every machine from scratch faster. Waiting is {waitShare}% of lead time and people\'s work the rest, and without a library of executions it can be sped up only a little.'),
        measure: t('Не автоматизировать. В первую неделю замерить, сколько запросов действительно уникальны, а сколько повторяют прежние исполнения.', 'Do not automate. In the first week measure how many enquiries are really unique and how many repeat earlier executions.'),
      },
    },
    pilot: {
      tobe: {
        scale: t('Три самых частых исполнения, один продавец и один инженер, 2 недели, конфигуратор считает рядом с ручным расчётом.', 'The three most frequent executions, one salesperson and one engineer, 2 weeks, the configurator calculates alongside the manual calculation.'),
        kpi: t('Время от запроса до предложения и расхождение цены конфигуратора с ручной.', 'The time from enquiry to quotation and the gap between the configurator\'s price and the manual one.'),
        target: t('Предложение в тот же день, расхождение цены не более 3 %. Стартовая цель, уточните по данным.', 'A same-day quotation, a price gap of no more than 3%. A starting target: refine it with data.'),
      },
      asis: {
        tech: ['DASH'],
        scale: t('Замер на последних 30 запросах за 2 недели.', 'Measure the last 30 enquiries over 2 weeks.'),
        kpi: t('Доля запросов, которые повторяют ранее выполненное исполнение.', 'The share of enquiries that repeat an execution done before.'),
        target: t('Допущение модели (68 % запросов закрывает библиотека) заменено замером.', 'The model\'s assumption (68% of enquiries covered by a library) is replaced by a measurement.'),
      },
    },
  },

  /* ----------------------------------------------------------- 5. transformer */
  {
    key: 'weg-gtd',
    matrix: 'weg-gtd-tobe',
    steps: [
      {
        id: 'parallel',
        tobe: { tech: ['BPM'], why: t('Заказ материалов по платформенной спецификации запускается маршрутом сразу после контракта.', 'Ordering materials by the platform specification starts on a route right after the contract.') },
        asis: {
          step: t('Сердечник, провод и масло заказывают после рабочего проекта', 'Core, wire and oil are ordered after the working design'),
          tech: ['BPM'],
          why: t('Маршрут можно настроить и сейчас, но порядок работ — решение руководителя проекта, а не функция системы.', 'A route can be set up now, but the order of work is the project manager\'s decision, not a system function.'),
        },
      },
      {
        id: 'commission',
        tobe: { tech: ['NONE'], why: t('Удалённая поддержка — канал связи и регламент, а не автоматизация.', 'Remote support is a communication channel and a procedure, not automation.') },
        asis: {
          step: t('Бригада работает на подстанции весь срок пусконаладки: 1440 мин', 'The crew works at the substation for the whole commissioning: 1,440 min'),
          tech: ['NONE'],
          why: t('Это физическая работа на площадке: автоматизировать нечего.', 'This is physical work on site: there is nothing to automate.'),
        },
      },
      {
        id: 'typetests',
        tobe: { tech: ['NONE', 'ERP'], why: t('Объём испытаний решает заказчик и стандарт; ERP хранит протоколы платформы и подставляет их в документацию заказа.', 'The scope of tests is decided by the customer and the standard; ERP stores the platform records and drops them into the order documentation.') },
        asis: {
          step: t('Полная программа типовых испытаний на каждом трансформаторе: 960 мин и R$ 45 тыс.', 'The full type-test programme on every transformer: 960 min and R$ 45k'),
          tech: ['NONE'],
          why: t('Автоматизировать нечего: стоит стенд и время испытателей, а не ввод данных.', 'There is nothing to automate: the cost is the test bay and the testers\' time, not data entry.'),
        },
      },
      {
        id: 'platform',
        tobe: { tech: ['CRM', 'ERP'], why: t('Библиотека платформ с расчётными правилами в ERP; тендер, который платформа закрывает, получает предварительный расчёт за минуты.', 'A library of platforms with calculation rules in ERP; a tender that a platform covers gets its preliminary calculation in minutes.') },
        asis: {
          step: t('Предварительный расчёт активной части под каждый тендер: 720 мин', 'A preliminary active-part calculation for every tender: 720 min'),
          tech: ['RPA'],
          why: t('Робот перенесёт цифры между файлами, а расчёт всё равно делается заново под каждый тендер.', 'A robot would move numbers between files, but the calculation is still redone for every tender.'),
        },
      },
      {
        id: 'capacity',
        tobe: { tech: ['EQUIP'], why: t('Расширение мощностей — оборудование и здания; ПО лишь планирует слоты.', 'Capacity expansion is equipment and buildings; software only plans the slots.') },
        asis: {
          step: t('Очередь между сушкой, намоткой и заливкой: ожидание 1440 мин', 'A queue between drying, winding and filling: 1,440 min of waiting'),
          tech: ['NONE'],
          why: t('Очередь создаёт нехватка мощностей; планировщик в ERP её не уберёт.', 'The queue comes from a shortage of capacity; a scheduler in ERP will not remove it.'),
        },
      },
    ],
    risk: {
      step: 'platform',
      tobe: {
        type: 'mess',
        desc: t('Типоразмеры ещё не стандартизированы: если ставить конфигуратор поверх индивидуальных расчётов, он закрепит разнобой и ускорит выдачу тендерных цен, которым не доверяют.', 'Ratings are not yet standardised: a configurator on top of individual calculations will fix the diversity and speed up tender prices nobody trusts.'),
        measure: t('В первую неделю разобрать последние 15 тендеров по типоразмерам, выбрать три платформы, которые покрывают большинство, и сверить их предварительный расчёт с итоговым.', 'In the first week sort the last 15 tenders by rating, pick the three platforms that cover most of them and check their preliminary calculation against the final one.'),
      },
      asis: {
        type: 'mess',
        desc: t('Автоматизировать расчёт под каждый тендер как есть значит быстрее считать то, что можно было взять из платформы. Ожидание — {waitShare} % срока, и ускорение расчёта его не тронет.', 'Automating the per-tender calculation as it is means calculating faster what could be taken from a platform. Waiting is {waitShare}% of lead time and a faster calculation does not touch it.'),
        measure: t('Не автоматизировать. В первую неделю замерить, какая доля тендеров укладывается в уже выполненные типоразмеры.', 'Do not automate. In the first week measure what share of tenders fits ratings already delivered.'),
      },
    },
    pilot: {
      tobe: {
        scale: t('Три платформы, два инженера, 5 новых тендеров за 2 недели, платформенный расчёт сверяется с ручным.', 'Three platforms, two engineers, 5 new tenders in 2 weeks, the platform calculation checked against the manual one.'),
        kpi: t('Время предварительного расчёта и расхождение с итоговым расчётом.', 'The preliminary calculation time and the gap from the final calculation.'),
        target: t('Расчёт за 3 часа вместо 12 (в модели 720 → 180 мин), расхождение не более 5 %. Стартовая цель, уточните по данным.', 'A calculation in 3 hours instead of 12 (720 → 180 min in the model), a gap of no more than 5%. A starting target: refine it with data.'),
      },
      asis: {
        tech: ['DASH'],
        scale: t('Замер на последних 15 тендерах за 2 недели.', 'Measure the last 15 tenders over 2 weeks.'),
        kpi: t('Доля тендеров, которые укладываются в уже выполненный типоразмер.', 'The share of tenders that fit a rating already delivered.'),
        target: t('Допущение модели (64 % тендеров закрывает платформа) заменено замером.', 'The model\'s assumption (64% of tenders covered by a platform) is replaced by a measurement.'),
      },
    },
  },

  /* ---------------------------------------------------------------- 6. service */
  {
    key: 'weg-service',
    matrix: 'weg-service-tobe',
    steps: [
      {
        id: 'remote',
        tobe: { tech: ['PRED', 'BOT'], why: t('Диагностику по телеметрии делают правила и модель, а чат-бот собирает данные заявки у клиента; сложный случай уходит к технику.', 'Rules and a model do the diagnosis from telemetry and a chatbot collects the request data from the customer; a hard case goes to a technician.') },
        asis: {
          step: t('Диагностика по звонку: техник смотрит данные привода, 35 мин', 'Diagnosis by phone: a technician reads the drive data, 35 min'),
          tech: ['BOT'],
          why: t('Чат-бот соберёт данные для заявки, но диагностика всё равно будет по телефону: телеметрии для неё нет.', 'A chatbot would collect the data for the request, but the diagnosis would still be by phone: there is no telemetry for it.'),
        },
      },
      {
        id: 'warranty',
        tobe: { tech: ['ERP', 'CRM'], why: t('Гарантийный статус записан в цифровой паспорт оборудования и читается из ERP и CRM без участия человека.', 'The warranty status is written into the equipment\'s digital passport and read from ERP and CRM with no person involved.') },
        asis: {
          step: t('Гарантийный статус определяют вручную, 15 мин', 'The warranty status is determined by hand, 15 min'),
          tech: ['RPA'],
          why: t('Робот найдёт дату продажи в двух системах, но если паспорта оборудования нет, данные остаются неполными.', 'A robot would find the sale date in two systems, but with no equipment passport the data stays incomplete.'),
        },
      },
      {
        id: 'parts',
        tobe: { tech: ['PRED', 'ERP'], why: t('Прогноз отказов подсказывает, какие запчасти держать на региональном складе, а ERP их резервирует.', 'The failure forecast says which parts to keep on a regional shelf and ERP reserves them.') },
        asis: {
          step: t('Запчасти заказывают после диагностики: ожидание 4 дня', 'Parts are ordered after the diagnosis: 4 days of waiting'),
          tech: ['NONE'],
          why: t('Автоматизировать заказ нет смысла: ожидание — это доставка, а не ввод заказа.', 'Automating the ordering makes no sense: the wait is delivery, not order entry.'),
        },
      },
      {
        id: 'quote',
        tobe: { tech: ['BPM', 'CRM'], why: t('Смета и согласование идут маршрутом BPM в портале клиента, данные ложатся в CRM.', 'The quotation and its approval run on a BPM route in the customer portal and the data goes to CRM.') },
        asis: {
          step: t('Смета согласуется письмами: ожидание 3 дня', 'The quotation is approved by letters: 3 days of waiting'),
          tech: ['BPM'],
          why: t('Маршрут согласования ускорит передачу, но клиент по-прежнему не видит обоснования и ждёт решения.', 'An approval route would speed up the hand-offs, but the customer still does not see the reasoning and waits for a decision.'),
        },
      },
      {
        id: 'monitoring',
        tobe: { tech: ['PRED'], why: t('Модель по вибрации, температуре и току открывает обращение до отказа; это предиктивная аналитика в чистом виде.', 'A model on vibration, temperature and current opens the case before the failure: predictive analytics in its pure form.') },
        asis: {
          step: t('Обращение начинается со звонка клиента после отказа', 'A case starts with the customer\'s call after the failure'),
          tech: ['NONE'],
          why: t('Нечего автоматизировать: события нет, пока нет телеметрии.', 'There is nothing to automate: there is no event until there is telemetry.'),
        },
      },
    ],
    risk: {
      step: 'remote',
      tobe: {
        type: 'tech',
        desc: t('Телеметрия привода уже стоит у части парка и приходит в разных форматах от разных поколений оборудования; интеграция с ними сложнее, чем казалось, а ошибочный диагноз по данным обойдётся дороже, чем звонок.', 'Drive telemetry is already installed on part of the fleet and arrives in different formats from different equipment generations; integrating it is harder than it looked, and a wrong diagnosis from data costs more than a call.'),
        measure: t('В первую неделю взять один тип привода с подключённой телеметрией, сверить диагнозы модели с решениями техников по последним 50 обращениям и записать расхождения.', 'In the first week take one drive type with telemetry connected, compare the model\'s diagnoses with the technicians\' decisions on the last 50 cases and write the disagreements down.'),
      },
      asis: {
        type: 'mess',
        desc: t('Автоматизировать диагностику по звонку как есть значит быстрее принимать звонки. Срок обращения — {waitShare} % ожидание (вывоз, смета, запчасти), и ускорение звонка его не сократит.', 'Automating diagnosis by phone as it is means taking calls faster. The case lead time is {waitShare}% waiting (collection, quotation, parts) and a faster call does not shorten it.'),
        measure: t('Не автоматизировать. В первую неделю замерить, какая доля обращений закрывается по звонку и сколько их ушло на вывоз зря.', 'Do not automate. In the first week measure what share of cases close by phone and how many were collected for nothing.'),
      },
    },
    pilot: {
      tobe: {
        scale: t('Один тип привода, один сервисный партнёр, 2 недели, диагноз модели сверяется с решением техника.', 'One drive type, one service partner, 2 weeks, the model\'s diagnosis checked against the technician\'s decision.'),
        kpi: t('Доля обращений, закрытых удалённо без повторного обращения за 7 дней.', 'The share of cases closed remotely with no repeat case within 7 days.'),
        target: t('Не ниже 50 % (в модели 58 %). Стартовая цель, уточните по данным.', 'At least 50% (the model has 58%). A starting target: refine it with data.'),
      },
      asis: {
        tech: ['DASH'],
        scale: t('Замер на последних 50 обращениях за 2 недели.', 'Measure the last 50 cases over 2 weeks.'),
        kpi: t('Доля обращений, закрытых по звонку, и ожидание вывоза, сметы и запчастей.', 'The share of cases closed by phone and the waiting for collection, quotation and parts.'),
        target: t('Допущения модели (35 %; 2, 3 и 4 дня) заменены замером.', 'The model\'s assumptions (35%; 2, 3 and 4 days) are replaced by measurements.'),
      },
    },
  },

  /* ---------------------------------------------------------- 7. new product */
  {
    key: 'weg-npd',
    matrix: 'weg-npd-tobe',
    steps: [
      {
        id: 'tooling',
        tobe: { tech: ['NONE', 'ERP'], why: t('Слот бронируется письмом изготовителю оснастки; ERP только фиксирует бронь и срок.', 'The slot is reserved by a letter to the tooling maker; ERP only records the reservation and the date.') },
        asis: {
          step: t('Оснастку заказывают после ворот 3, ожидание 30 дней', 'Tooling is ordered after Gate 3, 30 days of waiting'),
          tech: ['NONE'],
          why: t('Это очередь у изготовителя: автоматизировать нечего, нужно занять слот раньше.', 'It is a queue at the tooling maker: there is nothing to automate, the slot has to be taken earlier.'),
        },
      },
      {
        id: 'cert',
        tobe: { tech: ['BPM'], why: t('Параллельный маршрут досье и испытаний с вехой обмена данными: BPM следит, чтобы данные поступали вовремя.', 'A parallel route for the dossier and the tests with a data-exchange milestone: BPM makes sure the data arrives on time.') },
        asis: {
          step: t('Сертификацию подают после испытаний, ожидание органа 40 дней', 'Certification is filed after the tests, 40 days of waiting for the body'),
          tech: ['BPM'],
          why: t('Маршрут подачи ускорит бумаги, но срок определяет очередь органа сертификации, а порядок подачи — решение проекта.', 'A filing route would speed up the paperwork, but the date is set by the certification body\'s queue and the order of filing is the project\'s decision.'),
        },
      },
      {
        id: 'market',
        tobe: { tech: ['CRM', 'PRED'], why: t('Данные продаж и сервиса установленного парка из CRM и аналитика спроса вместо отдельного исследования.', 'Sales and service data of the installed base from CRM and demand analytics instead of a separate study.') },
        asis: {
          step: t('Рынок оценивают отдельным исследованием: 960 мин аналитика', 'The market is sized by a separate study: 960 min of an analyst'),
          tech: ['RPA'],
          why: t('Робот соберёт данные из нескольких файлов, но исследование останется отдельным и снова начнётся с нуля.', 'A robot would collect data from several files, but the study stays separate and starts from zero again.'),
        },
      },
      {
        id: 'calc',
        tobe: { tech: ['PRED'], why: t('Численная оптимизация активной части решает, достигнут ли класс КПД, до изготовления образца: это расчётная модель, а не RPA.', 'Numerical optimisation of the active part decides whether the efficiency class is reached before a prototype is built: a calculation model, not RPA.') },
        asis: {
          step: t('Класс КПД проверяют испытанием, доводка нужна в 30 % случаев', 'The efficiency class is checked by testing, refinement is needed in 30% of cases'),
          tech: ['DASH'],
          why: t('Дашборд покажет, сколько доводок было; он смотрит назад и стоимость цикла не снизит.', 'A dashboard would show how many refinements there were; it looks back and does not cut the cost of the cycle.'),
        },
      },
      {
        id: 'modules',
        tobe: { tech: ['NONE', 'ERP'], why: t('Модульная платформа — решение инженеров; ERP или PDM хранит библиотеку модулей.', 'A modular platform is the engineers\' decision; ERP or PDM stores the library of modules.') },
        asis: {
          step: t('Концепция с нуля: 1920 мин ведущего инженера', 'A concept from scratch: 1,920 min of a senior engineer'),
          tech: ['NONE'],
          why: t('Автоматизировать нечего: сокращение даёт повторное использование модулей.', 'There is nothing to automate: the reduction comes from reusing modules.'),
        },
      },
    ],
    risk: {
      step: 'calc',
      tobe: {
        type: 'tech',
        desc: t('Модели оптимизации не откалиброваны по испытаниям WEG: если они ошибаются, проект получает уверенный, но неверный ответ о классе КПД, и ошибку находит дорогой испытательный цикл.', 'The optimisation models are not calibrated on WEG\'s tests: if they are wrong the project gets a confident but wrong answer about the efficiency class, and an expensive test cycle finds the error.'),
        measure: t('В первую неделю прогнать модель на 10 уже испытанных двигателях и сравнить предсказанный КПД с измеренным; в проект пускать модель только с известной погрешностью.', 'In the first week run the model on 10 motors already tested and compare the predicted efficiency with the measured one; admit the model into projects only with a known error.'),
      },
      asis: {
        type: 'mess',
        desc: t('Автоматизировать учёт испытаний как есть значит быстрее фиксировать доводки, которых могло не быть. Срок проекта — {waitShare} % ожидание (сертификация, оснастка, образец), и ускорение учёта его не тронет.', 'Automating test records as they are means recording faster refinements that might not have been needed. The project lead time is {waitShare}% waiting (certification, tooling, prototype) and faster records do not touch it.'),
        measure: t('Не автоматизировать. В первую неделю взять 10 завершённых проектов и посчитать, в скольких классу КПД не хватило при первом испытании.', 'Do not automate. In the first week take 10 completed projects and count in how many the efficiency class was missed at the first test.'),
      },
    },
    pilot: {
      tobe: {
        scale: t('Один проект в разработке, один ведущий инженер, 2 недели, оптимизация считает рядом с обычным расчётом.', 'One project in development, one senior engineer, 2 weeks, the optimisation runs alongside the usual calculation.'),
        kpi: t('Расхождение предсказанного КПД с результатом испытания образца.', 'The gap between the predicted efficiency and the prototype test result.'),
        target: t('Не более 0,3 процентного пункта КПД. Стартовая цель, уточните по данным испытаний.', 'No more than 0.3 percentage points of efficiency. A starting target: refine it with test data.'),
      },
      asis: {
        tech: ['DASH'],
        scale: t('Замер на 10 завершённых проектах за 2 недели.', 'Measure 10 completed projects over 2 weeks.'),
        kpi: t('Доля проектов, которым класса КПД не хватило при первом испытании.', 'The share of projects that missed the efficiency class at the first test.'),
        target: t('Допущение модели (доводка в 30 % случаев) заменено замером.', 'The model\'s assumption (refinement in 30% of cases) is replaced by a measurement.'),
      },
    },
  },

  /* ---------------------------------------------------------------- 8. export */
  {
    key: 'weg-export',
    matrix: 'weg-export-tobe',
    steps: [
      {
        id: 'preclear',
        tobe: { tech: ['BPM', 'API'], why: t('Документы уходят брокеру в стране назначения по маршруту, чтобы декларация готовилась до прихода судна.', 'The documents go to the broker at the destination along a route so the declaration is prepared before the ship arrives.') },
        asis: {
          step: t('Импорт оформляют после прихода судна: ожидание 4 дня', 'Import is cleared after the ship arrives: 4 days of waiting'),
          tech: ['NONE'],
          why: t('Ожидание создаёт порядок работ, а не медленный ввод: сначала поменять порядок.', 'The wait comes from the order of work, not slow data entry: change the order first.'),
        },
      },
      {
        id: 'freight',
        tobe: { tech: ['NONE', 'ERP'], why: t('Годовой контракт — переговоры, ERP только подставляет ставки в букинг.', 'An annual contract is a negotiation, ERP only fills the rates into the booking.') },
        asis: {
          step: t('Разовый букинг и отдельный полис на каждую отправку', 'A one-off booking and a separate policy for each shipment'),
          tech: ['RPA'],
          why: t('Робот быстрее оформит букинг, но ставки и ожидание слота (2 дня) останутся: цена зависит от условий, а не от ввода.', 'A robot would book faster, but the rates and the wait for a slot (2 days) stay: the price depends on terms, not on entry.'),
        },
      },
      {
        id: 'ebl',
        tobe: { tech: ['API', 'BPM'], why: t('Электронный коносамент и комплект документов уходят банку и заказчику по маршруту сразу после погрузки.', 'The electronic bill of lading and the document set go to the bank and the customer on a route right after loading.') },
        asis: {
          step: t('Бумажный комплект документов пересылают курьером банку и заказчику', 'A paper document set is sent by courier to the bank and the customer'),
          tech: ['NONE'],
          why: t('Автоматизировать курьера нельзя: нужно убрать бумагу, а для этого банк и заказчик должны принимать электронный документ.', 'A courier cannot be automated: the paper has to go, and for that the bank and the customer must accept an electronic document.'),
        },
      },
      {
        id: 'docs',
        tobe: { tech: ['ERP'], why: t('Инвойс, packing list и сертификат происхождения — отчёты ERP из данных заказа одним пакетом.', 'The invoice, packing list and certificate of origin are ERP reports from the order data, as one set.') },
        asis: {
          step: t('Инвойс, packing list и сертификат оформляют вручную, 90 мин', 'The invoice, packing list and certificate are prepared by hand, 90 min'),
          tech: ['RPA'],
          why: t('Робот перенесёт данные в шаблоны, но шаблонов несколько и каждый ведётся отдельно; надёжнее единый источник в ERP.', 'A robot would copy data into templates, but there are several and each is kept separately; a single source in ERP is sturdier.'),
        },
      },
      {
        id: 'oea',
        tobe: { tech: ['NONE'], why: t('Статус OEA — аккредитация, а не система: процессу нужно соответствовать её требованиям.', 'The AEO (OEA) status is an accreditation, not a system: the process has to meet its requirements.') },
        asis: {
          step: t('Нет статуса OEA: 16 % отгрузок идут не по зелёному каналу', 'No AEO (OEA) status: 16% of shipments do not go through the green channel'),
          tech: ['NONE'],
          why: t('Автоматизировать нечего: канал определяет таможня по статусу экспортёра.', 'There is nothing to automate: customs sets the channel by the exporter\'s status.'),
        },
      },
    ],
    risk: {
      step: 'docs',
      tobe: {
        type: 'tech',
        desc: t('Требования к документам различаются по странам и меняются; шаблоны ERP придётся вести по каждому направлению, а ошибка в одном шаблоне остановит контейнер в порту.', 'Document requirements differ by country and change; the ERP templates have to be kept for every destination, and an error in one template stops a container in port.'),
        measure: t('В первую неделю взять одно направление с наибольшим числом отгрузок, собрать его комплект из ERP и сверить с последними 10 принятыми комплектами; расхождения исправить до пилота.', 'In the first week take the destination with the most shipments, generate its set from ERP and compare it with the last 10 accepted sets; fix the differences before the pilot.'),
      },
      asis: {
        type: 'mess',
        desc: t('Автоматизировать ручное оформление документов как есть значит быстрее готовить комплект, который потом ждёт в порту. Срок экспорта — {waitShare} % ожидание (канал, фрахт, оформление), и скорость оформления на него почти не влияет.', 'Automating the manual documents as they are means preparing faster a set that then waits in port. Export lead time is {waitShare}% waiting (channel, freight, clearance) and the speed of preparation hardly affects it.'),
        measure: t('Не автоматизировать. В первую неделю замерить, сколько отгрузок задержано из-за документов и на сколько.', 'Do not automate. In the first week measure how many shipments were delayed by documents and by how much.'),
      },
    },
    pilot: {
      tobe: {
        scale: t('Одно направление, 10 отгрузок, 2 недели; комплект из ERP проверяет брокер параллельно с ручным.', 'One destination, 10 shipments, 2 weeks; the broker checks the ERP set alongside the manual one.'),
        kpi: t('Доля комплектов, принятых брокером и банком с первого раза.', 'The share of sets accepted by the broker and the bank at the first attempt.'),
        target: t('Не ниже 95 %. Стартовая цель, уточните по данным брокера.', 'At least 95%. A starting target: refine it with the broker\'s data.'),
      },
      asis: {
        tech: ['DASH'],
        scale: t('Замер на 20 последних отгрузках за 2 недели.', 'Measure the last 20 shipments over 2 weeks.'),
        kpi: t('Время подготовки комплекта и доля отгрузок, задержанных из-за документов.', 'The time to prepare the set and the share of shipments delayed by documents.'),
        target: t('Допущение модели (90 мин на комплект) заменено замером.', 'The model\'s assumption (90 min per set) is replaced by a measurement.'),
      },
    },
  },

  /* ------------------------------------------------------- Uber Eats in Dubai */
  {
    key: 'uber-dubai-order',
    uber: true,
    steps: [
      {
        id: 'accept',
        step: t('Заказ идёт прямо в кассу и на экран кухни, ответ приходит автоматически', 'The order goes straight to the till and the kitchen display, the answer comes automatically'),
        tobe: { tech: ['API'], why: t('Интеграция с кассой (POS) заменяет планшет: остатки и загрузка сверяются до отправки, 97 % заказов принимаются сразу.', 'Integration with the point-of-sale system replaces the tablet: stock and load are checked before sending and 97% of orders are accepted at once.') },
        asis: {
          step: t('Ресторан принимает заказ на планшете вручную, 10 % не приняты сразу', 'The restaurant accepts the order on a tablet by hand, 10% not accepted at once'),
          tech: ['BOT'],
          why: t('Бот может звонить в ресторан вместо агента, но заказ по-прежнему ждёт человека на планшете.', 'A bot could phone the restaurant instead of an agent, but the order still waits for a person at the tablet.'),
        },
      },
      {
        id: 'dispatch',
        step: t('Курьера вызывают к моменту готовности заказа', 'The courier is called for the moment the order is ready'),
        tobe: { tech: ['PRED'], why: t('Прогноз времени готовности по загрузке кухни и составу заказа откладывает вызов курьера: простой у стойки падает с 4 до 1 минуты.', 'A ready-time forecast from kitchen load and basket delays the courier call: idling at the counter falls from 4 to 1 minute.') },
        asis: {
          step: t('Курьера вызывают в момент принятия заказа и он ждёт у стойки, 4 мин', 'The courier is called when the order is accepted and waits at the counter, 4 min'),
          tech: ['RPA'],
          why: t('Робот не изменит порядок вызова: курьер всё равно приедет раньше еды; нужно менять правило, а не ускорять диспетчера.', 'A robot does not change the order of calls: the courier still arrives before the food; the rule has to change, not the dispatcher\'s speed.'),
        },
      },
      {
        id: 'address',
        step: t('Адрес проверяется по коду Makani, вход и парковка подсказаны', 'The address is checked against the Makani code, entrance and parking are hinted'),
        tobe: { tech: ['API'], why: t('Проверка пина по коду Makani и сохранённые адреса убирают ручной ввод: 0,9 минуты вместо 1,8, недозвонов 4 % вместо 9 %.', 'A pin check against the Makani code and saved addresses remove manual entry: 0.9 minutes instead of 1.8, unreachable 4% instead of 9%.') },
        asis: {
          step: t('Клиент вводит адрес вручную: пин, здание, этаж, квартира', 'The customer types the address by hand: pin, building, floor, apartment'),
          tech: ['NONE'],
          why: t('Автоматизировать нечего: ошибка в данных адреса, а не медленная операция.', 'There is nothing to automate: the fault is in the address data, not a slow operation.'),
        },
      },
      {
        id: 'eta',
        step: t('Предиктивный ETA с проактивными уведомлениями', 'A predictive ETA with proactive notifications'),
        tobe: { tech: ['PRED', 'BOT'], why: t('Модель с поправкой на трафик и жару и автоматические уведомления снижают вопросы «где мой заказ» с 11 до 4 %.', 'A model corrected for traffic and heat and automatic notifications cut "where is my order" questions from 11% to 4%.') },
        asis: {
          step: t('ETA статичный, клиенты спрашивают «где мой заказ» (11 %), отвечает агент', 'A static ETA, customers ask "where is my order" (11%), an agent answers'),
          tech: ['BOT'],
          why: t('Чат-бот ответит на вопрос быстрее агента, но причина вопроса — устаревший ETA — останется.', 'A chatbot would answer faster than an agent, but the cause of the question, a stale ETA, remains.'),
        },
      },
      {
        id: 'complaint',
        step: t('Малые жалобы решаются автоматически по фото, GPS и QR-сверке', 'Small complaints are decided automatically from the photo, GPS and QR check'),
        tobe: { tech: ['PRED', 'BPM'], why: t('Оценка риска злоупотребления и правила решают малые суммы без человека (65 % случаев), BPM ведёт остальные к агенту.', 'An abuse-risk score and rules decide small amounts without a person (65% of cases) and BPM routes the rest to an agent.') },
        asis: {
          step: t('Агент разбирает каждую жалобу вручную: фото, состав, маршрут, 7,5 мин', 'An agent handles every complaint by hand: photo, contents, route, 7.5 min'),
          tech: ['BOT'],
          why: t('Бот примет жалобу, но решение всё равно за агентом: правила решений по малым суммам нужно написать сначала.', 'A bot would take the complaint, but the decision stays with the agent: the rules for small amounts have to be written first.'),
        },
      },
    ],
    risk: {
      step: 'accept',
      tobe: {
        type: 'tech',
        desc: t('Интеграция с кассой McDonald\'s зависит от их систем и сроков: у ресторанов разные версии POS, и пока интеграции нет, заказы продолжат идти на планшет, а платформа будет вести два канала.', 'Integration with McDonald\'s tills depends on their systems and timing: restaurants have different POS versions, and until the integration exists orders keep going to the tablet and the platform runs two channels.'),
        measure: t('В первую неделю выбрать один ресторан с самой свежей версией кассы, согласовать контактное лицо у партнёра и пустить на интеграцию 10 % его заказов, оставив планшет запасным каналом.', 'In the first week pick one restaurant with the newest till version, agree a contact at the partner and route 10% of its orders through the integration, keeping the tablet as a fallback channel.'),
      },
      asis: {
        type: 'mess',
        desc: t('Автоматизировать звонки агента в ресторан как есть значит быстрее выяснять, почему заказ не принят. Срок заказа — {waitShare} % ожидание (кухня, дорога), и звонок на него не влияет.', 'Automating the agent\'s calls to the restaurant as they are means finding out faster why the order was not accepted. The order lead time is {waitShare}% waiting (kitchen, travel) and a call does not affect it.'),
        measure: t('Не автоматизировать. В первую неделю замерить долю заказов, не принятых сразу, и долю договорённостей по звонку.', 'Do not automate. In the first week measure the share of orders not accepted at once and the share resolved on a call.'),
      },
    },
    pilot: {
      tobe: {
        scale: t('Один ресторан McDonald\'s, 2 недели, 10 % его заказов идут через интеграцию.', 'One McDonald\'s restaurant, 2 weeks, 10% of its orders go through the integration.'),
        kpi: t('Доля заказов, принятых рестораном без звонка агента.', 'The share of orders accepted by the restaurant without an agent\'s call.'),
        target: t('Не ниже 95 % (в модели 97 %). Стартовая цель, уточните по данным.', 'At least 95% (the model has 97%). A starting target: refine it with data.'),
      },
      asis: {
        tech: ['DASH'],
        scale: t('Замер на заказах одного ресторана за 2 недели.', 'Measure one restaurant\'s orders over 2 weeks.'),
        kpi: t('Доля заказов, не принятых сразу, и доля договорённостей по звонку.', 'The share of orders not accepted at once and the share resolved on a call.'),
        target: t('Допущения модели (10 % и 35 %) заменены замером.', 'The model\'s assumptions (10% and 35%) are replaced by measurements.'),
      },
    },
  },

  /* ------------------------------------------------------ WEG buyer journey */
  {
    key: 'weg-journey-bpmn',
    journey: true,
    steps: [
      {
        id: 'select',
        step: t('Подбор двигателя в подборщике портала: наличие и срок видны сразу', 'Motor selection in the portal selector: stock and lead time visible at once'),
        tobe: { tech: ['CRM', 'ERP'], why: t('Каталог, остатки и договорные цены подключены к порталу; подбор идёт по правилам, нестандартный случай уходит инженеру.', 'The catalogue, stock and contract prices are connected to the portal; selection runs by rules and a non-standard case goes to an engineer.') },
        asis: {
          step: t('Подбор по каталогу и листам данных, наличие неизвестно', 'Selection from the catalogue and data sheets, stock unknown'),
          tech: ['BOT'],
          why: t('Чат-бот ответит на вопросы о каталоге, но наличия и срока он не знает, пока остатки закрыты от клиента.', 'A chatbot would answer catalogue questions, but it does not know stock or lead time while the stock is closed to the customer.'),
        },
      },
      {
        id: 'order',
        step: t('Заказ из портала или по EDI с автоматической проверкой', 'An order from the portal or via EDI with automatic checks'),
        tobe: { tech: ['ERP', 'API'], why: t('Структурированный заказ приходит в ERP сразу, проверка строк и скоринг идут по правилам.', 'A structured order reaches ERP at once, and the line checks and scoring run by rules.') },
        asis: {
          step: t('Заказ письмом или таблицей, ручная регистрация и проверка артикулов', 'An order by letter or spreadsheet, manual registration and part-number checks'),
          tech: ['IDP'],
          why: t('IDP прочитает письмо, но ошибки в артикулах будут найдены после отправки: нужна проверка на входе.', 'IDP would read the letter, but part-number errors will be found after sending: a check at entry is needed.'),
        },
      },
      {
        id: 'payment',
        step: t('Заказчик выбирает срок оплаты: 30 дней или 7 дней со скидкой', 'The customer chooses the payment term: 30 days or 7 days with a discount'),
        tobe: { tech: ['NONE', 'ERP'], why: t('Выбор срока — условие договора; ERP выставляет счёт нужного варианта и ведёт напоминания.', 'The choice of term is a contract condition; ERP issues the invoice of the chosen option and runs the reminders.') },
        asis: {
          step: t('Счёт всегда на 30 дней, напоминания и взыскание вручную', 'The invoice is always for 30 days, reminders and collections by hand'),
          tech: ['RPA'],
          why: t('Робот разошлёт напоминания, но срок оплаты останется 30 дней и ожидание денег не сократится.', 'A robot would send the reminders, but the term stays 30 days and the wait for the money does not shrink.'),
        },
      },
      {
        id: 'service',
        step: t('Сервис начинается с события мониторинга и закрывается удалённо', 'Service starts from a monitoring event and closes remotely'),
        tobe: { tech: ['PRED', 'BPM'], why: t('Модель по телеметрии открывает обращение, BPM ведёт его от диагностики до возврата двигателя.', 'A model on telemetry opens the case and BPM runs it from diagnosis to the motor\'s return.') },
        asis: {
          step: t('Сервис по звонку клиента после отказа, диагностика по телефону', 'Service on the customer\'s call after a failure, diagnosis by phone'),
          tech: ['BOT'],
          why: t('Чат-бот примет заявку быстрее, но событие по-прежнему возникает после отказа, а не до него.', 'A chatbot would take the request faster, but the event still arises after the failure, not before it.'),
        },
      },
      {
        id: 'reorder',
        step: t('Повторный заказ из истории портала одним нажатием', 'A reorder from the portal history in one tap'),
        tobe: { tech: ['CRM', 'PRED'], why: t('История заказов и обращений в одной карточке клиента CRM; модель предлагает замену по фактической загрузке двигателя.', 'The history of orders and cases in one CRM customer record; a model suggests a replacement from the motor\'s actual load.') },
        asis: {
          step: t('Повтор по старому письму, цена запрашивается заново', 'A repeat from an old letter, the price is asked for again'),
          tech: ['RPA'],
          why: t('Робот найдёт старое письмо, но история заказов и обращений лежит в разных системах и не сходится.', 'A robot would find the old letter, but the order and case history sits in different systems and does not agree.'),
        },
      },
    ],
    risk: {
      step: 'order',
      tobe: {
        type: 'org',
        desc: t('Заказчики годами присылают заказы письмом и привыкли, что менеджер поправит ошибку; не все захотят вводить заказ в портал или подключать EDI, и менеджеры продолжат вводить письма вручную.', 'Customers have sent orders by letter for years and are used to a salesperson fixing mistakes; not all will want to key the order into a portal or connect EDI, and salespeople will keep keying letters by hand.'),
        measure: t('В первую неделю выбрать три крупных заказчика с самым большим числом строк, показать им портал на их собственном последнем заказе и договориться, что менеджер принимает письма только с пометкой «из портала».', 'In the first week pick the three customers with the most order lines, show them the portal on their own last order and agree that salespeople accept letters only marked "from the portal".'),
      },
      asis: {
        type: 'mess',
        desc: t('Автоматизировать приём письма с заказом как есть значит быстрее читать письма с ошибками. Ожидание — {waitShare} % срока пути, и ускорение приёма его не уменьшит.', 'Automating the intake of an order letter as it is means reading letters with errors faster. Waiting is {waitShare}% of the journey\'s lead time and a faster intake does not reduce it.'),
        measure: t('Не автоматизировать. В первую неделю посчитать, какая доля заказов приходит письмом, и сколько строк содержат ошибки артикула.', 'Do not automate. In the first week count what share of orders comes by letter and how many lines contain part-number errors.'),
      },
    },
    pilot: {
      tobe: {
        scale: t('Три заказчика, 2 недели, их заказы идут через портал, менеджер видит только исключения.', 'Three customers, 2 weeks, their orders go through the portal and the salesperson sees only exceptions.'),
        kpi: t('Доля заказов, принятых без вмешательства менеджера.', 'The share of orders accepted without a salesperson\'s intervention.'),
        target: t('Не ниже 90 % (в модели 94 %). Стартовая цель, уточните по данным.', 'At least 90% (the model has 94%). A starting target: refine it with data.'),
      },
      asis: {
        tech: ['DASH'],
        scale: t('Замер на 30 заказах трёх заказчиков за 2 недели.', 'Measure 30 orders of three customers over 2 weeks.'),
        kpi: t('Доля заказов с ошибками строк и время ручной регистрации и проверки.', 'The share of orders with line errors and the time of manual registration and checking.'),
        target: t('Допущения модели (4 и 12 мин) заменены замером.', 'The model\'s assumptions (4 and 12 min) are replaced by measurements.'),
      },
    },
  },
];

/* --------------------------------------------------------------- reference */

/** The lecture's own tables, as reference sheets. */
export const TECH_CLASSES = [
  {
    name: { ru: 'RPA', en: 'RPA' },
    strength: { ru: 'Рутина поверх старых систем: робот имитирует человека в интерфейсе, не трогая код.', en: 'Routine on top of old systems: a robot imitates a person in the interface without touching the code.' },
    limit: { ru: 'Хрупкий: ломается при смене интерфейса; не принимает решений в неопределённости.', en: 'Fragile: breaks when the interface changes; does not decide under uncertainty.' },
    task: { ru: 'Перенос данных между системами, чёткое правило, большой объём.', en: 'Moving data between systems; a clear rule and a large volume.' },
  },
  {
    name: { ru: 'BPM', en: 'BPM' },
    strength: { ru: 'Ведёт маршрут многошагового процесса между исполнителями по схеме BPMN, следит за сроками, хранит историю.', en: 'Runs the route of a multi-step process between performers by the BPMN diagram, watches the deadlines, keeps the history.' },
    limit: { ru: 'Не заменяет саму CRM или ERP.', en: 'Does not replace the CRM or ERP itself.' },
    task: { ru: 'Согласования, заявки, обращения: несколько исполнителей, нужна гибкость маршрута.', en: 'Approvals, requests, cases: several performers and a route that must stay flexible.' },
  },
  {
    name: { ru: 'CRM', en: 'CRM' },
    strength: { ru: 'Готовая логика продаж и обслуживания: воронка, статусы сделки, этапы обслуживания.', en: 'Ready logic of sales and service: the funnel, deal statuses, service stages.' },
    limit: { ru: 'Кастомизация под нестандартный процесс дорога и часто требует разработчика.', en: 'Customising for a non-standard process is expensive and often needs a developer.' },
    task: { ru: 'Процесс, где в центре клиент.', en: 'A process with the customer at the centre.' },
  },
  {
    name: { ru: 'ERP', en: 'ERP' },
    strength: { ru: 'Единая система компании: финансы, склад, закупки, производство; единый источник данных.', en: 'One system for the company: finance, warehouse, purchasing, production; a single source of data.' },
    limit: { ru: 'Самое дорогое и долгое внедрение из четырёх классов; менять логику — серьёзный проект.', en: 'The costliest and longest to introduce of the four; changing the logic is a serious project.' },
    task: { ru: 'Сквозные процессы (финансы ↔ склад).', en: 'End-to-end processes (finance ↔ warehouse).' },
  },
  {
    name: { ru: 'AI: IDP, предиктив, чат-боты', en: 'AI: IDP, predictive, chatbots' },
    strength: { ru: 'IDP читает неструктурированные документы и извлекает поля; предиктивная аналитика смотрит вперёд и предупреждает до проблемы; бот ведёт конечный диалог.', en: 'IDP reads unstructured documents and extracts the fields; predictive analytics looks ahead and warns before the problem; a bot runs a finite dialogue.' },
    limit: { ru: 'Бот хорош там, где сценарий конечен; нужны эмпатия или нестандартное суждение — нужен человек.', en: 'A bot works where the script is finite; when empathy or a non-standard judgement is needed, a person is needed.' },
    task: { ru: 'Понять документ или предугадать риск.', en: 'Understanding a document or foreseeing a risk.' },
  },
];

export const IMPLEMENTATION_STAGES = [
  { ru: 'Оценка готовности процесса: он уже оптимизирован (Тема 4)? Если нет, сначала туда, не сюда.', en: 'Readiness of the process: has it been optimised already (Topic 4)? If not, go there first.' },
  { ru: 'Выбор технологии и пилот: не весь процесс сразу, один участок или один отдел, чтобы дёшево проверить гипотезу.', en: 'Technology choice and pilot: not the whole process at once, one section or one department, to test the hypothesis cheaply.' },
  { ru: 'Интеграция с регламентами и ролями: кто теперь отвечает за шаг, который раньше делал человек; регламент переписывается.', en: 'Integration with procedures and roles: who now owns the step a person used to do; the procedure is rewritten.' },
  { ru: 'Обучение и параллельный запуск: старый и новый процесс идут одновременно, пока доверие к системе не подтверждено.', en: 'Training and parallel running: the old and the new process run together until trust in the system is confirmed.' },
  { ru: 'Полный переход и мониторинг: старый процесс закрывается, KPI показывают, сработало ли на самом деле.', en: 'Full switch-over and monitoring: the old process is closed, the KPIs show whether it really worked.' },
];

export const RISK_TYPES_TEXT = {
  ru: 'Организационные: сотрудники саботируют систему, потому что боятся потерять работу или контроль, требуется коммуникация, а не только технология.\n\nТехнологические: интеграция с унаследованными (legacy) системами оказывается сложнее, чем планировали; учитывайте это уже на этапе оценки.\n\n«Автоматизация бардака»: шаг ещё не оптимизирован, технология просто ускорит проблему, а не решит её; самая частая причина, по которой дорогой проект не окупается.',
  en: 'Organisational: people sabotage the system because they fear losing their job or control; it takes communication, not only technology.\n\nTechnological: integration with legacy systems turns out harder than planned; account for it at the assessment stage.\n\n"Automating the mess": the step is not optimised yet, so the technology merely speeds the problem up instead of solving it; the most common reason an expensive project does not pay back.',
};

export const SUCCESS_FACTORS_TEXT = {
  ru: 'Пилот перед масштабированием: всегда, без исключений.\n\nВладелец процесса вовлечён с самого начала, а не узнаёт о системе на этапе внедрения.\n\nЧёткий KPI «до» и «после», согласованный заранее: иначе невозможно доказать, что проект вообще сработал.\n\nПостепенность: параллельный запуск перед полным переходом снижает риск простоя компании.',
  en: 'A pilot before scaling: always, without exception.\n\nThe process owner is involved from the start rather than learning about the system at the implementation stage.\n\nA clear KPI "before" and "after", agreed in advance: otherwise it cannot be proved that the project worked at all.\n\nGradualness: a parallel run before the full switch-over lowers the risk of the company standing still.',
};

export const GOLDEN_RULE = {
  ru: 'Главное правило: не автоматизируй бардак. Оптимизация меняет ЛОГИКУ процесса: убирает лишние шаги, пересинхронизирует ветки, переставляет точки контроля. Автоматизация оставляет логику прежней (уже оптимизированной) и только меняет исполнителя шага. Она ускоряет исполнение, но не исправляет плохую логику. Один процесс почти всегда требует нескольких разных классов технологий: это и есть Hyperautomation.',
  en: 'The main rule: do not automate the mess. Optimisation changes the LOGIC of a process: it removes extra steps, resynchronises branches, moves control points. Automation keeps the logic as it is (already optimised) and only changes who performs the step. It speeds up execution but does not repair bad logic. One process almost always needs several technology classes: that is hyperautomation.',
};
