/**
 * Ready-made IDEF0 models.
 *
 * Each template describes the context function (A-0) together with its ICOM
 * arrows and, where useful, the decomposition (A0) - which is what makes an
 * IDEF0 model actually usable instead of a single lonely box.
 */

export const IDEF0_TEMPLATES = [
  {
    id: 'enterprise',
    keywords: ['предприят', 'компан', 'бизнес', 'enterprise', 'управлен'],
    name: { en: 'Enterprise process', ru: 'Деятельность предприятия' },
    description: { en: 'Context diagram of a company with its decomposition', ru: 'Контекстная диаграмма компании с декомпозицией' },
    spec: {
      notation: 'idef0',
      name: { en: 'Enterprise', ru: 'Деятельность предприятия' },
      context: {
        label: { en: 'Run the company', ru: 'Осуществлять деятельность предприятия' },
        number: 'A0',
        inputs: [{ en: 'Customer demand', ru: 'Потребность рынка' }, { en: 'Resources', ru: 'Ресурсы' }],
        controls: [{ en: 'Legislation', ru: 'Законодательство' }, { en: 'Company policy', ru: 'Политика компании' }],
        outputs: [{ en: 'Products and services', ru: 'Продукция и услуги' }, { en: 'Reports', ru: 'Отчётность' }],
        mechanisms: [{ en: 'Staff', ru: 'Персонал' }, { en: 'IT systems', ru: 'Информационные системы' }],
      },
      functions: [
        {
          number: 'A1',
          label: { en: 'Plan activities', ru: 'Планировать деятельность' },
          inputs: [{ en: 'Customer demand', ru: 'Потребность рынка' }],
          controls: [{ en: 'Company policy', ru: 'Политика компании' }],
          outputs: [{ en: 'Plan', ru: 'План' }],
          mechanisms: [{ en: 'Staff', ru: 'Персонал' }],
        },
        {
          number: 'A2',
          label: { en: 'Provide resources', ru: 'Обеспечить ресурсами' },
          inputs: [{ en: 'Plan', ru: 'План' }, { en: 'Resources', ru: 'Ресурсы' }],
          controls: [{ en: 'Legislation', ru: 'Законодательство' }],
          outputs: [{ en: 'Prepared resources', ru: 'Подготовленные ресурсы' }],
          mechanisms: [{ en: 'IT systems', ru: 'Информационные системы' }],
        },
        {
          number: 'A3',
          label: { en: 'Produce goods and services', ru: 'Производить продукцию и услуги' },
          inputs: [{ en: 'Prepared resources', ru: 'Подготовленные ресурсы' }],
          controls: [{ en: 'Plan', ru: 'План' }],
          outputs: [{ en: 'Products and services', ru: 'Продукция и услуги' }],
          mechanisms: [{ en: 'Staff', ru: 'Персонал' }],
        },
        {
          number: 'A4',
          label: { en: 'Control the results', ru: 'Контролировать результаты' },
          inputs: [{ en: 'Products and services', ru: 'Продукция и услуги' }],
          controls: [{ en: 'Company policy', ru: 'Политика компании' }],
          outputs: [{ en: 'Reports', ru: 'Отчётность' }],
          mechanisms: [{ en: 'IT systems', ru: 'Информационные системы' }],
        },
      ],
    },
  },
  {
    id: 'order',
    keywords: ['заказ', 'order', 'магазин', 'продаж', 'клиент'],
    name: { en: 'Order management', ru: 'Управление заказом' },
    description: { en: 'Order handling as an IDEF0 function tree', ru: 'Обработка заказа как дерево функций IDEF0' },
    spec: {
      notation: 'idef0',
      name: { en: 'Order management', ru: 'Управление заказом' },
      context: {
        label: { en: 'Manage the customer order', ru: 'Управлять заказом клиента' },
        number: 'A0',
        inputs: [{ en: 'Customer order', ru: 'Заказ клиента' }, { en: 'Goods in stock', ru: 'Товар на складе' }],
        controls: [{ en: 'Company policy', ru: 'Политика компании' }, { en: 'Payment rules', ru: 'Правила оплаты' }],
        outputs: [{ en: 'Completed order', ru: 'Выполненный заказ' }, { en: 'Invoice', ru: 'Счёт' }],
        mechanisms: [{ en: 'Employee', ru: 'Сотрудник' }, { en: 'CRM', ru: 'CRM' }, { en: 'Warehouse', ru: 'Склад' }],
      },
      functions: [
        {
          number: 'A1',
          label: { en: 'Accept the order', ru: 'Принять заказ' },
          inputs: [{ en: 'Customer order', ru: 'Заказ клиента' }],
          controls: [{ en: 'Company policy', ru: 'Политика компании' }],
          outputs: [{ en: 'Registered order', ru: 'Зарегистрированный заказ' }],
          mechanisms: [{ en: 'CRM', ru: 'CRM' }],
        },
        {
          number: 'A2',
          label: { en: 'Check the payment', ru: 'Проверить оплату' },
          inputs: [{ en: 'Registered order', ru: 'Зарегистрированный заказ' }],
          controls: [{ en: 'Payment rules', ru: 'Правила оплаты' }],
          outputs: [{ en: 'Paid order', ru: 'Оплаченный заказ' }, { en: 'Invoice', ru: 'Счёт' }],
          mechanisms: [{ en: 'Employee', ru: 'Сотрудник' }],
        },
        {
          number: 'A3',
          label: { en: 'Assemble the order', ru: 'Собрать заказ' },
          inputs: [{ en: 'Paid order', ru: 'Оплаченный заказ' }, { en: 'Goods in stock', ru: 'Товар на складе' }],
          controls: [{ en: 'Company policy', ru: 'Политика компании' }],
          outputs: [{ en: 'Packed order', ru: 'Собранный заказ' }],
          mechanisms: [{ en: 'Warehouse', ru: 'Склад' }],
        },
        {
          number: 'A4',
          label: { en: 'Deliver the order', ru: 'Доставить заказ' },
          inputs: [{ en: 'Packed order', ru: 'Собранный заказ' }],
          controls: [{ en: 'Company policy', ru: 'Политика компании' }],
          outputs: [{ en: 'Completed order', ru: 'Выполненный заказ' }],
          mechanisms: [{ en: 'Employee', ru: 'Сотрудник' }],
        },
      ],
    },
  },
  {
    id: 'production',
    keywords: ['производ', 'изготов', 'цех', 'production'],
    name: { en: 'Production', ru: 'Производственный процесс' },
    description: { en: 'Production as an IDEF0 model', ru: 'Производство в нотации IDEF0' },
    spec: {
      notation: 'idef0',
      name: { en: 'Production', ru: 'Производственный процесс' },
      context: {
        label: { en: 'Produce the product', ru: 'Производить продукцию' },
        number: 'A0',
        inputs: [{ en: 'Raw materials', ru: 'Сырьё и материалы' }],
        controls: [{ en: 'Technology', ru: 'Технологический регламент' }, { en: 'Quality standard', ru: 'Стандарт качества' }],
        outputs: [{ en: 'Finished product', ru: 'Готовая продукция' }, { en: 'Scrap', ru: 'Брак' }],
        mechanisms: [{ en: 'Equipment', ru: 'Оборудование' }, { en: 'Operators', ru: 'Операторы' }],
      },
      functions: [
        {
          number: 'A1',
          label: { en: 'Prepare materials', ru: 'Подготовить материалы' },
          inputs: [{ en: 'Raw materials', ru: 'Сырьё и материалы' }],
          controls: [{ en: 'Technology', ru: 'Технологический регламент' }],
          outputs: [{ en: 'Prepared materials', ru: 'Подготовленные материалы' }],
          mechanisms: [{ en: 'Operators', ru: 'Операторы' }],
        },
        {
          number: 'A2',
          label: { en: 'Process the materials', ru: 'Обработать материалы' },
          inputs: [{ en: 'Prepared materials', ru: 'Подготовленные материалы' }],
          controls: [{ en: 'Technology', ru: 'Технологический регламент' }],
          outputs: [{ en: 'Parts', ru: 'Детали' }],
          mechanisms: [{ en: 'Equipment', ru: 'Оборудование' }],
        },
        {
          number: 'A3',
          label: { en: 'Assemble the product', ru: 'Собрать изделие' },
          inputs: [{ en: 'Parts', ru: 'Детали' }],
          controls: [{ en: 'Quality standard', ru: 'Стандарт качества' }],
          outputs: [{ en: 'Assembled product', ru: 'Собранное изделие' }],
          mechanisms: [{ en: 'Operators', ru: 'Операторы' }],
        },
        {
          number: 'A4',
          label: { en: 'Control quality', ru: 'Контролировать качество' },
          inputs: [{ en: 'Assembled product', ru: 'Собранное изделие' }],
          controls: [{ en: 'Quality standard', ru: 'Стандарт качества' }],
          outputs: [{ en: 'Finished product', ru: 'Готовая продукция' }, { en: 'Scrap', ru: 'Брак' }],
          mechanisms: [{ en: 'Equipment', ru: 'Оборудование' }],
        },
      ],
    },
  },
  {
    id: 'logistics',
    keywords: ['логист', 'склад', 'перевоз', 'доставк', 'logistic'],
    name: { en: 'Logistics', ru: 'Логистика' },
    description: { en: 'Warehouse and transport functions', ru: 'Складские и транспортные функции' },
    spec: {
      notation: 'idef0',
      name: { en: 'Logistics', ru: 'Логистика' },
      context: {
        label: { en: 'Deliver the goods', ru: 'Доставлять товар' },
        number: 'A0',
        inputs: [{ en: 'Shipment request', ru: 'Заявка на доставку' }, { en: 'Goods', ru: 'Товар' }],
        controls: [{ en: 'Delivery terms', ru: 'Условия доставки' }, { en: 'Transport regulations', ru: 'Транспортные правила' }],
        outputs: [{ en: 'Delivered goods', ru: 'Доставленный товар' }, { en: 'Shipping documents', ru: 'Товарные документы' }],
        mechanisms: [{ en: 'Carrier', ru: 'Перевозчик' }, { en: 'WMS', ru: 'Система WMS' }],
      },
      functions: [
        {
          number: 'A1',
          label: { en: 'Plan the shipment', ru: 'Спланировать отгрузку' },
          inputs: [{ en: 'Shipment request', ru: 'Заявка на доставку' }],
          controls: [{ en: 'Delivery terms', ru: 'Условия доставки' }],
          outputs: [{ en: 'Shipment plan', ru: 'План отгрузки' }],
          mechanisms: [{ en: 'WMS', ru: 'Система WMS' }],
        },
        {
          number: 'A2',
          label: { en: 'Pick and load', ru: 'Собрать и погрузить' },
          inputs: [{ en: 'Shipment plan', ru: 'План отгрузки' }, { en: 'Goods', ru: 'Товар' }],
          controls: [{ en: 'Transport regulations', ru: 'Транспортные правила' }],
          outputs: [{ en: 'Loaded transport', ru: 'Загруженный транспорт' }, { en: 'Shipping documents', ru: 'Товарные документы' }],
          mechanisms: [{ en: 'WMS', ru: 'Система WMS' }],
        },
        {
          number: 'A3',
          label: { en: 'Transport', ru: 'Перевезти груз' },
          inputs: [{ en: 'Loaded transport', ru: 'Загруженный транспорт' }],
          controls: [{ en: 'Transport regulations', ru: 'Транспортные правила' }],
          outputs: [{ en: 'Delivered goods', ru: 'Доставленный товар' }],
          mechanisms: [{ en: 'Carrier', ru: 'Перевозчик' }],
        },
      ],
    },
  },
  {
    id: 'finance',
    keywords: ['финанс', 'бюджет', 'бухгалт', 'finance', 'счет', 'платеж'],
    name: { en: 'Financial process', ru: 'Финансовый процесс' },
    description: { en: 'Budgeting, payments and reporting', ru: 'Бюджетирование, платежи и отчётность' },
    spec: {
      notation: 'idef0',
      name: { en: 'Financial process', ru: 'Финансовый процесс' },
      context: {
        label: { en: 'Manage finances', ru: 'Управлять финансами' },
        number: 'A0',
        inputs: [{ en: 'Payment requests', ru: 'Заявки на оплату' }, { en: 'Income', ru: 'Поступления' }],
        controls: [{ en: 'Budget', ru: 'Бюджет' }, { en: 'Accounting policy', ru: 'Учётная политика' }],
        outputs: [{ en: 'Payments', ru: 'Платежи' }, { en: 'Financial statements', ru: 'Финансовая отчётность' }],
        mechanisms: [{ en: 'Accountant', ru: 'Бухгалтер' }, { en: 'ERP', ru: 'ERP-система' }],
      },
      functions: [
        {
          number: 'A1',
          label: { en: 'Plan the budget', ru: 'Планировать бюджет' },
          inputs: [{ en: 'Income', ru: 'Поступления' }],
          controls: [{ en: 'Accounting policy', ru: 'Учётная политика' }],
          outputs: [{ en: 'Budget', ru: 'Бюджет' }],
          mechanisms: [{ en: 'ERP', ru: 'ERP-система' }],
        },
        {
          number: 'A2',
          label: { en: 'Execute payments', ru: 'Исполнять платежи' },
          inputs: [{ en: 'Payment requests', ru: 'Заявки на оплату' }],
          controls: [{ en: 'Budget', ru: 'Бюджет' }],
          outputs: [{ en: 'Payments', ru: 'Платежи' }],
          mechanisms: [{ en: 'Accountant', ru: 'Бухгалтер' }],
        },
        {
          number: 'A3',
          label: { en: 'Report', ru: 'Формировать отчётность' },
          inputs: [{ en: 'Payments', ru: 'Платежи' }],
          controls: [{ en: 'Accounting policy', ru: 'Учётная политика' }],
          outputs: [{ en: 'Financial statements', ru: 'Финансовая отчётность' }],
          mechanisms: [{ en: 'ERP', ru: 'ERP-система' }],
        },
      ],
    },
  },
  {
    id: 'is',
    keywords: ['информацион', 'систем', 'данн', 'it', 'software', 'разработ'],
    name: { en: 'Information system', ru: 'Информационная система' },
    description: { en: 'Data processing functions of an IT system', ru: 'Функции обработки данных ИС' },
    spec: {
      notation: 'idef0',
      name: { en: 'Information system', ru: 'Информационная система' },
      context: {
        label: { en: 'Process the data', ru: 'Обрабатывать данные' },
        number: 'A0',
        inputs: [{ en: 'Source data', ru: 'Исходные данные' }, { en: 'User requests', ru: 'Запросы пользователей' }],
        controls: [{ en: 'Requirements', ru: 'Требования' }, { en: 'Security policy', ru: 'Политика безопасности' }],
        outputs: [{ en: 'Reports', ru: 'Отчёты' }, { en: 'Stored data', ru: 'Сохранённые данные' }],
        mechanisms: [{ en: 'Software', ru: 'Программное обеспечение' }, { en: 'Administrator', ru: 'Администратор' }],
      },
      functions: [
        {
          number: 'A1',
          label: { en: 'Collect the data', ru: 'Собирать данные' },
          inputs: [{ en: 'Source data', ru: 'Исходные данные' }],
          controls: [{ en: 'Requirements', ru: 'Требования' }],
          outputs: [{ en: 'Validated data', ru: 'Проверенные данные' }],
          mechanisms: [{ en: 'Software', ru: 'Программное обеспечение' }],
        },
        {
          number: 'A2',
          label: { en: 'Store the data', ru: 'Хранить данные' },
          inputs: [{ en: 'Validated data', ru: 'Проверенные данные' }],
          controls: [{ en: 'Security policy', ru: 'Политика безопасности' }],
          outputs: [{ en: 'Stored data', ru: 'Сохранённые данные' }],
          mechanisms: [{ en: 'Administrator', ru: 'Администратор' }],
        },
        {
          number: 'A3',
          label: { en: 'Serve the requests', ru: 'Обслуживать запросы' },
          inputs: [{ en: 'User requests', ru: 'Запросы пользователей' }, { en: 'Stored data', ru: 'Сохранённые данные' }],
          controls: [{ en: 'Requirements', ru: 'Требования' }],
          outputs: [{ en: 'Reports', ru: 'Отчёты' }],
          mechanisms: [{ en: 'Software', ru: 'Программное обеспечение' }],
        },
      ],
    },
  },
];

export function findIdef0Template(text) {
  const lower = String(text || '').toLowerCase();
  let best = null;
  let bestScore = 0;
  for (const template of IDEF0_TEMPLATES) {
    let score = 0;
    for (const keyword of template.keywords) if (lower.includes(keyword)) score += keyword.length;
    if (score > bestScore) {
      bestScore = score;
      best = template;
    }
  }
  return bestScore > 0 ? best : null;
}
