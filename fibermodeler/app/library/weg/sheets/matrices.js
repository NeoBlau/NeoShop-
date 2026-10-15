/**
 * Impact / effort worksheets for the eight WEG processes.
 *
 * Each sheet lists five changes taken from the TO-BE model. What the model can
 * say about a change is *measured* (see `engine.js`): impact is the change's
 * share of the process gain, so it comes from the models. Effort is an expert
 * judgement - the models know nothing about contracts, IT or people - and is
 * flagged as such on the sheet.
 *
 * A change is described by:
 *   label    text of the card
 *   effort   1-10, expert assumption (≤ 5 is the left half of the matrix)
 *   measure  how the engine measures it: { revert } or { steps, by }
 *   impact   optional fixed score for a change the models cannot measure
 *   caveat   what the numbers do not capture
 */

export const MATRICES = [
  /* --------------------------------------------------------- 1. order to cash */
  {
    processId: 'weg-o2c-tobe',
    weights: { lead: 1, cost: 1, work: 0.5 },
    first: 'early',
    why: {
      ru: 'Ранняя оплата стоит пункта в договоре и согласования с финансами, а не разработки, и по модели без неё срок до денег длиннее на {lead}: это больше всего выигрыша процесса по сроку ({leadShare}). Цена видна сразу, скидка обходится ≈ {year} в год, поэтому её запускают пилотом на части клиентов.',
      en: 'Early payment costs a contract clause and a finance sign-off, not development, and in the model the time to cash is {lead} longer without it: that is more than the whole lead-time gain of the process ({leadShare}). The price is visible at once, the discount costs ≈ {year} a year, so it starts as a pilot with some customers.',
    },
    items: [
      {
        id: 'early',
        label: { ru: 'Ранняя оплата: скидка 1,5 % за оплату в 7 дней', en: 'Early payment: 1.5% off for paying in 7 days' },
        effort: 3,
        measure: { revert: { edges: [['gwEarly', 'early', 0], ['gwEarly', 'terms', 100]] } },
        caveat: {
          ru: 'Доля берущих скидку (45 %) — допущение. Скидка — прямая уступка в цене: в стоимости случая она учтена.',
          en: 'The share taking the discount (45%) is an assumption. The discount is a straight price concession and is already inside the cost per case.',
        },
      },
      {
        id: 'docs',
        label: { ru: 'NF-e, трек-номер, счёт и закрытие без ручного ввода', en: 'NF-e, tracking, invoice and closing without re-keying' },
        effort: 2,
        measure: { revert: { nodes: ['nfe', 'notify', 'invoice', 'close'] } },
        caveat: {
          ru: 'Это настройка ERP; время шагов — допущение, прямая экономия мала.',
          en: 'This is ERP configuration; step times are assumptions and the direct saving is small.',
        },
      },
      {
        id: 'scoring',
        label: { ru: 'Кредитный скоринг по правилам вместо ручной проверки', en: 'Rule-based credit scoring instead of a manual check' },
        effort: 5,
        measure: { steps: ['credit'], by: ['score', 'review'] },
        caveat: {
          ru: 'Ручной разбор остаётся для 4 % заказов; правила скоринга нужно подтвердить на истории платежей.',
          en: 'Manual review stays for 4% of orders; the scoring rules still need to be checked against payment history.',
        },
      },
      {
        id: 'portal',
        label: { ru: 'Заказы из портала и EDI, проверка правилами', en: 'Orders from the portal and EDI, checked by rules' },
        effort: 7,
        measure: { steps: ['register', 'check'], by: ['validate', 'fix'] },
        caveat: {
          ru: 'Нужны интеграции на стороне клиентов; это условие для скоринга и расчёта срока отгрузки, поэтому его низкая доля — не повод отказаться.',
          en: 'Needs integrations on the customers’ side; it is a precondition for scoring and the ship-date promise, so its small share is no reason to drop it.',
        },
      },
      {
        id: 'atp',
        label: { ru: 'Срок отгрузки сразу и склад по спросу портала', en: 'Ship date at once, stock planned on portal demand' },
        effort: 8,
        measure: { revert: { nodes: ['mrp', 'waitProd'], edges: [['gwStock', 'pick', 78], ['gwStock', 'mrp', 22]] } },
        caveat: {
          ru: 'Рост доли отгрузок со склада с 78 до 92 % — допущение; требует прогноза спроса и больших остатков.',
          en: 'The rise in shipments from stock from 78% to 92% is an assumption; it needs demand forecasting and larger stock.',
        },
      },
    ],
  },

  /* ------------------------------------------------------------ 2. the motor */
  {
    processId: 'weg-make-motor-tobe',
    weights: { lead: 0.3, cost: 1, work: 1 },
    first: 'spc',
    why: {
      ru: 'Быстрых побед нет: крупные эффекты требуют станков и остановки линий (намотка ≈ {winding:year} в год, порошковая окраска ≈ {powder:year}). Ближе всего к быстрой победе контроль по телеметрии (≈ {spc:year} в год) и импульсный тест (≈ {surge:year}), их можно запускать на одной линии, пока остальные работают как обычно.',
      en: 'There are no quick wins: the large effects need machines and line stoppages (winding ≈ {winding:year} a year, powder coating ≈ {powder:year}). Closest to a quick win are control on telemetry (≈ {spc:year} a year) and the surge test (≈ {surge:year}); either can start on one line while the others run as usual.',
    },
    items: [
      {
        id: 'winding',
        label: { ru: 'Автоматическая намотка катушек', en: 'Automated coil winding' },
        effort: 9,
        measure: { revert: { nodes: ['coil'] } },
        caveat: {
          ru: 'Нужны станки и переналадка линий; окупаемость считается на объёме 19 млн двигателей в год.',
          en: 'Needs machines and line changeovers; payback is counted on 19 million motors a year.',
        },
      },
      {
        id: 'uv',
        label: { ru: 'УФ-полимеризация вместо печи при пропитке', en: 'UV curing instead of the oven when impregnating' },
        effort: 8,
        measure: { revert: { nodes: ['impreg'] } },
        caveat: {
          ru: 'Выигрыш в основном по ожиданию (40 → 12 мин): в деньгах он мал, потому что у минут на линии нет цены.',
          en: 'The gain is mostly waiting (40 → 12 min): small in money, because minutes on a line carry no price.',
        },
      },
      {
        id: 'powder',
        label: { ru: 'Порошковая окраска вместо жидкой', en: 'Powder coating instead of liquid paint' },
        effort: 7,
        measure: { revert: { nodes: ['paint'] } },
        caveat: {
          ru: 'Новая линия окраски; ожидание 25 → 8 мин и меньший расход материала — допущения.',
          en: 'A new paint line; waiting 25 → 8 min and lower material use are assumptions.',
        },
      },
      {
        id: 'surge',
        label: { ru: 'Импульсный тест изоляции прямо в линии', en: 'In-line surge test of the insulation' },
        effort: 4,
        measure: { revert: { nodes: ['surge', 'rewind'], edges: [['gwWind', 'impreg', 97], ['gwWind', 'rewind', 3]] } },
        caveat: {
          ru: 'Дефект ловится до пропитки: перемотки 3 → 1,2 %. Стоимость брака вне модели не учтена.',
          en: 'A defect is caught before impregnation: rewinds 3% → 1.2%. The cost of scrapped motors is outside the model.',
        },
      },
      {
        id: 'spc',
        label: { ru: 'Статистический контроль по телеметрии линии', en: 'Statistical process control on line telemetry' },
        effort: 3,
        measure: {
          revert: {
            zero: ['spc'],
            edges: [['gwSpc', 'routine', 100], ['gwSpc', 'adjust', 0], ['gwTest', 'sample', 97.5], ['gwTest', 'repair', 2.5]],
          },
        },
        caveat: {
          ru: 'Предполагает, что телеметрия линии уже собирается; несоответствия по КПД 2,5 → 1 % — допущение.',
          en: 'Assumes line telemetry is already collected; efficiency non-conformities 2.5% → 1% is an assumption.',
        },
      },
    ],
  },

  /* ------------------------------------------------------------ 3. sourcing */
  {
    processId: 'weg-procurement-tobe',
    weights: { lead: 0.5, cost: 1, work: 0.5 },
    first: 'vmi',
    why: {
      ru: 'Быстрых побед нет, а единственное крупное изменение, консигнация класса C ({leadShare} выигрыша по сроку, ≈ {year} в год), зависит от договоров с поставщиками, которые занимают время; поэтому начинать надо с неё, а четыре дешёвых правила вводить параллельно.',
      en: 'There are no quick wins, and the one large change, consignment for C-class items ({leadShare} of the lead-time gain, ≈ {year} a year), depends on supplier contracts that take time; so it starts first, with the four cheap rules introduced in parallel.',
    },
    items: [
      {
        id: 'vmi',
        label: { ru: 'Консигнация для класса C: крепёж, расходники, упаковка', en: 'Consignment stock for C-class items (fasteners, packaging)' },
        effort: 6,
        measure: { revert: { edges: [['gwClass', 'vmi', 0], ['gwClass', 'gwContract', 100]] } },
        caveat: {
          ru: 'Доля класса C (34 % позиций) — допущение. Срок короче потому, что эти позиции уже лежат на складе; запас у себя держит поставщик, и это отразится в цене.',
          en: 'The C-class share (34% of lines) is an assumption. The lead time is shorter because these items are already on the shelf; the supplier carries the stock, which will show in the price.',
        },
      },
      {
        id: 'hedge',
        label: { ru: 'Хедж меди и алюминия по правилу, пакетом', en: 'Hedge copper and aluminium by rule, in one batch' },
        effort: 4,
        measure: { revert: { nodes: ['hedge'], zero: ['hedgeRule'] } },
        caveat: {
          ru: 'Модель считает затраты на оформление сделок. Защиту маржи от скачка цены металла она не оценивает — а ради неё хедж и нужен.',
          en: 'The model counts the cost of processing the deals. It does not value protecting the margin from a metal price jump, which is what the hedge is for.',
        },
      },
      {
        id: 'sample',
        label: { ru: 'Выборочный входной контроль по электронному сертификату', en: 'Sampled inspection on an electronic certificate' },
        effort: 4,
        measure: { revert: { edges: [['gwSample', 'inspect', 100], ['gwSample', 'stock', 0]] } },
        caveat: {
          ru: 'Контроль 30 % партий вместо 100 % — допущение; риск пропущенного брака в модели не оценён.',
          en: 'Inspecting 30% of batches instead of 100% is an assumption; the risk of a missed defect is not priced.',
        },
      },
      {
        id: 'match',
        label: { ru: 'Автоматическая сверка заказ — приёмка — счёт и оплата', en: 'Automatic order–receipt–invoice match and payment' },
        effort: 4,
        measure: { revert: { nodes: ['match', 'pay', 'stock'] } },
        caveat: {
          ru: 'Выигрыш — в минутах работы финансов и склада; 7 % расхождений уходят на ручной разбор.',
          en: 'The gain is minutes of finance and warehouse work; 7% of mismatches still go to manual review.',
        },
      },
      {
        id: 'qualify',
        label: { ru: 'Квалификация поставщика один раз при входе в реестр', en: 'Qualify a supplier once, on entry to the register' },
        effort: 3,
        measure: { revert: { nodes: ['audit'], edges: [['gwRegister', 'audit', 12], ['gwRegister', 'hedgeRule', 88]] } },
        caveat: {
          ru: 'Полный аудит падает с 12 до 4 % заказов; условие — надёжный реестр с повторной проверкой по расписанию.',
          en: 'Full audits fall from 12% to 4% of orders; this requires a reliable register that is re-checked on a schedule.',
        },
      },
    ],
  },

  /* ----------------------------------------------------- 4. engineer to order */
  {
    processId: 'weg-eto-tobe',
    weights: { lead: 1, cost: 1, work: 0.5 },
    first: 'fat',
    why: {
      ru: 'Удалённые FAT и ввод в эксплуатацию требуют видеоканала и согласия заказчика, а не новой конструкции, и при принятых допущениях по стоимости дают {costShare} экономии на заказ (≈ {year} в год), больше любого другого изменения листа.',
      en: 'Remote FAT and commissioning need a video link and the customer’s consent, not a new design, and with the cost assumptions used they give {costShare} of the saving per order (≈ {year} a year), more than any other change on the sheet.',
    },
    items: [
      {
        id: 'parallel',
        label: { ru: 'Длинные позиции заказываются сразу после договора', en: 'Long-lead items ordered right after the contract' },
        effort: 3,
        measure: { revert: { rewire: { remove: [['pgSplit', 'design'], ['longlead', 'pgJoin']], add: [['longlead', 'design']] } } },
        caveat: {
          ru: 'Дисциплина планирования, не система. Риск: заказ ушёл, а проект изменился, — поэтому в состав входят только позиции, не зависящие от замечаний заказчика.',
          en: 'A planning discipline, not a system. The risk: the order is placed and then the design changes, so only items that do not depend on customer comments are included.',
        },
      },
      {
        id: 'fat',
        label: { ru: 'Удалённые FAT и ввод в эксплуатацию с поддержкой из центра', en: 'Remote FAT and commissioning with support from the centre' },
        effort: 4,
        measure: { revert: { nodes: ['fat', 'commission', 'handover'] } },
        caveat: {
          ru: 'Стоимость FAT (8,5 → 3,2 тыс.) и ввода — допущения; заказчик должен согласиться на удалённый приём.',
          en: 'The FAT (R$ 8.5k → 3.2k) and commissioning costs are assumptions; the customer must agree to remote acceptance.',
        },
      },
      {
        id: 'configurator',
        label: { ru: 'Конфигуратор исполнений: расчёт и цена за минуты', en: 'Execution configurator: calculation and price in minutes' },
        effort: 8,
        measure: {
          revert: {
            nodes: ['cost', 'clarify', 'concept', 'qualify', 'approve', 'quote'],
            zero: ['configure'],
            edges: [['gwFit', 'cost', 0], ['gwFit', 'clarify', 100]],
          },
        },
        caveat: {
          ru: 'Доля запросов из библиотеки (68 %) — допущение; библиотеку исполнений нужно собрать из прошлых проектов.',
          en: 'The share of enquiries covered by the library (68%) is an assumption; the library has to be assembled from past projects.',
        },
      },
      {
        id: 'modular',
        label: { ru: 'Модульная конструкция из проверенных узлов', en: 'Modular design from proven units' },
        effort: 8,
        measure: { revert: { nodes: ['design', 'review'], edges: [['gwReview', 'rework', 28], ['gwReview', 'pgJoin', 72]] } },
        caveat: {
          ru: 'Проектирование 2400 → 1200 мин и замечания 28 → 14 % — допущения; нужна ревизия конструкций.',
          en: 'Design 2400 → 1200 min and comments 28% → 14% are assumptions; the designs have to be revised.',
        },
      },
      {
        id: 'twin',
        label: { ru: 'Цифровой двойник: режимы до сборки', en: 'Digital twin: duty points before assembly' },
        effort: 8,
        measure: { revert: { zero: ['twin', 'preset'], edges: [['gwFat', 'fix', 8], ['gwFat', 'preset', 92]] } },
        caveat: {
          ru: 'В модели двойник стоит больше, чем экономит на процессе: 240 мин ведущего инженера и R$ 9 тыс. на заказ против снижения непринятых FAT с 8 до 3 %. Его выгода — качество поставки — в процесс не входит.',
          en: 'In the model the twin costs more than it saves inside the process: 240 min of a senior engineer plus R$ 9k per order against FAT failures falling from 8% to 3%. Its benefit, delivery quality, is outside the process.',
        },
      },
    ],
  },

  /* ----------------------------------------------------------- 5. transformer */
  {
    processId: 'weg-gtd-tobe',
    weights: { lead: 1, cost: 1, work: 0.5 },
    first: 'typetests',
    why: {
      ru: 'Типовые испытания на платформу выполняются один раз, на заказе остаётся сокращённая программа, и это {costShare} экономии на проект (≈ {year} в год): самая большая доля среди недорогих изменений листа, при условии что заказчик примет протоколы платформы.',
      en: 'Type tests are run once per platform and only a short programme remains on the order, which is {costShare} of the saving per project (≈ {year} a year): the largest share among the inexpensive changes on the sheet, provided the customer accepts the platform records.',
    },
    items: [
      {
        id: 'parallel',
        label: { ru: 'Сердечник, провод и масло — сразу после контракта', en: 'Core, wire and oil ordered right after the contract' },
        effort: 3,
        measure: { revert: { rewire: { remove: [['pgSplit', 'design2'], ['longlead', 'pgJoin']], add: [['longlead', 'design2']] } } },
        caveat: {
          ru: 'Возможно потому, что платформенная спецификация фиксирует материалы заранее. Для нестандартных исполнений заказ остаётся после согласования.',
          en: 'Possible because the platform specification fixes the materials early. For non-standard executions the order still waits for approval.',
        },
      },
      {
        id: 'commission',
        label: { ru: 'Удалённая поддержка пусконаладки из инжинирингового центра', en: 'Remote commissioning support from the engineering centre' },
        effort: 4,
        measure: { revert: { nodes: ['commission', 'handover'] } },
        caveat: {
          ru: 'Нужны защищённый канал и согласие сети на удалённый приём; бригада остаётся на площадке.',
          en: 'Needs a secure channel and the utility’s consent to remote acceptance; the crew stays on site.',
        },
      },
      {
        id: 'typetests',
        label: { ru: 'Типовые испытания один раз на платформу', en: 'Type tests once per platform' },
        effort: 5,
        measure: { revert: { nodes: ['typeTest'], zero: ['shortTest'], edges: [['gwType', 'typeTest', 100], ['gwType', 'shortTest', 0]] } },
        caveat: {
          ru: 'Доля полной программы 100 → 36 % — допущение; зависит от того, примет ли заказчик протоколы платформы по IEC 60076.',
          en: 'Full programme share 100% → 36% is an assumption; it depends on the customer accepting the platform’s IEC 60076 records.',
        },
      },
      {
        id: 'platform',
        label: { ru: 'Библиотека платформ закрывает 64 % тендеров', en: 'A platform library covers 64% of tenders' },
        effort: 8,
        measure: {
          revert: {
            nodes: ['design1', 'techSpec', 'cost', 'screen'],
            zero: ['platform'],
            edges: [['gwPlatform', 'platform', 0], ['gwPlatform', 'techSpec', 100]],
          },
        },
        caveat: {
          ru: 'Доля 64 % — допущение; платформы нужно рассчитать и испытать заранее.',
          en: 'The 64% share is an assumption; the platforms have to be designed and tested in advance.',
        },
      },
      {
        id: 'capacity',
        label: { ru: 'Расширенные мощности: сушка и заливка без очереди', en: 'Expanded capacity: drying and filling without queues' },
        effort: 10,
        measure: { revert: { nodes: ['dryout', 'core', 'windings', 'tank'] } },
        caveat: {
          ru: 'Для самого процесса вклад умеренный. Решение о мощностях принимается по росту спроса (публично объявлено R$ 1,2 млрд), а не по эффекту на один процесс.',
          en: 'Inside this process the contribution is moderate. A capacity decision follows demand growth (R$ 1.2bn publicly announced), not the effect on one process.',
        },
      },
    ],
  },

  /* ---------------------------------------------------------------- 6. service */
  {
    processId: 'weg-service-tobe',
    weights: { lead: 1, cost: 1, work: 0.5 },
    first: 'remote',
    why: {
      ru: 'Удалённая диагностика закрывает без выезда 58 % случаев вместо 35 % и даёт {costShare} экономии на обращение (≈ {year} в год), а работает она на той части парка, где телеметрия уже подключена, так что начинать можно с неё.',
      en: 'Remote diagnosis closes 58% of cases without a visit instead of 35% and gives {costShare} of the saving per case (≈ {year} a year); it works on the part of the installed base where telemetry is already connected, so it can start there.',
    },
    items: [
      {
        id: 'remote',
        label: { ru: 'Удалённая диагностика: 58 % случаев без выезда', en: 'Remote diagnosis: 58% of cases without a visit' },
        effort: 5,
        measure: { revert: { nodes: ['remote', 'closeRemote'], edges: [['gwRemote', 'closeRemote', 35], ['gwRemote', 'warranty', 65]] } },
        caveat: {
          ru: 'Доля 58 % — допущение; работает там, где телеметрия уже подключена, поэтому начинать стоит с этого парка.',
          en: 'The 58% share is an assumption; it works where telemetry is already connected, so start with that part of the installed base.',
        },
      },
      {
        id: 'warranty',
        label: { ru: 'Гарантийный статус по цифровому паспорту оборудования', en: 'Warranty status from the digital equipment passport' },
        effort: 3,
        measure: { revert: { nodes: ['warranty'] } },
        caveat: {
          ru: 'Выигрыш мал, зато это основа для остальных шагов: паспорт нужен и для прогноза запчастей.',
          en: 'The gain is small, but it is the base for the other steps: the passport is also needed for the parts forecast.',
        },
      },
      {
        id: 'parts',
        label: { ru: 'Запчасти на региональном складе по прогнозу отказов', en: 'Spare parts on a regional shelf from the failure forecast' },
        effort: 6,
        measure: { steps: ['parts'], by: ['stage'] },
        caveat: {
          ru: 'Ожидание запчастей 4 дня → 1 — допущение; запас на региональном складе — замороженные деньги.',
          en: 'Parts waiting 4 days → 1 is an assumption; stock on a regional shelf is tied-up money.',
        },
      },
      {
        id: 'quote',
        label: { ru: 'Смета в портале клиента с готовой калькуляцией', en: 'Quotation in the customer portal with its calculation' },
        effort: 4,
        measure: { revert: { nodes: ['quote'], edges: [['gwAccept', 'gwScope', 78], ['gwAccept', 'return', 22]] } },
        caveat: {
          ru: 'Ускоряет согласование, но дороже в расчёте на случай: больше смет принимается, и больше случаев доходит до ремонта.',
          en: 'It speeds up approval but costs more per case: more quotations are accepted, so more cases reach a repair.',
        },
      },
      {
        id: 'monitoring',
        label: { ru: 'Мониторинг сам открывает обращения (62 % работ)', en: 'Monitoring opens the cases itself (62% of the work)' },
        effort: 7,
        impact: 7,
        caveat: {
          ru: 'Модель не измеряет этот пункт: объём обращений в ней фиксирован, а простой клиента и аварийная наценка не учтены. Оценка эффекта — экспертная.',
          en: 'The model does not measure this item: the case volume is fixed and the customer’s downtime and emergency premium are not priced. The impact score is a judgement.',
        },
      },
    ],
  },

  /* ---------------------------------------------------------- 7. new product */
  {
    processId: 'weg-npd-tobe',
    weights: { lead: 1, cost: 0.5, work: 0.5 },
    first: 'cert',
    why: {
      ru: 'Подача сертификации параллельно испытаниям меняет порядок работ, а не требует инвестиций, и сокращает срок разработки на {lead}: это {leadShare} выигрыша по сроку; плата за это — риск править досье, если расчёт и испытание разойдутся (в модели 12 % случаев).',
      en: 'Filing certification in parallel with testing changes the order of work and needs no investment, and it shortens development by {lead}, which is {leadShare} of the lead-time gain; the price is the risk of amending the dossier if calculation and test disagree (12% of cases in the model).',
    },
    items: [
      {
        id: 'tooling',
        label: { ru: 'Слот у изготовителя оснастки бронируется до ворот 3', en: 'Tooling slot reserved before Gate 3' },
        effort: 2,
        measure: { revert: { nodes: ['tooling'], zero: ['reserve'] } },
        caveat: {
          ru: 'Бронь стоит R$ 12 тыс.; сам заказ на R$ 340 тыс. по-прежнему после ворот 3. Если проект закрывают, бронь теряется.',
          en: 'The reservation costs R$ 12k; the R$ 340k order itself still follows Gate 3. If the project is stopped, the reservation is lost.',
        },
      },
      {
        id: 'cert',
        label: { ru: 'Сертификация подаётся параллельно испытаниям', en: 'Certification filed in parallel with testing' },
        effort: 3,
        measure: {
          revert: {
            rewire: {
              remove: [['gwConfirm', 'pgJoin'], ['cert', 'pgJoin'], ['reserve', 'pgJoin'], ['pgSplit', 'certPrep'], ['pgSplit', 'reserve']],
              add: [['gwConfirm', 'certPrep', 88], ['cert', 'reserve'], ['reserve', 'pgJoin']],
            },
          },
        },
        caveat: {
          ru: 'Риск: если расчёт и испытание разойдутся, досье придётся править; в модели таких случаев 12 % (допущение), правка модели и конструкции оценена в R$ 24 тыс.',
          en: 'The risk: if calculation and test disagree the dossier has to be amended; the model uses 12% of cases (an assumption) and prices the model and design correction at R$ 24k.',
        },
      },
      {
        id: 'market',
        label: { ru: 'Ворота 1 по данным продаж и сервиса парка', en: 'Gate 1 on sales and service data from the installed base' },
        effort: 4,
        measure: { revert: { nodes: ['screen', 'business'] } },
        caveat: {
          ru: 'Нужны очищенные данные CRM и сервиса. Доля прохождения ворот (45 %) намеренно не менялась.',
          en: 'Needs clean CRM and service data. The gate pass share (45%) was deliberately left unchanged.',
        },
      },
      {
        id: 'calc',
        label: { ru: 'Класс КПД решается численной оптимизацией, а не испытанием', en: 'Efficiency class settled by calculation, not by test' },
        effort: 8,
        measure: { revert: { nodes: ['tune'], like: { optimise: 'simulate' }, edges: [['gwClass', 'gate2', 70], ['gwClass', 'tune', 30]] } },
        caveat: {
          ru: 'Доводки после испытаний 30 → 12 % — допущение; нужны откалиброванные модели и время инженеров.',
          en: 'Refinements after tests 30% → 12% is an assumption; it needs calibrated models and engineers’ time.',
        },
      },
      {
        id: 'modules',
        label: { ru: 'Концепция собирается из модулей платформы', en: 'The concept is assembled from platform modules' },
        effort: 8,
        measure: { revert: { nodes: ['concept', 'redesign'], edges: [['gate2', 'redesign', 22], ['gate2', 'pgSplit', 78]] } },
        caveat: {
          ru: 'Модульная платформа создаётся годами; доработки после ворот 2 с 22 до 10 % — допущение.',
          en: 'A modular platform takes years to build; rework after Gate 2 from 22% to 10% is an assumption.',
        },
      },
    ],
  },

  /* ---------------------------------------------------------------- 8. export */
  {
    processId: 'weg-export-tobe',
    weights: { lead: 1, cost: 1, work: 0.5 },
    first: 'freight',
    why: {
      ru: 'Годовой контракт на фрахт и генеральный полис — это переговоры с перевозчиком и страховщиком, а не интеграция, и при принятых ставках они дают {costShare} экономии на отгрузку (≈ {year} в год) и убирают ожидание букинга.',
      en: 'An annual freight contract and an open policy are negotiations with a carrier and an insurer, not an integration, and at the assumed rates they give {costShare} of the saving per shipment (≈ {year} a year) and remove the wait for a booking.',
    },
    items: [
      {
        id: 'preclear',
        label: { ru: 'Импорт в стране назначения декларируется до прихода судна', en: 'Import declared at the destination before the ship arrives' },
        effort: 4,
        measure: { revert: { nodes: ['destClear'], zero: ['preClear'] } },
        caveat: {
          ru: 'Нужны локальный брокер и документы заранее; ожидание 4 → 1,5 дня — допущение.',
          en: 'Needs a local broker and the documents in advance; waiting 4 → 1.5 days is an assumption.',
        },
      },
      {
        id: 'freight',
        label: { ru: 'Годовой контракт на фрахт и генеральный полис', en: 'An annual freight contract and an open insurance policy' },
        effort: 3,
        measure: { revert: { nodes: ['booking', 'insure'] } },
        caveat: {
          ru: 'Ставки по контракту (R$ 12 → 10,4 тыс. за отгрузку) — допущение; контракт фиксирует объём и теряет гибкость рынка.',
          en: 'The contract rates (R$ 12k → 10.4k per shipment) are an assumption; a contract fixes the volume and loses market flexibility.',
        },
      },
      {
        id: 'ebl',
        label: { ru: 'Электронный коносамент уходит банку и заказчику сразу', en: 'Electronic bill of lading sent to bank and customer at once' },
        effort: 5,
        measure: { revert: { nodes: ['sendDocs', 'payment'] } },
        caveat: {
          ru: 'Банк и заказчик должны принимать электронный BL; ожидание оплаты 12 → 10 раб. дн. — допущение.',
          en: 'The bank and the customer must accept the electronic BL; waiting for payment 12 → 10 working days is an assumption.',
        },
      },
      {
        id: 'docs',
        label: { ru: 'Инвойс, packing list и сертификат из ERP одним пакетом', en: 'Invoice, packing list and certificate from ERP as one set' },
        effort: 3,
        measure: { revert: { nodes: ['proforma', 'docs', 'nfe'] } },
        caveat: {
          ru: 'Настройка ERP и шаблонов; прямая экономия на печати и курьере (R$ 320 → 160) — допущение.',
          en: 'ERP and template configuration; the direct saving on printing and couriers (R$ 320 → 160) is an assumption.',
        },
      },
      {
        id: 'oea',
        label: { ru: 'Статус OEA: приоритет «зелёного» канала', en: 'AEO (OEA) status: priority for the green channel' },
        effort: 8,
        measure: {
          revert: {
            edges: [['gwChannel', 'gwChannelJoin', 84], ['gwChannel', 'yellow', 11], ['gwChannel', 'red', 5]],
            nodes: ['yellow', 'red', 'channel'],
          },
        },
        caveat: {
          ru: 'В среднем эффект мал, ведь и сегодня 84 % отгрузок идут по зелёному каналу. Основная ценность статуса — предсказуемость срока, а её в среднем по модели не видно.',
          en: 'On average the effect is small, since 84% of shipments already clear the green channel today. The main value of the status is a predictable lead time, which an average does not show.',
        },
      },
    ],
  },
];
