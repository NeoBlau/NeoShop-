/**
 * 3 (TO-BE). Sourcing on framework agreements, a supplier portal, consignment
 * for C-class items and a rule-driven hedge.
 */
import { DERIVED, WEG, dataNote, roles, sourceBlock } from '../facts.js';
import { DAY, WEEK, auto, flow, node, reported, work } from '../kit.js';

const LANES = [
  { id: 'mrp', label: { ru: 'Планирование материалов', en: 'Material planning' } },
  { id: 'buy', label: { ru: 'Закупки', en: 'Procurement' } },
  { id: 'portal', label: { ru: 'Портал поставщиков (автоматика)', en: 'Supplier portal (automated)' } },
  { id: 'treasury', label: { ru: 'Казначейство', en: 'Treasury' } },
  { id: 'qa', label: { ru: 'Входной контроль', en: 'Incoming quality' } },
  { id: 'wh', label: { ru: 'Склад и учёт', en: 'Warehouse and accounting' } },
];

export const procurementToBe = {
  id: 'weg-procurement-tobe',
  order: 3,
  variant: 'to-be',
  baselineId: 'weg-procurement',
  name: {
    ru: '3. Закупка сырья и хеджирование — как будет',
    en: '3. Raw material sourcing and hedging — to be',
  },
  description: {
    ru: 'Рамочные контракты покрывают почти всю номенклатуру, класс C идёт по консигнации без заказа, новые позиции разыгрываются электронным аукционом, хедж ставится правилом, входной контроль выборочный по электронному сертификату, сверка и оплата автоматические.',
    en: 'Framework agreements cover nearly the whole catalogue, C-class items run on consignment without a purchase order, new items go through an e-auction, the hedge is placed by rule, incoming inspection is sampled against an electronic certificate, and matching and payment are automatic.',
  },
  analysis: {
    currency: 'R$',
    volumePerYear: 48000,
    hoursPerFte: 1800,
    workingDays: WEG.workingDays,
    roles: roles('Планировщик', 'Закупщик', 'Казначейство', 'ОТК', 'Логист', 'Финансы'),
  },
  documentation: {
    ru: `Целевое состояние снабжения сырьём и комплектующими.

Что меняется по сравнению с «как есть»:
1. **Покрытие контрактами.** Доля позиций под рамочным контрактом растёт с 72 до 90 %: тендер нужен реже, и он проходит электронным аукционом вместо переписки с котировками (25 → 12 мин работы, ожидание 1 день вместо 3).
2. **Класс C.** Крепёж, расходники и упаковка переводятся на консигнацию (VMI): поставщик пополняет склад по сигналу, заказ и приёмка по каждой партии не оформляются вовсе — это отдельная короткая ветка.
3. **Квалификация поставщика.** Проверка выполняется один раз при входе в реестр, а не при каждом новом заказе: доля заказов с полным аудитом падает с 12 до 4 %.
4. **Хедж.** Решение о хеджировании принимается правилом по доле биржевой составляющей и горизонту, казначейство подтверждает пакетом, а не по каждой позиции.
5. **Входной контроль.** Электронный сертификат качества приходит в портале до прибытия груза, физический контроль становится выборочным (30 % партий вместо 100 %).
6. **Сверка и оплата.** Трёхсторонняя сверка и платёж выполняются автоматически при совпадении заказа, приёмки и счёта.

Что НЕ меняется: срок поставки от поставщика, рекламационная процедура, платёжные условия контракта.

Хедж остаётся ключевым для маржи: EBITDA-маржа ${DERIVED.ebitdaMargin} % при выручке R$ ${(WEG.revenue / 1e9).toFixed(1)} млрд (публичная отчётность 2025) чувствительна к меди и алюминию. Целевые нормативы времени — **отраслевые допущения**.

${dataNote('ru')}

${sourceBlock(['fy2025', 'verticalization', 'numbers'], 'ru')}`,
    en: `Target state of raw material sourcing.

Changes: framework coverage rises from 72% to 90% and the remaining tenders run as an e-auction (25 → 12 min of work, one day of waiting instead of three); C-class items move to consignment, replenished on a signal with no purchase order or receipt per batch; supplier qualification happens once on entry into the register, so full audits drop from 12% to 4% of orders; the hedge decision is made by rule and confirmed in a batch; the electronic quality certificate arrives in the portal before the goods, so physical inspection is sampled on 30% of batches; three-way matching and payment run automatically when order, receipt and invoice agree.

Unchanged: the supplier's lead time, the claim procedure and the contractual payment terms.

Hedging stays central to the margin: a ${DERIVED.ebitdaMargin}% EBITDA margin on R$ ${(WEG.revenue / 1e9).toFixed(1)}bn of revenue is sensitive to copper and aluminium. The target times are **assumptions**.

${dataNote('en')}

${sourceBlock(['fy2025', 'verticalization', 'numbers'], 'en')}`,
  },
  spec: {
    notation: 'bpmn',
    name: { ru: 'Закупка сырья — как будет', en: 'Sourcing and hedging — to be' },
    lanes: LANES,
    nodes: [
      node('start', 'startTimerEvent', 'mrp', 'Ежедневный прогон MRP', 'Daily MRP run', reported({})),
      node('demand', 'serviceTask', 'mrp', 'Рассчитать чистую потребность автоматически', 'Compute the net requirement automatically', auto(0.5)),
      node('gwClass', 'exclusiveGateway', 'mrp', 'Класс позиции?', 'Item class?'),
      node('vmi', 'sendTask', 'portal', 'Сигнал пополнения поставщику по консигнации', 'Replenishment signal to the consignment supplier', auto(0.3)),
      node('vmiFill', 'intermediateTimerEvent', 'wh', 'Поставщик пополняет склад', 'Supplier refills the stock', { waitTime: DAY * 3, dataSource: 'assumption' }),
      node('vmiUse', 'serviceTask', 'wh', 'Списать по факту потребления', 'Consume from the consignment stock', auto(0.4)),
      node('endVmi', 'endEvent', 'wh', 'Класс C доступен производству', 'C-class item available', { completes: true }),
      node('gwContract', 'exclusiveGateway', 'mrp', 'Позиция покрыта рамочным контрактом?', 'Covered by a framework agreement?'),
      node('calloff', 'serviceTask', 'portal', 'Отзыв по контракту формируется автоматически', 'Call-off generated automatically', auto(0.5)),
      node('auction', 'userTask', 'buy', 'Провести электронный аукцион в портале', 'Run the e-auction in the portal', work(12, 'Закупщик', { waitTime: DAY })),
      node('compare', 'businessRuleTask', 'portal', 'Сравнить предложения по правилам (цена, срок, риск)', 'Score the bids by rule (price, lead time, risk)', auto(0.6)),
      node('gwBudget', 'exclusiveGateway', 'buy', 'Цена в рамках бюджета?', 'Price within budget?'),
      node('escalate', 'userTask', 'buy', 'Согласовать отклонение по электронному маршруту', 'Approve the deviation on the electronic route', work(12, 'Закупщик', { waitTime: 240 })),
      node('gwRegister', 'exclusiveGateway', 'buy', 'Поставщик в реестре квалифицированных?', 'Supplier in the qualified register?'),
      node('audit', 'userTask', 'qa', 'Квалифицировать поставщика и внести в реестр', 'Qualify the supplier and add to the register', work(180, 'ОТК', { cost: 3200 })),
      node('hedgeRule', 'businessRuleTask', 'treasury', 'Правило хеджирования: доля биржевой составляющей и горизонт', 'Hedging rule: exchange-linked share and horizon', auto(0.3)),
      node('gwHedge', 'exclusiveGateway', 'treasury', 'Нужен хедж?', 'Hedge needed?'),
      node('hedge', 'serviceTask', 'treasury', 'Захеджировать пакетом за день', 'Hedge in the daily batch', work(6, 'Казначейство', { cost: 380 })),
      node('po', 'serviceTask', 'portal', 'Разместить заказ в портале поставщика', 'Place the order in the supplier portal', auto(0.4)),
      node('confirm', 'receiveTask', 'portal', 'Автоматическое подтверждение поставщика', 'Automatic supplier confirmation', auto(0.3, { waitTime: 120 })),
      node('leadTime', 'intermediateTimerEvent', 'buy', 'Срок поставки по контракту', 'Contractual lead time', { waitTime: WEEK * 2, dataSource: 'assumption' }),
      node('asn', 'serviceTask', 'portal', 'Принять уведомление об отгрузке и сертификат', 'Receive the despatch advice and the certificate', auto(0.3)),
      node('receive', 'manualTask', 'wh', 'Принять груз сканированием по ASN', 'Receive the goods by scanning against the ASN', work(12, 'Логист')),
      node('gwSample', 'exclusiveGateway', 'qa', 'Партия попала в выборку контроля?', 'Batch selected for inspection?'),
      node('inspect', 'userTask', 'qa', 'Входной контроль выборочной партии', 'Incoming inspection of the sampled batch', work(38, 'ОТК')),
      node('gwQuality', 'exclusiveGateway', 'qa', 'Соответствует спецификации?', 'Conforms to the specification?'),
      node('claim', 'sendTask', 'qa', 'Оформить рекламацию в портале', 'Raise the claim in the portal', work(30, 'ОТК', { waitTime: DAY * 3 })),
      node('gwClaim', 'exclusiveGateway', 'qa', 'Замена поставлена?', 'Replacement delivered?'),
      node('reject', 'endErrorEvent', 'qa', 'Поставка отклонена', 'Delivery rejected'),
      node('stock', 'serviceTask', 'wh', 'Оприходовать автоматически', 'Post to stock automatically', auto(0.3)),
      node('match', 'businessRuleTask', 'portal', 'Автоматическая трёхсторонняя сверка', 'Automatic three-way match', auto(0.4)),
      node('gwMatch', 'exclusiveGateway', 'wh', 'Расхождений нет?', 'No discrepancy?'),
      node('resolve', 'userTask', 'wh', 'Разобрать расхождение с поставщиком', 'Clear the discrepancy with the supplier', work(25, 'Финансы')),
      node('pay', 'serviceTask', 'wh', 'Оплатить в срок контракта', 'Pay on the contractual date', auto(0.3, { waitTime: DAY * 30 })),
      node('end', 'endEvent', 'wh', 'Материал доступен производству', 'Material available to production', { completes: true }),
      node('contractData', 'dataStore', 'portal', 'Рамочные контракты, реестр поставщиков, цены', 'Framework agreements, supplier register, prices'),
      node('certData', 'dataObject', 'qa', 'Электронный сертификат качества партии', 'Electronic batch quality certificate'),
      node('note', 'textAnnotation', 'treasury', 'Хедж защищает EBITDA-маржу 21,5 % (публичная отчётность 2025)', 'Hedging protects the 21.5% EBITDA margin (2025 disclosure)'),
    ],
    edges: [
      flow('start', 'demand'),
      flow('demand', 'gwClass'),
      flow('gwClass', 'vmi', { share: 34, ru: 'класс C (консигнация)', en: 'C-class (consignment)' }),
      flow('gwClass', 'gwContract', { share: 66, ru: 'класс A/B', en: 'A/B class' }),
      flow('vmi', 'vmiFill'),
      flow('vmiFill', 'vmiUse'),
      flow('vmiUse', 'endVmi'),
      flow('gwContract', 'calloff', { share: 90, ru: 'покрыта', en: 'covered' }),
      flow('gwContract', 'auction', { share: 10, ru: 'нужен тендер', en: 'tender needed' }),
      flow('auction', 'compare'),
      flow('compare', 'gwBudget'),
      flow('gwBudget', 'gwRegister', { share: 86, ru: 'в бюджете', en: 'within budget' }),
      flow('gwBudget', 'escalate', { share: 14, ru: 'отклонение', en: 'deviation' }),
      flow('escalate', 'gwRegister'),
      flow('gwRegister', 'hedgeRule', { share: 96, ru: 'в реестре', en: 'registered' }),
      flow('gwRegister', 'audit', { share: 4, ru: 'новый', en: 'new' }),
      flow('audit', 'hedgeRule'),
      flow('calloff', 'hedgeRule'),
      flow('hedgeRule', 'gwHedge'),
      flow('gwHedge', 'hedge', { share: 46, ru: 'да', en: 'yes' }),
      flow('gwHedge', 'po', { share: 54, ru: 'нет', en: 'no' }),
      flow('hedge', 'po'),
      flow('po', 'confirm'),
      flow('confirm', 'leadTime'),
      flow('leadTime', 'asn'),
      flow('asn', 'receive'),
      flow('receive', 'gwSample'),
      flow('gwSample', 'inspect', { share: 30, ru: 'в выборке', en: 'sampled' }),
      flow('gwSample', 'stock', { share: 70, ru: 'по сертификату', en: 'on certificate' }),
      flow('inspect', 'gwQuality'),
      flow('gwQuality', 'stock', { share: 97, ru: 'соответствует', en: 'conforms' }),
      flow('gwQuality', 'claim', { share: 3, ru: 'отклонение', en: 'non-conforming' }),
      flow('claim', 'gwClaim'),
      flow('gwClaim', 'inspect', { share: 74, ru: 'замена пришла', en: 'replaced' }),
      flow('gwClaim', 'reject', { share: 26, ru: 'отказ', en: 'rejected' }),
      flow('stock', 'match'),
      flow('match', 'gwMatch'),
      flow('gwMatch', 'pay', { share: 93, ru: 'совпало', en: 'matched' }),
      flow('gwMatch', 'resolve', { share: 7, ru: 'расхождение', en: 'discrepancy' }),
      flow('resolve', 'pay'),
      flow('pay', 'end'),
      { source: 'calloff', target: 'contractData', type: 'dataAssociation' },
      { source: 'asn', target: 'certData', type: 'dataAssociation' },
      { source: 'hedge', target: 'note', type: 'association' },
    ],
  },
};
