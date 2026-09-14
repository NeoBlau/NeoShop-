import { assert, test } from './harness.js';
import { createDiagram, createEdge, createNode } from '../app/core/model.js';
import { layoutEdges, orthogonalRoute, previewRoute, autoSides } from '../app/canvas/routing.js';
import { autoLayout, alignNodes, distributeNodes, equalizeSize, fitContainers, layeredLayout, idef0Layout } from '../app/layout/index.js';

function flowDiagram() {
  const diagram = createDiagram({ notation: 'bpmn', name: 'Flow' });
  const nodes = [
    ['s', 'startEvent', 36, 36],
    ['t1', 'task', 130, 84],
    ['gw', 'exclusiveGateway', 50, 50],
    ['t2', 'task', 130, 84],
    ['t3', 'task', 130, 84],
    ['e', 'endEvent', 36, 36],
  ];
  for (const [id, type, w, h] of nodes) diagram.nodes.push(createNode({ id, type, x: 0, y: 0, w, h }));
  for (const [id, source, target] of [
    ['f1', 's', 't1'], ['f2', 't1', 'gw'], ['f3', 'gw', 't2'], ['f4', 'gw', 't3'], ['f5', 't2', 'e'], ['f6', 't3', 'e'],
  ]) diagram.edges.push(createEdge({ id, type: 'sequenceFlow', source, target }));
  return diagram;
}

test('edges dock on the facing sides and produce a polyline', () => {
  const diagram = createDiagram({ notation: 'bpmn' });
  diagram.nodes.push(createNode({ id: 'a', type: 'task', x: 0, y: 0, w: 100, h: 60 }));
  diagram.nodes.push(createNode({ id: 'b', type: 'task', x: 300, y: 0, w: 100, h: 60 }));
  diagram.edges.push(createEdge({ id: 'e', type: 'sequenceFlow', source: 'a', target: 'b' }));
  const geometry = layoutEdges(diagram, {});
  const edge = geometry.get('e');
  assert.equal(edge.sourceSide, 'right');
  assert.equal(edge.targetSide, 'left');
  assert.equal(edge.points[0].x, 100);
  assert.equal(edge.points[edge.points.length - 1].x, 300);
  assert.ok(edge.labelPoint);
});

test('parallel edges between the same pair get separate anchors', () => {
  const diagram = createDiagram({ notation: 'bpmn' });
  diagram.nodes.push(createNode({ id: 'gw', type: 'exclusiveGateway', x: 0, y: 0, w: 50, h: 50 }));
  diagram.nodes.push(createNode({ id: 'a', type: 'task', x: 300, y: -80, w: 120, h: 70 }));
  diagram.nodes.push(createNode({ id: 'b', type: 'task', x: 300, y: 80, w: 120, h: 70 }));
  diagram.edges.push(createEdge({ id: 'e1', type: 'sequenceFlow', source: 'gw', target: 'a' }));
  diagram.edges.push(createEdge({ id: 'e2', type: 'sequenceFlow', source: 'gw', target: 'b' }));
  const geometry = layoutEdges(diagram, {});
  const first = geometry.get('e1').points[0];
  const second = geometry.get('e2').points[0];
  assert.ok(Math.abs(first.y - second.y) > 1 || Math.abs(first.x - second.x) > 1, 'anchors must not overlap');
});

test('manual waypoints are honoured', () => {
  const diagram = createDiagram({ notation: 'bpmn' });
  diagram.nodes.push(createNode({ id: 'a', type: 'task', x: 0, y: 0, w: 100, h: 60 }));
  diagram.nodes.push(createNode({ id: 'b', type: 'task', x: 300, y: 300, w: 100, h: 60 }));
  diagram.edges.push(
    createEdge({ id: 'e', type: 'sequenceFlow', source: 'a', target: 'b', routing: 'manual', waypoints: [{ x: 50, y: 250 }] })
  );
  const points = layoutEdges(diagram, {}).get('e').points;
  assert.ok(points.some((p) => p.x === 50 && p.y === 250));
});

test('orthogonal routing only produces axis-aligned segments', () => {
  const points = orthogonalRoute({ x: 100, y: 30 }, 'right', { x: 300, y: 200 }, 'left', { x: 0, y: 0, w: 100, h: 60 }, { x: 300, y: 170, w: 100, h: 60 });
  for (let i = 1; i < points.length; i++) {
    const dx = Math.abs(points[i].x - points[i - 1].x);
    const dy = Math.abs(points[i].y - points[i - 1].y);
    assert.ok(dx < 0.01 || dy < 0.01, 'segment is not orthogonal');
  }
});

test('preview route works without a target', () => {
  const points = previewRoute({ x: 0, y: 0, w: 100, h: 60 }, 'right', { x: 400, y: 200 }, null);
  assert.ok(points.length >= 2);
  assert.equal(points[points.length - 1].x, 400);
});

test('auto layout arranges a flow left to right with branches', () => {
  const diagram = flowDiagram();
  const changes = autoLayout(diagram);
  const position = new Map(changes.map((c) => [c.id, c]));
  for (const change of changes) Object.assign(diagram.nodes.find((n) => n.id === change.id), change);
  const x = (id) => diagram.nodes.find((n) => n.id === id).x;
  assert.ok(x('s') < x('t1'), 'start before the first task');
  assert.ok(x('t1') < x('gw'), 'task before the gateway');
  assert.ok(x('gw') < x('t2') && x('gw') < x('t3'), 'gateway before both branches');
  assert.ok(x('t2') < x('e') && x('t3') < x('e'), 'branches before the end');
  const y2 = diagram.nodes.find((n) => n.id === 't2').y;
  const y3 = diagram.nodes.find((n) => n.id === 't3').y;
  assert.ok(Math.abs(y2 - y3) > 60, 'branches are placed on separate rows');
  assert.ok(position.size >= 6);
});

test('auto layout never overlaps two nodes', () => {
  const diagram = flowDiagram();
  for (const change of autoLayout(diagram)) Object.assign(diagram.nodes.find((n) => n.id === change.id), change);
  const nodes = diagram.nodes;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      assert.ok(!overlap, `${a.id} overlaps ${b.id}`);
    }
  }
});

test('auto layout handles cycles without hanging', () => {
  const diagram = flowDiagram();
  diagram.edges.push(createEdge({ id: 'loop', type: 'sequenceFlow', source: 'e', target: 't1' }));
  const changes = autoLayout(diagram);
  assert.ok(changes.length > 0);
});

test('IDEF0 layout builds the staircase and places ICOM anchors', () => {
  const diagram = createDiagram({ notation: 'idef0', name: 'A0' });
  for (const [id, number] of [['a1', 'A1'], ['a2', 'A2'], ['a3', 'A3']]) {
    diagram.nodes.push(createNode({ id, type: 'idef0Function', w: 190, h: 110, props: { number } }));
  }
  diagram.nodes.push(createNode({ id: 'in', type: 'idef0Anchor', w: 110, h: 26 }));
  diagram.edges.push(createEdge({ id: 'e0', type: 'idef0Input', source: 'in', target: 'a1' }));
  diagram.edges.push(createEdge({ id: 'e1', type: 'idef0Input', source: 'a1', target: 'a2' }));
  diagram.edges.push(createEdge({ id: 'e2', type: 'idef0Input', source: 'a2', target: 'a3' }));
  const changes = idef0Layout(diagram);
  for (const change of changes) Object.assign(diagram.nodes.find((n) => n.id === change.id), change);
  const a1 = diagram.nodes.find((n) => n.id === 'a1');
  const a3 = diagram.nodes.find((n) => n.id === 'a3');
  assert.ok(a3.x > a1.x && a3.y > a1.y, 'boxes descend to the right');
  const anchor = diagram.nodes.find((n) => n.id === 'in');
  assert.ok(anchor.x < a1.x, 'input anchor sits left of the first box');
});

test('alignment and distribution', () => {
  const nodes = [
    createNode({ id: 'a', x: 0, y: 0, w: 100, h: 50 }),
    createNode({ id: 'b', x: 200, y: 30, w: 100, h: 50 }),
    createNode({ id: 'c', x: 500, y: 90, w: 100, h: 50 }),
  ];
  const aligned = alignNodes(nodes, 'top');
  assert.equal(aligned.length, 2);
  assert.ok(aligned.every((change) => change.y === 0));
  const distributed = distributeNodes(nodes, 'horizontal');
  assert.equal(distributed.length, 1);
  assert.equal(distributed[0].id, 'b');
  const sized = equalizeSize([{ ...nodes[0] }, { ...nodes[1], w: 60, h: 20 }]);
  assert.equal(sized[0].w, 100);
});

test('containers grow to fit their children', () => {
  const diagram = createDiagram({ notation: 'bpmn' });
  const pool = createNode({ id: 'pool', type: 'pool', x: 0, y: 0, w: 200, h: 120 });
  const task = createNode({ id: 'task', type: 'task', x: 150, y: 40, w: 130, h: 80, parent: 'pool' });
  diagram.nodes.push(pool, task);
  const changes = fitContainers(diagram);
  assert.equal(changes.length, 1);
  assert.ok(changes[0].w >= 280);
});
