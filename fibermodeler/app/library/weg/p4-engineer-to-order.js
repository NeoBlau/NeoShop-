/**
 * 4. Engineer-to-order: a large custom machine (HGF motor or generator).
 *
 * WEG is expanding generator capacity with a US$ 165 million programme aiming
 * at roughly 50 generators a day worldwide by 2030 - this is the process that
 * turns such an enquiry into a commissioned machine.
 */
import { WEG, dataNote, roles, sourceBlock } from './facts.js';
import { DAY, WEEK, flow, node, reported, wait, work } from './kit.js';

const LANES = [
  { id: 'customer', label: { ru: 'Заказчик', en: 'Customer' } },
  { id: 'sales', label: { ru: 'Продажи проектов', en: 'Project sales' } },
  { id: 'eng', label: { ru: 'Инжиниринг', en: 'Engineering' } },
  { id: 'plan', label: { ru: 'Планирование и снабжение', en: 'Planning & supply' } },
  { id: 'prod', label: { ru: 'Производство', en: 'Manufacturing' } },
  { id: 'test', label: { ru: 'Испытательный центр', en: 'Test centre' } },
  { id: 'field', label: { ru: 'Шеф-монтаж', en: 'Field service' } },
];

export const engineerToOrder = {
  id: 'weg-eto',
  order: 4,
  name: { ru: '4. Крупная машина на заказ (ETO)', en: '4. Engineer-to-order machine' },
  description: {
    ru: 'Запрос — расчёт — КП — договор — проектирование — производство — FAT с заказчиком — отгрузка — пусконаладка.',
    en: 'Enquiry — costing — quotation — contract — design — build — customer FAT — shipment — commissioning.',
  },
  analysis: {
    currency: 'R$',
    volumePerYear: 2600,
    hoursPerFte: 1800,
    workingDays: WEG.workingDays,
    roles: roles('Менеджер по продажам', 'Инженер-конструктор', 'Ведущий инженер', 'Планировщик', 'Сборщик', 'Техник-испытатель', 'Сервисный инженер'),
  },
  documentation: {
    ru: `Изготовление крупной электрической машины под конкретный проект заказчика (высоковольтные двигатели HGF, генераторы).

Публичные данные:
• программа инвестиций US$ ${(WEG.investments.generatorsUsd / 1e6).toFixed(0)} млн (R$ ${(WEG.investments.generatorsBrl / 1e6).toFixed(0)} млн) в производство генераторов в Северной Америке; к 2030 году — около ${WEG.investments.generatorsPerDay2030} генераторов в день на заводах в Мексике, США, Бразилии и Китае;
• в 2024 году приобретён бизнес промышленных двигателей и генераторов Regal Rexnord: ${WEG.acquisition2024.employees} сотрудников, ${WEG.acquisition2024.plants} заводов в ${WEG.acquisition2024.countries} странах;
• сегмент промышленного электрооборудования — ${(WEG.segments.industrial * 100).toFixed(1)} % выручки 2025 года.

Расчёт из публичных данных: объём в модели — 2 600 проектных заказов в год (допущение для крупных машин; при ${WEG.investments.generatorsPerDay2030} генераторах в день к 2030 году только генераторное направление даст ≈12 500 машин в год).

Конверсия 32 % в выигранные КП, 28 % замечаний по чертежам и 8 % замечаний на FAT — отраслевые допущения.

${dataNote('ru')}

${sourceBlock(['generators', 'annual2025', 'profile'], 'ru')}`,
    en: `Build of a large project-specific electrical machine (HGF high-voltage motors, generators).

Public figures: a US$ ${(WEG.investments.generatorsUsd / 1e6).toFixed(0)}m (R$ ${(WEG.investments.generatorsBrl / 1e6).toFixed(0)}m) generator programme targeting about ${WEG.investments.generatorsPerDay2030} generators a day by 2030 in Mexico, the US, Brazil and China; the 2024 Regal Rexnord acquisition added ${WEG.acquisition2024.employees} people and ${WEG.acquisition2024.plants} plants in ${WEG.acquisition2024.countries} countries.

Volume in the model: 2,600 project orders a year (assumption).

${dataNote('en')}

${sourceBlock(['generators', 'annual2025', 'profile'], 'en')}`,
  },
  spec: {
    notation: 'bpmn',
    name: { ru: 'Крупная машина на заказ (ETO)', en: 'Engineer-to-order machine' },
    lanes: LANES,
    nodes: [
      node('start', 'startMessageEvent', 'customer', 'Получен запрос (RFQ)', 'Enquiry received (RFQ)', reported({})),
      node('qualify', 'userTask', 'sales', 'Квалифицировать запрос и заказчика', 'Qualify the enquiry and the customer', work(45, 'Менеджер по продажам')),
      node('clarify', 'userTask', 'eng', 'Уточнить техническое задание', 'Clarify the technical specification', work(180, 'Инженер-конструктор', { waitTime: DAY * 2 })),
      node('concept', 'userTask', 'eng', 'Подобрать исполнение и рассчитать характеристики', 'Select the design and calculate performance', work(420, 'Ведущий инженер')),
      node('cost', 'businessRuleTask', 'sales', 'Рассчитать себестоимость и цену', 'Calculate cost and price', work(120, 'Менеджер по продажам')),
      node('gwDiscount', 'exclusiveGateway', 'sales', 'Скидка выше полномочий?', 'Discount above authority?'),
      node('approve', 'userTask', 'sales', 'Согласовать условия у директора', 'Get management approval', work(40, 'Менеджер по продажам', { waitTime: DAY })),
      node('quote', 'sendTask', 'sales', 'Отправить коммерческое предложение', 'Send the quotation', work(30, 'Менеджер по продажам')),
      node('waitDecision', 'intermediateTimerEvent', 'customer', 'Ожидание решения заказчика', 'Waiting for the customer decision', wait(DAY * 20)),
      node('gwWin', 'exclusiveGateway', 'sales', 'Заказ выигран?', 'Order won?'),
      node('lost', 'endEvent', 'sales', 'Проиграно конкуренту', 'Lost'),
      node('contract', 'userTask', 'sales', 'Заключить договор и получить аванс', 'Sign the contract and collect the advance', work(90, 'Менеджер по продажам', { waitTime: DAY * 5 })),
      node('design', 'userTask', 'eng', 'Рабочее проектирование и 3D-модель', 'Detailed design and 3D model', work(2400, 'Инженер-конструктор')),
      node('review', 'sendTask', 'eng', 'Согласовать чертежи с заказчиком', 'Customer drawing approval', work(60, 'Инженер-конструктор', { waitTime: DAY * 7 })),
      node('gwReview', 'exclusiveGateway', 'eng', 'Есть замечания?', 'Comments raised?'),
      node('rework', 'userTask', 'eng', 'Внести изменения в проект', 'Update the design', work(420, 'Инженер-конструктор')),
      node('bom', 'serviceTask', 'plan', 'Сформировать спецификацию и план', 'Release the BOM and the schedule', work(120, 'Планировщик')),
      node('longlead', 'intermediateTimerEvent', 'plan', 'Поставка длинных позиций', 'Long-lead items', wait(WEEK * 12)),
      node('manufacture', 'manualTask', 'prod', 'Изготовить статор, ротор, корпус', 'Manufacture stator, rotor and frame', work(5400, 'Сборщик', { resourceQty: 4, cost: 42000 })),
      node('assemble', 'manualTask', 'prod', 'Собрать машину', 'Assemble the machine', work(1800, 'Сборщик', { resourceQty: 3 })),
      node('routine', 'userTask', 'test', 'Приёмо-сдаточные испытания', 'Routine tests', work(480, 'Техник-испытатель')),
      node('fat', 'userTask', 'test', 'FAT в присутствии заказчика', 'Customer witnessed FAT', work(600, 'Техник-испытатель', { cost: 8500 })),
      node('gwFat', 'exclusiveGateway', 'test', 'FAT принят?', 'FAT accepted?'),
      node('fix', 'userTask', 'prod', 'Устранить замечания FAT', 'Close the FAT punch list', work(960, 'Сборщик', { resourceQty: 2 })),
      node('pack', 'manualTask', 'plan', 'Консервация и упаковка для перевозки', 'Preservation and transport packing', work(420, 'Сборщик', { cost: 6200 })),
      node('ship', 'serviceTask', 'plan', 'Отгрузить заказчику', 'Ship to the customer', work(120, 'Планировщик', { cost: 23000, waitTime: DAY * 12 })),
      node('commission', 'userTask', 'field', 'Шеф-монтаж и пусконаладка', 'Supervised installation and commissioning', work(1920, 'Сервисный инженер', { cost: 14500 })),
      node('handover', 'userTask', 'field', 'Подписать акт и открыть гарантию', 'Sign the acceptance certificate, start the warranty', work(90, 'Сервисный инженер')),
      node('end', 'endEvent', 'field', 'Машина принята в эксплуатацию', 'Machine in operation'),
      node('drawings', 'dataObject', 'eng', 'Согласованные чертежи', 'Approved drawings'),
      node('fatReport', 'dataObject', 'test', 'Протокол FAT', 'FAT report'),
      node('note', 'textAnnotation', 'sales', 'Конверсия КП 32 % — допущение, калибруется по CRM', 'Quote conversion 32% — assumption, calibrate with CRM'),
    ],
    edges: [
      flow('start', 'qualify'),
      flow('qualify', 'clarify'),
      flow('clarify', 'concept'),
      flow('concept', 'cost'),
      flow('cost', 'gwDiscount'),
      flow('gwDiscount', 'approve', { share: 38, ru: 'да', en: 'yes' }),
      flow('gwDiscount', 'quote', { share: 62, ru: 'в полномочиях', en: 'within authority' }),
      flow('approve', 'quote'),
      flow('quote', 'waitDecision'),
      flow('waitDecision', 'gwWin'),
      flow('gwWin', 'contract', { share: 32, ru: 'выиграно', en: 'won' }),
      flow('gwWin', 'lost', { share: 68, ru: 'проиграно', en: 'lost' }),
      flow('contract', 'design'),
      flow('design', 'review'),
      flow('review', 'gwReview'),
      flow('gwReview', 'rework', { share: 28, ru: 'есть замечания', en: 'comments' }),
      flow('gwReview', 'bom', { share: 72, ru: 'согласовано', en: 'approved' }),
      flow('rework', 'review'),
      flow('bom', 'longlead'),
      flow('longlead', 'manufacture'),
      flow('manufacture', 'assemble'),
      flow('assemble', 'routine'),
      flow('routine', 'fat'),
      flow('fat', 'gwFat'),
      flow('gwFat', 'pack', { share: 92, ru: 'принят', en: 'accepted' }),
      flow('gwFat', 'fix', { share: 8, ru: 'замечания', en: 'punch list' }),
      flow('fix', 'fat'),
      flow('pack', 'ship'),
      flow('ship', 'commission'),
      flow('commission', 'handover'),
      flow('handover', 'end'),
      { source: 'review', target: 'drawings', type: 'dataAssociation' },
      { source: 'fat', target: 'fatReport', type: 'dataAssociation' },
      { source: 'cost', target: 'note', type: 'association' },
    ],
  },
};
