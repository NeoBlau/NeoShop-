/**
 * Implementation-risk worksheets: one change per WEG process, three questions.
 *
 * The change is the one the impact / effort sheet of the same process put
 * first. The answers are hypotheses drawn from the logic of the process, not
 * survey results: nobody at WEG was asked. They say who plausibly loses, what
 * the resistance would look like and which single measure would reduce it - to
 * be checked in interviews with the people the change touches.
 *
 * `{id:key}` placeholders are filled from the same measurements as the matrix.
 */

export const RISK_QUESTIONS = [
  {
    ru: 'Кто теряет от этого изменения и что именно (время / контроль / комфорт / статус)?',
    en: 'Who loses from this change, and what exactly (time / control / comfort / status)?',
  },
  {
    ru: 'Как будет проявляться сопротивление на практике (конкретно, не абстрактно)?',
    en: 'How will resistance show up in practice (concretely, not in the abstract)?',
  },
  {
    ru: 'Какая одна мера снизит сопротивление сильнее всего?',
    en: 'Which single measure would reduce the resistance the most?',
  },
];

export const RISK_NOTE = {
  ru: 'Ответы — гипотезы по логике процесса, не итоги опроса. Проверьте их в разговорах с теми, кого изменение касается.',
  en: 'The answers are hypotheses from the logic of the process, not survey results. Check them in conversations with the people the change touches.',
};

export const RISKS = [
  {
    processId: 'weg-o2c-tobe',
    itemId: 'early',
    answers: [
      {
        ru: 'Финансы и казначейство: скидка 1,5 % — прямая потеря выручки (≈ {early:year} в год по модели), а график поступлений становится менее предсказуемым, то есть уходят контроль и комфорт. Продавцы теряют часть цены, которой они торгуются с клиентом, и тем самым статус переговорщика.',
        en: 'Finance and treasury: a 1.5% discount is a direct loss of revenue (≈ {early:year} a year in the model) and the cash schedule becomes less predictable, so control and comfort go. Salespeople lose part of the price they bargain with, and with it some standing as negotiators.',
      },
      {
        ru: 'Продавцы не предлагают скидку («и так сложно продавать»); кредитный контроль продолжает слать напоминания тем, кто платит раньше; казначейство закладывает в бюджет полный срок оплаты, поэтому ранние деньги не меняют план. Через квартал в отчёте видно: скидку заплатили, а деньги пришли в обычные сроки.',
        en: 'Salespeople do not offer the discount (“it is hard enough to sell as it is”); credit control keeps sending reminders to those who pay early; treasury budgets for the full payment term, so early money changes no plan. A quarter later the report shows it plainly: the discount was paid and the cash still came on the usual terms.',
      },
      {
        ru: 'Включить долю заказов с ранней оплатой в премию продавцов и вести скидку отдельной строкой бюджета финансов, а не за счёт маржи продавца: тогда ему выгодно её предлагать, а финансы видят её цену.',
        en: 'Put the share of early-paid orders into the salespeople’s bonus and book the discount on a separate finance budget line rather than against the seller’s margin: then it pays to offer it and finance sees its price.',
      },
    ],
  },
  {
    processId: 'weg-make-motor-tobe',
    itemId: 'spc',
    answers: [
      {
        ru: 'Операторы и мастера смены: сигнал о выходе за пределы требует остановить линию или вмешаться, и они теряют привычную свободу, то есть контроль и комфорт. Отклонения, которые раньше не фиксировались, становятся видимыми, и это удар по статусу тех, чья линия «шумит» чаще других.',
        en: 'Operators and shift supervisors: a signal outside the limits means stopping the line or stepping in, and they lose their usual freedom, that is control and comfort. Deviations that used to go unrecorded become visible, which hurts the standing of whoever’s line “beeps” most.',
      },
      {
        ru: 'Сигналы отключают или игнорируют после первых ложных срабатываний («не мигает — не трогаем»); пределы расширяют вручную, пока сигналов почти не остаётся; значения в системе поправляют задним числом.',
        en: 'The signals get switched off or ignored after the first false alarms (“if it isn’t flashing, don’t touch it”); the limits are widened by hand until almost no signals remain; values in the system are corrected after the fact.',
      },
      {
        ru: 'Запустить на одной линии и в первые недели настраивать пределы вместе с операторами этой линии раз в неделю, показывая только те сигналы, за которыми последовал реальный дефект, — ложные срабатывания не должны стать поводом отключить систему.',
        en: 'Start on one line and, for the first weeks, tune the limits together with that line’s operators once a week, showing only the signals that were followed by a real defect: false alarms must not become a reason to switch the system off.',
      },
    ],
  },
  {
    processId: 'weg-procurement-tobe',
    itemId: 'vmi',
    answers: [
      {
        ru: 'Закупщики теряют контроль: заказы на позиции класса C (34 % номенклатуры в модели) больше не оформляются, и вместе с ними уходит влияние на цену и поставщика. Склад меняет порядок приёмки, а сами поставщики берут на себя запас и закладывают его стоимость в цену.',
        en: 'Buyers lose control: orders for C-class items (34% of lines in the model) are no longer placed, and the influence on price and supplier goes with them. The warehouse changes its receiving routine, and the suppliers take on the stock and build its cost into the price.',
      },
      {
        ru: 'Закупщики по привычке оформляют заказы «на всякий случай»; склад держит свой неучтённый запас рядом с консигнационным; поставщики поднимают цену или задерживают пополнение, чтобы вернуть стоимость хранения.',
        en: 'Buyers keep placing orders “just in case”; the warehouse keeps its own unrecorded stock next to the consignment stock; suppliers raise the price or delay replenishment to recover their storage cost.',
      },
      {
        ru: 'Начать с 3–5 поставщиков, у которых самая большая доля позиций класса C, с фиксированным уровнем запаса и ценой, и измерять нехватки и итоговую цену позиции за квартал; остальных подключать, когда цифры покажут, что цена не выросла.',
        en: 'Start with the 3–5 suppliers that hold the largest share of C-class items, with a fixed stock level and price, and measure shortages and the resulting item price over a quarter; add the others once the figures show the price has not risen.',
      },
    ],
  },
  {
    processId: 'weg-eto-tobe',
    itemId: 'fat',
    answers: [
      {
        ru: 'Испытатели и сервисные инженеры теряют выезды (дорогу, часть командировочных, личный контакт с заказчиком), то есть комфорт и статус. Заказчик теряет возможность посмотреть на машину вживую и разделить ответственность за приёмку «на месте» — контроль.',
        en: 'Test and service engineers lose the trips (the travel, part of the allowances, face-to-face contact with the customer), that is comfort and status. The customer loses the chance to see the machine in person and to share responsibility for acceptance on the spot, that is control.',
      },
      {
        ru: 'Заказчик настаивает на присутствии «как в договоре» и приезжает за свой счёт; инженеры всё равно едут вместе с трансляцией; в протокол вносят замечания, которые раньше решались устно, и приёмка затягивается.',
        en: 'The customer insists on attending “as the contract says” and travels at their own expense; the engineers go anyway alongside the stream; the record fills with remarks that used to be settled verbally, and acceptance drags on.',
      },
      {
        ru: 'Дать заказчику выбор: удалённый FAT с независимой видеофиксацией и правом приехать за счёт WEG по любому спорному пункту. Выезд остаётся страховкой, а не стандартом, и заказчик не чувствует, что у него отняли контроль.',
        en: 'Offer the customer a choice: a remote FAT with independent video recording and the right to come at WEG’s expense for any disputed point. The trip stays an insurance policy rather than the norm, and the customer does not feel control has been taken away.',
      },
    ],
  },
  {
    processId: 'weg-gtd-tobe',
    itemId: 'typetests',
    answers: [
      {
        ru: 'Лаборатория и испытатели теряют объём: полная программа остаётся лишь для нестандартных исполнений (36 % в модели), а с ней уходят часть сверхурочных и загрузка стенда. Эксперты заказчика теряют роль свидетелей испытания своего трансформатора — статус и контроль.',
        en: 'The laboratory and test crews lose volume: the full programme stays only for non-standard executions (36% in the model), and part of the overtime and the test-bay load goes with it. The customer’s experts lose their role as witnesses of the test on their own transformer, that is status and control.',
      },
      {
        ru: 'Заказчик вписывает в техзадание «типовые испытания на каждом изделии»; лаборатория находит основания считать исполнение нестандартным и возвращает заказ на полную программу; инженеры платформы не вносят протоколы в библиотеку вовремя.',
        en: 'The customer writes “type tests on every unit” into the specification; the laboratory finds grounds to call the execution non-standard and sends the order back to the full programme; the platform engineers do not enter the records into the library on time.',
      },
      {
        ru: 'Договориться с 2–3 крупнейшими заказчиками, что протоколы платформы принимаются по рамочному договору, и пригласить их экспертов на испытание самой платформы: они один раз увидят полную программу, зато перестанут требовать её на каждом изделии.',
        en: 'Agree with the 2–3 largest customers that the platform records are accepted under the framework contract, and invite their experts to the test of the platform itself: they see the full programme once and stop demanding it on every unit.',
      },
    ],
  },
  {
    processId: 'weg-service-tobe',
    itemId: 'remote',
    answers: [
      {
        ru: 'Сервисные партнёры (сеть ASTEC) теряют часть выездов и ремонтов, потому что удалённо закрывается 58 % обращений вместо 35 %, — то есть выручку и загрузку. Клиенты теряют ощущение, что «приехал специалист».',
        en: 'The service partners (the ASTEC network) lose part of their visits and repairs, because 58% of requests close remotely instead of 35%: revenue and utilisation. Customers lose the feeling that “a specialist came”.',
      },
      {
        ru: 'Партнёры оформляют повторные обращения, чтобы вернуть выезд («по телефону не помогло»); клиенты просят инженера приехать «на всякий случай»; диагносты перестраховываются и при любом сомнении рекомендуют выезд.',
        en: 'Partners raise repeat requests to get the visit back (“the phone call did not help”); customers ask for an engineer “just in case”; diagnosticians play safe and recommend a visit at any doubt.',
      },
      {
        ru: 'Первые два квартала платить партнёру за удалённое закрытие обращения по тарифу выезда: удалённая диагностика не лишает его дохода, а дорогой выезд остаётся для случаев, где он нужен. Это временная мера, и её цена вычитается из экономии.',
        en: 'For the first two quarters pay the partner for a remote closure at the visit rate: remote diagnosis does not take its income away, and the costly visit stays for the cases that need it. It is a temporary measure and its price comes off the saving.',
      },
    ],
  },
  {
    processId: 'weg-npd-tobe',
    itemId: 'cert',
    answers: [
      {
        ru: 'Сертификационная группа теряет комфорт: досье нужно готовить по ещё не готовым данным. Руководитель проекта теряет контроль над последовательностью («сначала испытания, потом бумага»), а испытатели получают дедлайн на промежуточные результаты.',
        en: 'The certification team loses comfort: the dossier has to be prepared from data that is not ready yet. The project manager loses control over the sequence (“tests first, paperwork after”), and the test engineers get a deadline for interim results.',
      },
      {
        ru: 'Досье подают, а данные «докладывают потом»; орган сертификации возвращает заявку с замечаниями; испытатели не успевают выдать промежуточные результаты, и группа ждёт; к воротам 3 проект приходит «условно готовым».',
        en: 'The dossier is filed and the data is “added later”; the certification body returns the application with remarks; the test engineers miss the interim results and the team waits; the project reaches Gate 3 “conditionally ready”.',
      },
      {
        ru: 'Определить минимальный набор промежуточных результатов испытаний, нужный для подачи, и поставить его в график проекта отдельной вехой: тогда досье подаётся по реальным данным, а не по ожиданиям.',
        en: 'Define the minimum set of interim test results needed for filing and put it into the project schedule as its own milestone: then the dossier is filed on real data, not on expectations.',
      },
    ],
  },
  {
    processId: 'weg-export-tobe',
    itemId: 'freight',
    answers: [
      {
        ru: 'Логисты теряют гибкость выбора перевозчика на каждую отправку (контроль) и повод показать «сэкономил на ставке» (статус); перевозчик теряет премию за срочные заказы; закупщик фрахта обязуется держать объём, и ошибка в прогнозе становится его ошибкой.',
        en: 'Logisticians lose the freedom to pick a carrier for each shipment (control) and the chance to show “saved on the rate” (status); the carrier loses the premium on rush orders; the freight buyer commits to a volume, so a forecasting error becomes theirs.',
      },
      {
        ru: 'Срочные отправки уходят мимо контракта по спотовым ставкам; контрактный объём не выбирается, и приходится платить за недобор; перевозчик не даёт слот в пик и ссылается на загрузку.',
        en: 'Rush shipments go outside the contract at spot rates; the contracted volume is not used up and the shortfall has to be paid for; the carrier refuses a slot at the peak and cites capacity.',
      },
      {
        ru: 'Зафиксировать в контракте долю объёма (например, 70 %) и гарантированные слоты в пик, а остальное оставить на спот; оценивать логиста по средней ставке за год, а не по каждой отправке.',
        en: 'Fix a share of the volume in the contract (say 70%) with guaranteed slots at the peak, and leave the rest to the spot market; assess the logistician on the average rate over the year, not on each shipment.',
      },
    ],
  },
];
