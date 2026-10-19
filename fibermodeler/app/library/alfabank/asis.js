/**
 * Alfa-Bank, consumer loan - from the application to disbursement and the first
 * questions afterwards. AS-IS (current state), described from the bank's side.
 *
 * The shape follows the publicly described journey (see `facts.js`); every
 * number inside is an assumption.
 */
import { auto, flow, node, wait, work } from '../kit.js';
import { APPLICATIONS_PER_YEAR, ROLE, conventionsBlock, contextBlock, dataNote, roles } from './facts.js';

export const LANES = [
  { id: 'customer', label: { ru: 'Клиент (приложение, сайт, отделение)', en: 'Customer (app, site, branch)' } },
  { id: 'digital', label: { ru: 'Цифровые каналы и автоматика банка', en: 'Digital channels and bank automation' } },
  { id: 'manager', label: { ru: 'Клиентский менеджер', en: 'Client manager' } },
  { id: 'underwriting', label: { ru: 'Кредитный андеррайтинг', en: 'Credit underwriting' } },
  { id: 'security', label: { ru: 'Служба безопасности', en: 'Security' } },
  { id: 'operations', label: { ru: 'Операционный отдел', en: 'Operations' } },
  { id: 'service', label: { ru: 'Обслуживание клиентов', en: 'Customer service' } },
];

export const alfaAsIs = {
  id: 'alfa-consumer-loan',
  order: 1,
  variant: 'as-is',
  name: {
    ru: 'Кредит наличными в Альфа-Банке: заявка, решение, выдача и обслуживание — как есть',
    en: 'Cash loan at Alfa-Bank: application, decision, disbursement and servicing — as is',
  },
  description: {
    ru: 'От интереса клиента до выданных денег и первых вопросов по кредиту: калькулятор и анкета, проверка личности, бюро кредитных историй, скоринг и антифрод, ручной андеррайтинг и служба безопасности, звонок менеджера, подписание, проверка документов, зачисление и обращения в обслуживание.',
    en: 'From the customer\'s interest to disbursed money and the first questions about the loan: calculator and application form, identity check, the credit bureau, scoring and fraud control, manual underwriting and security, the manager\'s call, signing, document check, crediting and servicing requests.',
  },
  analysis: {
    currency: 'RUB',
    volumePerYear: APPLICATIONS_PER_YEAR,
    hoursPerFte: 1800,
    workingDays: 365,
    roles: roles('manager', 'underwriter', 'security', 'operations', 'contact', 'collections'),
  },
  documentation: {
    ru: `Потребительский кредит наличными в Альфа-Банке — процесс «как есть», описанный со стороны банка.

${dataNote('ru')}

${conventionsBlock('ru')}

Границы процесса. Начало — клиент решил взять кредит и изучает условия. Конец — деньги зачислены, клиент получил график платежей, а возникшие у него вопросы разобраны. Дальнейшее обслуживание кредита (ежемесячные платежи, просрочка по общему правилу) — отдельный процесс; здесь от него остаётся только ветка «клиенту нужна помощь».

Участники (дорожки):
1. Клиент — считает платёж, заполняет анкету, даёт согласия, собирает документы, решает, подписывает, спрашивает.
2. Цифровые каналы и автоматика банка — проверка личности, запрос в бюро кредитных историй, скоринг, антифрод, формирование предложения, уведомления, зачисление.
3. Клиентский менеджер — уточняет данные, запрашивает документы, звонит клиенту с условиями и предлагает страхование.
4. Кредитный андеррайтинг — вручную рассматривает заявки, которые система не решила сама.
5. Служба безопасности — проверяет часть заявок, которые вызывают сомнение.
6. Операционный отдел — проверяет комплект документов, открывает ссудный счёт и зачисляет деньги.
7. Обслуживание клиентов — контакт-центр отвечает на вопросы, специалист по работе с просрочкой помогает клиентам, у которых возникли трудности с платежом.

Описание этапов.
1) Интерес и анкета. Клиент считает платёж на калькуляторе, заполняет анкету (паспорт, доход, работодатель, телефон) и даёт согласие на запрос в бюро кредитных историй.
2) Проверка личности. Автоматика сверяет паспорт и подтверждает клиента смс-кодом. Если данные не сошлись, менеджер связывается с клиентом и просит исправить или прислать фото документов; часть клиентов на этом уходит.
3) Решение системы. Запрос в бюро, скоринг (вероятность невозврата, доступный лимит и ставка) и антифрод-проверка. Система решает сама: одобряет, отказывает или отправляет заявку на ручную проверку.
4) Ручная ветка. Менеджер запрашивает справку о доходах, клиент её собирает и загружает (на этом часть заявок теряется), андеррайтер рассматривает заявку, а часть заявок дополнительно проверяет служба безопасности.
5) Предложение и звонок. Банк формирует индивидуальное предложение; менеджер звонит клиенту, называет сумму, ставку и срок и предлагает страхование. Часть клиентов на этом отказывается.
6) Подписание и оформление. Клиент подписывает договор (смс-код или в отделении); часть клиентов берёт страхование и дополнительные услуги. Операционист проверяет комплект документов; при замечаниях договор исправляют и снова согласуют с клиентом.
7) Выдача. Открывается ссудный счёт, деньги зачисляются, клиент получает уведомление и график платежей.
8) Вопросы после выдачи. Часть клиентов обращается за помощью: график и реквизиты, досрочное погашение, трудности с платежом (реструктуризация).

Слабые места, которые целевая схема могла бы адресовать (это наблюдения по структуре, не данные банка):
• Ручная ветка: четверть заявок уходит на ручное рассмотрение, и клиенту приходится собирать справки, а банку — ждать.
• Звонок менеджера после одобрения: клиент ждёт, пока позвонят, а звонок занимает время менеджера, хотя условия уже сформированы системой.
• Двойная проверка договора: клиент подписал, затем операционист находит замечания, и договор подписывают снова.
• Вопросы после выдачи обрабатываются по каналам (телефон, чат, отделение) без общей истории обращения.

${contextBlock('ru')}`,
    en: `A consumer cash loan at Alfa-Bank - the as-is process, described from the bank's side.

${dataNote('en')}

${conventionsBlock('en')}

Scope. It starts when the customer decides to borrow and studies the terms. It ends when the money is credited, the customer has the payment schedule and the questions that came up are handled. The later servicing of the loan (monthly payments, ordinary arrears) is a separate process; only the "customer needs help" branch remains here.

Actors (lanes): the customer (calculates, fills in the form, gives consents, collects documents, decides, signs, asks); digital channels and bank automation (identity check, credit-bureau request, scoring, fraud control, offer, notifications, crediting); the client manager (clarifies data, requests documents, phones the customer with the terms and offers insurance); credit underwriting (reviews by hand the applications the system did not decide); security (checks the applications that raise doubts); operations (checks the document set, opens the loan account and credits the money); and customer service (the contact centre answers questions, a collections specialist helps customers who struggle to pay).

Stages. 1) Interest and form: the customer calculates the payment, fills in the form (passport, income, employer, phone) and consents to the credit-bureau request. 2) Identity check: automation matches the passport and confirms the customer by SMS code; if the data does not match, a manager contacts the customer to correct it or to ask for photos of the documents, and some customers drop out here. 3) System decision: the bureau request, scoring (probability of default, available limit and rate) and fraud control; the system approves, rejects or sends the application to manual review. 4) Manual branch: a manager requests an income certificate, the customer collects and uploads it (some applications are lost here), an underwriter reviews the application and some are additionally checked by security. 5) Offer and call: the bank builds an individual offer; a manager phones the customer, states the amount, rate and term and offers insurance; some customers refuse here. 6) Signing and processing: the customer signs the contract (SMS code or in a branch); some take insurance and extra services; an operations officer checks the document set and, if there are remarks, the contract is corrected and agreed with the customer again. 7) Disbursement: the loan account is opened, the money credited, and the customer gets a notification and the payment schedule. 8) Questions after disbursement: some customers ask for help - schedule and details, early repayment, difficulty paying (restructuring).

Weak spots a target diagram could address (observations on the structure, not bank data): the manual branch (a quarter of applications go to manual review, the customer has to collect certificates and the bank has to wait); the manager's call after approval (the customer waits to be phoned and the call takes manager time although the system has already built the terms); the double check of the contract (the customer signs, then operations finds remarks and the contract is signed again); and post-disbursement questions handled by channel (phone, chat, branch) without a shared case history.

${contextBlock('en')}`,
  },
  spec: {
    notation: 'bpmn',
    name: { ru: 'Кредит наличными в Альфа-Банке — как есть', en: 'Cash loan at Alfa-Bank — as is' },
    lanes: LANES,
    nodes: [
      /* 1. interest and form */
      node('start', 'startEvent', 'customer', 'Клиент решил взять кредит наличными', 'The customer decides to take a cash loan'),
      node('calc', 'userTask', 'customer', 'Изучить условия и посчитать платёж на калькуляторе', 'Study the terms and calculate the payment on the calculator', wait(12)),
      node('apply', 'userTask', 'customer', 'Заполнить анкету: паспорт, доход, работодатель, телефон', 'Fill in the form: passport, income, employer, phone', wait(9)),
      node('consent', 'userTask', 'customer', 'Дать согласие на обработку данных и запрос в бюро кредитных историй', 'Consent to data processing and the credit-bureau request', wait(1.5)),

      /* 2. identity */
      node('verify', 'serviceTask', 'digital', 'Сверить паспорт и подтвердить клиента смс-кодом', 'Match the passport and confirm the customer by SMS code', auto(0.5, { cost: 6 })),
      node('gwVerify', 'exclusiveGateway', 'digital', 'Личность подтверждена?', 'Identity confirmed?'),
      node('verifyFix', 'userTask', 'manager', 'Связаться с клиентом: исправить данные или получить фото документов', 'Contact the customer: fix the data or get photos of the documents', work(6, ROLE.manager, { waitTime: 90 })),
      node('gwFix', 'exclusiveGateway', 'manager', 'Данные исправлены?', 'Data corrected?'),
      node('endVerify', 'endEvent', 'manager', 'Заявка прекращена: личность не подтверждена', 'Application stopped: identity not confirmed'),

      /* 3. system decision */
      node('bureau', 'serviceTask', 'digital', 'Запросить кредитную историю в бюро', 'Request the credit history from the bureau', auto(0.4, { cost: 28 })),
      node('scoring', 'businessRuleTask', 'digital', 'Скоринг: вероятность невозврата, доступный лимит и ставка', 'Scoring: probability of default, available limit and rate', auto(0.3, { cost: 4 })),
      node('fraud', 'businessRuleTask', 'digital', 'Антифрод-проверка: устройство, связи, признаки подделки', 'Fraud control: device, links, signs of forgery', auto(0.3, { cost: 3 })),
      node('gwDecision', 'exclusiveGateway', 'digital', 'Решение системы?', 'The system\'s decision?'),

      /* 4. manual branch */
      node('docsReq', 'sendTask', 'manager', 'Запросить справку о доходах и документы', 'Request the income certificate and documents', work(8, ROLE.manager)),
      node('docsWait', 'userTask', 'customer', 'Собрать справку (2-НДФЛ или по форме банка) и загрузить', 'Collect the certificate (2-NDFL or on the bank\'s form) and upload it', wait(720)),
      node('gwDocs', 'exclusiveGateway', 'manager', 'Документы получены?', 'Documents received?'),
      node('endDocs', 'endEvent', 'manager', 'Заявка закрыта: клиент не прислал документы', 'Application closed: the customer sent no documents'),
      node('underwrite', 'userTask', 'underwriting', 'Рассмотреть заявку вручную: доход, долговая нагрузка, работодатель', 'Review the application by hand: income, debt load, employer', work(35, ROLE.underwriter)),
      node('gwSec', 'exclusiveGateway', 'underwriting', 'Нужна проверка службы безопасности?', 'Is a security check needed?'),
      node('secReview', 'userTask', 'security', 'Проверить данные клиента и работодателя, связи и признаки мошенничества', 'Check the customer\'s and employer\'s data, links and signs of fraud', work(25, ROLE.security, { waitTime: 240 })),
      node('gwUw', 'exclusiveGateway', 'underwriting', 'Заявка одобрена?', 'Application approved?'),

      /* rejection */
      node('rejectNotify', 'sendTask', 'digital', 'Сообщить об отказе в смс и приложении', 'Tell the customer about the rejection by SMS and in the app', auto(0.2, { cost: 1.5 })),
      node('endReject', 'endEvent', 'digital', 'Заявка отклонена банком', 'Application rejected by the bank'),

      /* 5. offer and call */
      node('gwOfferJoin', 'exclusiveGateway', 'digital', 'Заявка одобрена', 'Application approved'),
      node('offer', 'serviceTask', 'digital', 'Сформировать индивидуальное предложение: сумма, ставка, срок', 'Build the individual offer: amount, rate, term', auto(0.3, { cost: 1 })),
      node('call', 'userTask', 'manager', 'Позвонить клиенту: назвать условия, ответить на вопросы, предложить страхование', 'Phone the customer: state the terms, answer questions, offer insurance', work(7, ROLE.manager, { waitTime: 45 })),
      node('gwAccept', 'exclusiveGateway', 'customer', 'Клиент согласен с условиями?', 'Does the customer accept the terms?'),
      node('endAbandon', 'endEvent', 'customer', 'Клиент отказался от кредита', 'The customer declined the loan'),

      /* 6. signing and processing */
      node('sign', 'userTask', 'customer', 'Подписать кредитный договор: смс-код или в отделении', 'Sign the loan contract: SMS code or in a branch', wait(6)),
      node('gwIns', 'exclusiveGateway', 'customer', 'Берёт страхование и дополнительные услуги?', 'Takes insurance and extra services?'),
      node('insure', 'userTask', 'manager', 'Оформить страхование и подключить услуги', 'Arrange insurance and connect the services', work(6, ROLE.manager)),
      node('gwInsJoin', 'exclusiveGateway', 'manager', 'Договор подписан', 'Contract signed'),
      node('docCheck', 'userTask', 'operations', 'Проверить комплект документов и условия договора', 'Check the document set and the contract terms', work(10, ROLE.operations)),
      node('gwOps', 'exclusiveGateway', 'operations', 'Замечаний нет?', 'No remarks?'),
      node('fixDocs', 'userTask', 'operations', 'Исправить договор и заново согласовать с клиентом', 'Correct the contract and agree it with the customer again', work(12, ROLE.operations, { waitTime: 240 })),

      /* 7. disbursement */
      node('disburse', 'serviceTask', 'operations', 'Открыть ссудный счёт и зачислить деньги клиенту', 'Open the loan account and credit the money to the customer', auto(0.5, { cost: 2.4 })),
      node('notify', 'sendTask', 'digital', 'Уведомить: деньги зачислены, график платежей', 'Notify: money credited, payment schedule', auto(0.2, { cost: 1.2 })),

      /* 8. questions afterwards */
      node('gwQ', 'exclusiveGateway', 'service', 'Клиенту нужна помощь по кредиту?', 'Does the customer need help with the loan?'),
      node('ask', 'userTask', 'customer', 'Позвонить или написать в банк с вопросом', 'Call or write to the bank with a question', wait(8)),
      node('gwQType', 'exclusiveGateway', 'service', 'О чём вопрос?', 'What is the question about?'),
      node('answerInfo', 'userTask', 'service', 'Ответить: график, реквизиты, статус платежа', 'Answer: schedule, details, payment status', work(5, ROLE.contact)),
      node('earlyRepay', 'userTask', 'service', 'Оформить досрочное погашение: рассчитать сумму, принять заявление', 'Arrange early repayment: work out the amount, take the application', work(9, ROLE.contact)),
      node('restructure', 'userTask', 'service', 'Обсудить трудности с платежом и предложить изменение графика', 'Discuss the payment difficulty and offer a changed schedule', work(20, ROLE.collections, { waitTime: 960 })),
      node('gwQJoin', 'exclusiveGateway', 'service', 'Вопрос закрыт', 'Question closed'),
      node('end', 'endEvent', 'service', 'Кредит выдан, клиент обслужен', 'Loan disbursed, customer served', { completes: true }),

      /* data and notes */
      node('appData', 'dataObject', 'digital', 'Заявка, анкета и согласия клиента', 'Application, form and the customer\'s consents'),
      node('bureauData', 'dataStore', 'digital', 'Бюро кредитных историй (внешняя система)', 'Credit bureau (an external system)'),
      node('contractData', 'dataObject', 'operations', 'Кредитный договор и график платежей', 'Loan contract and payment schedule'),
      node('autoNote', 'textAnnotation', 'digital', 'По описаниям на сторонних сайтах решение приходит от двух минут; в модели автоматические шаги занимают 1,5 минуты (допущение)', 'Third-party sites describe a decision from two minutes; in the model the automated steps take 1.5 minutes (an assumption)'),
      node('manualNote', 'textAnnotation', 'underwriting', 'Доля ручной ветки (25 %) — допущение: её нужно заменить данными банка', 'The share of the manual branch (25%) is an assumption: replace it with the bank\'s data'),
    ],
    edges: [
      flow('start', 'calc'),
      flow('calc', 'apply'),
      flow('apply', 'consent'),
      flow('consent', 'verify'),
      flow('verify', 'gwVerify'),
      flow('gwVerify', 'bureau', { share: 94, ru: 'да', en: 'yes' }),
      flow('gwVerify', 'verifyFix', { share: 6, ru: 'нет', en: 'no' }),
      flow('verifyFix', 'gwFix'),
      flow('gwFix', 'verify', { share: 70, ru: 'исправил', en: 'corrected' }),
      flow('gwFix', 'endVerify', { share: 30, ru: 'ушёл', en: 'dropped out' }),
      flow('bureau', 'scoring'),
      flow('scoring', 'fraud'),
      flow('fraud', 'gwDecision'),
      flow('gwDecision', 'gwOfferJoin', { share: 55, ru: 'одобрено системой', en: 'approved by the system' }),
      flow('gwDecision', 'docsReq', { share: 25, ru: 'на ручную проверку', en: 'to manual review' }),
      flow('gwDecision', 'rejectNotify', { share: 20, ru: 'отказ', en: 'rejected' }),
      flow('docsReq', 'docsWait'),
      flow('docsWait', 'gwDocs'),
      flow('gwDocs', 'underwrite', { share: 82, ru: 'получены', en: 'received' }),
      flow('gwDocs', 'endDocs', { share: 18, ru: 'не прислал', en: 'not sent' }),
      flow('underwrite', 'gwSec'),
      flow('gwSec', 'secReview', { share: 20, ru: 'да', en: 'yes' }),
      flow('gwSec', 'gwUw', { share: 80, ru: 'нет', en: 'no' }),
      flow('secReview', 'gwUw'),
      flow('gwUw', 'gwOfferJoin', { share: 70, ru: 'одобрена', en: 'approved' }),
      flow('gwUw', 'rejectNotify', { share: 30, ru: 'отказ', en: 'rejected' }),
      flow('rejectNotify', 'endReject'),
      flow('gwOfferJoin', 'offer'),
      flow('offer', 'call'),
      flow('call', 'gwAccept'),
      flow('gwAccept', 'sign', { share: 78, ru: 'согласен', en: 'accepts' }),
      flow('gwAccept', 'endAbandon', { share: 22, ru: 'отказался', en: 'declines' }),
      flow('sign', 'gwIns'),
      flow('gwIns', 'insure', { share: 30, ru: 'да', en: 'yes' }),
      flow('gwIns', 'gwInsJoin', { share: 70, ru: 'нет', en: 'no' }),
      flow('insure', 'gwInsJoin'),
      flow('gwInsJoin', 'docCheck'),
      flow('docCheck', 'gwOps'),
      flow('gwOps', 'disburse', { share: 92, ru: 'да', en: 'yes' }),
      flow('gwOps', 'fixDocs', { share: 8, ru: 'есть замечания', en: 'remarks' }),
      flow('fixDocs', 'docCheck'),
      flow('disburse', 'notify'),
      flow('notify', 'gwQ'),
      flow('gwQ', 'ask', { share: 28, ru: 'да', en: 'yes' }),
      flow('gwQ', 'gwQJoin', { share: 72, ru: 'нет', en: 'no' }),
      flow('ask', 'gwQType'),
      flow('gwQType', 'answerInfo', { share: 60, ru: 'график и реквизиты', en: 'schedule and details' }),
      flow('gwQType', 'earlyRepay', { share: 25, ru: 'досрочное погашение', en: 'early repayment' }),
      flow('gwQType', 'restructure', { share: 15, ru: 'трудности с платежом', en: 'payment difficulty' }),
      flow('answerInfo', 'gwQJoin'),
      flow('earlyRepay', 'gwQJoin'),
      flow('restructure', 'gwQJoin'),
      flow('gwQJoin', 'end'),
      { source: 'apply', target: 'appData', type: 'dataAssociation' },
      { source: 'bureau', target: 'bureauData', type: 'dataAssociation' },
      { source: 'docCheck', target: 'contractData', type: 'dataAssociation' },
      { source: 'scoring', target: 'autoNote', type: 'association' },
      { source: 'gwDecision', target: 'manualNote', type: 'association' },
    ],
  },
};
