/**
 * 8. Export shipment from Brazil and customs clearance (DU-E / Siscomex).
 */
import { DERIVED, WEG, dataNote, roles, sourceBlock } from './facts.js';
import { DAY, WEEK, flow, node, reported, work } from './kit.js';

const LANES = [
  { id: 'client', label: { ru: 'Зарубежный заказчик', en: 'Overseas customer' } },
  { id: 'sales', label: { ru: 'Экспортные продажи', en: 'Export sales' } },
  { id: 'fin', label: { ru: 'Финансы и казначейство', en: 'Finance & treasury' } },
  { id: 'plant', label: { ru: 'Завод и упаковка', en: 'Plant & packing' } },
  { id: 'customs', label: { ru: 'Таможенный брокер', en: 'Customs broker' } },
  { id: 'carrier', label: { ru: 'Перевозчик и порт', en: 'Carrier & port' } },
  { id: 'dest', label: { ru: 'Компания WEG в стране назначения', en: 'WEG company at destination' } },
];

const SHIPMENT_VALUE = 420000; // R$, average consolidated export shipment
const BRAZIL_EXPORT_SHARE = 0.45; // share of external revenue shipped out of Brazil
const EXPORT_REVENUE = Math.round(DERIVED.externalRevenue * BRAZIL_EXPORT_SHARE);
const SHIPMENTS = Math.round(EXPORT_REVENUE / SHIPMENT_VALUE / 100) * 100; // ≈ 26 000

export const exportProcess = {
  id: 'weg-export',
  order: 8,
  name: {
    ru: '8. Экспортная поставка и таможенное оформление',
    en: '8. Export shipment and customs clearance',
  },
  description: {
    ru: 'Экспортный заказ — комплаенс по стране и контрагенту — условия оплаты (аккредитив, предоплата, открытый счёт) — экспортная упаковка и документы — DU-E в Siscomex — канал досмотра — погрузка на судно — морской переход — оформление в стране назначения — поставка и закрытие валютного контракта.',
    en: 'Export order — country and counterparty compliance — payment terms (L/C, advance, open account) — export packing and documents — DU-E in Siscomex — inspection channel — vessel loading — ocean transit — destination clearance — delivery and FX contract settlement.',
  },
  analysis: {
    currency: 'R$',
    volumePerYear: SHIPMENTS,
    hoursPerFte: 1800,
    workingDays: WEG.workingDays,
    roles: roles('Менеджер по продажам', 'Аналитик', 'Логист', 'Таможенный брокер', 'Финансы', 'Оператор'),
  },
  documentation: {
    ru: `Отгрузка готовой продукции с бразильских площадок зарубежному заказчику и таможенное оформление на экспорт.

Публичные данные:
• ${Math.round(WEG.externalShare * 1000) / 10} % выручки 2025 года WEG получает вне Бразилии — это ≈ R$ ${(DERIVED.externalRevenue / 1e9).toFixed(1)} млрд от общей выручки R$ ${(WEG.revenue / 1e9).toFixed(1)} млрд;
• WEG работает на ${WEG.plants} производственных площадках в ${WEG.countries} странах, поэтому часть зарубежной выручки производится локально и через бразильскую таможню не проходит.

Расчёт из публичных данных (объём процесса):
1) внешняя выручка = R$ ${(WEG.revenue / 1e9).toFixed(1)} млрд × ${Math.round(WEG.externalShare * 1000) / 10} % = R$ ${(DERIVED.externalRevenue / 1e9).toFixed(1)} млрд;
2) допущение: ${Math.round(BRAZIL_EXPORT_SHARE * 100)} % этой суммы вывозится из Бразилии, остальное делают заводы в других странах → R$ ${(EXPORT_REVENUE / 1e9).toFixed(1)} млрд;
3) допущение: средняя стоимость консолидированной отгрузки (один-два 40-футовых контейнера) — R$ ${(SHIPMENT_VALUE / 1000).toFixed(0)} тыс.;
4) объём = R$ ${(EXPORT_REVENUE / 1e9).toFixed(1)} млрд ÷ R$ ${(SHIPMENT_VALUE / 1000).toFixed(0)} тыс. ≈ ${SHIPMENTS.toLocaleString('ru-RU')} отгрузок в год.

Нормативная часть процесса (соответствует бразильскому порядку, а не внутренним регламентам WEG):
• DU-E (Declaração Única de Exportação) оформляется в Portal Único Siscomex и заменяет прежние RE/DDE;
• после регистрации DU-E груз проходит параметризацию и получает канал: зелёный (выпуск без проверки), жёлтый (проверка документов), красный (физический досмотр);
• разрешение на погрузку и последующая «averbação» подтверждают фактический вывоз;
• экспортная деревянная тара маркируется по ISPM 15, счёт-фактура выпускается как NF-e с экспортным CFOP (7.xxx);
• валютная выручка закрывается контрактом обмена (ACC/ACE) в уполномоченном банке.

Доли каналов досмотра (${84} / ${11} / ${5} %) и распределение условий оплаты — отраслевые допущения, их следует заменить статистикой собственного Siscomex-кабинета и CRM.

${dataNote('ru')}

${sourceBlock(['fy2025', 'profile', 'numbers', 'annual2025'], 'ru')}`,
    en: `Shipment of finished goods from the Brazilian plants to an overseas customer, including export customs clearance.

Public figures: ${Math.round(WEG.externalShare * 1000) / 10}% of WEG's 2025 revenue came from markets outside Brazil — about R$ ${(DERIVED.externalRevenue / 1e9).toFixed(1)}bn of R$ ${(WEG.revenue / 1e9).toFixed(1)}bn. WEG also runs ${WEG.plants} plants in ${WEG.countries} countries, so part of that revenue is produced locally and never crosses Brazilian customs.

Volume derivation: external revenue R$ ${(DERIVED.externalRevenue / 1e9).toFixed(1)}bn × ${Math.round(BRAZIL_EXPORT_SHARE * 100)}% shipped out of Brazil (assumption) ÷ R$ ${(SHIPMENT_VALUE / 1000).toFixed(0)}k average consolidated shipment (assumption) ≈ ${SHIPMENTS.toLocaleString('en-US')} shipments a year.

Regulatory steps follow Brazilian practice rather than WEG internal procedure: the DU-E is filed in Portal Único Siscomex, parameterisation assigns a green / yellow / red channel, the shipping authorisation and later averbação confirm the physical export, wooden export packing is ISPM 15 marked, the invoice is issued as an NF-e with an export CFOP, and the currency proceeds are settled through an FX contract (ACC/ACE) at an authorised bank.

Channel shares (84 / 11 / 5%) and the payment-term mix are assumptions — replace them with your own Siscomex and CRM statistics.

${dataNote('en')}

${sourceBlock(['fy2025', 'profile', 'numbers', 'annual2025'], 'en')}`,
  },
  spec: {
    notation: 'bpmn',
    name: { ru: 'Экспортная поставка и таможенное оформление', en: 'Export shipment and customs clearance' },
    lanes: LANES,
    nodes: [
      node('start', 'startMessageEvent', 'client', 'Экспортный заказ подтверждён', 'Export order confirmed', reported({})),
      node('terms', 'userTask', 'sales', 'Проверить Incoterms, страну и требования сертификации', 'Check Incoterms, country and certification requirements', work(45, 'Менеджер по продажам')),
      node('screen', 'businessRuleTask', 'sales', 'Комплаенс: санкционный скрининг страны и контрагента', 'Compliance: sanctions screening of country and counterparty', work(20, 'Аналитик')),
      node('gwScreen', 'exclusiveGateway', 'sales', 'Поставка допустима?', 'Shipment allowed?'),
      node('reject', 'sendTask', 'sales', 'Отказать и зафиксировать причину в комплаенс-журнале', 'Decline and record the reason in the compliance log', work(25, 'Аналитик')),
      node('endReject', 'endEvent', 'sales', 'Отгрузка запрещена комплаенсом', 'Blocked by compliance'),
      node('proforma', 'userTask', 'sales', 'Выпустить proforma invoice и подтвердить срок отгрузки', 'Issue the proforma invoice and confirm the shipping date', work(40, 'Менеджер по продажам')),
      node('gwPay', 'exclusiveGateway', 'fin', 'Условия оплаты?', 'Payment terms?'),
      node('lc', 'userTask', 'fin', 'Проверить аккредитив и список документов с банком', 'Check the L/C and the document set with the bank', work(120, 'Финансы', { waitTime: DAY * 4 })),
      node('advance', 'receiveTask', 'fin', 'Получить предоплату', 'Receive the advance payment', work(30, 'Финансы', { waitTime: DAY * 5 })),
      node('credit', 'businessRuleTask', 'fin', 'Проверить кредитный лимит и страховое покрытие экспорта', 'Check the credit limit and export credit insurance', work(35, 'Финансы')),
      node('gwPayJoin', 'exclusiveGateway', 'fin', 'Оплата обеспечена', 'Payment secured'),
      node('release', 'serviceTask', 'plant', 'Выпустить заказ на отгрузку и зарезервировать продукцию', 'Release the shipping order and reserve the goods', work(20, 'Логист')),
      node('waitGoods', 'intermediateTimerEvent', 'plant', 'Ожидание готовности продукции на складе', 'Waiting for the goods to be ready', { waitTime: WEEK * 2, dataSource: 'assumption' }),
      node('pgSplit', 'parallelGateway', 'plant', 'Упаковка и документы параллельно', 'Packing and documents in parallel'),
      node('pack', 'manualTask', 'plant', 'Экспортная упаковка и тара по ISPM 15', 'Export packing and ISPM 15 crating', work(300, 'Оператор', { resourceQty: 3, cost: 2600 })),
      node('marking', 'serviceTask', 'plant', 'Нанести маркировку, взвесить, снять фотоотчёт', 'Apply markings, weigh and photograph the packages', work(60, 'Оператор', { cost: 180 })),
      node('docs', 'userTask', 'customs', 'Подготовить инвойс, packing list и сертификат происхождения', 'Prepare the invoice, packing list and certificate of origin', work(90, 'Таможенный брокер', { cost: 320 })),
      node('nfe', 'serviceTask', 'fin', 'Выпустить NF-e с экспортным CFOP', 'Issue the NF-e with an export CFOP', work(25, 'Финансы')),
      node('insure', 'serviceTask', 'fin', 'Оформить морское страхование груза', 'Arrange marine cargo insurance', work(20, 'Финансы', { cost: 1050 })),
      node('pgJoin', 'parallelGateway', 'customs', 'Груз и документы готовы', 'Cargo and documents ready'),
      node('due', 'serviceTask', 'customs', 'Зарегистрировать DU-E в Portal Único Siscomex', 'File the DU-E in Portal Único Siscomex', work(75, 'Таможенный брокер', { cost: 1450 })),
      node('gwLicense', 'exclusiveGateway', 'customs', 'Нужна экспортная лицензия (ануэнсия)?', 'Export licence (anuência) required?'),
      node('license', 'userTask', 'customs', 'Получить согласование уполномоченного органа', 'Obtain the licensing authority approval', work(90, 'Таможенный брокер', { waitTime: DAY * 6 })),
      node('booking', 'sendTask', 'carrier', 'Забукировать судно и получить booking confirmation', 'Book the vessel and get the booking confirmation', work(45, 'Логист', { cost: 12000, waitTime: DAY * 2 })),
      node('stuff', 'manualTask', 'plant', 'Загрузить контейнер и опломбировать', 'Stuff the container and seal it', work(180, 'Оператор', { resourceQty: 2, cost: 900 })),
      node('drayage', 'serviceTask', 'carrier', 'Доставить контейнер в порт и пройти gate-in', 'Truck the container to the port and gate in', work(90, 'Логист', { cost: 3800, waitTime: DAY * 2 })),
      node('channel', 'businessRuleTask', 'customs', 'Параметризация DU-E и канал досмотра', 'DU-E parameterisation and inspection channel', work(15, 'Таможенный брокер')),
      node('gwChannel', 'exclusiveGateway', 'customs', 'Канал досмотра?', 'Inspection channel?'),
      node('yellow', 'userTask', 'customs', 'Жёлтый канал: проверка документов таможней', 'Yellow channel: customs document review', work(60, 'Таможенный брокер', { waitTime: DAY })),
      node('red', 'userTask', 'customs', 'Красный канал: физический досмотр', 'Red channel: physical inspection', work(240, 'Таможенный брокер', { cost: 2100, waitTime: DAY * 3 })),
      node('gwChannelJoin', 'exclusiveGateway', 'customs', 'Груз выпущен таможней', 'Cleared by customs'),
      node('authorise', 'serviceTask', 'customs', 'Разрешение на погрузку и averbação', 'Shipping authorisation and averbação', work(30, 'Таможенный брокер', { cost: 1900 })),
      node('load', 'serviceTask', 'carrier', 'Погрузить на судно и выпустить Bill of Lading', 'Load on board and issue the Bill of Lading', work(40, 'Логист', { waitTime: DAY * 2 })),
      node('transit', 'intermediateTimerEvent', 'carrier', 'Морской переход до порта назначения', 'Ocean transit to the destination port', { waitTime: DAY * 26, dataSource: 'assumption' }),
      node('sendDocs', 'sendTask', 'sales', 'Передать комплект документов банку и заказчику', 'Send the document set to the bank and the customer', work(35, 'Менеджер по продажам', { cost: 260 })),
      node('destClear', 'userTask', 'dest', 'Оформить импорт в стране назначения', 'Clear the import at the destination', work(180, 'Таможенный брокер', { cost: 2400, waitTime: DAY * 4 })),
      node('checkCargo', 'userTask', 'dest', 'Принять груз и проверить сохранность', 'Receive the cargo and check for damage', work(60, 'Логист')),
      node('gwDamage', 'exclusiveGateway', 'dest', 'Есть повреждения?', 'Any damage?'),
      node('claim', 'userTask', 'dest', 'Открыть страховую претензию и согласовать возмещение', 'Open the insurance claim and agree the settlement', work(150, 'Логист', { waitTime: DAY * 12 })),
      node('deliver', 'serviceTask', 'dest', 'Доставить заказчику и получить подтверждение приёмки', 'Deliver to the customer and obtain the acceptance', work(120, 'Логист', { cost: 1700, waitTime: DAY * 2 })),
      node('payment', 'receiveTask', 'fin', 'Получить платёж по контракту', 'Receive the contract payment', work(25, 'Финансы', { waitTime: DAY * 12 })),
      node('fx', 'serviceTask', 'fin', 'Закрыть валютный контракт обмена и разнести выручку', 'Settle the FX contract and post the revenue', work(45, 'Финансы')),
      node('end', 'endEvent', 'fin', 'Экспортная поставка закрыта', 'Export shipment closed'),
      node('duDoc', 'dataObject', 'customs', 'DU-E (Siscomex)', 'DU-E (Siscomex)'),
      node('blDoc', 'dataObject', 'carrier', 'Bill of Lading', 'Bill of Lading'),
      node('regStore', 'dataStore', 'fin', 'Реестр экспортных операций и валютных контрактов', 'Register of export operations and FX contracts'),
      node('note', 'textAnnotation', 'customs', 'Каналы Siscomex: зелёный — выпуск без проверки, жёлтый — документы, красный — физический досмотр', 'Siscomex channels: green — released, yellow — documents, red — physical inspection'),
    ],
    edges: [
      flow('start', 'terms'),
      flow('terms', 'screen'),
      flow('screen', 'gwScreen'),
      flow('gwScreen', 'reject', { share: 2, ru: 'ограничение', en: 'restricted' }),
      flow('gwScreen', 'proforma', { share: 98, ru: 'допустима', en: 'allowed' }),
      flow('reject', 'endReject'),
      flow('proforma', 'gwPay'),
      flow('gwPay', 'lc', { share: 34, ru: 'аккредитив', en: 'letter of credit', condition: 'terms == "L/C"' }),
      flow('gwPay', 'advance', { share: 18, ru: 'предоплата', en: 'advance', condition: 'terms == "advance"' }),
      flow('gwPay', 'credit', { share: 48, ru: 'открытый счёт', en: 'open account', condition: 'terms == "open account"' }),
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
      flow('docs', 'pgJoin'),
      flow('nfe', 'insure'),
      flow('insure', 'pgJoin'),
      flow('pgJoin', 'due'),
      flow('due', 'gwLicense'),
      flow('gwLicense', 'license', { share: 12, ru: 'нужна ануэнсия', en: 'licence needed' }),
      flow('gwLicense', 'booking', { share: 88, ru: 'не требуется', en: 'not required' }),
      flow('license', 'booking'),
      flow('booking', 'stuff'),
      flow('stuff', 'drayage'),
      flow('drayage', 'channel'),
      flow('channel', 'gwChannel'),
      flow('gwChannel', 'gwChannelJoin', { share: 84, ru: 'зелёный', en: 'green' }),
      flow('gwChannel', 'yellow', { share: 11, ru: 'жёлтый', en: 'yellow' }),
      flow('gwChannel', 'red', { share: 5, ru: 'красный', en: 'red' }),
      flow('yellow', 'gwChannelJoin'),
      flow('red', 'gwChannelJoin'),
      flow('gwChannelJoin', 'authorise'),
      flow('authorise', 'load'),
      flow('load', 'transit'),
      flow('transit', 'sendDocs'),
      flow('sendDocs', 'destClear'),
      flow('destClear', 'checkCargo'),
      flow('checkCargo', 'gwDamage'),
      flow('gwDamage', 'claim', { share: 3, ru: 'да', en: 'yes' }),
      flow('gwDamage', 'deliver', { share: 97, ru: 'нет', en: 'no' }),
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
