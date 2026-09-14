import { assert, test } from './harness.js';
import { Doc, createProject } from '../app/core/model.js';
import { buildDiagrams, buildBpmnDiagram, buildIdef0Diagrams, normalizeSpec } from '../app/ai/schema.js';
import { generateLocalSpec, detectNotation } from '../app/ai/local.js';
import { generateModel } from '../app/ai/index.js';
import { parseModelJson, PROVIDERS, buildUserPrompt } from '../app/ai/providers.js';
import { bpmnSpecFromRows, idef0SpecFromRows } from '../app/ui/dialogs/quickbuild.js';
import { BPMN_TEMPLATES, findBpmnTemplate } from '../app/notations/bpmn/templates.js';
import { IDEF0_TEMPLATES, findIdef0Template } from '../app/notations/idef0/templates.js';
import { validateBpmn } from '../app/notations/bpmn/validate.js';
import { validateIdef0 } from '../app/notations/idef0/validate.js';
import { createDemoProject } from '../app/demo.js';
import { en } from '../app/i18n/en.js';
import { ru } from '../app/i18n/ru.js';
import { i18n } from '../app/i18n/index.js';

const errorsOf = (problems) => problems.filter((p) => p.severity === 'error').map((p) => p.messageKey);

test('every BPMN template builds into a valid diagram', () => {
  for (const template of BPMN_TEMPLATES) {
    const doc = new Doc(createProject({}));
    const diagram = buildDiagrams(template.spec, { locale: 'ru' })[0];
    doc.addDiagram(diagram);
    assert.ok(diagram.nodes.length >= 5, `${template.id} is too small`);
    assert.deepEqual(errorsOf(validateBpmn(diagram, doc)), [], `${template.id} has validation errors`);
  }
});

test('every IDEF0 template builds a context diagram and a decomposition', () => {
  for (const template of IDEF0_TEMPLATES) {
    const doc = new Doc(createProject({}));
    const diagrams = buildDiagrams(template.spec, { locale: 'ru' });
    assert.equal(diagrams.length, 2, `${template.id} must produce A-0 and A0`);
    for (const diagram of diagrams) doc.addDiagram(diagram);
    assert.equal(diagrams[1].parentDiagramId, diagrams[0].id);
    assert.ok(diagrams[1].parentNodeId, 'the decomposition points at its parent box');
    for (const diagram of diagrams) {
      assert.deepEqual(errorsOf(validateIdef0(diagram, doc)), [], `${template.id}/${diagram.name} has errors`);
    }
  }
});

test('template matching picks the right domain', () => {
  assert.equal(findBpmnTemplate('Процесс обработки заказа интернет-магазина').id, 'order');
  assert.equal(findBpmnTemplate('Найм сотрудника в компанию').id, 'hiring');
  assert.equal(findBpmnTemplate('оплата счета поставщика').id, 'invoice');
  assert.equal(findIdef0Template('производственный процесс цеха').id, 'production');
  assert.equal(findBpmnTemplate('что-то совершенно постороннее'), null);
});

test('offline generator parses a step by step description', () => {
  const { spec, source } = generateLocalSpec(
    'Клиент оформляет заказ. Менеджер проверяет оплату. Если оплата прошла, склад собирает заказ. Затем курьер доставляет заказ.',
    { notation: 'bpmn', locale: 'ru' }
  );
  assert.equal(source, 'parser');
  assert.equal(spec.notation, 'bpmn');
  assert.equal(spec.nodes[0].type, 'startEvent');
  assert.ok(spec.nodes.some((n) => n.type === 'exclusiveGateway'), 'a condition becomes a gateway');
  assert.ok(spec.nodes.some((n) => n.type === 'endEvent'), 'the process is closed with an end event');
  assert.ok(spec.lanes.length >= 2, 'actors become lanes');
  const gateway = spec.nodes.find((n) => n.type === 'exclusiveGateway');
  const outgoing = spec.edges.filter((e) => e.source === gateway.id);
  assert.ok(outgoing.length >= 2, 'a gateway gets at least two branches');
  assert.ok(outgoing.every((e) => e.label), 'branches are labelled');
});

test('offline generator falls back to a template for a bare title', () => {
  const result = generateLocalSpec('Процесс обработки заказа интернет-магазина.', { notation: 'bpmn', locale: 'ru' });
  assert.equal(result.source, 'template');
  assert.equal(result.templateId, 'order');
});

test('offline generator extracts ICOM arrows for IDEF0', () => {
  const { spec } = generateLocalSpec(
    'Обработка заказа: на вход поступает заказ клиента, согласно регламенту продаж, с помощью CRM, результат — выполненный заказ. Принять заказ. Проверить оплату. Отгрузить заказ.',
    { notation: 'idef0', locale: 'ru' }
  );
  assert.equal(spec.notation, 'idef0');
  assert.ok(spec.context.inputs.length >= 1);
  assert.ok(spec.context.controls.length >= 1);
  assert.ok(spec.context.outputs.length >= 1);
  assert.ok(spec.context.mechanisms.length >= 1);
  assert.ok(spec.functions.length >= 3);
  const doc = new Doc(createProject({}));
  const diagrams = buildDiagrams(spec, { locale: 'ru' });
  for (const diagram of diagrams) doc.addDiagram(diagram);
  for (const diagram of diagrams) assert.deepEqual(errorsOf(validateIdef0(diagram, doc)), [], diagram.name);
});

test('notation detection', () => {
  assert.equal(detectNotation('функции системы, входы и выходы, механизмы'), 'idef0');
  assert.equal(detectNotation('процесс: клиент оформляет заявку, затем менеджер'), 'bpmn');
});

test('generateModel always returns a model and falls back without a key', async () => {
  const local = await generateModel({ prompt: 'Обработка заказа', provider: 'local', notation: 'bpmn' });
  assert.equal(local.provider, 'local');
  assert.ok(local.spec.nodes.length > 0);
  const fallback = await generateModel({ prompt: 'Обработка заказа', provider: 'claude', settings: {}, notation: 'bpmn' });
  assert.equal(fallback.provider, 'local');
  assert.equal(fallback.fallbackFrom, 'claude');
  assert.ok(fallback.error, 'the reason is reported');
});

test('AI provider plumbing', () => {
  assert.ok(PROVIDERS.claude.needsKey && PROVIDERS.claude.defaultModel.startsWith('claude-'));
  assert.equal(PROVIDERS.local.offline, true);
  assert.includes(buildUserPrompt('Заказ', { notation: 'bpmn', complexity: 'simple' }), 'Заказ');
  assert.deepEqual(parseModelJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(parseModelJson('Here you go: {"nodes":[]} thanks'), { nodes: [] });
  assert.throws(() => parseModelJson('no json here'));
});

test('a malformed model answer is rejected before it reaches the canvas', () => {
  assert.throws(() => normalizeSpec(null));
  assert.throws(() => normalizeSpec({ notation: 'bpmn', nodes: [] }));
  const spec = normalizeSpec({ notation: 'bpmn', nodes: [{ label: 'Шаг' }], edges: [{ source: 'a' }] });
  assert.equal(spec.edges.length, 0, 'incomplete edges are dropped');
  assert.ok(spec.nodes[0].id, 'missing ids are generated');
});

test('table builder produces a correct BPMN model', () => {
  const spec = bpmnSpecFromRows(
    [
      { name: 'Заказ получен', type: 'startEvent', lane: 'Клиент' },
      { name: 'Проверить заказ', type: 'userTask', lane: 'Менеджер' },
      { name: 'Оплачено?', type: 'exclusiveGateway', lane: 'Менеджер', next: '4,5', branches: 'да,нет' },
      { name: 'Собрать заказ', type: 'manualTask', lane: 'Склад', next: '6' },
      { name: 'Уведомить клиента', type: 'sendTask', lane: 'Менеджер', next: '6' },
      { name: 'Заказ закрыт', type: 'endEvent', lane: 'Менеджер' },
    ],
    'Обработка заказа'
  );
  assert.equal(spec.lanes.length, 3);
  assert.equal(spec.edges.length, 6);
  const doc = new Doc(createProject({}));
  const diagram = buildDiagrams(spec, { locale: 'ru' })[0];
  doc.addDiagram(diagram);
  assert.deepEqual(errorsOf(validateBpmn(diagram, doc)), []);
  const branchLabels = diagram.edges.filter((e) => e.label).map((e) => e.label);
  assert.includes(branchLabels, 'да');
  assert.includes(branchLabels, 'нет');
});

test('table builder produces a correct IDEF0 model', () => {
  const spec = idef0SpecFromRows(
    [
      { name: 'Принять заказ', input: 'Заказ клиента', control: 'Политика компании', output: 'Зарегистрированный заказ', mechanism: 'CRM' },
      { name: 'Проверить оплату', input: 'Зарегистрированный заказ', control: 'Правила оплаты', output: 'Оплаченный заказ', mechanism: 'Сотрудник' },
      { name: 'Отгрузить', input: 'Оплаченный заказ', control: 'Политика компании', output: 'Выполненный заказ', mechanism: 'Склад' },
    ],
    'Обработка заказа'
  );
  assert.equal(spec.functions.length, 3);
  assert.deepEqual(spec.context.inputs, ['Заказ клиента']);
  assert.deepEqual(spec.context.outputs, ['Выполненный заказ']);
  const doc = new Doc(createProject({}));
  const diagrams = buildDiagrams(spec, { locale: 'ru' });
  for (const diagram of diagrams) doc.addDiagram(diagram);
  for (const diagram of diagrams) assert.deepEqual(errorsOf(validateIdef0(diagram, doc)), [], diagram.name);
  const child = diagrams[1];
  const chained = child.edges.filter((e) => {
    const source = child.nodes.find((n) => n.id === e.source);
    const target = child.nodes.find((n) => n.id === e.target);
    return source?.type === 'idef0Function' && target?.type === 'idef0Function';
  });
  assert.ok(chained.length >= 2, 'outputs feed the next function');
});

test('BPMN builder lays lanes out without overlaps', () => {
  const diagram = buildBpmnDiagram(BPMN_TEMPLATES[0].spec, { locale: 'ru' });
  const lanes = diagram.nodes.filter((n) => n.type === 'lane');
  assert.equal(lanes.length, 3);
  for (let i = 1; i < lanes.length; i++) {
    assert.ok(lanes[i].y >= lanes[i - 1].y + lanes[i - 1].h - 1, 'lanes are stacked');
  }
  const flow = diagram.nodes.filter((n) => !['pool', 'lane'].includes(n.type));
  for (const node of flow) {
    const lane = lanes.find((l) => l.id === node.parent);
    if (!lane) continue;
    assert.ok(node.y >= lane.y - 2 && node.y + node.h <= lane.y + lane.h + 2, `${node.label} escapes its lane`);
  }
});

test('IDEF0 builder wires matching inputs and outputs together', () => {
  const diagrams = buildIdef0Diagrams(IDEF0_TEMPLATES[0].spec, { locale: 'en' });
  const child = diagrams[1];
  const functions = child.nodes.filter((n) => n.type === 'idef0Function');
  assert.equal(functions.length, 4);
  const anchors = child.nodes.filter((n) => n.type === 'idef0Anchor');
  assert.ok(anchors.length > 0, 'boundary arrows are created');
  assert.ok(anchors.every((a) => /^[ICOM]\d+$/.test(a.props.icom)), 'ICOM codes are assigned');
});

test('demo project is valid in both notations', () => {
  const project = createDemoProject('ru');
  const doc = new Doc(project);
  assert.equal(project.diagrams.length, 3);
  for (const diagram of project.diagrams) {
    const problems = diagram.notation === 'bpmn' ? validateBpmn(diagram, doc) : validateIdef0(diagram, doc);
    assert.deepEqual(errorsOf(problems), [], `${diagram.name} has errors`);
  }
});

test('translations stay in sync', () => {
  const missing = Object.keys(en).filter((key) => !(key in ru));
  const extra = Object.keys(ru).filter((key) => !(key in en));
  assert.deepEqual(missing, [], 'keys missing in ru');
  assert.deepEqual(extra, [], 'keys missing in en');
  i18n.setLocale('en');
  assert.equal(i18n.t('menu.file'), 'File');
  i18n.setLocale('ru');
  assert.equal(i18n.t('menu.file'), 'Файл');
  assert.equal(i18n.t('status.nodes', { count: 5 }), 'Элементов: 5');
  assert.equal(i18n.t('unknown.key'), 'unknown.key');
});
