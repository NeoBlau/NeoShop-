/**
 * Ready-made BPMN processes.
 *
 * A template is an abstract specification (nodes + edges, no coordinates);
 * the auto layout gives it geometry when it is inserted, so templates always
 * look right regardless of notation settings.
 */

const flow = (...pairs) => pairs.map(([source, target, label, condition]) => ({ source, target, label, condition }));

export const BPMN_TEMPLATES = [
  {
    id: 'order',
    keywords: ['заказ', 'order', 'интернет-магазин', 'shop', 'ecommerce', 'покупк', 'доставк'],
    name: { en: 'Order processing', ru: 'Обработка заказа' },
    description: { en: 'Online shop order from checkout to shipment', ru: 'Заказ интернет-магазина от оформления до отгрузки' },
    spec: {
      notation: 'bpmn',
      name: { en: 'Order processing', ru: 'Обработка заказа' },
      lanes: [
        { id: 'customer', label: { en: 'Customer', ru: 'Клиент' } },
        { id: 'sales', label: { en: 'Sales', ru: 'Менеджер' } },
        { id: 'warehouse', label: { en: 'Warehouse', ru: 'Склад' } },
      ],
      nodes: [
        { id: 'start', type: 'startMessageEvent', lane: 'customer', label: { en: 'Order received', ru: 'Заказ получен' } },
        { id: 'check', type: 'userTask', lane: 'sales', label: { en: 'Check the order', ru: 'Проверить заказ' } },
        { id: 'payment', type: 'serviceTask', lane: 'sales', label: { en: 'Verify payment', ru: 'Проверить оплату' } },
        { id: 'gw', type: 'exclusiveGateway', lane: 'sales', label: { en: 'Paid?', ru: 'Оплачено?' } },
        { id: 'notify', type: 'sendTask', lane: 'sales', label: { en: 'Notify the customer', ru: 'Уведомить клиента' } },
        { id: 'cancel', type: 'endErrorEvent', lane: 'sales', label: { en: 'Order cancelled', ru: 'Заказ отменён' } },
        { id: 'pick', type: 'manualTask', lane: 'warehouse', label: { en: 'Pick and pack', ru: 'Собрать и упаковать' } },
        { id: 'ship', type: 'userTask', lane: 'warehouse', label: { en: 'Ship the order', ru: 'Отгрузить заказ' } },
        { id: 'done', type: 'endEvent', lane: 'warehouse', label: { en: 'Order shipped', ru: 'Заказ отгружен' } },
        { id: 'doc', type: 'dataObject', lane: 'sales', label: { en: 'Invoice', ru: 'Счёт' } },
      ],
      edges: [
        ...flow(
          ['start', 'check'],
          ['check', 'payment'],
          ['payment', 'gw'],
          ['gw', 'pick', { en: 'yes', ru: 'да' }, 'paid = true'],
          ['gw', 'notify', { en: 'no', ru: 'нет' }, 'paid = false'],
          ['notify', 'cancel'],
          ['pick', 'ship'],
          ['ship', 'done']
        ),
        { source: 'payment', target: 'doc', type: 'dataAssociation' },
      ],
    },
  },
  {
    id: 'invoice',
    keywords: ['счет', 'счёт', 'invoice', 'оплат', 'платеж', 'бухгалт'],
    name: { en: 'Invoice approval', ru: 'Обработка счёта' },
    description: { en: 'Incoming invoice check, approval and payment', ru: 'Проверка, согласование и оплата входящего счёта' },
    spec: {
      notation: 'bpmn',
      name: { en: 'Invoice approval', ru: 'Обработка счёта' },
      lanes: [
        { id: 'ap', label: { en: 'Accounting', ru: 'Бухгалтерия' } },
        { id: 'mgr', label: { en: 'Manager', ru: 'Руководитель' } },
      ],
      nodes: [
        { id: 'start', type: 'startMessageEvent', lane: 'ap', label: { en: 'Invoice received', ru: 'Счёт получен' } },
        { id: 'register', type: 'userTask', lane: 'ap', label: { en: 'Register invoice', ru: 'Зарегистрировать счёт' } },
        { id: 'check', type: 'businessRuleTask', lane: 'ap', label: { en: 'Check against contract', ru: 'Сверить с договором' } },
        { id: 'gw', type: 'exclusiveGateway', lane: 'ap', label: { en: 'Amount > limit?', ru: 'Сумма > лимита?' } },
        { id: 'approve', type: 'userTask', lane: 'mgr', label: { en: 'Approve invoice', ru: 'Согласовать счёт' } },
        { id: 'gw2', type: 'exclusiveGateway', lane: 'mgr', label: { en: 'Approved?', ru: 'Согласовано?' } },
        { id: 'pay', type: 'serviceTask', lane: 'ap', label: { en: 'Pay invoice', ru: 'Оплатить счёт' } },
        { id: 'reject', type: 'endErrorEvent', lane: 'mgr', label: { en: 'Rejected', ru: 'Отклонён' } },
        { id: 'end', type: 'endEvent', lane: 'ap', label: { en: 'Invoice paid', ru: 'Счёт оплачен' } },
      ],
      edges: flow(
        ['start', 'register'],
        ['register', 'check'],
        ['check', 'gw'],
        ['gw', 'approve', { en: 'yes', ru: 'да' }],
        ['gw', 'pay', { en: 'no', ru: 'нет' }],
        ['approve', 'gw2'],
        ['gw2', 'pay', { en: 'approved', ru: 'согласован' }],
        ['gw2', 'reject', { en: 'rejected', ru: 'отклонён' }],
        ['pay', 'end']
      ),
    },
  },
  {
    id: 'procurement',
    keywords: ['закуп', 'снабжен', 'procure', 'purchase', 'поставщик', 'тендер'],
    name: { en: 'Procurement', ru: 'Закупка' },
    description: { en: 'Purchase request, supplier choice, delivery', ru: 'Заявка, выбор поставщика, поставка' },
    spec: {
      notation: 'bpmn',
      name: { en: 'Procurement', ru: 'Закупка' },
      nodes: [
        { id: 'start', type: 'startEvent', label: { en: 'Need identified', ru: 'Возникла потребность' } },
        { id: 'request', type: 'userTask', label: { en: 'Create purchase request', ru: 'Оформить заявку' } },
        { id: 'approve', type: 'userTask', label: { en: 'Approve request', ru: 'Согласовать заявку' } },
        { id: 'gw', type: 'exclusiveGateway', label: { en: 'Approved?', ru: 'Согласовано?' } },
        { id: 'suppliers', type: 'userTask', label: { en: 'Collect supplier quotes', ru: 'Собрать предложения' } },
        { id: 'choose', type: 'businessRuleTask', label: { en: 'Choose supplier', ru: 'Выбрать поставщика' } },
        { id: 'order', type: 'sendTask', label: { en: 'Send purchase order', ru: 'Отправить заказ поставщику' } },
        { id: 'receive', type: 'receiveTask', label: { en: 'Receive goods', ru: 'Принять товар' } },
        { id: 'check', type: 'manualTask', label: { en: 'Quality check', ru: 'Проверить качество' } },
        { id: 'end', type: 'endEvent', label: { en: 'Goods in stock', ru: 'Товар на складе' } },
        { id: 'stop', type: 'endEvent', label: { en: 'Request declined', ru: 'Заявка отклонена' } },
      ],
      edges: flow(
        ['start', 'request'],
        ['request', 'approve'],
        ['approve', 'gw'],
        ['gw', 'suppliers', { en: 'yes', ru: 'да' }],
        ['gw', 'stop', { en: 'no', ru: 'нет' }],
        ['suppliers', 'choose'],
        ['choose', 'order'],
        ['order', 'receive'],
        ['receive', 'check'],
        ['check', 'end']
      ),
    },
  },
  {
    id: 'hiring',
    keywords: ['найм', 'hiring', 'подбор', 'вакан', 'кандидат', 'recruit', 'hr'],
    name: { en: 'Hiring', ru: 'Найм сотрудника' },
    description: { en: 'From vacancy to first working day', ru: 'От вакансии до первого рабочего дня' },
    spec: {
      notation: 'bpmn',
      name: { en: 'Hiring', ru: 'Найм сотрудника' },
      lanes: [
        { id: 'hr', label: { en: 'HR', ru: 'HR' } },
        { id: 'lead', label: { en: 'Hiring manager', ru: 'Руководитель' } },
      ],
      nodes: [
        { id: 'start', type: 'startEvent', lane: 'lead', label: { en: 'Vacancy opened', ru: 'Открыта вакансия' } },
        { id: 'publish', type: 'userTask', lane: 'hr', label: { en: 'Publish the vacancy', ru: 'Опубликовать вакансию' } },
        { id: 'screen', type: 'userTask', lane: 'hr', label: { en: 'Screen CVs', ru: 'Отобрать резюме' } },
        { id: 'interview', type: 'userTask', lane: 'lead', label: { en: 'Interview', ru: 'Провести собеседование' } },
        { id: 'gw', type: 'exclusiveGateway', lane: 'lead', label: { en: 'Offer?', ru: 'Делаем оффер?' } },
        { id: 'offer', type: 'sendTask', lane: 'hr', label: { en: 'Send offer', ru: 'Отправить оффер' } },
        { id: 'reject', type: 'sendTask', lane: 'hr', label: { en: 'Send rejection', ru: 'Отправить отказ' } },
        { id: 'onboard', type: 'userTask', lane: 'hr', label: { en: 'Onboarding', ru: 'Оформить сотрудника' } },
        { id: 'end', type: 'endEvent', lane: 'hr', label: { en: 'Employee hired', ru: 'Сотрудник принят' } },
        { id: 'end2', type: 'endEvent', lane: 'hr', label: { en: 'Candidate rejected', ru: 'Кандидат отклонён' } },
      ],
      edges: flow(
        ['start', 'publish'],
        ['publish', 'screen'],
        ['screen', 'interview'],
        ['interview', 'gw'],
        ['gw', 'offer', { en: 'yes', ru: 'да' }],
        ['gw', 'reject', { en: 'no', ru: 'нет' }],
        ['offer', 'onboard'],
        ['onboard', 'end'],
        ['reject', 'end2']
      ),
    },
  },
  {
    id: 'support',
    keywords: ['поддержк', 'support', 'обращен', 'тикет', 'ticket', 'инцидент', 'клиентск'],
    name: { en: 'Customer support', ru: 'Служба поддержки' },
    description: { en: 'Ticket triage, resolution and feedback', ru: 'Приём обращения, решение и обратная связь' },
    spec: {
      notation: 'bpmn',
      name: { en: 'Customer support', ru: 'Служба поддержки' },
      nodes: [
        { id: 'start', type: 'startMessageEvent', label: { en: 'Ticket received', ru: 'Поступило обращение' } },
        { id: 'classify', type: 'userTask', label: { en: 'Classify the ticket', ru: 'Классифицировать обращение' } },
        { id: 'gw', type: 'exclusiveGateway', label: { en: 'First line can solve?', ru: 'Решает первая линия?' } },
        { id: 'solve', type: 'userTask', label: { en: 'Resolve on first line', ru: 'Решить на первой линии' } },
        { id: 'escalate', type: 'userTask', label: { en: 'Escalate to engineers', ru: 'Эскалировать инженерам' } },
        { id: 'fix', type: 'userTask', label: { en: 'Fix the problem', ru: 'Устранить проблему' } },
        { id: 'inform', type: 'sendTask', label: { en: 'Inform the customer', ru: 'Сообщить клиенту' } },
        { id: 'survey', type: 'userTask', label: { en: 'Ask for feedback', ru: 'Запросить оценку' } },
        { id: 'end', type: 'endEvent', label: { en: 'Ticket closed', ru: 'Обращение закрыто' } },
      ],
      edges: flow(
        ['start', 'classify'],
        ['classify', 'gw'],
        ['gw', 'solve', { en: 'yes', ru: 'да' }],
        ['gw', 'escalate', { en: 'no', ru: 'нет' }],
        ['escalate', 'fix'],
        ['solve', 'inform'],
        ['fix', 'inform'],
        ['inform', 'survey'],
        ['survey', 'end']
      ),
    },
  },
  {
    id: 'logistics',
    keywords: ['логист', 'перевоз', 'доставк', 'logistic', 'shipping', 'транспорт'],
    name: { en: 'Logistics', ru: 'Логистика' },
    description: { en: 'Shipment planning, transport and delivery', ru: 'Планирование, перевозка и вручение груза' },
    spec: {
      notation: 'bpmn',
      name: { en: 'Logistics', ru: 'Логистика' },
      nodes: [
        { id: 'start', type: 'startEvent', label: { en: 'Shipment requested', ru: 'Заявка на перевозку' } },
        { id: 'plan', type: 'userTask', label: { en: 'Plan the route', ru: 'Спланировать маршрут' } },
        { id: 'carrier', type: 'businessRuleTask', label: { en: 'Select carrier', ru: 'Выбрать перевозчика' } },
        { id: 'load', type: 'manualTask', label: { en: 'Load the goods', ru: 'Загрузить груз' } },
        { id: 'transport', type: 'serviceTask', label: { en: 'Transport', ru: 'Перевезти груз' } },
        { id: 'gw', type: 'exclusiveGateway', label: { en: 'Delivered on time?', ru: 'Доставлено вовремя?' } },
        { id: 'claim', type: 'userTask', label: { en: 'Handle the claim', ru: 'Обработать претензию' } },
        { id: 'docs', type: 'userTask', label: { en: 'Close the documents', ru: 'Закрыть документы' } },
        { id: 'end', type: 'endEvent', label: { en: 'Delivery completed', ru: 'Доставка завершена' } },
      ],
      edges: flow(
        ['start', 'plan'],
        ['plan', 'carrier'],
        ['carrier', 'load'],
        ['load', 'transport'],
        ['transport', 'gw'],
        ['gw', 'docs', { en: 'yes', ru: 'да' }],
        ['gw', 'claim', { en: 'no', ru: 'нет' }],
        ['claim', 'docs'],
        ['docs', 'end']
      ),
    },
  },
  {
    id: 'production',
    keywords: ['производ', 'изготов', 'production', 'manufact', 'цех', 'сборк'],
    name: { en: 'Production', ru: 'Производство' },
    description: { en: 'Production order to finished goods', ru: 'От производственного заказа до готовой продукции' },
    spec: {
      notation: 'bpmn',
      name: { en: 'Production', ru: 'Производство' },
      nodes: [
        { id: 'start', type: 'startEvent', label: { en: 'Production order', ru: 'Производственный заказ' } },
        { id: 'plan', type: 'userTask', label: { en: 'Plan production', ru: 'Спланировать производство' } },
        { id: 'material', type: 'manualTask', label: { en: 'Prepare materials', ru: 'Подготовить материалы' } },
        { id: 'parallel', type: 'parallelGateway', label: { en: 'Start operations', ru: 'Запустить операции' } },
        { id: 'machine', type: 'serviceTask', label: { en: 'Machining', ru: 'Механическая обработка' } },
        { id: 'assembly', type: 'manualTask', label: { en: 'Assembly', ru: 'Сборка' } },
        { id: 'join', type: 'parallelGateway', label: { en: 'Operations done', ru: 'Операции завершены' } },
        { id: 'qc', type: 'userTask', label: { en: 'Quality control', ru: 'Контроль качества' } },
        { id: 'end', type: 'endEvent', label: { en: 'Goods produced', ru: 'Продукция готова' } },
      ],
      edges: flow(
        ['start', 'plan'],
        ['plan', 'material'],
        ['material', 'parallel'],
        ['parallel', 'machine'],
        ['parallel', 'assembly'],
        ['machine', 'join'],
        ['assembly', 'join'],
        ['join', 'qc'],
        ['qc', 'end']
      ),
    },
  },
  {
    id: 'banking',
    keywords: ['банк', 'кредит', 'займ', 'bank', 'loan', 'заявка на кредит'],
    name: { en: 'Loan application', ru: 'Кредитная заявка' },
    description: { en: 'Scoring, decision and disbursement', ru: 'Скоринг, решение и выдача' },
    spec: {
      notation: 'bpmn',
      name: { en: 'Loan application', ru: 'Кредитная заявка' },
      nodes: [
        { id: 'start', type: 'startMessageEvent', label: { en: 'Application received', ru: 'Заявка получена' } },
        { id: 'verify', type: 'userTask', label: { en: 'Verify documents', ru: 'Проверить документы' } },
        { id: 'scoring', type: 'serviceTask', label: { en: 'Run scoring', ru: 'Провести скоринг' } },
        { id: 'gw', type: 'exclusiveGateway', label: { en: 'Score enough?', ru: 'Скоринг пройден?' } },
        { id: 'manual', type: 'userTask', label: { en: 'Manual underwriting', ru: 'Ручной андеррайтинг' } },
        { id: 'gw2', type: 'exclusiveGateway', label: { en: 'Approved?', ru: 'Одобрено?' } },
        { id: 'contract', type: 'userTask', label: { en: 'Sign the contract', ru: 'Подписать договор' } },
        { id: 'pay', type: 'serviceTask', label: { en: 'Disburse the loan', ru: 'Выдать кредит' } },
        { id: 'refuse', type: 'sendTask', label: { en: 'Send refusal', ru: 'Отправить отказ' } },
        { id: 'end', type: 'endEvent', label: { en: 'Loan issued', ru: 'Кредит выдан' } },
        { id: 'end2', type: 'endEvent', label: { en: 'Application closed', ru: 'Заявка закрыта' } },
      ],
      edges: flow(
        ['start', 'verify'],
        ['verify', 'scoring'],
        ['scoring', 'gw'],
        ['gw', 'contract', { en: 'high score', ru: 'высокий балл' }],
        ['gw', 'manual', { en: 'borderline', ru: 'спорная' }],
        ['manual', 'gw2'],
        ['gw2', 'contract', { en: 'yes', ru: 'да' }],
        ['gw2', 'refuse', { en: 'no', ru: 'нет' }],
        ['contract', 'pay'],
        ['pay', 'end'],
        ['refuse', 'end2']
      ),
    },
  },
  {
    id: 'sales',
    keywords: ['продаж', 'sales', 'сделк', 'лид', 'crm', 'воронк'],
    name: { en: 'Sales pipeline', ru: 'Продажа' },
    description: { en: 'Lead qualification to signed deal', ru: 'От лида до подписанной сделки' },
    spec: {
      notation: 'bpmn',
      name: { en: 'Sales pipeline', ru: 'Продажа' },
      nodes: [
        { id: 'start', type: 'startEvent', label: { en: 'Lead created', ru: 'Появился лид' } },
        { id: 'qualify', type: 'userTask', label: { en: 'Qualify the lead', ru: 'Квалифицировать лид' } },
        { id: 'gw', type: 'exclusiveGateway', label: { en: 'Qualified?', ru: 'Квалифицирован?' } },
        { id: 'demo', type: 'userTask', label: { en: 'Present the offer', ru: 'Провести презентацию' } },
        { id: 'quote', type: 'userTask', label: { en: 'Prepare the quote', ru: 'Подготовить коммерческое предложение' } },
        { id: 'negotiate', type: 'userTask', label: { en: 'Negotiate', ru: 'Согласовать условия' } },
        { id: 'contract', type: 'userTask', label: { en: 'Sign the contract', ru: 'Подписать договор' } },
        { id: 'lost', type: 'endEvent', label: { en: 'Deal lost', ru: 'Сделка потеряна' } },
        { id: 'end', type: 'endEvent', label: { en: 'Deal won', ru: 'Сделка закрыта' } },
      ],
      edges: flow(
        ['start', 'qualify'],
        ['qualify', 'gw'],
        ['gw', 'demo', { en: 'yes', ru: 'да' }],
        ['gw', 'lost', { en: 'no', ru: 'нет' }],
        ['demo', 'quote'],
        ['quote', 'negotiate'],
        ['negotiate', 'contract'],
        ['contract', 'end']
      ),
    },
  },
];

export function findBpmnTemplate(text) {
  const lower = String(text || '').toLowerCase();
  let best = null;
  let bestScore = 0;
  for (const template of BPMN_TEMPLATES) {
    let score = 0;
    for (const keyword of template.keywords) if (lower.includes(keyword)) score += keyword.length;
    if (score > bestScore) {
      bestScore = score;
      best = template;
    }
  }
  return bestScore > 0 ? best : null;
}
