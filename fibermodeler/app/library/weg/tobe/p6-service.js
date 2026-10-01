/**
 * 6 (TO-BE). Predictive service: condition monitoring triggers the work before
 * the failure, parts are staged from the forecast, most cases close remotely.
 */
import { WEG, dataNote, roles, sourceBlock } from '../facts.js';
import { DAY, auto, flow, node, reported, work } from '../kit.js';

const LANES = [
  { id: 'fleet', label: { ru: 'Мониторинг парка оборудования', en: 'Equipment fleet monitoring' } },
  { id: 'customer', label: { ru: 'Клиент', en: 'Customer' } },
  { id: 'support', label: { ru: 'Техническая поддержка', en: 'Technical support' } },
  { id: 'astec', label: { ru: 'Авторизованный сервис (ASTEC)', en: 'Authorised service (ASTEC)' } },
  { id: 'plant', label: { ru: 'Завод-изготовитель', en: 'Manufacturing plant' } },
  { id: 'log', label: { ru: 'Логистика и запчасти', en: 'Logistics and spare parts' } },
];

export const serviceProcessToBe = {
  id: 'weg-service-tobe',
  order: 6,
  variant: 'to-be',
  baselineId: 'weg-service',
  name: {
    ru: '6. Сервис и ремонт оборудования — как будет',
    en: '6. After-sales service and repair — to be',
  },
  description: {
    ru: 'Мониторинг состояния запускает работу до отказа, диагноз ставится по телеметрии, большинство случаев закрывается удалённо, запчасти подбираются по прогнозу заранее, смета согласуется в портале, ремонт планируется в окно остановки клиента.',
    en: 'Condition monitoring starts the work before the failure, the diagnosis comes from telemetry, most cases close remotely, parts are staged from the forecast, the quotation is approved in the portal, and the repair is planned into the customer’s shutdown window.',
  },
  analysis: {
    currency: 'R$',
    volumePerYear: 145000,
    hoursPerFte: 1800,
    workingDays: WEG.workingDays,
    roles: roles('Техник', 'Сервисный инженер', 'Инженер', 'Логист', 'ОТК'),
  },
  documentation: {
    ru: `Целевое состояние послепродажного обслуживания — переход от реактивного ремонта к обслуживанию по состоянию.

Опирается на то, что WEG уже делает публично: сеть авторизованного сервиса ASTEC (более ${WEG.serviceNetworkBrazilTransformers} аккредитованных партнёров только по трансформаторам в Бразилии) и собственные цифровые решения для мониторинга приводов и двигателей. Объём расчёта не меняется: 145 000 обращений в год.

Что меняется по сравнению с «как есть»:
1. **Источник события.** 62 % работ инициирует система мониторинга по отклонению вибрации, температуры и тока, а не звонок клиента после отказа. Это меняет экономику: плановая работа дешевле аварийной и не останавливает производство заказчика.

   Важно: отклонение в мониторинге — ещё не отказ. В 45 % случаев достаточно удалённо скорректировать режим или регламент смазки, и до вывоза оборудования дело не доходит. Суммарно доля случаев, доходящих до физического ремонта, падает с 65 до ≈50 % — именно отсюда берётся экономия, а не из скорости ремонта.
2. **Диагностика.** Телеметрия уже есть на момент обращения, поэтому удалённо закрывается 58 % случаев вместо 35 %, а удалённая диагностика занимает 18 мин вместо 35.
3. **Гарантия.** Статус определяется автоматически по цифровому паспорту оборудования, а не вручную.
4. **Запчасти.** Прогноз отказов позволяет держать нужные позиции в региональном складе: ожидание запчастей падает с 4 дней до 1.
5. **Смета.** Согласование идёт в портале клиента с готовой калькуляцией: ожидание 3 дня → 1 день, доля отказов падает с 22 до 14 %, потому что клиент видит обоснование и стоимость простоя.
6. **Окно работ.** Плановые случаи выполняются в согласованную остановку, поэтому вывоз и возврат не создают аварийного простоя.
7. **Повторные ремонты.** Диагноз по телеметрии точнее, доля повторов падает с 7 до 3 %.

Что НЕ меняется: физический ремонт и капитальный ремонт на заводе, испытания после ремонта, доставка.

Доли (62 % предиктивных, 58 % удалённых) — **отраслевые допущения**, их следует заменить статистикой собственной платформы мониторинга и CRM.

${dataNote('ru')}

${sourceBlock(['astec', 'production', 'numbers'], 'ru')}`,
    en: `Target state of after-sales service - a move from reactive repair to condition-based work.

It builds on what WEG already runs publicly: the ASTEC authorised network (more than ${WEG.serviceNetworkBrazilTransformers} accredited transformer partners in Brazil alone) and its own digital monitoring for drives and motors. The volume is unchanged at 145,000 requests a year.

Changes: 62% of the work is triggered by monitoring on a vibration, temperature or current deviation rather than by a call after the failure, and a deviation is not yet a failure - in 45% of those cases a remote correction of the duty point or the lubrication plan is enough, so the share of events that reach a physical repair falls from 65% to about 50%, which is where the saving actually comes from; telemetry is already present, so 58% of cases close remotely instead of 35% and remote diagnosis takes 18 min instead of 35; warranty status is derived automatically from the digital equipment passport; failure forecasting keeps the right parts in the regional store, cutting the parts wait from four days to one; the quotation is approved in the customer portal (three days of waiting down to one, declines down from 22% to 14%); planned cases run inside an agreed shutdown window; a telemetry-based diagnosis is more accurate, so repeat repairs fall from 7% to 3%.

Unchanged: the physical repair and the factory overhaul, post-repair testing and delivery.

The shares (62% predictive, 58% remote) are **assumptions** - replace them with your own monitoring and CRM statistics.

${dataNote('en')}

${sourceBlock(['astec', 'production', 'numbers'], 'en')}`,
  },
  spec: {
    notation: 'bpmn',
    name: { ru: 'Сервис по состоянию — как будет', en: 'Condition-based service — to be' },
    lanes: LANES,
    nodes: [
      node('start', 'startConditionalEvent', 'fleet', 'Событие обслуживания: отклонение в мониторинге или обращение клиента', 'Service event: a monitoring deviation or a customer request', reported({})),
      node('gwSource', 'exclusiveGateway', 'fleet', 'Источник события?', 'Event source?'),
      node('predict', 'businessRuleTask', 'fleet', 'Оценить остаточный ресурс по телеметрии', 'Estimate the remaining life from telemetry', auto(2)),
      node('gwAction', 'exclusiveGateway', 'fleet', 'Нужен физический ремонт?', 'Physical repair needed?'),
      node('adjust', 'userTask', 'support', 'Скорректировать режим или регламент смазки удалённо', 'Correct the duty point or the lubrication plan remotely', work(20, 'Техник')),
      node('plan', 'userTask', 'support', 'Согласовать окно планового обслуживания', 'Agree the planned maintenance window', work(12, 'Техник', { waitTime: DAY * 2 })),
      node('register', 'serviceTask', 'support', 'Зарегистрировать обращение автоматически', 'Log the request automatically', auto(0.5)),
      node('remote', 'userTask', 'support', 'Удалённая диагностика по телеметрии', 'Remote diagnosis from telemetry', work(18, 'Техник')),
      node('gwRemote', 'exclusiveGateway', 'support', 'Решено удалённо?', 'Solved remotely?'),
      node('closeRemote', 'serviceTask', 'support', 'Закрыть обращение и выслать инструкцию', 'Close the case with instructions', work(6, 'Техник')),
      node('endRemote', 'endEvent', 'support', 'Решено без выезда', 'Closed remotely', { completes: true }),
      node('warranty', 'businessRuleTask', 'support', 'Определить гарантийный статус по цифровому паспорту', 'Derive the warranty status from the digital passport', auto(0.4)),
      node('assign', 'serviceTask', 'support', 'Назначить сервис по региону и загрузке', 'Assign the partner by region and workload', auto(0.5)),
      node('stage', 'serviceTask', 'log', 'Подготовить запчасти по прогнозу отказа', 'Stage the parts from the failure forecast', work(20, 'Логист', { cost: 1480, waitTime: DAY })),
      node('pickup', 'serviceTask', 'log', 'Забрать оборудование в согласованное окно', 'Collect the equipment in the agreed window', work(45, 'Логист', { cost: 390, waitTime: DAY })),
      node('inspect', 'userTask', 'astec', 'Дефектовка с подсказкой по телеметрии', 'Tear-down guided by the telemetry', work(110, 'Сервисный инженер')),
      node('quote', 'sendTask', 'astec', 'Выставить смету в портале клиента', 'Publish the quotation in the customer portal', work(15, 'Сервисный инженер', { waitTime: DAY })),
      node('gwAccept', 'exclusiveGateway', 'astec', 'Смета согласована?', 'Quotation accepted?'),
      node('return', 'serviceTask', 'log', 'Вернуть без ремонта', 'Return without repair', work(40, 'Логист', { cost: 360 })),
      node('endDecline', 'endEvent', 'log', 'Клиент отказался от ремонта', 'Customer declined'),
      node('gwScope', 'exclusiveGateway', 'astec', 'Ремонт на месте или на заводе?', 'Local repair or factory?'),
      node('repairLocal', 'manualTask', 'astec', 'Выполнить ремонт в сервисном центре', 'Repair in the service centre', work(480, 'Сервисный инженер', { cost: 2150 })),
      node('repairPlant', 'manualTask', 'plant', 'Капитальный ремонт на заводе', 'Full overhaul at the plant', work(2100, 'Инженер', { resourceQty: 2, cost: 12000, waitTime: DAY * 6 })),
      node('test', 'userTask', 'astec', 'Испытать и снять характеристики', 'Test and record the performance', work(90, 'ОТК')),
      node('gwTest', 'exclusiveGateway', 'astec', 'Испытания пройдены?', 'Tests passed?'),
      node('deliver', 'serviceTask', 'log', 'Доставить и установить в окно остановки', 'Deliver and install in the shutdown window', work(120, 'Логист', { cost: 480, waitTime: DAY })),
      node('baseline', 'serviceTask', 'fleet', 'Снять новую базовую линию мониторинга', 'Capture a new monitoring baseline', work(25, 'Сервисный инженер')),
      node('report', 'serviceTask', 'astec', 'Обновить цифровой паспорт оборудования', 'Update the digital equipment passport', auto(0.5)),
      node('feedback', 'sendTask', 'support', 'Запросить оценку качества сервиса', 'Ask for a service rating', auto(0.3)),
      node('end', 'endEvent', 'support', 'Обращение закрыто', 'Case closed', { completes: true }),
      node('history', 'dataStore', 'fleet', 'Цифровой паспорт и история обслуживания', 'Digital passport and service history'),
      node('note', 'textAnnotation', 'fleet', 'Плановая работа по состоянию дешевле аварийной и не останавливает производство заказчика', 'Condition-based work is cheaper than a breakdown and does not stop the customer'),
    ],
    edges: [
      flow('start', 'gwSource'),
      flow('gwSource', 'predict', { share: 62, ru: 'мониторинг', en: 'monitoring' }),
      flow('gwSource', 'register', { share: 38, ru: 'обращение клиента', en: 'customer request' }),
      flow('predict', 'gwAction'),
      flow('gwAction', 'adjust', { share: 45, ru: 'хватит настройки', en: 'a setting change is enough' }),
      flow('gwAction', 'plan', { share: 55, ru: 'нужен ремонт', en: 'repair needed' }),
      flow('adjust', 'closeRemote'),
      flow('plan', 'warranty'),
      flow('register', 'remote'),
      flow('remote', 'gwRemote'),
      flow('gwRemote', 'closeRemote', { share: 58, ru: 'да', en: 'yes' }),
      flow('gwRemote', 'warranty', { share: 42, ru: 'нужен ремонт', en: 'repair needed' }),
      flow('closeRemote', 'endRemote'),
      flow('warranty', 'assign'),
      flow('assign', 'stage'),
      flow('stage', 'pickup'),
      flow('pickup', 'inspect'),
      flow('inspect', 'quote'),
      flow('quote', 'gwAccept'),
      flow('gwAccept', 'gwScope', { share: 86, ru: 'согласована', en: 'accepted' }),
      flow('gwAccept', 'return', { share: 14, ru: 'отказ', en: 'declined' }),
      flow('return', 'endDecline'),
      flow('gwScope', 'repairLocal', { share: 84, ru: 'на месте', en: 'local' }),
      flow('gwScope', 'repairPlant', { share: 16, ru: 'на заводе', en: 'factory' }),
      flow('repairLocal', 'test'),
      flow('repairPlant', 'test'),
      flow('test', 'gwTest'),
      flow('gwTest', 'deliver', { share: 97, ru: 'годен', en: 'pass' }),
      flow('gwTest', 'repairLocal', { share: 3, ru: 'повторный ремонт', en: 'rework' }),
      flow('deliver', 'baseline'),
      flow('baseline', 'report'),
      flow('report', 'feedback'),
      flow('feedback', 'end'),
      { source: 'report', target: 'history', type: 'dataAssociation' },
      { source: 'predict', target: 'note', type: 'association' },
    ],
  },
};
