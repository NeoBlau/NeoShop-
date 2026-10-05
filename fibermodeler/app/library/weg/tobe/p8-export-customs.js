/**
 * 8 (TO-BE). Export under an authorised economic operator status (OEA), with a
 * pre-filed DU-E, an ERP-generated document set and an electronic bill of lading.
 */
import { DERIVED, WEG, dataNote, roles, sourceBlock } from '../facts.js';
import { DAY, WEEK, auto, flow, node, reported, work } from '../../kit.js';

const LANES = [
  { id: 'client', label: { ru: 'Зарубежный заказчик', en: 'Overseas customer' } },
  { id: 'sales', label: { ru: 'Экспортные продажи', en: 'Export sales' } },
  { id: 'fin', label: { ru: 'Финансы и казначейство', en: 'Finance and treasury' } },
  { id: 'plant', label: { ru: 'Завод и упаковка', en: 'Plant and packing' } },
  { id: 'customs', label: { ru: 'Таможенное оформление (статус OEA)', en: 'Customs (AEO status)' } },
  { id: 'carrier', label: { ru: 'Перевозчик и порт', en: 'Carrier and port' } },
  { id: 'dest', label: { ru: 'Компания WEG в стране назначения', en: 'WEG company at destination' } },
];

const SHIPMENTS = 26000;

export const exportProcessToBe = {
  id: 'weg-export-tobe',
  order: 8,
  variant: 'to-be',
  baselineId: 'weg-export',
  name: {
    ru: '8. Экспортная поставка и таможенное оформление — как будет',
    en: '8. Export shipment and customs clearance — to be',
  },
  description: {
    ru: 'Комплаенс и условия оплаты проверяются правилами на входе, документы формируются из ERP одним пакетом, DU-E подаётся предварительно до прибытия в порт, статус OEA даёт зелёный канал почти всегда, коносамент электронный, выручка закрывается автоматически.',
    en: 'Compliance and payment terms are checked by rule at entry, the document set is generated from ERP in one go, the DU-E is pre-filed before the cargo reaches the port, the AEO status gives the green channel almost always, the bill of lading is electronic, and the proceeds settle automatically.',
  },
  analysis: {
    currency: 'R$',
    volumePerYear: SHIPMENTS,
    hoursPerFte: 1800,
    workingDays: WEG.workingDays,
    roles: roles('Менеджер по продажам', 'Аналитик', 'Логист', 'Таможенный брокер', 'Финансы', 'Оператор'),
  },
  documentation: {
    ru: `Целевое состояние экспортной отгрузки с бразильских площадок.

Объём и база расчёта не меняются: ≈ ${SHIPMENTS.toLocaleString('ru-RU')} отгрузок в год (вывод в модели «как есть»: внешняя выручка R$ ${(DERIVED.externalRevenue / 1e9).toFixed(1)} млрд × доля вывоза из Бразилии ÷ средняя стоимость отгрузки).

Что меняется по сравнению с «как есть»:
1. **Статус OEA.** Бразильская программа Operador Econômico Autorizado (аналог AEO/C-TPAT) даёт аккредитованному экспортёру приоритетную параметризацию: доля зелёного канала растёт с 84 до 96 %, жёлтого — с 11 до 3 %, красного — с 5 до 1 %. Это снимает самый непредсказуемый кусок срока.
2. **Предварительное декларирование.** DU-E подаётся в Portal Único Siscomex на основании данных ERP до прибытия контейнера в порт, параллельно упаковке. Канал известен заранее, и контейнер не ждёт в терминале.
3. **Документы.** Инвойс, packing list и сертификат происхождения формируются из ERP одним пакетом (90 → 12 мин), NF-e с экспортным CFOP выпускается автоматически.
4. **Комплаенс.** Санкционный скрининг страны и контрагента выполняется правилами при вводе заказа; аналитик разбирает только совпадения.
5. **Фрахт и страхование.** Годовой контракт со ставками вместо разового букинга (ожидание 2 дня → 0,5), генеральный полис вместо полиса на отгрузку.
6. **Коносамент.** Электронный BL уходит банку и заказчику сразу после погрузки — курьерская пересылка документов исчезает вместе со своим ожиданием.
7. **Назначение.** Документы приходят до судна, импортное оформление в стране назначения начинается заранее: ожидание 4 дня → 1,5.

Что НЕ меняется: морской переход (26 дней — физика маршрута), экспортная упаковка и ISPM 15, загрузка контейнера, доставка в порт, платёжный срок контракта.

Нормативная часть (DU-E, averbação, каналы, ISPM 15, CFOP) соответствует бразильскому порядку, а не внутренним регламентам WEG. Доли каналов в целевом состоянии — **отраслевые допущения** на основе того, какой приоритет даёт статус OEA; их нужно подтвердить статистикой собственного кабинета Siscomex.

${dataNote('ru')}

${sourceBlock(['fy2025', 'profile', 'numbers', 'annual2025'], 'ru')}`,
    en: `Target state of the export shipment. The volume and its derivation are unchanged: about ${SHIPMENTS.toLocaleString('en-US')} shipments a year.

Changes: the Brazilian AEO programme (Operador Econômico Autorizado) gives an accredited exporter priority parameterisation, so the green channel rises from 84% to 96%, yellow falls from 11% to 3% and red from 5% to 1%, removing the least predictable part of the lead time; the DU-E is pre-filed from ERP data before the container reaches the port, in parallel with packing, so the channel is known in advance and the box does not wait at the terminal; the invoice, packing list and certificate of origin are generated from ERP in one set (90 → 12 min) and the NF-e is issued automatically; sanctions screening runs by rule at order entry with an analyst only on the hits; an annual freight contract replaces per-shipment booking and an open marine policy replaces per-shipment cover; an electronic bill of lading reaches the bank and the customer right after loading, so courier document transfer disappears along with its wait; documents arrive before the vessel, so destination clearance starts early (four days of waiting down to one and a half).

Unchanged: the 26-day ocean transit, export packing and ISPM 15, container stuffing, drayage to the port and the contractual payment term.

The regulatory steps follow Brazilian practice, not WEG internal procedure. The target channel shares are **assumptions** based on the priority the AEO status grants; confirm them with your own Siscomex statistics.

${dataNote('en')}

${sourceBlock(['fy2025', 'profile', 'numbers', 'annual2025'], 'en')}`,
  },
  spec: {
    notation: 'bpmn',
    name: { ru: 'Экспорт и таможня — как будет', en: 'Export and customs — to be' },
    lanes: LANES,
    nodes: [
      node('start', 'startMessageEvent', 'client', 'Экспортный заказ подтверждён', 'Export order confirmed', reported({})),
      node('terms', 'businessRuleTask', 'sales', 'Проверить Incoterms, страну и требования правилами', 'Check Incoterms, country and requirements by rule', auto(1.5)),
      node('screen', 'businessRuleTask', 'sales', 'Автоматический санкционный скрининг', 'Automatic sanctions screening', auto(0.5, { cost: 1.2 })),
      node('gwScreen', 'exclusiveGateway', 'sales', 'Есть совпадение по спискам?', 'Any list hit?'),
      node('investigate', 'userTask', 'sales', 'Разобрать совпадение комплаенс-аналитиком', 'Clear the hit with a compliance analyst', work(30, 'Аналитик')),
      node('gwClear', 'exclusiveGateway', 'sales', 'Поставка допустима?', 'Shipment allowed?'),
      node('reject', 'sendTask', 'sales', 'Отказать и зафиксировать решение', 'Decline and record the decision', work(20, 'Аналитик')),
      node('endReject', 'endEvent', 'sales', 'Отгрузка запрещена комплаенсом', 'Blocked by compliance'),
      node('proforma', 'serviceTask', 'sales', 'Выпустить proforma invoice из ERP', 'Issue the proforma invoice from ERP', auto(1)),
      node('gwPay', 'exclusiveGateway', 'fin', 'Условия оплаты?', 'Payment terms?'),
      node('lc', 'userTask', 'fin', 'Проверить аккредитив по типовому перечню документов', 'Check the L/C against the standard document set', work(60, 'Финансы', { waitTime: DAY * 2 })),
      node('advance', 'receiveTask', 'fin', 'Получить предоплату', 'Receive the advance payment', work(10, 'Финансы', { waitTime: DAY * 3 })),
      node('credit', 'businessRuleTask', 'fin', 'Проверить лимит и страховое покрытие правилами', 'Check the limit and export cover by rule', auto(0.6)),
      node('gwPayJoin', 'exclusiveGateway', 'fin', 'Оплата обеспечена', 'Payment secured'),
      node('release', 'serviceTask', 'plant', 'Выпустить заказ на отгрузку автоматически', 'Release the shipping order automatically', auto(0.5)),
      node('waitGoods', 'intermediateTimerEvent', 'plant', 'Ожидание готовности продукции на складе', 'Waiting for the goods to be ready', { waitTime: WEEK * 2, dataSource: 'assumption' }),
      node('pgSplit', 'parallelGateway', 'plant', 'Упаковка, документы и декларация параллельно', 'Packing, documents and declaration in parallel'),
      node('pack', 'manualTask', 'plant', 'Экспортная упаковка и тара по ISPM 15', 'Export packing and ISPM 15 crating', work(300, 'Оператор', { resourceQty: 3, cost: 2600 })),
      node('marking', 'serviceTask', 'plant', 'Маркировка, взвешивание и фотоотчёт', 'Marking, weighing and photo record', work(45, 'Оператор', { cost: 180 })),
      node('docs', 'serviceTask', 'customs', 'Сформировать пакет документов из ERP', 'Generate the document set from ERP', work(12, 'Таможенный брокер', { cost: 160 })),
      node('nfe', 'serviceTask', 'fin', 'Выпустить NF-e с экспортным CFOP автоматически', 'Issue the NF-e with an export CFOP automatically', auto(0.5)),
      node('insure', 'serviceTask', 'fin', 'Отнести отгрузку на генеральный полис', 'Declare the shipment under the open policy', auto(0.5, { cost: 940 })),
      node('due', 'serviceTask', 'customs', 'Предварительно подать DU-E в Portal Único Siscomex', 'Pre-file the DU-E in Portal Único Siscomex', work(25, 'Таможенный брокер', { cost: 1100 })),
      node('gwLicense', 'exclusiveGateway', 'customs', 'Нужна экспортная лицензия (ануэнсия)?', 'Export licence (anuência) required?'),
      node('license', 'userTask', 'customs', 'Получить согласование уполномоченного органа', 'Obtain the licensing authority approval', work(60, 'Таможенный брокер', { waitTime: DAY * 3 })),
      node('channel', 'businessRuleTask', 'customs', 'Параметризация DU-E с приоритетом OEA', 'DU-E parameterisation with AEO priority', auto(0.4)),
      node('gwChannel', 'exclusiveGateway', 'customs', 'Канал досмотра?', 'Inspection channel?'),
      node('yellow', 'userTask', 'customs', 'Жёлтый канал: проверка документов', 'Yellow channel: document review', work(40, 'Таможенный брокер', { waitTime: 240 })),
      node('red', 'userTask', 'customs', 'Красный канал: физический досмотр', 'Red channel: physical inspection', work(200, 'Таможенный брокер', { cost: 1900, waitTime: DAY })),
      node('gwChannelJoin', 'exclusiveGateway', 'customs', 'Груз выпущен таможней', 'Cleared by customs'),
      node('pgJoin', 'parallelGateway', 'plant', 'Груз, документы и выпуск готовы', 'Cargo, documents and clearance ready'),
      node('booking', 'serviceTask', 'carrier', 'Разместить слот по годовому контракту фрахта', 'Take the slot under the annual freight contract', auto(2, { cost: 10400, waitTime: 240 })),
      node('stuff', 'manualTask', 'plant', 'Загрузить контейнер и опломбировать', 'Stuff the container and seal it', work(180, 'Оператор', { resourceQty: 2, cost: 900 })),
      node('drayage', 'serviceTask', 'carrier', 'Доставить в порт и пройти приоритетный gate-in', 'Truck to the port and use the priority gate-in', work(75, 'Логист', { cost: 3800, waitTime: 480 })),
      node('authorise', 'serviceTask', 'customs', 'Разрешение на погрузку и averbação', 'Shipping authorisation and averbação', auto(1, { cost: 1900 })),
      node('load', 'serviceTask', 'carrier', 'Погрузить на судно и выпустить электронный BL', 'Load on board and issue the electronic bill of lading', work(25, 'Логист', { waitTime: 480 })),
      node('sendDocs', 'serviceTask', 'sales', 'Передать электронный пакет банку и заказчику', 'Send the electronic set to the bank and the customer', auto(0.5)),
      node('preClear', 'userTask', 'dest', 'Предварительно заявить импорт в стране назначения', 'Pre-declare the import at the destination', work(90, 'Таможенный брокер', { cost: 1900 })),
      node('transit', 'intermediateTimerEvent', 'carrier', 'Морской переход до порта назначения', 'Ocean transit to the destination port', { waitTime: DAY * 26, dataSource: 'assumption' }),
      node('destClear', 'userTask', 'dest', 'Завершить импортное оформление', 'Complete the import clearance', work(60, 'Таможенный брокер', { cost: 600, waitTime: DAY * 1.5 })),
      node('checkCargo', 'userTask', 'dest', 'Принять груз и проверить сохранность', 'Receive the cargo and check for damage', work(45, 'Логист')),
      node('gwDamage', 'exclusiveGateway', 'dest', 'Есть повреждения?', 'Any damage?'),
      node('claim', 'userTask', 'dest', 'Заявить убыток по генеральному полису', 'File the loss under the open policy', work(90, 'Логист', { waitTime: DAY * 6 })),
      node('deliver', 'serviceTask', 'dest', 'Доставить заказчику и подтвердить приёмку', 'Deliver and obtain the acceptance', work(100, 'Логист', { cost: 1700, waitTime: DAY })),
      node('payment', 'receiveTask', 'fin', 'Получить платёж по контракту', 'Receive the contract payment', auto(1, { waitTime: DAY * 10 })),
      node('fx', 'serviceTask', 'fin', 'Закрыть валютный контракт и разнести выручку', 'Settle the FX contract and post the revenue', auto(1.5)),
      node('end', 'endEvent', 'fin', 'Экспортная поставка закрыта', 'Export shipment closed', { completes: true }),
      node('duDoc', 'dataObject', 'customs', 'DU-E (Siscomex)', 'DU-E (Siscomex)'),
      node('blDoc', 'dataObject', 'carrier', 'Электронный Bill of Lading', 'Electronic bill of lading'),
      node('regStore', 'dataStore', 'fin', 'Реестр экспортных операций и валютных контрактов', 'Register of export operations and FX contracts'),
      node('note', 'textAnnotation', 'customs', 'Статус OEA: зелёный канал 96 % вместо 84 % — самый непредсказуемый кусок срока уходит', 'AEO status: a 96% green channel instead of 84% - the least predictable part of the lead time disappears'),
    ],
    edges: [
      flow('start', 'terms'),
      flow('terms', 'screen'),
      flow('screen', 'gwScreen'),
      flow('gwScreen', 'investigate', { share: 6, ru: 'совпадение', en: 'hit' }),
      flow('gwScreen', 'proforma', { share: 94, ru: 'чисто', en: 'clear' }),
      flow('investigate', 'gwClear'),
      flow('gwClear', 'proforma', { share: 67, ru: 'допустима', en: 'allowed' }),
      flow('gwClear', 'reject', { share: 33, ru: 'запрещена', en: 'blocked' }),
      flow('reject', 'endReject'),
      flow('proforma', 'gwPay'),
      flow('gwPay', 'lc', { share: 28, ru: 'аккредитив', en: 'letter of credit', condition: 'terms == "L/C"' }),
      flow('gwPay', 'advance', { share: 16, ru: 'предоплата', en: 'advance', condition: 'terms == "advance"' }),
      flow('gwPay', 'credit', { share: 56, ru: 'открытый счёт', en: 'open account', condition: 'terms == "open account"' }),
      flow('lc', 'gwPayJoin'),
      flow('advance', 'gwPayJoin'),
      flow('credit', 'gwPayJoin'),
      flow('gwPayJoin', 'release'),
      flow('release', 'waitGoods'),
      flow('waitGoods', 'pgSplit'),
      flow('pgSplit', 'pack'),
      flow('pgSplit', 'docs'),
      flow('pgSplit', 'nfe'),
      flow('pack', 'marking'),
      flow('marking', 'pgJoin'),
      flow('nfe', 'insure'),
      flow('insure', 'pgJoin'),
      flow('docs', 'due'),
      flow('due', 'gwLicense'),
      flow('gwLicense', 'license', { share: 9, ru: 'нужна ануэнсия', en: 'licence needed' }),
      flow('gwLicense', 'channel', { share: 91, ru: 'не требуется', en: 'not required' }),
      flow('license', 'channel'),
      flow('channel', 'gwChannel'),
      flow('gwChannel', 'gwChannelJoin', { share: 96, ru: 'зелёный', en: 'green' }),
      flow('gwChannel', 'yellow', { share: 3, ru: 'жёлтый', en: 'yellow' }),
      flow('gwChannel', 'red', { share: 1, ru: 'красный', en: 'red' }),
      flow('yellow', 'gwChannelJoin'),
      flow('red', 'gwChannelJoin'),
      flow('gwChannelJoin', 'pgJoin'),
      flow('pgJoin', 'booking'),
      flow('booking', 'stuff'),
      flow('stuff', 'drayage'),
      flow('drayage', 'authorise'),
      flow('authorise', 'load'),
      flow('load', 'sendDocs'),
      flow('sendDocs', 'preClear'),
      flow('preClear', 'transit'),
      flow('transit', 'destClear'),
      flow('destClear', 'checkCargo'),
      flow('checkCargo', 'gwDamage'),
      flow('gwDamage', 'claim', { share: 2, ru: 'да', en: 'yes' }),
      flow('gwDamage', 'deliver', { share: 98, ru: 'нет', en: 'no' }),
      flow('claim', 'deliver'),
      flow('deliver', 'payment'),
      flow('payment', 'fx'),
      flow('fx', 'end'),
      { source: 'due', target: 'duDoc', type: 'dataAssociation' },
      { source: 'load', target: 'blDoc', type: 'dataAssociation' },
      { source: 'fx', target: 'regStore', type: 'dataAssociation' },
      { source: 'channel', target: 'note', type: 'association' },
    ],
  },
};
