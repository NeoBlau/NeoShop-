import { assert, test } from './harness.js';
import { createDiagram, createEdge, createNode, Doc, createProject } from '../app/core/model.js';
import { getNotation, makeNode, paletteFor, typeName } from '../app/notations/index.js';
import { BPMN_TYPES } from '../app/notations/bpmn/types.js';
import { IDEF0_EDGE_TYPES, IDEF0_TYPES, nextIcomCode, nextNodeNumber } from '../app/notations/idef0/types.js';
import { validateBpmn } from '../app/notations/bpmn/validate.js';
import { validateIdef0 } from '../app/notations/idef0/validate.js';
import { wrapText, measure } from '../app/notations/shared.js';

test('BPMN catalogue covers the whole notation', () => {
  const ids = Object.keys(BPMN_TYPES);
  for (const required of [
    'startEvent', 'startMessageEvent', 'startTimerEvent', 'intermediateEvent', 'intermediateTimerEvent',
    'endEvent', 'endTerminateEvent', 'task', 'userTask', 'manualTask', 'serviceTask', 'scriptTask',
    'businessRuleTask', 'sendTask', 'receiveTask', 'callActivity', 'subProcess', 'eventSubProcess',
    'exclusiveGateway', 'inclusiveGateway', 'parallelGateway', 'eventBasedGateway', 'complexGateway',
    'pool', 'lane', 'dataObject', 'dataStore', 'dataInput', 'dataOutput', 'group', 'textAnnotation',
  ]) {
    assert.includes(ids, required, 'missing BPMN type');
  }
  assert.ok(ids.length >= 45);
});

test('every type can draw itself and declares properties', () => {
  for (const [notation, catalogue] of [['bpmn', BPMN_TYPES], ['idef0', IDEF0_TYPES]]) {
    for (const type of Object.values(catalogue)) {
      const node = makeNode(notation, type.id, 100, 100, { label: 'Проверка счёта' });
      const markup = type.draw(node, {});
      assert.ok(typeof markup === 'string' && markup.length > 10, `${type.id} draws nothing`);
      assert.ok(Array.isArray(type.props) && type.props.length, `${type.id} has no properties`);
      assert.ok(type.name.ru && type.name.en, `${type.id} is not translated`);
    }
  }
});

test('palette groups are populated for both notations', () => {
  const bpmn = paletteFor('bpmn');
  assert.ok(bpmn.length >= 6);
  assert.ok(bpmn.reduce((sum, group) => sum + group.items.length, 0) > 35);
  const idef0 = paletteFor('idef0');
  assert.ok(idef0.reduce((sum, group) => sum + group.items.length, 0) >= 8);
  assert.equal(typeName('bpmn', 'userTask', 'ru'), 'Пользовательская задача');
});

test('BPMN connection rules', () => {
  const notation = getNotation('bpmn');
  const diagram = createDiagram({ notation: 'bpmn' });
  const start = createNode({ id: 'start', type: 'startEvent' });
  const task = createNode({ id: 'task', type: 'task' });
  const end = createNode({ id: 'end', type: 'endEvent' });
  const note = createNode({ id: 'note', type: 'textAnnotation' });
  const data = createNode({ id: 'data', type: 'dataObject' });
  diagram.nodes.push(start, task, end, note, data);

  assert.equal(notation.canConnect(diagram, start, task).ok, true);
  assert.equal(notation.canConnect(diagram, task, start).ok, false, 'start events take no incoming flow');
  assert.equal(notation.canConnect(diagram, end, task).ok, false, 'end events have no outgoing flow');
  assert.equal(notation.canConnect(diagram, task, task).ok, false, 'no self loops');
  assert.equal(notation.defaultEdgeType(diagram, task, note), 'association');
  assert.equal(notation.defaultEdgeType(diagram, task, data), 'dataAssociation');

  diagram.edges.push(createEdge({ id: 'f', type: 'sequenceFlow', source: 'start', target: 'task' }));
  assert.equal(notation.canConnect(diagram, start, task).ok, false, 'duplicate flows are refused');
});

test('BPMN pools separate sequence flow from message flow', () => {
  const notation = getNotation('bpmn');
  const diagram = createDiagram({ notation: 'bpmn' });
  const poolA = createNode({ id: 'poolA', type: 'pool', x: 0, y: 0, w: 400, h: 200 });
  const poolB = createNode({ id: 'poolB', type: 'pool', x: 0, y: 260, w: 400, h: 200 });
  const a = createNode({ id: 'a', type: 'task', parent: 'poolA' });
  const b = createNode({ id: 'b', type: 'task', parent: 'poolB' });
  diagram.nodes.push(poolA, poolB, a, b);
  assert.equal(notation.defaultEdgeType(diagram, a, b), 'messageFlow');
  assert.equal(notation.canConnect(diagram, a, b, 'sequenceFlow').ok, false);
  assert.equal(notation.canConnect(diagram, a, b, 'messageFlow').ok, true);
});

test('IDEF0 arrow roles follow the attachment side', () => {
  const notation = getNotation('idef0');
  assert.equal(IDEF0_EDGE_TYPES.idef0Input.targetSide, 'left');
  assert.equal(IDEF0_EDGE_TYPES.idef0Control.targetSide, 'top');
  assert.equal(IDEF0_EDGE_TYPES.idef0Mechanism.targetSide, 'bottom');
  assert.equal(IDEF0_EDGE_TYPES.idef0Output.sourceSide, 'right');
  const a = createNode({ id: 'a', type: 'idef0Function', x: 0, y: 0, w: 200, h: 100 });
  const b = createNode({ id: 'b', type: 'idef0Function', x: 400, y: 100, w: 200, h: 100 });
  const sides = notation.sidesFor('idef0Input', a, b);
  assert.equal(sides.targetSide, 'left');
});

test('IDEF0 numbering helpers', () => {
  const diagram = createDiagram({ notation: 'idef0' });
  diagram.nodes.push(createNode({ type: 'idef0Function', props: { number: 'A1' } }));
  assert.equal(nextNodeNumber(diagram, 'A0'), 'A2');
  diagram.nodes.push(createNode({ type: 'idef0Anchor', props: { icom: 'I1' } }));
  assert.equal(nextIcomCode(diagram, 'input'), 'I2');
  assert.equal(nextIcomCode(diagram, 'control'), 'C1');
});

test('BPMN validation finds the classic mistakes', () => {
  const doc = new Doc(createProject({}));
  const diagram = createDiagram({ notation: 'bpmn', name: 'P' });
  doc.addDiagram(diagram);
  diagram.nodes.push(createNode({ id: 'task', type: 'task', label: 'Задача' }));
  diagram.nodes.push(createNode({ id: 'gw', type: 'exclusiveGateway', label: 'Шлюз' }));
  const problems = validateBpmn(diagram, doc);
  const keys = problems.map((p) => p.messageKey);
  assert.includes(keys, 'noStart');
  assert.includes(keys, 'noEnd');
  assert.includes(keys, 'noOutgoing');
  assert.includes(keys, 'noIncoming');
  assert.ok(problems.every((p) => p.message.ru && p.message.en), 'problems are translated');
});

test('BPMN validation accepts a correct process', () => {
  const doc = new Doc(createProject({}));
  const diagram = createDiagram({ notation: 'bpmn', name: 'P' });
  doc.addDiagram(diagram);
  diagram.nodes.push(createNode({ id: 's', type: 'startEvent', label: 'Старт' }));
  diagram.nodes.push(createNode({ id: 't', type: 'userTask', label: 'Задача' }));
  diagram.nodes.push(createNode({ id: 'e', type: 'endEvent', label: 'Конец' }));
  diagram.edges.push(createEdge({ id: 'f1', type: 'sequenceFlow', source: 's', target: 't' }));
  diagram.edges.push(createEdge({ id: 'f2', type: 'sequenceFlow', source: 't', target: 'e' }));
  const problems = validateBpmn(diagram, doc).filter((p) => p.severity === 'error');
  assert.equal(problems.length, 0, JSON.stringify(problems.map((p) => p.messageKey)));
});

test('IDEF0 validation enforces control and output arrows', () => {
  const doc = new Doc(createProject({}));
  const diagram = createDiagram({ notation: 'idef0', name: 'A0' });
  doc.addDiagram(diagram);
  diagram.nodes.push(createNode({ id: 'f1', type: 'idef0Function', label: 'Функция', props: { number: 'A1' } }));
  const problems = validateIdef0(diagram, doc);
  const keys = problems.map((p) => p.messageKey);
  assert.includes(keys, 'noControl');
  assert.includes(keys, 'noOutput');
});

test('IDEF0 validation reports duplicated node numbers', () => {
  const doc = new Doc(createProject({}));
  const diagram = createDiagram({ notation: 'idef0', name: 'A0' });
  doc.addDiagram(diagram);
  diagram.nodes.push(createNode({ id: 'f1', type: 'idef0Function', props: { number: 'A1' } }));
  diagram.nodes.push(createNode({ id: 'f2', type: 'idef0Function', props: { number: 'A1' } }));
  const keys = validateIdef0(diagram, doc).map((p) => p.messageKey);
  assert.includes(keys, 'duplicateNumber');
});

test('text wrapping keeps words intact and respects the width', () => {
  const lines = wrapText('Проверить счёт поставщика и согласовать оплату', 110, 12);
  assert.ok(lines.length >= 2);
  for (const line of lines) assert.ok(measure(line, 12) <= 115, `line too long: ${line}`);
  assert.equal(wrapText('', 100, 12).length, 0);
});
