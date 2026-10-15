/**
 * The WEG buyer's journey as BPMN 2.0, as is and to be.
 *
 * The buyer is an industrial customer of standard motors. One case is one
 * purchase from the first need to the decision about the next order, and it
 * is built from what the library already models rather than re-typed:
 *
 *  - the order-to-cash steps (process 1) are taken over from that library
 *    entry, lanes remapped, parameters and branch shares untouched;
 *  - after-sale service is one call to process 6: its work, waiting and cost
 *    per case are read from the calculation of that diagram, and it is entered
 *    with the probability that a delivered motor needs service, derived from
 *    the two processes' yearly volumes (145 000 cases against 760 000 orders);
 *  - what only the customer does - selecting, asking for a price, receiving,
 *    installing, deciding about the next order - is added here, with the
 *    customer's time recorded as waiting (the convention of every library
 *    process: customer time is waiting, not company labour).
 *
 * Because the shared steps are copied at build time, a change to process 1 or 6
 * shows up here too, and the comparison of the two journeys is computed by the
 * same engine as everywhere else. Only the customer-side steps and the
 * connections are assumptions of this file, and they are tagged as such.
 */
import { DAY, auto, flow, node, wait, work } from '../../kit.js';
import { buildLibraryDiagrams, pick, variantFolder } from '../../shared.js';
import { dataNote, roleLabel } from '../facts.js';
import { WEG_AS_IS, WEG_TO_BE } from '../index.js';
import { analyse } from '../sheets/engine.js';

export const WEG_JOURNEY_LIBRARY = 'wegjourney';

const ROOT = { ru: 'WEG/Путь покупателя', en: 'WEG/Customer journey' };

export function journeyFolder(variant, locale = 'ru') {
  return variantFolder(pick(ROOT, locale), variant, locale);
}

const find = (list, id) => list.find((process) => process.id === id);
const clone = (value) => JSON.parse(JSON.stringify(value));

/** Share of delivered motors that need service: service cases per order (derived). */
const SERVICE_SHARE = 19;
/** Share of enquiries that turn into an order: the same in both versions, so the market does not move the comparison. */
const WIN_SHARE = 85;

const SKIP_TYPES = new Set(['textAnnotation', 'dataObject', 'dataStore']);

/** Nodes of a library process without notes and data objects, lanes remapped, ids optionally prefixed. */
function takeNodes(process, { drop = [], prefix = '', laneMap = {}, strip = [] }) {
  return process.spec.nodes
    .filter((entry) => !SKIP_TYPES.has(entry.type) && !drop.includes(entry.id))
    .map((entry) => {
      const copy = clone(entry);
      copy.id = prefix + entry.id;
      copy.lane = laneMap[entry.lane] || entry.lane;
      if (strip.includes(entry.id) && copy.props) delete copy.props.completes;
      return copy;
    });
}

function takeEdges(process, { drop = [], prefix = '', rename = {} }) {
  const skipped = new Set([...drop, ...process.spec.nodes.filter((entry) => SKIP_TYPES.has(entry.type)).map((entry) => entry.id)]);
  return process.spec.edges
    .filter((edge) => !edge.type || edge.type === 'sequenceFlow')
    .filter((edge) => !skipped.has(edge.source) && !skipped.has(edge.target))
    .map((edge) => {
      const copy = clone(edge);
      copy.source = rename[edge.source] ?? prefix + edge.source;
      copy.target = rename[edge.target] ?? prefix + edge.target;
      return copy;
    });
}

/** One call activity that stands for process 6, with the figures of its own calculation. */
function serviceCall(svc, label) {
  const result = analyse(svc);
  const work = Math.round(result.work * 10) / 10;
  const waiting = Math.max(0, Math.round((result.lead - result.work) * 10) / 10);
  return node('service', 'callActivity', 'service', label.ru, label.en, {
    duration: work,
    waitTime: waiting,
    cost: Math.round(result.result.totals.costPerRun * 100) / 100,
    dataSource: 'derived',
  });
}

const SERVICE_LANE = { id: 'service', label: { ru: 'Сервис и ремонт (процесс 6)', en: 'Service and repair (process 6)' } };

function mergeLanes(...lists) {
  const seen = new Set();
  const lanes = [];
  for (const list of lists) {
    for (const lane of list) {
      if (seen.has(lane.id)) continue;
      seen.add(lane.id);
      lanes.push(lane);
    }
  }
  return lanes;
}

function mergeRoles(...lists) {
  const seen = new Set();
  return lists.flat().filter((role) => (seen.has(role.id) ? false : seen.add(role.id)));
}

/* ------------------------------------------------------------------ AS-IS */

function buildAsIs() {
  const o2c = find(WEG_AS_IS, 'weg-o2c');
  const svc = find(WEG_AS_IS, 'weg-service');
  const log = 'log';
  const nodes = [
    node('start', 'startEvent', 'customer', 'Появилась потребность в двигателе: замена, новая установка или рост нагрузки', 'A need for a motor: a replacement, a new installation or a higher load'),
    node('select', 'userTask', 'customer', 'Подобрать двигатель по каталогу и листам данных', 'Select a motor from the catalogue and data sheets', wait(90)),
    node('ask', 'sendTask', 'customer', 'Запросить цену и срок у менеджера или дистрибьютора', 'Ask a salesperson or distributor for price and lead time', wait(20)),
    node('offer', 'userTask', 'sales', 'Собрать и отправить предложение вручную из прайса и условий', 'Build and send the quotation by hand from the price list and terms', work(25, 'Менеджер по продажам', { waitTime: DAY / 2 })),
    node('gwOffer', 'exclusiveGateway', 'customer', 'Предложение подходит?', 'Does the quotation suit?'),
    node('lost', 'endEvent', 'customer', 'Клиент выбрал другого поставщика', 'The customer chose another supplier'),
    node('order', 'sendTask', 'customer', 'Отправить заказ письмом или таблицей', 'Send the order as a letter or a spreadsheet', wait(15)),
    ...takeNodes(o2c, { drop: ['start'] }),
    node('pgDeliver', 'parallelGateway', log, 'Груз передан: оплата и поставка идут параллельно', 'Goods handed over: payment and delivery run in parallel'),
    node('receive', 'manualTask', 'customer', 'Принять груз, сверить с накладной и заказом', 'Receive the load and check it against the delivery note and the order', wait(60)),
    node('install', 'manualTask', 'customer', 'Смонтировать и запустить двигатель', 'Install and start the motor', wait(DAY)),
    node('gwNeed', 'exclusiveGateway', 'customer', 'Двигателю потребовался сервис?', 'Did the motor need service?'),
    serviceCall(svc, { ru: 'Сервис и ремонт: звонок, диагностика, гарантия, вывоз, смета, ремонт, возврат', en: 'Service and repair: call, diagnosis, warranty, collection, quotation, repair, return' }),
    node('gwBack', 'exclusiveGateway', 'customer', 'Двигатель снова в работе', 'The motor is back in service'),
    node('reorder', 'userTask', 'customer', 'Решить: повторить заказ, сменить поставщика или заменить модель', 'Decide: reorder, switch supplier or replace the model', wait(60)),
    node('finish', 'endEvent', 'customer', 'Путь закончен: повторный заказ или уход', 'Journey over: a reorder or a departure'),
  ];
  const edges = [
    flow('start', 'select'),
    flow('select', 'ask'),
    flow('ask', 'offer'),
    flow('offer', 'gwOffer'),
    flow('gwOffer', 'order', { share: WIN_SHARE, ru: 'подходит', en: 'suits' }),
    flow('gwOffer', 'lost', { share: 100 - WIN_SHARE, ru: 'не подходит', en: 'does not suit' }),
    flow('order', 'register'),
    ...takeEdges(o2c, { drop: ['start'], rename: {} }).filter((edge) => !(edge.source === 'notify' && edge.target === 'invoice')),
    flow('notify', 'pgDeliver'),
    flow('pgDeliver', 'invoice'),
    flow('pgDeliver', 'receive'),
    flow('receive', 'install'),
    flow('install', 'gwNeed'),
    flow('gwNeed', 'service', { share: SERVICE_SHARE, ru: 'да', en: 'yes' }),
    flow('gwNeed', 'gwBack', { share: 100 - SERVICE_SHARE, ru: 'нет', en: 'no' }),
    flow('service', 'gwBack'),
    flow('gwBack', 'reorder'),
    flow('reorder', 'finish'),
  ];
  return { o2c, svc, nodes, edges };
}

/* ------------------------------------------------------------------ TO-BE */

function buildToBe() {
  const o2c = find(WEG_TO_BE, 'weg-o2c-tobe');
  const svc = find(WEG_TO_BE, 'weg-service-tobe');
  const nodes = [
    node('start', 'startEvent', 'customer', 'Появилась потребность в двигателе: замена, новая установка или рост нагрузки', 'A need for a motor: a replacement, a new installation or a higher load'),
    node('select', 'userTask', 'customer', 'Подобрать двигатель в подборщике портала: наличие и срок видны сразу', 'Select a motor in the portal selector: stock and lead time are visible at once', wait(25)),
    node('basket', 'userTask', 'customer', 'Увидеть цену по своему договору и срок в корзине портала', 'See the price under their own contract and the date in the portal basket', wait(10)),
    node('gwOffer', 'exclusiveGateway', 'customer', 'Условия подходят?', 'Do the terms suit?'),
    node('lost', 'endEvent', 'customer', 'Клиент выбрал другого поставщика', 'The customer chose another supplier'),
    node('order', 'sendTask', 'customer', 'Загрузить заказ в портале или по EDI', 'Upload the order on the portal or via EDI', wait(10)),
    ...takeNodes(o2c, { drop: ['start'] }),
    node('pgDeliver', 'parallelGateway', 'log', 'Груз передан: оплата и поставка идут параллельно', 'Goods handed over: payment and delivery run in parallel'),
    node('receive', 'manualTask', 'customer', 'Сканировать груз по уведомлению об отгрузке, открыть цифровой паспорт двигателя', 'Scan the load against the despatch notice and open the motor\'s digital passport', wait(30)),
    node('install', 'manualTask', 'customer', 'Смонтировать и запустить двигатель', 'Install and start the motor', wait(DAY)),
    node('connect', 'userTask', 'customer', 'Подключить мониторинг вибрации, температуры и тока', 'Connect monitoring of vibration, temperature and current', wait(45)),
    node('gwNeed', 'exclusiveGateway', 'customer', 'Двигателю потребовался сервис?', 'Did the motor need service?'),
    serviceCall(svc, { ru: 'Сервис по событию мониторинга: диагностика по телеметрии, окно остановки, запчасти по прогнозу, смета в портале', en: 'Service from a monitoring event: telemetry diagnosis, shutdown window, parts by forecast, quotation in the portal' }),
    node('gwBack', 'exclusiveGateway', 'customer', 'Двигатель снова в работе', 'The motor is back in service'),
    node('reorder', 'userTask', 'customer', 'Решить: повторить заказ из истории, сменить поставщика или заменить модель', 'Decide: reorder from the history, switch supplier or replace the model', wait(30)),
    node('finish', 'endEvent', 'customer', 'Путь закончен: повторный заказ или уход', 'Journey over: a reorder or a departure'),
  ];
  const edges = [
    flow('start', 'select'),
    flow('select', 'basket'),
    flow('basket', 'gwOffer'),
    flow('gwOffer', 'order', { share: WIN_SHARE, ru: 'подходят', en: 'suit' }),
    flow('gwOffer', 'lost', { share: 100 - WIN_SHARE, ru: 'не подходят', en: 'do not suit' }),
    flow('order', 'validate'),
    ...takeEdges(o2c, { drop: ['start'] }).filter((edge) => !(edge.source === 'notify' && edge.target === 'invoice')),
    flow('notify', 'pgDeliver'),
    flow('pgDeliver', 'invoice'),
    flow('pgDeliver', 'receive'),
    flow('receive', 'install'),
    flow('install', 'connect'),
    flow('connect', 'gwNeed'),
    flow('gwNeed', 'service', { share: SERVICE_SHARE, ru: 'да', en: 'yes' }),
    flow('gwNeed', 'gwBack', { share: 100 - SERVICE_SHARE, ru: 'нет', en: 'no' }),
    flow('service', 'gwBack'),
    flow('gwBack', 'reorder'),
    flow('reorder', 'finish'),
  ];
  return { o2c, svc, nodes, edges };
}

/* ---------------------------------------------------------------- process */

function documentation(variant, locale) {
  const ru = locale === 'ru';
  const asis = variant === 'as-is';
  const note = dataNote(locale);
  const common = ru
    ? `Покупатель — промышленный заказчик серийных двигателей WEG. Один случай — одна покупка от первой потребности до решения о следующем заказе. Схема собрана из того, что уже смоделировано в библиотеке: этапы от заказа до денег взяты из процесса «1. Обработка заказа на серийный двигатель», сервис после поставки показан одним вызовом процесса «6. Сервис и ремонт оборудования»: его трудозатраты, ожидание и стоимость берутся из расчёта той схемы. Параметры и доли шагов процесса 1 не переписаны, а копируются при сборке: изменится процесс 1 или 6 — изменится и эта схема.

Чего в схеме нет в других процессах и что здесь допущение (помечено «отраслевое допущение»): шаги самого заказчика (подбор, запрос, приёмка, монтаж, решение о повторном заказе), вероятность того, что заказчик согласится с предложением (${WIN_SHARE} %, одинаковая в обеих версиях, чтобы рынок не двигал сравнение), и вероятность того, что поставленному двигателю потребуется сервис (${SERVICE_SHARE} %: 145 000 сервисных обращений на 760 000 заказов в год — расчёт из объёмов двух процессов).

Время заказчика записано как ожидание, а не как труд компании. Эксплуатация двигателя длится годами и в срок пути не входит: путь закрывается решением о повторном заказе. Деньги получены — отдельная ветка, она идёт параллельно поставке и считается завершением заказа.`
    : `The buyer is an industrial customer of WEG standard motors. One case is one purchase from the first need to the decision about the next order. The diagram is assembled from what the library already models: the stages from order to cash are taken from "1. Order to cash for catalogue motors", after-sale service is shown as one call to "6. After-sales service and repair", whose work, waiting and cost are read from the calculation of that diagram. The parameters and branch shares of process 1 are not retyped but copied at build time: change process 1 or 6 and this diagram changes with it.

What this diagram adds and what is an assumption here (tagged "industry assumption"): the customer's own steps (selection, enquiry, receiving, installation, the reorder decision), the chance that the customer accepts the quotation (${WIN_SHARE}%, the same in both versions so the market does not move the comparison) and the chance that a delivered motor needs service (${SERVICE_SHARE}%: 145,000 service cases against 760,000 orders a year, derived from the volumes of the two processes).

Customer time is recorded as waiting, not as company labour. A motor runs for years and that is not part of the journey's lead time: the journey closes with the decision about the next order. "Cash received" is a separate branch that runs in parallel with delivery and counts as the completion of the order.`;
  const stages = asis
    ? ru
      ? `Этапы.
1) Потребность и подбор — заказчик сам листает каталог и листы данных. 2) Запрос и предложение — письмо менеджеру или дистрибьютору, предложение собирается вручную, заказчик ждёт часы. 3) Заказ и проверка кредита — заказ письмом или таблицей, ручная регистрация и проверка артикулов, ручная проверка лимита, предоплата для части заказов. 4) Ожидание и отгрузка — резерв, ожидание производственной партии для заказов не со склада, комплектация, NF-e, передача перевозчику. 5) Получение и монтаж — заказчик принимает груз и запускает двигатель. 6) Оплата — счёт, 30 дней, напоминания и взыскание для части заказов. 7—8) Эксплуатация, сервис и ремонт — вызов процесса 6 (звонок, диагностика, гарантия, вывоз, смета, ремонт, возврат), его цифры взяты из расчёта той схемы. 9) Повторный заказ — заказчик решает, остаться ли.`
      : `Stages.
1) Need and selection: the customer browses the catalogue and data sheets alone. 2) Enquiry and quotation: a letter to a salesperson or distributor, the quotation is built by hand, the customer waits for hours. 3) Order and credit check: the order by letter or spreadsheet, manual registration and part-number checks, a manual limit check, prepayment for some orders. 4) Waiting and shipment: reservation, the wait for a production batch for orders not from stock, picking, NF-e, handover to the carrier. 5) Receipt and installation: the customer receives the load and starts the motor. 6) Payment: the invoice, 30 days, reminders and collections for some orders. 7-8) Operation, service and repair: a call to process 6 (call, diagnosis, warranty, collection, quotation, repair, return) with the figures of that diagram's calculation. 9) Reorder: the customer decides whether to stay.`
    : ru
      ? `Что меняется на пути покупателя.
1) Подбор в портале: наличие и срок видны сразу, ручной запрос и ручное предложение исчезают для каталожных позиций. 2) Заказ из портала или по EDI с автоматической проверкой строк и скорингом вместо ручной регистрации и проверки лимита. 3) Срок отгрузки показывается при заказе, склад планируется по спросу портала, NF-e, уведомление и счёт формируются сами. 4) Заказчик выбирает срок оплаты: 30 дней или 7 дней со скидкой 1,5 %. 5) Груз принимается по уведомлению об отгрузке, у двигателя есть цифровой паспорт, а у заказчика появляется новый шаг: подключить мониторинг. 6) Сервис начинается с события мониторинга в 62 % случаев и закрывается удалённо в 58 % случаев, дальше те же шаги процесса 6 с портальной сметой и запчастями по прогнозу.

Что НЕ меняется: монтаж двигателя заказчиком, доля заказчиков, согласных с предложением, вероятность сервиса, физическая комплектация, перевозка и ремонт.`
      : `What changes on the buyer's path.
1) Selection in the portal: stock and lead time are visible at once, and the manual enquiry and manual quotation disappear for catalogue items. 2) The order comes from the portal or via EDI with automatic line checks and scoring instead of manual registration and a manual limit check. 3) The ship date is shown at ordering, stock is planned from portal demand, and the NF-e, the notice and the invoice generate themselves. 4) The customer chooses the payment term: 30 days or 7 days at a 1.5% discount. 5) The load is received against the despatch notice, the motor has a digital passport, and the customer gets a new step: connecting monitoring. 6) Service starts from a monitoring event in 62% of cases and closes remotely in 58% of cases, then the same steps of process 6 with the quotation in the portal and parts staged by forecast.

What does NOT change: the customer installs the motor, the share of customers who accept the quotation, the chance that service is needed, physical picking, transport and the repair itself.`;
  return `${common}\n\n${stages}\n\n${note}`;
}

function journeyProcess(variant) {
  const asis = variant === 'as-is';
  const built = asis ? buildAsIs() : buildToBe();
  const lanes = mergeLanes(built.o2c.spec.lanes, [SERVICE_LANE]);
  const spec = {
    notation: 'bpmn',
    name: asis
      ? { ru: 'Путь покупателя WEG (BPMN) — как есть', en: 'WEG customer journey (BPMN) — as is' }
      : { ru: 'Путь покупателя WEG (BPMN) — как будет', en: 'WEG customer journey (BPMN) — to be' },
    lanes,
    nodes: built.nodes,
    edges: built.edges,
  };
  return {
    id: asis ? 'weg-journey-bpmn' : 'weg-journey-bpmn-tobe',
    order: 1,
    variant,
    baselineId: asis ? undefined : 'weg-journey-bpmn',
    name: spec.name,
    description: asis
      ? {
          ru: 'Путь покупателя серийного двигателя сегодня, от потребности до решения о повторном заказе: подбор, запрос, заказ и проверка кредита, ожидание, отгрузка, получение, оплата и сервис.',
          en: 'The standard-motor buyer\'s journey today, from the need to the reorder decision: selection, enquiry, order and credit check, waiting, shipment, receipt, payment and service.',
        }
      : {
          ru: 'Путь покупателя после изменений: подбор и цена в портале, заказ без ручных проверок, дата отгрузки при заказе, выбор срока оплаты, цифровой паспорт, мониторинг и удалённый сервис.',
          en: 'The buyer\'s journey after the changes: selection and price in the portal, an order without manual checks, a ship date at ordering, a choice of payment term, a digital passport, monitoring and remote service.',
        },
    analysis: {
      ...clone(built.o2c.analysis),
      roles: mergeRoles(clone(built.o2c.analysis.roles || [])),
    },
    documentation: { ru: documentation(variant, 'ru'), en: documentation(variant, 'en') },
    spec,
  };
}

export const WEG_JOURNEY_AS_IS = [journeyProcess('as-is')];
export const WEG_JOURNEY_TO_BE = [journeyProcess('to-be')];
export const WEG_JOURNEY_PROCESSES = [...WEG_JOURNEY_AS_IS, ...WEG_JOURNEY_TO_BE];

const BUILD = {
  library: WEG_JOURNEY_LIBRARY,
  author: 'WEG S.A. — public disclosure; FiberModeler',
  roleName: roleLabel,
};

/** The two BPMN journeys as diagrams, with the computed comparison on the target one. */
export function buildWegJourneyDiagrams(locale = 'ru') {
  return buildLibraryDiagrams(WEG_JOURNEY_PROCESSES, locale, BUILD, (process) => journeyFolder(process.variant, locale));
}
