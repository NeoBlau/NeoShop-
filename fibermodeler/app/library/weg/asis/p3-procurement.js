/**
 * 3. Sourcing of strategic raw materials (copper, electrical steel, aluminium)
 *    together with the commodity hedge that protects the margin.
 */
import { WEG, dataNote, roles, sourceBlock } from '../facts.js';
import { DAY, flow, node, reported, wait, work } from '../kit.js';

const LANES = [
  { id: 'mrp', label: { ru: 'Планирование материалов', en: 'Material planning' } },
  { id: 'buy', label: { ru: 'Закупки', en: 'Procurement' } },
  { id: 'treasury', label: { ru: 'Казначейство', en: 'Treasury' } },
  { id: 'qa', label: { ru: 'Входной контроль', en: 'Incoming quality' } },
  { id: 'wh', label: { ru: 'Склад и учёт', en: 'Warehouse & accounting' } },
];

export const procurement = {
  id: 'weg-procurement',
  order: 3,
  variant: 'as-is',
  name: { ru: '3. Закупка сырья и хеджирование', en: '3. Raw material sourcing and hedging' },
  description: {
    ru: 'От прогона MRP до оплаты поставщику: отзыв по контракту или тендер, квалификация поставщика, хедж по меди, приёмка и входной контроль.',
    en: 'From the MRP run to the supplier payment: call-off or tender, supplier qualification, copper hedge, receiving and incoming inspection.',
  },
  analysis: {
    currency: 'R$',
    volumePerYear: 48000,
    hoursPerFte: 1800,
    workingDays: WEG.workingDays,
    roles: roles('Планировщик', 'Закупщик', 'Казначейство', 'ОТК', 'Логист', 'Финансы'),
  },
  documentation: {
    ru: `Закупка прямых материалов для производства двигателей: медный обмоточный провод, электротехническая сталь, алюминий, подшипники.

Публичные данные:
• WEG направляет около R$ ${(WEG.investments.verticalizationBrl / 1e6).toFixed(0)} млн на вертикальную интеграцию в Мексике и Бразилии — часть закупаемых позиций переводится в собственное производство;
• выручка 2025 — R$ ${(WEG.revenue / 1e9).toFixed(1)} млрд, себестоимость материалов прямо зависит от цен на медь и сталь;
• EBITDA-маржа ${(WEG.ebitda / WEG.revenue * 100).toFixed(1)} % — именно её защищает хеджирование.

Расчёт из публичных данных: объём в модели — 48 000 заказов на закупку в год (допущение: ≈190 заказов в рабочий день на ${WEG.plants} площадок).

Времена операций и доли веток — отраслевые допущения; замените их данными своей системы закупок.

${dataNote('ru')}

${sourceBlock(['verticalization', 'annual2025', 'fy2025'], 'ru')}`,
    en: `Sourcing of direct materials: copper winding wire, electrical steel, aluminium, bearings.

Public figures: about R$ ${(WEG.investments.verticalizationBrl / 1e6).toFixed(0)}m invested in vertical integration in Mexico and Brazil; 2025 revenue R$ ${(WEG.revenue / 1e9).toFixed(1)}bn; EBITDA margin ${(WEG.ebitda / WEG.revenue * 100).toFixed(1)}%, which the commodity hedge protects.

Volume in the model: 48,000 purchase orders a year (assumption).

${dataNote('en')}

${sourceBlock(['verticalization', 'annual2025', 'fy2025'], 'en')}`,
  },
  spec: {
    notation: 'bpmn',
    name: { ru: 'Закупка сырья и хеджирование', en: 'Raw material sourcing and hedging' },
    lanes: LANES,
    nodes: [
      node('start', 'startTimerEvent', 'mrp', 'Еженедельный прогон MRP', 'Weekly MRP run', reported({})),
      node('demand', 'serviceTask', 'mrp', 'Рассчитать чистую потребность', 'Calculate the net requirement', work(9, 'Планировщик')),
      node('gwContract', 'exclusiveGateway', 'mrp', 'Позиция покрыта рамочным контрактом?', 'Covered by a frame contract?'),
      node('calloff', 'serviceTask', 'buy', 'Сформировать отзыв по контракту', 'Issue a call-off against the contract', work(7, 'Закупщик')),
      node('rfq', 'sendTask', 'buy', 'Запросить котировки у поставщиков', 'Send RFQ to suppliers', work(25, 'Закупщик', { waitTime: DAY * 3 })),
      node('compare', 'businessRuleTask', 'buy', 'Сравнить цену, сроки и условия', 'Compare price, lead time and terms', work(35, 'Закупщик')),
      node('gwBudget', 'exclusiveGateway', 'buy', 'Цена в рамках бюджета?', 'Within budget?'),
      node('escalate', 'userTask', 'buy', 'Согласовать отклонение с руководством', 'Escalate the deviation', work(20, 'Закупщик', { waitTime: DAY })),
      node('gwNew', 'exclusiveGateway', 'buy', 'Поставщик новый?', 'New supplier?'),
      node('audit', 'userTask', 'qa', 'Квалифицировать и проверить поставщика', 'Qualify and audit the supplier', work(240, 'ОТК', { cost: 3800 })),
      node('gwCopper', 'exclusiveGateway', 'treasury', 'Позиция привязана к бирже?', 'Exchange-linked commodity?'),
      node('hedge', 'serviceTask', 'treasury', 'Захеджировать объём (медь, алюминий)', 'Hedge the volume (copper, aluminium)', work(30, 'Казначейство', { cost: 450 })),
      node('po', 'serviceTask', 'buy', 'Разместить заказ в ERP', 'Place the purchase order', work(8, 'Закупщик')),
      node('confirm', 'receiveTask', 'buy', 'Получить подтверждение поставщика', 'Receive the supplier confirmation', work(5, 'Закупщик', { waitTime: DAY })),
      node('leadTime', 'intermediateTimerEvent', 'buy', 'Срок поставки', 'Supplier lead time', wait(DAY * 21)),
      node('receive', 'manualTask', 'wh', 'Принять груз и сверить с заказом', 'Receive and check against the order', work(30, 'Логист')),
      node('inspect', 'userTask', 'qa', 'Входной контроль и сертификаты', 'Incoming inspection and certificates', work(45, 'ОТК')),
      node('gwQuality', 'exclusiveGateway', 'qa', 'Соответствует спецификации?', 'Meets the specification?'),
      node('claim', 'sendTask', 'qa', 'Оформить рекламацию поставщику', 'Raise a supplier claim', work(50, 'ОТК', { waitTime: DAY * 5 })),
      node('gwClaim', 'exclusiveGateway', 'qa', 'Замена поставлена?', 'Replacement delivered?'),
      node('reject', 'endErrorEvent', 'qa', 'Поставка отклонена', 'Delivery rejected'),
      node('stock', 'serviceTask', 'wh', 'Оприходовать на склад', 'Post the goods receipt', work(6, 'Логист')),
      node('match', 'serviceTask', 'wh', 'Трёхсторонняя сверка заказ–приёмка–счёт', 'Three-way match', work(10, 'Финансы')),
      node('pay', 'serviceTask', 'wh', 'Оплатить в срок контракта', 'Pay per contract terms', work(4, 'Финансы', { waitTime: DAY * 30 })),
      node('end', 'endEvent', 'wh', 'Материал доступен производству', 'Material available to production', { completes: true }),
      node('contractData', 'dataStore', 'buy', 'Рамочные контракты и цены', 'Frame contracts and prices'),
      node('certData', 'dataObject', 'qa', 'Сертификат качества партии', 'Batch quality certificate'),
      node('note', 'textAnnotation', 'treasury', 'Хедж защищает EBITDA-маржу 21,5 % (отчёт 2025)', 'The hedge protects the 21.5% EBITDA margin (2025 report)'),
    ],
    edges: [
      flow('start', 'demand'),
      flow('demand', 'gwContract'),
      flow('gwContract', 'calloff', { share: 72, ru: 'контракт есть', en: 'under contract' }),
      flow('gwContract', 'rfq', { share: 28, ru: 'нужен тендер', en: 'tender needed' }),
      flow('rfq', 'compare'),
      flow('compare', 'gwBudget'),
      flow('gwBudget', 'gwNew', { share: 81, ru: 'да', en: 'yes' }),
      flow('gwBudget', 'escalate', { share: 19, ru: 'превышение', en: 'over budget' }),
      flow('escalate', 'gwNew'),
      flow('gwNew', 'audit', { share: 12, ru: 'новый', en: 'new' }),
      flow('gwNew', 'gwCopper', { share: 88, ru: 'известный', en: 'known' }),
      flow('audit', 'gwCopper'),
      flow('calloff', 'gwCopper'),
      flow('gwCopper', 'hedge', { share: 46, ru: 'медь / алюминий', en: 'copper / aluminium' }),
      flow('gwCopper', 'po', { share: 54, ru: 'фиксированная цена', en: 'fixed price' }),
      flow('hedge', 'po'),
      flow('po', 'confirm'),
      flow('confirm', 'leadTime'),
      flow('leadTime', 'receive'),
      flow('receive', 'inspect'),
      flow('inspect', 'gwQuality'),
      flow('gwQuality', 'stock', { share: 96, ru: 'годен', en: 'accepted' }),
      flow('gwQuality', 'claim', { share: 4, ru: 'несоответствие', en: 'non-conformity' }),
      flow('claim', 'gwClaim'),
      flow('gwClaim', 'inspect', { share: 70, ru: 'замена', en: 'replaced' }),
      flow('gwClaim', 'reject', { share: 30, ru: 'отказ', en: 'rejected' }),
      flow('stock', 'match'),
      flow('match', 'pay'),
      flow('pay', 'end'),
      { source: 'calloff', target: 'contractData', type: 'dataAssociation' },
      { source: 'inspect', target: 'certData', type: 'dataAssociation' },
      { source: 'hedge', target: 'note', type: 'association' },
    ],
  },
};
