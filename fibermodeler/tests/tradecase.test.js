import { assert, test } from './harness.js';
import { buildTradecaseDiagrams, TRADECASE_COUNT, TRADECASE_FOLDER } from '../app/library/tradecase/index.js';
import { DIAGNOSIS, CHANGES, SCENARIOS } from '../app/library/tradecase/sheets.js';
import { validateBpmn } from '../app/notations/bpmn/validate.js';
import { validateSheet } from '../app/notations/sheet/validate.js';
import { buildBpmnDiagram } from '../app/ai/schema.js';
import { exportBpmnXml, importBpmnXml } from '../app/io/bpmn.js';
import { SOURCE_SPEC } from '../app/library/tradecase/models.js';

const cyrillic = /[А-Яа-яЁё]/;
const overlaps = (a, b) => a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;
const keys = (diagram) => validateBpmn(diagram).map((p) => p.messageKey);

test('the case holds three BPMN models and four sheets in one folder, in both languages', () => {
  assert.equal(TRADECASE_COUNT, 7, 'seven items');
  for (const locale of ['ru', 'en']) {
    const diagrams = buildTradecaseDiagrams(locale);
    assert.equal(diagrams.length, 7, 'all built');
    assert.equal(diagrams.filter((d) => d.notation === 'bpmn').length, 3, 'three models');
    assert.equal(diagrams.filter((d) => d.notation === 'sheet').length, 4, 'four sheets');
    assert.ok(diagrams.every((d) => d.meta.library === 'tradecase' && d.meta.folder === TRADECASE_FOLDER[locale]), 'one folder');
    assert.equal(new Set(diagrams.map((d) => d.meta.processId)).size, 7, 'identifiers are unique');
    if (locale === 'en') {
      for (const d of diagrams) {
        assert.ok(!cyrillic.test(d.name + d.meta.documentation + d.meta.description), `${d.name}: metadata is translated`);
        for (const node of d.nodes) assert.ok(!cyrillic.test(`${node.label} ${Object.values(node.props || {}).join(' ')}`), `${d.name}: "${(node.label || '').slice(0, 40)}" is translated`);
        for (const edge of d.edges) assert.ok(!cyrillic.test(edge.label || ''), `${d.name}: edge labels are translated`);
      }
    }
  }
});

test('the program\'s own check finds the notation mistakes of the source model and none in the corrected ones', () => {
  const [source, asis, tobe] = buildTradecaseDiagrams('ru');
  const found = keys(source);
  assert.ok(found.includes('sequenceCrossPool'), 'a sequence flow between pools');
  assert.ok(found.includes('messageSamePool'), 'a message flow inside a pool');
  assert.ok(found.includes('gatewayMismatch'), 'an exclusive split closed by a parallel join');
  assert.ok(found.includes('noOutgoing') && found.includes('noIncoming'), 'the missing sequence flows that follow');
  assert.equal(keys(asis).length, 0, 'the corrected AS-IS has no problems');
  assert.equal(keys(tobe).length, 0, 'the TO-BE has no problems');
  assert.ok(source.meta.documentation.includes('Поток управления «'), 'the documentation quotes what the check found');
});

test('the corrected AS-IS has two pools, six message flows and the three outcomes on each side', () => {
  for (const locale of ['ru', 'en']) {
    const [, asis, tobe] = buildTradecaseDiagrams(locale);
    for (const diagram of [asis, tobe]) {
      assert.equal(diagram.nodes.filter((n) => n.type === 'pool').length, 2, 'the customer and the company');
      assert.equal(diagram.edges.filter((e) => e.type === 'messageFlow').length, 6, 'six message flows');
      const ends = diagram.nodes.filter((n) => n.type === 'endEvent');
      assert.equal(ends.length, 6, 'three company ends and three customer ends');
      assert.equal(diagram.nodes.filter((n) => n.type === 'parallelGateway').length, 0, 'no parallel gateway: nothing runs in parallel');
      const timer = diagram.nodes.filter((n) => n.type === 'intermediateTimerEvent');
      assert.equal(timer.length, 1, 'one timer: the payment term');
      assert.ok(/3/.test(timer[0].label), 'it is the three working days');
      assert.equal(diagram.meta.analysis, undefined, 'no numeric parameters: the task forbids calculating effects without data');
    }
    const lanes = (diagram) => diagram.nodes.filter((n) => n.type === 'lane').map((n) => n.label);
    assert.equal(lanes(asis).length, 3, 'manager, warehouse, accounting');
    assert.equal(lanes(tobe).length, 4, 'and the configured system in the TO-BE');
  }
});

test('shipping comes before closing, and the order is cancelled when the goods are missing or unpaid', () => {
  const [, asis, tobe] = buildTradecaseDiagrams('en');
  const next = (diagram, from, to) => {
    const as = diagram.nodes.filter((n) => n.label === from).map((n) => n.id);
    const bs = diagram.nodes.filter((n) => n.label === to).map((n) => n.id);
    return diagram.edges.some((e) => e.type === 'sequenceFlow' && as.includes(e.source) && bs.includes(e.target));
  };
  assert.ok(next(asis, 'Ship the goods', 'Tell the customer the order is fulfilled'), 'shipping is followed by the notice');
  assert.ok(next(asis, 'Tell the customer the order is fulfilled', 'Close the order'), 'which is followed by closing');
  assert.ok(next(asis, 'Notify the customer that the goods are out of stock', 'Cancel the order'), 'the notice about missing goods is followed by cancelling');
  assert.ok(next(asis, '3 working days have passed', 'Cancel the order'), 'the timer is followed by cancelling');
  assert.ok(next(tobe, 'Cancel the order and release the reserve', 'Notify the customer of the cancellation automatically'), 'the TO-BE releases the reserve on non-payment');
  assert.ok(tobe.nodes.some((n) => n.label === 'Check the stock and reserve the goods for the payment term'), 'the TO-BE reserves the goods');
});

test('no element leaves its pool or lane, and none overlaps', () => {
  for (const diagram of buildTradecaseDiagrams('ru').filter((d) => d.notation === 'bpmn')) {
    const containers = diagram.nodes.filter((n) => n.type === 'lane' || n.type === 'pool');
    const boxes = diagram.nodes.filter((n) => !['pool', 'lane'].includes(n.type));
    for (const node of boxes) {
      const parent = containers.find((c) => c.id === node.parent);
      assert.ok(parent, `${diagram.name}: "${node.label}" belongs to a lane or a pool`);
      assert.ok(node.y >= parent.y - 1 && node.y + node.h <= parent.y + parent.h + 1, `${diagram.name}: "${node.label}" stays inside`);
      assert.ok(node.x >= parent.x - 1 && node.x + node.w <= parent.x + parent.w + 1, `${diagram.name}: "${node.label}" stays inside horizontally`);
    }
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) assert.ok(!overlaps(boxes[i], boxes[j]), `${diagram.name}: "${boxes[i].label}" overlaps "${boxes[j].label}"`);
    const pools = diagram.nodes.filter((n) => n.type === 'pool');
    for (let i = 0; i < pools.length; i++) for (let j = i + 1; j < pools.length; j++) assert.ok(!overlaps(pools[i], pools[j]), `${diagram.name}: pools do not overlap`);
  }
});

test('the diagnosis, the reasoning and the scenarios are complete tables', () => {
  assert.equal(DIAGNOSIS.length, 11, 'eleven remarks');
  assert.equal(CHANGES.length, 4, 'four changes: the task asks for at least three');
  assert.equal(SCENARIOS.length, 3, 'the three scenarios of the task');
  for (const row of DIAGNOSIS) for (const key of ['fragment', 'error', 'effect', 'fix']) assert.ok(row[key].ru.length > 30 && row[key].en.length > 30, `a remark has its ${key}`);
  for (const row of CHANGES) for (const key of ['problem', 'change', 'bpmn', 'result', 'indicator']) assert.ok(row[key].ru.length > 30 && row[key].en.length > 30, `a change has its ${key}`);
  for (const row of CHANGES) assert.ok(!/\d+\s?%/.test(row.result.ru + row.indicator.ru + row.result.en + row.indicator.en), 'no numeric effect is claimed');
  const diagrams = buildTradecaseDiagrams('ru').filter((d) => d.notation === 'sheet');
  const complete = diagrams.filter((d) => validateSheet(d).filter((p) => p.severity !== 'info').length === 0);
  assert.equal(complete.length, 3, 'the three tables are complete');
  const report = diagrams.find((d) => d.meta.processId === 'case-order-report');
  assert.deepEqual(validateSheet(report).map((p) => p.messageKey), ['answerEmpty'], 'only the group composition is left for the group to fill in');
});

test('the models export to BPMN 2.0 XML and read back with pools, lanes and message flows', () => {
  const [, asis] = buildTradecaseDiagrams('en');
  const xml = exportBpmnXml(asis);
  assert.ok(xml.includes('<bpmn:participant') || xml.includes('participant'), 'the pools are participants');
  assert.ok(xml.includes('messageFlow'), 'the message flows are exported');
  const { diagram: imported } = importBpmnXml(xml);
  assert.ok(imported.nodes.filter((n) => n.type === 'pool').length >= 2, 'the pools survive');
  assert.equal(imported.edges.filter((e) => e.type === 'messageFlow').length, 6, 'the message flows survive');
});

test('a single-pool diagram built the old way is unchanged by the multi-pool layout', () => {
  const diagram = buildBpmnDiagram({
    notation: 'bpmn',
    lanes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
    poolLabel: 'P',
    nodes: [
      { id: 's', type: 'startEvent', label: 'Start', lane: 'a' },
      { id: 't', type: 'task', label: 'Do', lane: 'b' },
      { id: 'e', type: 'endEvent', label: 'End', lane: 'a' },
    ],
    edges: [{ source: 's', target: 't' }, { source: 't', target: 'e' }],
  }, { locale: 'en' });
  assert.equal(diagram.nodes.filter((n) => n.type === 'pool').length, 1, 'one pool');
  assert.equal(diagram.nodes.filter((n) => n.type === 'lane').length, 2, 'two lanes');
  assert.equal(validateBpmn(diagram).length, 0, 'valid');
  assert.ok(SOURCE_SPEC.pools.length === 2, 'the case uses the new pools field');
});
