import { assert, test } from './harness.js';
import { createDiagram, createEdge, createNode } from '../app/core/model.js';
import { analyzeProcess } from '../app/analysis/simulate.js';
import { formatDuration, formatMoney, toMinutes, edgeProbability, analysisSettings } from '../app/analysis/parameters.js';

function build(nodes, edges, analysis = {}) {
  const diagram = createDiagram({ notation: 'bpmn', name: 'Process' });
  diagram.meta.analysis = { currency: 'R$', volumePerYear: 1000, hoursPerFte: 1800, roles: [], ...analysis };
  for (const [id, type, label, props] of nodes) diagram.nodes.push(createNode({ id, type, label, props: props || {} }));
  for (const [id, source, target, props] of edges) {
    diagram.edges.push(createEdge({ id, type: 'sequenceFlow', source, target, props: props || {} }));
  }
  return diagram;
}

test('linear process: lead time, work time and cost add up', () => {
  const diagram = build(
    [
      ['s', 'startEvent', 'Start'],
      ['a', 'userTask', 'A', { duration: 30, resource: 'Analyst', cost: 100 }],
      ['b', 'serviceTask', 'B', { duration: 60, waitTime: 120, resource: 'System' }],
      ['e', 'endEvent', 'End'],
    ],
    [['f1', 's', 'a'], ['f2', 'a', 'b'], ['f3', 'b', 'e']],
    { roles: [{ id: 'Analyst', name: 'Analyst', rate: 120 }] }
  );
  const result = analyzeProcess(diagram);
  assert.equal(result.ok, true);
  assert.equal(result.totals.workMinutes, 90);
  assert.equal(result.totals.waitMinutes, 120);
  assert.equal(result.totals.leadExpected, 210, 'lead = 30 + 60 + 120 wait');
  assert.equal(result.totals.directCost, 100);
  assert.equal(result.totals.labourCost, 60, '30 min of a 120/h analyst');
  assert.equal(result.totals.costPerRun, 160);
});

test('exclusive gateway weights the branches by their share', () => {
  const diagram = build(
    [
      ['s', 'startEvent', 'Start'],
      ['g', 'exclusiveGateway', 'Paid?'],
      ['a', 'userTask', 'Ship', { duration: 100 }],
      ['b', 'userTask', 'Chase payment', { duration: 400 }],
      ['e', 'endEvent', 'End'],
      ['e2', 'endEvent', 'Cancelled'],
    ],
    [
      ['f1', 's', 'g'],
      ['f2', 'g', 'a', { probability: 80 }],
      ['f3', 'g', 'b', { probability: 20 }],
      ['f4', 'a', 'e'],
      ['f5', 'b', 'e2'],
    ]
  );
  const result = analyzeProcess(diagram);
  const runs = new Map(result.nodes.map((row) => [row.label, row.runs]));
  assert.equal(runs.get('Ship'), 0.8);
  assert.equal(runs.get('Chase payment'), 0.2);
  assert.equal(result.totals.workMinutes, 160, '0.8*100 + 0.2*400');
  assert.equal(result.totals.leadCritical, 400, 'critical path takes the slowest branch');
  assert.equal(result.totals.leadExpected, 160, 'expected lead weights the branches');
});

test('parallel branches run at the same time and the join passes one token', () => {
  const diagram = build(
    [
      ['s', 'startEvent', 'Start'],
      ['split', 'parallelGateway', 'Split'],
      ['a', 'userTask', 'A', { duration: 120 }],
      ['b', 'userTask', 'B', { duration: 45 }],
      ['join', 'parallelGateway', 'Join'],
      ['e', 'endEvent', 'End'],
    ],
    [
      ['f1', 's', 'split'],
      ['f2', 'split', 'a'],
      ['f3', 'split', 'b'],
      ['f4', 'a', 'join'],
      ['f5', 'b', 'join'],
      ['f6', 'join', 'e'],
    ]
  );
  const result = analyzeProcess(diagram);
  const runs = new Map(result.nodes.map((row) => [row.label, row.runs]));
  assert.equal(runs.get('Join'), 1, 'an AND join must not multiply tokens');
  assert.equal(runs.get('End'), 1);
  assert.equal(result.totals.workMinutes, 165, 'labour is the sum of both branches');
  assert.equal(result.totals.leadExpected, 120, 'lead time is the slowest branch');
  assert.equal(result.totals.laborPerLead, 1.38);
});

test('rework loop multiplies the executions and the lead time', () => {
  const diagram = build(
    [
      ['s', 'startEvent', 'Start'],
      ['a', 'userTask', 'Check', { duration: 30 }],
      ['g', 'exclusiveGateway', 'Correct?'],
      ['fix', 'userTask', 'Fix', { duration: 60 }],
      ['e', 'endEvent', 'End'],
    ],
    [
      ['f1', 's', 'a'],
      ['f2', 'a', 'g'],
      ['f3', 'g', 'e', { probability: 75 }],
      ['f4', 'g', 'fix', { probability: 25 }],
      ['f5', 'fix', 'a'],
    ]
  );
  const result = analyzeProcess(diagram);
  const runs = new Map(result.nodes.map((row) => [row.label, row.runs]));
  assert.close(runs.get('Check'), 1.333, 0.01, 'check runs 1/(1-0.25) times');
  assert.close(runs.get('Fix'), 0.333, 0.01);
  assert.ok(result.totals.reworkDelay > 0, 'rework shows up as extra lead time');
  assert.close(result.totals.workMinutes, 60, 0.5, '1.333*30 + 0.333*60');
});

test('resources roll up to hours, money and headcount', () => {
  const diagram = build(
    [
      ['s', 'startEvent', 'Start'],
      ['a', 'manualTask', 'Assemble', { duration: 120, resource: 'Operator', resourceQty: 2 }],
      ['b', 'userTask', 'Inspect', { duration: 30, resource: 'Inspector' }],
      ['e', 'endEvent', 'End'],
    ],
    [['f1', 's', 'a'], ['f2', 'a', 'b'], ['f3', 'b', 'e']],
    {
      volumePerYear: 12000,
      hoursPerFte: 1800,
      roles: [
        { id: 'Operator', name: 'Operator', rate: 45 },
        { id: 'Inspector', name: 'Inspector', rate: 80 },
      ],
    }
  );
  const result = analyzeProcess(diagram);
  const operator = result.resources.find((row) => row.role === 'Operator');
  assert.equal(operator.minutesPerRun, 240, '2 operators for 120 minutes');
  assert.equal(operator.hoursPerYear, 48000);
  assert.close(operator.fte, 26.67, 0.02);
  assert.equal(operator.costPerRun, 180, '2 h * 45 * 2 units');
  assert.equal(result.bottleneck.label, 'Assemble');
  assert.equal(result.annual.volume, 12000);
  assert.close(result.annual.fte, 16.67, 0.02, 'total labour hours / FTE hours');
});

test('data quality issues are reported, not silently ignored', () => {
  const diagram = build(
    [
      ['s', 'startEvent', 'Start'],
      ['g', 'exclusiveGateway', 'Split'],
      ['a', 'userTask', 'A', { duration: 10 }],
      ['b', 'userTask', 'B'],
      ['e', 'endEvent', 'End'],
    ],
    [
      ['f1', 's', 'g'],
      ['f2', 'g', 'a', { probability: 60 }],
      ['f3', 'g', 'b', { probability: 30 }],
      ['f4', 'a', 'e'],
      ['f5', 'b', 'e'],
    ]
  );
  const codes = analyzeProcess(diagram).issues.map((issue) => issue.code);
  assert.includes(codes, 'shareSum');
  assert.includes(codes, 'noDuration');
});

test('an IDEF0 or empty diagram analyses to nothing instead of throwing', () => {
  const idef0 = createDiagram({ notation: 'idef0', name: 'A0' });
  assert.equal(analyzeProcess(idef0).ok, false);
  assert.equal(analyzeProcess(null).ok, false);
  assert.equal(analyzeProcess(createDiagram({ notation: 'bpmn' })).ok, false);
});

test('parameter helpers', () => {
  assert.equal(toMinutes(2, 'h'), 120);
  assert.equal(toMinutes(1, 'd'), 480);
  assert.equal(formatDuration(90, 'ru'), '1.5 ч');
  assert.equal(formatMoney(40800000000, 'R$', 'ru'), 'R$ 40.8 млрд');
  assert.equal(edgeProbability({ props: { probability: 35 } }), 0.35);
  assert.equal(edgeProbability({ props: {} }), null);
  assert.equal(analysisSettings({ meta: { analysis: { currency: 'US$' } } }).currency, 'US$');
});

test('an unconnected end event does not become a second start', () => {
  const diagram = build(
    [
      ['s', 'startEvent', 'Start'],
      ['a', 'userTask', 'A', { duration: 60 }],
      ['e', 'endEvent', 'End'],
      ['orphan', 'endErrorEvent', 'Scrapped'],
    ],
    [['f1', 's', 'a'], ['f2', 'a', 'e']]
  );
  const result = analyzeProcess(diagram);
  const runs = new Map(result.nodes.map((row) => [row.label, row.runs]));
  assert.equal(runs.get('A'), 1, 'the live path still carries a full token');
  assert.equal(runs.get('Scrapped'), 0);
  assert.equal(result.totals.workMinutes, 60);
  assert.includes(result.issues.map((issue) => issue.code), 'unreachable');
});
