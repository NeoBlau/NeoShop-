import { assert, test } from './harness.js';
import { Doc, createDiagram, createEdge, createNode, createProject, normalizeProject } from '../app/core/model.js';
import { History } from '../app/core/history.js';
import { Selection } from '../app/core/selection.js';
import { Clipboard, extract, instantiate } from '../app/core/clipboard.js';
import { Settings } from '../app/core/settings.js';
import { dockPoint, facingSide, pointToSegment, roundedPath, simplify, snap, unionRect } from '../app/core/geometry.js';

function sampleDoc() {
  const doc = new Doc(createProject({ name: 'Test' }));
  const diagram = createDiagram({ notation: 'bpmn', name: 'P1' });
  doc.addDiagram(diagram);
  doc.addNode(diagram.id, createNode({ id: 'start', type: 'startEvent', x: 0, y: 0, w: 36, h: 36 }));
  doc.addNode(diagram.id, createNode({ id: 'task', type: 'task', x: 200, y: 0, w: 130, h: 80 }));
  doc.addEdge(diagram.id, createEdge({ id: 'flow', type: 'sequenceFlow', source: 'start', target: 'task' }));
  return { doc, diagram };
}

test('project and diagram creation', () => {
  const { doc, diagram } = sampleDoc();
  assert.equal(doc.project.diagrams.length, 1);
  assert.equal(doc.diagram(diagram.id).nodes.length, 2);
  assert.equal(doc.stats().edges, 1);
  assert.ok(doc.node(diagram.id, 'task'));
  assert.equal(doc.edgesOf(diagram.id, 'task').length, 1);
});

test('node removal detaches its edges via the app-level flow', () => {
  const { doc, diagram } = sampleDoc();
  for (const edge of doc.edgesOf(diagram.id, 'task')) doc.removeEdge(diagram.id, edge.id);
  doc.removeNode(diagram.id, 'task');
  assert.equal(doc.diagram(diagram.id).nodes.length, 1);
  assert.equal(doc.diagram(diagram.id).edges.length, 0);
});

test('undo and redo restore the model exactly', () => {
  const { doc, diagram } = sampleDoc();
  const history = new History(doc);
  history.run('add', diagram.id, (d) => d.addNode(diagram.id, createNode({ id: 'extra', x: 10, y: 10 })));
  assert.equal(doc.diagram(diagram.id).nodes.length, 3);
  history.undo();
  assert.equal(doc.diagram(diagram.id).nodes.length, 2);
  history.redo();
  assert.equal(doc.diagram(diagram.id).nodes.length, 3);
  assert.equal(doc.node(diagram.id, 'extra').x, 10);
});

test('live transactions (drag) become one undo step', () => {
  const { doc, diagram } = sampleDoc();
  const history = new History(doc);
  const token = history.beginLive('move', diagram.id);
  doc.node(diagram.id, 'task').x = 500;
  doc.node(diagram.id, 'task').y = 120;
  history.commitLive(token);
  assert.equal(doc.node(diagram.id, 'task').x, 500);
  history.undo();
  assert.equal(doc.node(diagram.id, 'task').x, 200);
  assert.equal(doc.node(diagram.id, 'task').y, 0);
});

test('history reports dirty state and save points', () => {
  const { doc, diagram } = sampleDoc();
  const history = new History(doc);
  history.markSaved();
  assert.equal(history.isDirty, false);
  history.run('add', diagram.id, (d) => d.addNode(diagram.id, createNode({ id: 'x' })));
  assert.equal(history.isDirty, true);
  history.undo();
  assert.equal(history.isDirty, false);
});

test('a failing mutation rolls back instead of corrupting the model', () => {
  const { doc, diagram } = sampleDoc();
  const history = new History(doc);
  assert.throws(() =>
    history.run('bad', diagram.id, (d) => {
      d.addNode(diagram.id, createNode({ id: 'half' }));
      throw new Error('boom');
    })
  );
  assert.equal(doc.diagram(diagram.id).nodes.length, 2);
  assert.equal(history.canUndo, false);
});

test('selection emits changes and keeps a primary item', () => {
  const selection = new Selection();
  let events = 0;
  selection.on('change', () => events++);
  selection.set(['a', 'b']);
  selection.add('c');
  selection.toggle('a');
  assert.equal(selection.size, 2);
  assert.equal(events, 3);
  selection.set(['b', 'c']);
  assert.equal(events, 3, 'setting the same selection must not emit');
});

test('clipboard copies a sub-graph with fresh ids', () => {
  const { doc, diagram } = sampleDoc();
  const payload = extract(doc.diagram(diagram.id), ['start', 'task']);
  assert.equal(payload.nodes.length, 2);
  assert.equal(payload.edges.length, 1);
  const { nodes, edges } = instantiate(payload, { dx: 40, dy: 0 });
  assert.equal(nodes[0].id === 'start', false);
  assert.equal(nodes[0].x, 40);
  assert.equal(edges[0].source, nodes[0].id);
  const clipboard = new Clipboard();
  clipboard.set(payload);
  assert.equal(clipboard.isEmpty, false);
});

test('project normalisation repairs partial data', () => {
  const project = normalizeProject({
    name: 'Broken',
    diagrams: [{ id: 'd1', notation: 'bpmn', nodes: [{ id: 'a' }], edges: [{ id: 'e', source: 'a', target: 'missing' }] }],
  });
  assert.equal(project.diagrams[0].edges.length, 0, 'edges to missing nodes are dropped');
  assert.equal(project.diagrams[0].nodes[0].type, 'task');
});

test('settings store and restore nested values', () => {
  const memory = new Map();
  const storage = { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v), removeItem: (k) => memory.delete(k) };
  const settings = new Settings(storage);
  settings.set('canvas.gridSize', 25);
  assert.equal(settings.get('canvas.gridSize'), 25);
  const reloaded = new Settings(storage);
  assert.equal(reloaded.get('canvas.gridSize'), 25);
  assert.equal(reloaded.get('canvas.grid'), true, 'defaults survive');
});

test('geometry helpers', () => {
  assert.equal(snap(23, 10), 20);
  assert.deepEqual(unionRect([{ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 5, w: 10, h: 10 }]), { x: 0, y: 0, w: 30, h: 15 });
  assert.equal(facingSide({ x: 0, y: 0, w: 100, h: 50 }, { x: 200, y: 25 }), 'right');
  const dock = dockPoint({ x: 0, y: 0, w: 100, h: 100 }, { x: 200, y: 50 });
  assert.equal(Math.round(dock.x), 100);
  assert.close(pointToSegment({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 10, y: 0 }).dist, 5);
  assert.equal(simplify([{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }]).length, 2, 'collinear points are removed');
  assert.includes(roundedPath([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]), 'Q');
});
