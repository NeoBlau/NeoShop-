/**
 * Table builder — "fill the cells, get the diagram".
 *
 * A spreadsheet-like editor that produces a notation-correct model without any
 * drawing: rows are steps (BPMN) or functions (IDEF0), and the connections are
 * derived from the "next step" / ICOM columns.
 */
import { i18n, t } from '../../i18n/index.js';
import { buttonRow, openDialog } from '../dialog.js';
import { icon } from '../icons.js';

const BPMN_TYPES = [
  { value: 'startEvent', ru: 'Старт', en: 'Start' },
  { value: 'task', ru: 'Задача', en: 'Task' },
  { value: 'userTask', ru: 'Пользовательская', en: 'User task' },
  { value: 'serviceTask', ru: 'Системная', en: 'Service task' },
  { value: 'manualTask', ru: 'Ручная', en: 'Manual task' },
  { value: 'sendTask', ru: 'Отправка', en: 'Send' },
  { value: 'receiveTask', ru: 'Получение', en: 'Receive' },
  { value: 'businessRuleTask', ru: 'Правило', en: 'Business rule' },
  { value: 'scriptTask', ru: 'Скрипт', en: 'Script' },
  { value: 'exclusiveGateway', ru: 'Шлюз (или)', en: 'Exclusive gateway' },
  { value: 'parallelGateway', ru: 'Шлюз (и)', en: 'Parallel gateway' },
  { value: 'intermediateTimerEvent', ru: 'Таймер', en: 'Timer' },
  { value: 'endEvent', ru: 'Конец', en: 'End' },
];

const EXAMPLE_BPMN = [
  { name: { ru: 'Заказ получен', en: 'Order received' }, type: 'startEvent', lane: { ru: 'Клиент', en: 'Customer' } },
  { name: { ru: 'Проверить заказ', en: 'Check the order' }, type: 'userTask', lane: { ru: 'Менеджер', en: 'Manager' } },
  { name: { ru: 'Оплачено?', en: 'Paid?' }, type: 'exclusiveGateway', lane: { ru: 'Менеджер', en: 'Manager' }, next: '4,6', branches: { ru: 'да,нет', en: 'yes,no' } },
  { name: { ru: 'Собрать заказ', en: 'Pick the order' }, type: 'manualTask', lane: { ru: 'Склад', en: 'Warehouse' } },
  { name: { ru: 'Отгрузить заказ', en: 'Ship the order' }, type: 'userTask', lane: { ru: 'Склад', en: 'Warehouse' }, next: '7' },
  { name: { ru: 'Уведомить клиента', en: 'Notify the customer' }, type: 'sendTask', lane: { ru: 'Менеджер', en: 'Manager' }, next: '7' },
  { name: { ru: 'Заказ закрыт', en: 'Order closed' }, type: 'endEvent', lane: { ru: 'Менеджер', en: 'Manager' } },
];

const EXAMPLE_IDEF0 = [
  {
    name: { ru: 'Принять заказ', en: 'Accept the order' },
    input: { ru: 'Заказ клиента', en: 'Customer order' },
    control: { ru: 'Политика компании', en: 'Company policy' },
    output: { ru: 'Зарегистрированный заказ', en: 'Registered order' },
    mechanism: { ru: 'CRM', en: 'CRM' },
  },
  {
    name: { ru: 'Проверить оплату', en: 'Check the payment' },
    input: { ru: 'Зарегистрированный заказ', en: 'Registered order' },
    control: { ru: 'Правила оплаты', en: 'Payment rules' },
    output: { ru: 'Оплаченный заказ', en: 'Paid order' },
    mechanism: { ru: 'Сотрудник', en: 'Employee' },
  },
  {
    name: { ru: 'Собрать и отгрузить', en: 'Pick and ship' },
    input: { ru: 'Оплаченный заказ', en: 'Paid order' },
    control: { ru: 'Политика компании', en: 'Company policy' },
    output: { ru: 'Выполненный заказ', en: 'Completed order' },
    mechanism: { ru: 'Склад', en: 'Warehouse' },
  },
];

const pick = (value) => (typeof value === 'string' ? value : value?.[i18n.locale] || value?.en || '');

export function openQuickBuild(app) {
  let notation = app.activeDiagram?.notation === 'idef0' ? 'idef0' : 'bpmn';
  let rows = emptyRows(notation);
  let title = '';

  const body = document.createElement('div');
  body.innerHTML = `
    <div class="field-row" style="align-items:end">
      <div class="field"><label>${t('props.name')}</label><input class="input" data-role="title" placeholder="${escapeAttr(
        t('quickBuild.title')
      )}"></div>
      <div class="field"><label>${t('autoBuild.notation')}</label><div class="segmented" data-role="notation"></div></div>
    </div>
    <div data-role="table" style="max-height:44vh;overflow:auto"></div>
    <div class="inline-actions" style="margin-top:10px">
      <button class="btn" data-role="add">${t('quickBuild.addRow')}</button>
      <button class="btn ghost" data-role="example">${t('quickBuild.example')}</button>
    </div>
    <div class="note" style="margin-top:10px">${t('quickBuild.hint')}</div>
  `;
  const tableHost = body.querySelector('[data-role="table"]');
  const titleInput = body.querySelector('[data-role="title"]');
  titleInput.addEventListener('input', () => {
    title = titleInput.value;
  });

  const renderNotation = () => {
    const host = body.querySelector('[data-role="notation"]');
    host.innerHTML = '';
    for (const option of [
      { value: 'bpmn', label: 'BPMN' },
      { value: 'idef0', label: 'IDEF0' },
    ]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = option.label;
      button.className = notation === option.value ? 'is-active' : '';
      button.addEventListener('click', () => {
        if (notation === option.value) return;
        notation = option.value;
        rows = emptyRows(notation);
        renderNotation();
        renderTable();
      });
      host.appendChild(button);
    }
  };

  const renderTable = () => {
    const table = document.createElement('table');
    table.className = 'grid';
    const headers =
      notation === 'bpmn'
        ? ['#', t('quickBuild.name'), t('quickBuild.type'), t('quickBuild.lane'), t('quickBuild.next'), t('quickBuild.branch'), '']
        : ['#', t('quickBuild.function'), t('quickBuild.input'), t('quickBuild.control'), t('quickBuild.output'), t('quickBuild.mechanism'), ''];
    table.innerHTML = `<thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody></tbody>`;
    const tbody = table.querySelector('tbody');

    rows.forEach((row, index) => {
      const tr = document.createElement('tr');
      const cells = [`<td class="num">${index + 1}</td>`];
      if (notation === 'bpmn') {
        cells.push(cell('name', row.name, 'text'));
        cells.push(
          `<td><select data-field="type">${BPMN_TYPES.map(
            (type) => `<option value="${type.value}"${row.type === type.value ? ' selected' : ''}>${escapeHtml(type[i18n.locale] || type.en)}</option>`
          ).join('')}</select></td>`
        );
        cells.push(cell('lane', row.lane, 'text'));
        cells.push(cell('next', row.next, 'text', '2'));
        cells.push(cell('branches', row.branches, 'text'));
      } else {
        cells.push(cell('name', row.name, 'text'));
        cells.push(cell('input', row.input, 'text'));
        cells.push(cell('control', row.control, 'text'));
        cells.push(cell('output', row.output, 'text'));
        cells.push(cell('mechanism', row.mechanism, 'text'));
      }
      cells.push(`<td class="act"><button class="icon-btn" data-remove="${index}" title="${escapeAttr(t('quickBuild.removeRow'))}">${icon('close', 13)}</button></td>`);
      tr.innerHTML = cells.join('');
      tr.dataset.index = String(index);
      tbody.appendChild(tr);
    });

    tbody.addEventListener('input', (event) => {
      const input = event.target.closest('[data-field]');
      if (!input) return;
      const index = Number(input.closest('tr').dataset.index);
      rows[index][input.dataset.field] = input.value;
    });
    tbody.addEventListener('change', (event) => {
      const input = event.target.closest('[data-field]');
      if (!input) return;
      const index = Number(input.closest('tr').dataset.index);
      rows[index][input.dataset.field] = input.value;
    });
    tbody.addEventListener('click', (event) => {
      const button = event.target.closest('[data-remove]');
      if (!button) return;
      rows.splice(Number(button.dataset.remove), 1);
      if (!rows.length) rows = emptyRows(notation);
      renderTable();
    });

    tableHost.innerHTML = '';
    tableHost.appendChild(table);
  };

  body.querySelector('[data-role="add"]').addEventListener('click', () => {
    rows.push(notation === 'bpmn' ? { name: '', type: 'task' } : { name: '', input: '', control: '', output: '', mechanism: '' });
    renderTable();
  });
  body.querySelector('[data-role="example"]').addEventListener('click', () => {
    rows =
      notation === 'bpmn'
        ? EXAMPLE_BPMN.map((row) => ({ name: pick(row.name), type: row.type, lane: pick(row.lane), next: row.next || '', branches: pick(row.branches) }))
        : EXAMPLE_IDEF0.map((row) => ({
            name: pick(row.name),
            input: pick(row.input),
            control: pick(row.control),
            output: pick(row.output),
            mechanism: pick(row.mechanism),
          }));
    titleInput.value = title = i18n.locale === 'ru' ? 'Обработка заказа' : 'Order processing';
    renderTable();
  });

  const dialog = openDialog({ title: t('quickBuild.title'), subtitle: t('quickBuild.subtitle'), body, width: 'wide' });
  dialog.footer.appendChild(
    buttonRow([
      'spacer',
      { label: t('dialog.cancel'), action: () => dialog.close() },
      {
        label: t('quickBuild.build'),
        variant: 'primary',
        action: () => {
          const spec = notation === 'bpmn' ? bpmnSpecFromRows(rows, title) : idef0SpecFromRows(rows, title);
          if (!spec) return;
          app.insertSpec(spec, { name: title });
          dialog.close();
        },
      },
    ])
  );
  renderNotation();
  renderTable();
  return dialog;
}

function emptyRows(notation) {
  return notation === 'bpmn'
    ? [
        { name: '', type: 'startEvent' },
        { name: '', type: 'task' },
        { name: '', type: 'endEvent' },
      ]
    : [
        { name: '', input: '', control: '', output: '', mechanism: '' },
        { name: '', input: '', control: '', output: '', mechanism: '' },
        { name: '', input: '', control: '', output: '', mechanism: '' },
      ];
}

function cell(field, value, type, placeholder = '') {
  return `<td><input data-field="${field}" type="${type}" value="${escapeAttr(value || '')}" placeholder="${escapeAttr(placeholder)}"></td>`;
}

/** Table rows -> BPMN specification. Exported for the tests. */
export function bpmnSpecFromRows(rows, name) {
  const used = rows.map((row, index) => ({ ...row, index })).filter((row) => (row.name || '').trim());
  if (!used.length) return null;
  const lanes = new Map();
  const nodes = used.map((row) => {
    const laneName = (row.lane || '').trim();
    if (laneName && !lanes.has(laneName)) lanes.set(laneName, { id: laneName, label: laneName });
    return { id: `r${row.index}`, type: row.type || 'task', label: row.name.trim(), lane: laneName || undefined };
  });
  const edges = [];
  const byIndex = new Map(used.map((row) => [row.index, row]));
  used.forEach((row, position) => {
    const targets = String(row.next || '')
      .split(/[,;]/)
      .map((value) => Number(String(value).trim()) - 1)
      .filter((value) => Number.isInteger(value) && byIndex.has(value));
    const labels = String(row.branches || '')
      .split(/[,;]/)
      .map((value) => value.trim())
      .filter(Boolean);
    if (targets.length) {
      targets.forEach((target, i) => edges.push({ source: `r${row.index}`, target: `r${target}`, label: labels[i] || '' }));
    } else if (row.type !== 'endEvent') {
      const next = used[position + 1];
      if (next) edges.push({ source: `r${row.index}`, target: `r${next.index}`, label: labels[0] || '' });
    }
  });
  return { notation: 'bpmn', name: name || 'Process', lanes: [...lanes.values()], nodes, edges };
}

/** Table rows -> IDEF0 specification. Exported for the tests. */
export function idef0SpecFromRows(rows, name) {
  const used = rows.filter((row) => (row.name || '').trim());
  if (!used.length) return null;
  const split = (value) =>
    String(value || '')
      .split(/[,;]/)
      .map((item) => item.trim())
      .filter(Boolean);
  const functions = used.map((row, index) => ({
    number: `A${index + 1}`,
    label: row.name.trim(),
    inputs: split(row.input),
    controls: split(row.control),
    outputs: split(row.output),
    mechanisms: split(row.mechanism),
  }));
  const all = (key) => [...new Set(functions.flatMap((fn) => fn[key]))];
  const producedOutputs = new Set(all('outputs'));
  return {
    notation: 'idef0',
    name: name || 'IDEF0',
    context: {
      label: name || functions[0].label,
      number: 'A0',
      inputs: all('inputs').filter((value) => !producedOutputs.has(value)),
      controls: all('controls'),
      outputs: all('outputs').filter((value) => !functions.some((fn) => fn.inputs.includes(value) || fn.controls.includes(value))),
      mechanisms: all('mechanisms'),
    },
    functions,
  };
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}
function escapeAttr(value) {
  return escapeHtml(value);
}
