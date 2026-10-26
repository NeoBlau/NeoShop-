/**
 * Case library: "diagnosis and redesign of a business process" (a trading
 * company taking customer orders).
 *
 * Seven items in one folder: the source model with its mistakes, the corrected
 * AS-IS model and the TO-BE model as BPMN, and four worksheets - the diagnosis
 * table, the reasoning for the TO-BE changes, the walk through three scenarios
 * and a short report. None of it carries numeric effects: the task says not to
 * calculate them without source data.
 */
import { buildSheetDiagrams, pick } from '../../notations/sheet/build.js';
import { validateBpmn } from '../../notations/bpmn/validate.js';
import { buildLibraryDiagram } from '../shared.js';
import { AS_IS_SPEC, SOURCE_SPEC, TO_BE_SPEC } from './models.js';
import { DIAGNOSIS, changesSpec, diagnosisSpec, reportSpec, scenariosSpec } from './sheets.js';

export const TRADECASE_LIBRARY = 'tradecase';
export const TRADECASE_FOLDER = { ru: 'Кейс: торговая компания', en: 'Case: trading company' };

const t = (ru, en) => ({ ru, en });

const NAMES = {
  source: t('1. Исходная модель с ошибками (рисунок 1)', '1. The source model with errors (figure 1)'),
  asis: t('2. Исправленная модель AS-IS', '2. The corrected AS-IS model'),
  tobe: t('3. Модель TO-BE', '3. The TO-BE model'),
};

/** What the program's own check says about a diagram, as lines of text. */
function checkLines(diagram, locale) {
  return validateBpmn(diagram).map((problem) => {
    const text = (problem.message[locale] || problem.message.en).replace(/\{(\w+)\}/g, (match, key) => problem.params[key] ?? match);
    return `• ${text}`;
  });
}

function sourceDocumentation(diagram, locale) {
  const lines = checkLines(diagram, locale).join('\n');
  return locale === 'ru'
    ? `Модель с рисунка 1 задания «Диагностика и перепроектирование бизнес-процесса», воспроизведённая в программе вместе со всеми её ошибками. Она намеренно неверна и не является эталоном BPMN: при противоречии между схемой и условиями кейса верны условия.

Условия кейса: клиент, менеджер, склад и бухгалтерия; товар отгружается только после полной предоплаты; при отсутствии товара менеджер уведомляет клиента, после чего заказ отменяется (закупка не рассматривается); срок оплаты 3 рабочих дня с момента выставления счёта, при неоплате заказ отменяется; заказ закрывается после отгрузки; доставка и возвраты не рассматриваются.

Что находит проверка программы (вкладка проблем, кнопка проверки):
${lines}

Эти замечания охватывают нотацию. Остальные ошибки (ветка «Нет» ведёт к отгрузке, нет срока оплаты, закрытие раньше отгрузки, один конец на три исхода, неполное взаимодействие с клиентом) программа найти не может: их видно только при сопоставлении с условиями. Все одиннадцать замечаний разобраны в таблице 1 («Таблица 1. Диагностика исходной модели»).`
    : `The model of figure 1 of the task "Diagnosis and redesign of a business process", reproduced in the program with all its mistakes. It is wrong on purpose and is not a BPMN reference: where the diagram and the case conditions disagree, the conditions are right.

The case conditions: a customer, a manager, a warehouse and accounting; goods ship only after full prepayment; if the goods are missing the manager notifies the customer and the order is then cancelled (purchasing is out of scope); the payment term is 3 working days from the invoice and an order not paid is cancelled; an order is closed after shipping; delivery and returns are out of scope.

What the program's check finds (the problems tab, the check button):
${lines}

These remarks cover the notation. The other mistakes (the "No" branch leads to shipping, no payment deadline, closing before shipping, one end for three outcomes, incomplete interaction with the customer) the program cannot find: they show only against the conditions. All eleven remarks are worked through in table 1 ("Table 1. Diagnosis of the source model").`;
}

function asIsDocumentation(locale) {
  return locale === 'ru'
    ? `Исправленная модель AS-IS: действующий процесс по условиям кейса и правилам BPMN 2.0. Обязанности участников и бизнес-правила сохранены, исправлены только ошибки моделирования.

Участники: пул «Торговая компания» с дорожками «Менеджер», «Склад» и «Бухгалтерия» и пул «Клиент». Клиент показан свёрнутым пулом («чёрный ящик»): его поведение в кейсе не разбирается. Между пулами идут только потоки сообщений: заказ, «нет товара», счёт, оплата, «выполнен», «отменён».

Ход процесса. Менеджер регистрирует полученный заказ, склад проверяет наличие. Если товара нет, менеджер уведомляет клиента и отменяет заказ. Если товар есть, бухгалтерия выставляет счёт и процесс ждёт одного из двух событий: оплаты или истечения трёх рабочих дней. При оплате бухгалтерия подтверждает поступление, склад отгружает товар, менеджер сообщает клиенту о выполнении и закрывает заказ. Без оплаты в срок менеджер отменяет заказ и уведомляет клиента.

Три исхода: «Заказ выполнен», «Заказ отменён: товара нет», «Заказ отменён: нет оплаты». Клиент узнаёт о каждом по своему сообщению.

Числовых параметров в модели нет: по условиям задания эффекты без исходных данных не рассчитываются.`
    : `The corrected AS-IS model: the existing process by the case conditions and the BPMN 2.0 rules. The participants' duties and the business rules are kept; only modelling mistakes are fixed.

Participants: the "Trading company" pool with the "Manager", "Warehouse" and "Accounting" lanes and the "Customer" pool. The customer is a collapsed pool (a black box): its behaviour is not analysed in the case. Only message flows run between the pools: the order, "out of stock", the invoice, the payment, "fulfilled", "cancelled".

The flow. The manager registers the received order and the warehouse checks the stock. If the goods are missing the manager notifies the customer and cancels the order. If they are in stock accounting issues the invoice and the process waits for one of two events: the payment or the end of three working days. On payment accounting confirms the receipt, the warehouse ships, the manager tells the customer it is fulfilled and closes the order. If there is no payment in time the manager cancels the order and notifies the customer.

Three outcomes: "Order fulfilled", "Order cancelled: out of stock", "Order cancelled: no payment". The customer learns of each from its own message.

The model carries no numeric parameters: by the task, effects are not calculated without source data.`;
}

function toBeDocumentation(locale) {
  return locale === 'ru'
    ? `Модель TO-BE: четыре изменения организации процесса без увеличения штата. Явное допущение: настройка имеющейся информационной системы (форма заказа, правила остатков и резерв, шаблон счёта, сопоставление платежей, статусные уведомления). Для этого в пул компании добавлена дорожка «Информационная система компании (настроена; допущение)».

1. Электронная форма заказа и автоматическая регистрация: заказ приходит из формы, система регистрирует его.
2. Автоматическая проверка остатков и резерв товара на срок оплаты: оплаченный заказ не остаётся без товара.
3. Автоматический счёт, сопоставление платежа со счётом и таймер срока: у бухгалтерии одна задача, подтверждение сопоставленного платежа.
4. Автоматические статусные уведомления и закрытие заказа по отметке склада об отгрузке; менеджер остаётся для случая отсутствия товара.

Бизнес-правила кейса сохранены: предоплата, отмена при отсутствии товара, срок оплаты 3 рабочих дня, закрытие после отгрузки. Для каждого изменения проблема, отражение в BPMN, результат и показатель описаны в таблице «Обоснование изменений TO-BE». Числовые эффекты не рассчитывались: нет исходных данных.`
    : `The TO-BE model: four changes to how the process is organised with no increase in staff. The explicit assumption: the existing information system is configured (an order form, stock rules and a reserve, an invoice template, payment matching, status notices). For this a lane "The company's information system (configured; an assumption)" is added to the company pool.

1. An electronic order form and automatic registration: the order arrives from the form and the system registers it.
2. An automatic stock check and a reserve for the payment term: a paid order is not left without goods.
3. An automatic invoice, matching of the payment with the invoice and a term timer: accounting has one task, confirming the matched payment.
4. Automatic status notices and closing of the order on the warehouse's shipment mark; the manager stays for the out-of-stock case.

The case's business rules are kept: prepayment, cancellation when the goods are missing, the 3-working-day payment term, closing after shipping. For each change the problem, the BPMN reflection, the result and the indicator are described in the table "TO-BE changes: reasoning". No numeric effects were calculated: there is no source data.`;
}

function bpmn(spec, key, id, variant, locale, documentation) {
  const process = {
    id,
    order: 1,
    variant,
    name: NAMES[key],
    description: {
      source: t('Модель с рисунка 1 задания вместе с её ошибками: поток управления между пулами, поток сообщений внутри пула, исключающее ветвление с параллельным слиянием и другие.', 'The model of figure 1 of the task with its mistakes: a sequence flow between pools, a message flow inside a pool, an exclusive split with a parallel merge and others.'),
      asis: t('Действующий процесс по условиям кейса: два пула (клиент свёрнут), шесть потоков сообщений, ожидание оплаты с таймером в 3 рабочих дня и три исхода.', 'The existing process by the case conditions: two pools (the customer collapsed), six message flows, waiting for payment with a 3-working-day timer and three outcomes.'),
      tobe: t('Четыре изменения без увеличения штата: электронная форма, остатки с резервом, автоматический счёт и сопоставление платежей, статусные уведомления.', 'Four changes with no increase in staff: an electronic form, stock with a reserve, an automatic invoice and payment matching, status notices.'),
    }[key],
    documentation: null,
    spec,
  };
  const diagram = buildLibraryDiagram(process, locale, {
    library: TRADECASE_LIBRARY,
    folder: pick(TRADECASE_FOLDER, locale),
    author: 'FiberModeler — case solution',
    roleName: (name) => name,
  });
  diagram.meta.documentation = documentation(diagram, locale);
  diagram.meta.processId = id;
  return diagram;
}

function sheet(spec, id, locale) {
  const [diagram] = buildSheetDiagrams(spec, { locale });
  diagram.meta.folder = pick(TRADECASE_FOLDER, locale);
  diagram.meta.library = TRADECASE_LIBRARY;
  diagram.meta.processId = id;
  diagram.meta.author = 'FiberModeler — case solution';
  return diagram;
}

export const TRADECASE_COUNT = 7;

/** The three BPMN models, then the four worksheets. */
export function buildTradecaseDiagrams(locale = 'ru') {
  const source = bpmn(SOURCE_SPEC, 'source', 'case-order-source', 'as-is', locale, sourceDocumentation);
  const asis = bpmn(AS_IS_SPEC, 'asis', 'case-order-asis', 'as-is', locale, (diagram, lang) => asIsDocumentation(lang));
  const tobe = bpmn(TO_BE_SPEC, 'tobe', 'case-order-tobe', 'to-be', locale, (diagram, lang) => toBeDocumentation(lang));
  const counts = {
    remarks: DIAGNOSIS.length,
    asis: asis.nodes.filter((n) => !['pool', 'lane', 'textAnnotation'].includes(n.type)).length,
    tobe: tobe.nodes.filter((n) => !['pool', 'lane', 'textAnnotation'].includes(n.type)).length,
  };
  return [
    source,
    asis,
    tobe,
    sheet(diagnosisSpec(), 'case-order-diagnosis', locale),
    sheet(changesSpec(), 'case-order-changes', locale),
    sheet(scenariosSpec(), 'case-order-scenarios', locale),
    sheet(reportSpec(counts), 'case-order-report', locale),
  ];
}

export function tradecaseDocumentation(locale = 'ru') {
  return locale === 'en'
    ? 'Case "diagnosis and redesign of a business process" — a trading company taking customer orders: the source model with its mistakes, the corrected AS-IS model, the TO-BE model, the diagnosis table, the reasoning for the changes, the three scenarios and a short report. No numeric effects are calculated: the task says not to do it without source data.'
    : 'Кейс «Диагностика и перепроектирование бизнес-процесса» — торговая компания принимает заказы: исходная модель с ошибками, исправленная модель AS-IS, модель TO-BE, таблица диагностики, обоснование изменений, три сценария и краткий отчёт. Числовые эффекты не рассчитываются: по заданию без исходных данных этого делать нельзя.';
}
