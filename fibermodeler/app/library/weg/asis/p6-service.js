/**
 * 6. After-sales service and repair through the authorised network (ASTEC).
 */
import { WEG, dataNote, roles, sourceBlock } from '../facts.js';
import { DAY, flow, node, reported, wait, work } from '../kit.js';

const LANES = [
  { id: 'customer', label: { ru: 'Клиент', en: 'Customer' } },
  { id: 'support', label: { ru: 'Техническая поддержка', en: 'Technical support' } },
  { id: 'astec', label: { ru: 'Авторизованный сервис (ASTEC)', en: 'Authorised service (ASTEC)' } },
  { id: 'plant', label: { ru: 'Завод-изготовитель', en: 'Manufacturing plant' } },
  { id: 'log', label: { ru: 'Логистика и запчасти', en: 'Logistics & spare parts' } },
];

export const serviceProcess = {
  id: 'weg-service',
  order: 6,
  variant: 'as-is',
  name: { ru: '6. Сервис и ремонт оборудования', en: '6. After-sales service and repair' },
  description: {
    ru: 'Обращение клиента — удалённая диагностика — определение гарантии — ремонт в авторизованном сервисе или на заводе — испытания — возврат.',
    en: 'Customer request — remote diagnosis — warranty decision — repair in the authorised network or at the plant — testing — return.',
  },
  analysis: {
    currency: 'R$',
    volumePerYear: 145000,
    hoursPerFte: 1800,
    workingDays: WEG.workingDays,
    roles: roles('Техник', 'Сервисный инженер', 'Инженер', 'Логист', 'ОТК'),
  },
  documentation: {
    ru: `Послепродажное обслуживание двигателей, приводов и трансформаторов.

Публичные данные:
• WEG поддерживает сеть авторизованного сервиса ASTEC; только по трансформаторам в Бразилии работают более ${WEG.serviceNetworkBrazilTransformers} аккредитованных партнёров — крупнейшая сеть в стране;
• базы сервиса WEG Automação: Jaraguá do Sul (SC), São Bernardo do Campo (SP), Ribeirão Preto (SP);
• установленный парк растёт: более ${(WEG.motorsPerYear / 1e6).toFixed(0)} млн двигателей выпускается ежегодно, и часть из них возвращается в сервис в течение срока службы.

Расчёт из публичных данных: объём в модели — 145 000 обращений в год (допущение: ≈0,8 % годового выпуска двигателей обращается в сервис).

Доли веток (35 % решается удалённо, 41 % гарантийных случаев, 78 % согласований сметы) — отраслевые допущения, их следует заменить статистикой собственной CRM.

${dataNote('ru')}

${sourceBlock(['astec', 'production', 'numbers'], 'ru')}`,
    en: `After-sales service for motors, drives and transformers.

Public figures: the ASTEC authorised network includes more than ${WEG.serviceNetworkBrazilTransformers} accredited transformer partners in Brazil alone; WEG Automação service bases sit in Jaraguá do Sul, São Bernardo do Campo and Ribeirão Preto.

Volume in the model: 145,000 requests a year (assumption: ≈0.8% of annual motor output returns for service).

${dataNote('en')}

${sourceBlock(['astec', 'production', 'numbers'], 'en')}`,
  },
  spec: {
    notation: 'bpmn',
    name: { ru: 'Сервис и ремонт оборудования', en: 'After-sales service and repair' },
    lanes: LANES,
    nodes: [
      node('start', 'startMessageEvent', 'customer', 'Обращение клиента', 'Customer request', reported({})),
      node('register', 'serviceTask', 'support', 'Зарегистрировать обращение в CRM', 'Log the request in CRM', work(8, 'Техник')),
      node('remote', 'userTask', 'support', 'Удалённая диагностика по данным привода', 'Remote diagnosis from drive data', work(35, 'Техник')),
      node('gwRemote', 'exclusiveGateway', 'support', 'Решено удалённо?', 'Solved remotely?'),
      node('closeRemote', 'serviceTask', 'support', 'Закрыть обращение и выслать инструкцию', 'Close the case with instructions', work(10, 'Техник')),
      node('endRemote', 'endEvent', 'support', 'Решено без выезда', 'Closed remotely', { completes: true }),
      node('warranty', 'businessRuleTask', 'support', 'Определить гарантийный статус', 'Determine the warranty status', work(15, 'Техник')),
      node('gwWarranty', 'exclusiveGateway', 'support', 'Случай гарантийный?', 'Under warranty?'),
      node('assign', 'userTask', 'support', 'Назначить авторизованный сервис по региону', 'Assign the regional service partner', work(12, 'Техник')),
      node('pickup', 'serviceTask', 'log', 'Забрать оборудование у клиента', 'Collect the equipment', work(60, 'Логист', { cost: 420, waitTime: DAY * 2 })),
      node('inspect', 'userTask', 'astec', 'Дефектовка и измерения', 'Tear-down and measurements', work(180, 'Сервисный инженер')),
      node('gwScope', 'exclusiveGateway', 'astec', 'Ремонт на месте или на заводе?', 'Local repair or factory?'),
      node('quote', 'sendTask', 'astec', 'Согласовать смету с клиентом', 'Agree the quotation with the customer', work(40, 'Сервисный инженер', { waitTime: DAY * 3 })),
      node('gwAccept', 'exclusiveGateway', 'astec', 'Смета согласована?', 'Quotation accepted?'),
      node('return', 'serviceTask', 'log', 'Вернуть без ремонта', 'Return without repair', work(45, 'Логист', { cost: 380 })),
      node('endDecline', 'endEvent', 'log', 'Клиент отказался от ремонта', 'Customer declined'),
      node('parts', 'serviceTask', 'log', 'Подобрать и отгрузить запчасти', 'Pick and ship the spare parts', work(50, 'Логист', { cost: 1650, waitTime: DAY * 4 })),
      node('repairLocal', 'manualTask', 'astec', 'Выполнить ремонт в сервисном центре', 'Repair in the service centre', work(600, 'Сервисный инженер', { cost: 2400 })),
      node('repairPlant', 'manualTask', 'plant', 'Капитальный ремонт на заводе', 'Full overhaul at the plant', work(2400, 'Инженер', { resourceQty: 2, cost: 12800, waitTime: DAY * 10 })),
      node('test', 'userTask', 'astec', 'Испытать и снять характеристики', 'Test and record the performance', work(120, 'ОТК')),
      node('gwTest', 'exclusiveGateway', 'astec', 'Испытания пройдены?', 'Tests passed?'),
      node('deliver', 'serviceTask', 'log', 'Доставить и установить у клиента', 'Deliver and install at the customer', work(150, 'Логист', { cost: 520, waitTime: DAY * 2 })),
      node('report', 'serviceTask', 'astec', 'Оформить отчёт и обновить историю оборудования', 'Issue the report, update the asset history', work(30, 'Сервисный инженер')),
      node('feedback', 'sendTask', 'support', 'Запросить оценку качества сервиса', 'Ask for a service rating', work(6, 'Техник')),
      node('end', 'endEvent', 'support', 'Обращение закрыто', 'Case closed', { completes: true }),
      node('history', 'dataStore', 'astec', 'История обслуживания оборудования', 'Equipment service history'),
      node('note', 'textAnnotation', 'astec', 'Сеть ASTEC: 40+ аккредитованных партнёров только по трансформаторам (WEG)', 'ASTEC network: 40+ accredited transformer partners (WEG)'),
    ],
    edges: [
      flow('start', 'register'),
      flow('register', 'remote'),
      flow('remote', 'gwRemote'),
      flow('gwRemote', 'closeRemote', { share: 35, ru: 'да', en: 'yes' }),
      flow('gwRemote', 'warranty', { share: 65, ru: 'нужен ремонт', en: 'repair needed' }),
      flow('closeRemote', 'endRemote'),
      flow('warranty', 'gwWarranty'),
      flow('gwWarranty', 'assign', { share: 41, ru: 'гарантия', en: 'warranty' }),
      flow('gwWarranty', 'assign', { share: 59, ru: 'платный', en: 'chargeable' }),
      flow('assign', 'pickup'),
      flow('pickup', 'inspect'),
      flow('inspect', 'quote'),
      flow('quote', 'gwAccept'),
      flow('gwAccept', 'gwScope', { share: 78, ru: 'согласована', en: 'accepted' }),
      flow('gwAccept', 'return', { share: 22, ru: 'отказ', en: 'declined' }),
      flow('return', 'endDecline'),
      flow('gwScope', 'parts', { share: 81, ru: 'на месте', en: 'local' }),
      flow('gwScope', 'repairPlant', { share: 19, ru: 'на заводе', en: 'factory' }),
      flow('parts', 'repairLocal'),
      flow('repairLocal', 'test'),
      flow('repairPlant', 'test'),
      flow('test', 'gwTest'),
      flow('gwTest', 'deliver', { share: 93, ru: 'годен', en: 'pass' }),
      flow('gwTest', 'repairLocal', { share: 7, ru: 'повторный ремонт', en: 'rework' }),
      flow('deliver', 'report'),
      flow('report', 'feedback'),
      flow('feedback', 'end'),
      { source: 'report', target: 'history', type: 'dataAssociation' },
      { source: 'inspect', target: 'note', type: 'association' },
    ],
  },
};
