import { assert, test } from './harness.js';
import {
  WEG_AS_IS,
  WEG_FOLDER,
  WEG_PROCESSES,
  WEG_TO_BE,
  buildWegDiagrams,
  createWegProject,
  localizeSpec,
  wegFolder,
} from '../app/library/weg/index.js';
import { compareProcesses, completionShare } from '../app/analysis/compare.js';
import { ROLE_LABELS, WEG, WEG_SOURCES, roleLabel } from '../app/library/weg/facts.js';
import { validateBpmn } from '../app/notations/bpmn/validate.js';
import { analyzeProcess } from '../app/analysis/simulate.js';
import { hasAnalysisData } from '../app/analysis/parameters.js';
import { normalizeProject } from '../app/core/model.js';

const docStub = (project) => ({
  project,
  diagram: (id) => project.diagrams.find((d) => d.id === id) || null,
  childDiagrams: () => [],
});

test('the library ships eight processes in a current and a target version', () => {
  assert.equal(WEG_AS_IS.length, 8, 'eight as-is processes');
  assert.equal(WEG_TO_BE.length, 8, 'eight to-be processes');
  assert.equal(WEG_PROCESSES.length, 16, 'sixteen models in total');
  for (const list of [WEG_AS_IS, WEG_TO_BE]) {
    assert.deepEqual(list.map((p) => p.order), [1, 2, 3, 4, 5, 6, 7, 8], 'processes are ordered 1..8');
  }
  for (const process of WEG_AS_IS) assert.equal(process.variant, 'as-is', `${process.id} is the current state`);
  for (const process of WEG_TO_BE) {
    assert.equal(process.variant, 'to-be', `${process.id} is the target state`);
    const baseline = WEG_AS_IS.find((item) => item.id === process.baselineId);
    assert.ok(baseline, `${process.id} names an existing baseline`);
    assert.equal(baseline.order, process.order, `${process.id} pairs with the same numbered process`);
    assert.equal(
      baseline.analysis.volumePerYear,
      process.analysis.volumePerYear,
      `${process.id} keeps the same annual volume as its baseline`
    );
  }
  const ids = new Set(WEG_PROCESSES.map((p) => p.id));
  assert.equal(ids.size, 16, 'process identifiers are unique');
  for (const process of WEG_PROCESSES) {
    assert.ok(process.name.ru && process.name.en, `${process.id} is named in both languages`);
    assert.ok(process.description.ru && process.description.en, `${process.id} is described in both languages`);
    assert.equal(process.spec.notation, 'bpmn', `${process.id} is a BPMN model`);
  }
});

test('every specification is internally consistent', () => {
  for (const process of WEG_PROCESSES) {
    const { nodes, edges, lanes } = process.spec;
    const ids = new Set();
    const laneIds = new Set(lanes.map((lane) => lane.id));
    for (const node of nodes) {
      assert.ok(!ids.has(node.id), `${process.id}: duplicate node id ${node.id}`);
      ids.add(node.id);
      assert.ok(node.label.ru && node.label.en, `${process.id}/${node.id} is labelled in both languages`);
      assert.ok(laneIds.has(node.lane), `${process.id}/${node.id} sits in a declared lane`);
    }
    for (const edge of edges) {
      assert.ok(ids.has(edge.source), `${process.id}: edge from unknown ${edge.source}`);
      assert.ok(ids.has(edge.target), `${process.id}: edge to unknown ${edge.target}`);
    }
    assert.ok(nodes.length >= 25, `${process.id} is detailed enough (${nodes.length} elements)`);
  }
});

test('every parameter declares where its value comes from', () => {
  const allowed = new Set(['report', 'derived', 'assumption']);
  for (const process of WEG_PROCESSES) {
    for (const node of process.spec.nodes) {
      const props = node.props || {};
      const carriesNumbers =
        props.duration !== undefined || props.waitTime !== undefined || props.cost !== undefined;
      if (!carriesNumbers) continue;
      assert.ok(allowed.has(props.dataSource), `${process.id}/${node.id} tags its data source`);
      if (props.resource !== undefined) {
        assert.ok(ROLE_LABELS[props.resource], `${process.id}/${node.id}: role "${props.resource}" is translatable`);
      }
    }
  }
});

test('roles used by the steps are priced in the diagram settings', () => {
  for (const process of WEG_PROCESSES) {
    const priced = new Set((process.analysis.roles || []).map((role) => role.name));
    for (const node of process.spec.nodes) {
      const role = node.props?.resource;
      if (!role) continue;
      assert.ok(priced.has(role), `${process.id}: role "${role}" has an hourly rate`);
    }
    for (const role of process.analysis.roles) assert.ok(role.rate > 0, `${process.id}: ${role.name} has a rate`);
    assert.ok(process.analysis.volumePerYear > 0, `${process.id} declares an annual volume`);
  }
});

test('branch shares of a split add up to 100%', () => {
  for (const process of WEG_PROCESSES) {
    const outgoing = new Map();
    for (const edge of process.spec.edges) {
      if (edge.type && edge.type !== 'sequenceFlow') continue;
      if (!outgoing.has(edge.source)) outgoing.set(edge.source, []);
      outgoing.get(edge.source).push(edge);
    }
    for (const [source, flows] of outgoing) {
      if (flows.length < 2) continue;
      const node = process.spec.nodes.find((n) => n.id === source);
      if (node?.type !== 'exclusiveGateway' && node?.type !== 'inclusiveGateway') continue;
      const sum = flows.reduce((total, edge) => total + (edge.props?.probability ?? 0), 0);
      assert.close(sum, 100, 0.01, `${process.id}/${source}: branch shares`);
    }
  }
});

test('documentation cites the public sources it relies on', () => {
  const known = WEG_SOURCES.map((item) => item.url);
  for (const process of WEG_PROCESSES) {
    for (const locale of ['ru', 'en']) {
      const text = process.documentation[locale];
      assert.ok(text && text.length > 400, `${process.id}/${locale}: documentation is substantial`);
      assert.ok(
        known.some((url) => text.includes(url)),
        `${process.id}/${locale}: documentation links a known source`
      );
    }
  }
});

test('all sixteen diagrams build, land in the WEG folders and pass BPMN validation', () => {
  for (const locale of ['ru', 'en']) {
    const project = createWegProject(locale);
    assert.equal(project.diagrams.length, 16, 'sixteen diagrams');
    const doc = docStub(project);
    for (const diagram of project.diagrams) {
      assert.equal(diagram.meta.folder, wegFolder(diagram.meta.variant, locale), `${diagram.name}: variant folder`);
      assert.ok(diagram.meta.folder.startsWith(`${WEG_FOLDER}/`), `${diagram.name}: nested under WEG`);
      assert.equal(diagram.meta.library, 'weg', `${diagram.name}: marked as library content`);
      assert.ok(diagram.meta.documentation.length > 400, `${diagram.name}: documentation travels with the diagram`);
      assert.ok(
        diagram.nodes.some((node) => node.type === 'pool') && diagram.nodes.some((node) => node.type === 'lane'),
        `${diagram.name}: has a pool with lanes`
      );
      const errors = validateBpmn(diagram, doc).filter((problem) => problem.severity === 'error');
      assert.equal(errors.length, 0, `${diagram.name}: ${errors.map((e) => e.messageKey).join(', ')}`);
    }
  }
});

test('every diagram lays its elements out without overlaps inside the lanes', () => {
  for (const diagram of buildWegDiagrams('ru')) {
    const lanes = diagram.nodes.filter((node) => node.type === 'lane');
    for (const node of diagram.nodes) {
      if (!node.parent) continue;
      const lane = lanes.find((item) => item.id === node.parent);
      if (!lane) continue;
      assert.ok(node.y >= lane.y - 1, `${diagram.name}/${node.label}: below the lane top`);
      assert.ok(node.y + node.h <= lane.y + lane.h + 1, `${diagram.name}/${node.label}: inside the lane bottom`);
    }
  }
});

test('every diagram produces a calculation, not an empty report', () => {
  for (const diagram of buildWegDiagrams('ru')) {
    const result = analyzeProcess(diagram);
    assert.ok(result.ok, `${diagram.name}: analysis ran`);
    assert.ok(result.totals.steps >= 10, `${diagram.name}: ${result.totals.steps} steps counted`);
    assert.ok(result.totals.workMinutes > 0, `${diagram.name}: work time`);
    assert.ok(result.totals.leadExpected >= result.totals.workMinutes, `${diagram.name}: lead time covers the work`);
    assert.ok(result.totals.leadCritical >= result.totals.leadExpected - 1, `${diagram.name}: critical path is the longest`);
    assert.ok(result.totals.costPerRun > 0, `${diagram.name}: cost per instance`);
    assert.ok(result.annual.cost > 0 && result.annual.fte > 0, `${diagram.name}: annual demand`);
    assert.ok(result.bottleneck && result.bottleneck.label, `${diagram.name}: bottleneck found`);
    assert.ok(result.resources.length > 0, `${diagram.name}: resource table`);
    assert.equal(result.issues.length, 0, `${diagram.name}: ${result.issues.map((i) => i.key || i.kind).join(', ')}`);
    assert.ok(hasAnalysisData(diagram), `${diagram.name}: steps carry parameters`);
  }
});

test('the models sum up to a plausible share of the reported business', () => {
  const diagrams = buildWegDiagrams('ru');
  const byId = new Map(diagrams.map((diagram) => [diagram.meta.processId, diagram]));
  const motors = analyzeProcess(byId.get('weg-make-motor'));
  assert.equal(motors.settings.volumePerYear, WEG.motorsPerYear, 'manufacturing runs the reported motor volume');
  const totalFte = diagrams
    .filter((diagram) => diagram.meta.variant === 'as-is')
    .reduce((sum, diagram) => sum + analyzeProcess(diagram).annual.fte, 0);
  assert.ok(totalFte > 1000, `modelled workforce demand is meaningful (${Math.round(totalFte)} FTE)`);
  assert.ok(totalFte < WEG.employees * 1.5, `modelled workforce stays in the order of the reported headcount (${Math.round(totalFte)} FTE)`);
});

test('localisation resolves both languages down to plain strings', () => {
  const process = WEG_PROCESSES[0];
  for (const locale of ['ru', 'en']) {
    const spec = localizeSpec(process.spec, locale);
    assert.equal(typeof spec.name, 'string', 'name is a string');
    for (const lane of spec.lanes) assert.equal(typeof lane.label, 'string', 'lane label is a string');
    for (const node of spec.nodes) {
      assert.equal(typeof node.label, 'string', 'node label is a string');
      for (const value of Object.values(node.props)) {
        assert.ok(typeof value !== 'object' || value === null, 'no bilingual leftovers in props');
      }
    }
  }
  const russian = localizeSpec(process.spec, 'ru');
  const english = localizeSpec(process.spec, 'en');
  assert.ok(russian.name !== english.name, 'the two languages differ');
  assert.equal(roleLabel('Логист', 'en'), 'Logistics', 'roles are translated');
  assert.equal(roleLabel('Логист', 'ru'), 'Логист', 'roles keep their Russian name');
  assert.equal(roleLabel('Неизвестная роль', 'en'), 'Неизвестная роль', 'unknown roles pass through');
});

test('the library survives a save / load round trip', () => {
  const project = createWegProject('ru');
  const restored = normalizeProject(JSON.parse(JSON.stringify(project)));
  assert.equal(restored.diagrams.length, 16, 'diagrams survive');
  for (let i = 0; i < restored.diagrams.length; i++) {
    const before = project.diagrams[i];
    const after = restored.diagrams[i];
    assert.ok(after.meta.folder.startsWith(`${WEG_FOLDER}/`), 'folder survives');
    assert.equal(after.meta.variant, before.meta.variant, 'variant survives');
    assert.equal(after.nodes.length, before.nodes.length, 'node count survives');
    assert.equal(after.edges.length, before.edges.length, 'edge count survives');
    assert.deepEqual(after.meta.analysis, before.meta.analysis, 'analysis settings survive');
    const a = analyzeProcess(before);
    const b = analyzeProcess(after);
    assert.close(b.totals.costPerRun, a.totals.costPerRun, 0.01, 'cost survives');
    assert.close(b.totals.leadExpected, a.totals.leadExpected, 0.01, 'lead time survives');
  }
});


test('every target model is paired with its baseline and is measurably better', () => {
  const diagrams = buildWegDiagrams('ru');
  const byId = new Map(diagrams.map((diagram) => [diagram.meta.processId, diagram]));
  const targets = diagrams.filter((diagram) => diagram.meta.variant === 'to-be');
  assert.equal(targets.length, 8, 'eight target models');
  for (const target of targets) {
    const baseline = byId.get(target.meta.baselineId);
    assert.ok(baseline, `${target.name}: baseline present in the project`);
    const comparison = compareProcesses(baseline, target);
    assert.ok(comparison, `${target.name}: comparison computed`);

    const by = Object.fromEntries(comparison.rows.map((row) => [row.key, row]));
    assert.ok(by.lead.to < by.lead.from, `${target.name}: lead time improves`);
    assert.ok(by.work.to < by.work.from, `${target.name}: work per case improves`);
    assert.ok(by.fte.to < by.fte.from, `${target.name}: resource demand improves`);
    // cost per *started* case may rise when fewer cases are rejected late, but
    // the cost of actually finishing one must always come down
    assert.ok(
      by.costPerCompletion.to < by.costPerCompletion.from,
      `${target.name}: cost per completed case improves (${by.costPerCompletion.from} -> ${by.costPerCompletion.to})`
    );
    assert.ok(comparison.completion.to > 0 && comparison.completion.to <= 1.0001, `${target.name}: completion share is a share`);
  }
});

test('the target documentation carries the computed comparison', () => {
  for (const locale of ['ru', 'en']) {
    const diagrams = buildWegDiagrams(locale);
    for (const diagram of diagrams) {
      const hasTable = diagram.meta.documentation.includes('|---|---|---|---|');
      if (diagram.meta.variant === 'to-be') {
        assert.ok(hasTable, `${diagram.name}: comparison table present`);
        assert.ok(
          diagram.meta.documentation.includes('%'),
          `${diagram.name}: comparison carries the deltas`
        );
      } else {
        assert.ok(!hasTable, `${diagram.name}: baseline has no comparison table`);
      }
    }
  }
});

test('completion share counts only the end events marked as successful', () => {
  const diagrams = buildWegDiagrams('ru');
  for (const diagram of diagrams) {
    const marked = diagram.nodes.filter((node) => node.props?.completes);
    assert.ok(marked.length > 0, `${diagram.name}: a successful end is marked`);
    for (const node of marked) {
      assert.ok(/^end/i.test(node.type), `${diagram.name}: only end events are marked (${node.type})`);
    }
    const share = completionShare(diagram, analyzeProcess(diagram));
    assert.ok(share > 0.1 && share <= 1.0001, `${diagram.name}: completion share ${share} is plausible`);
  }
});


test('no two elements of a diagram overlap on the canvas', () => {
  const containers = new Set(['pool', 'lane', 'group']);
  for (const locale of ['ru', 'en']) {
    for (const diagram of buildWegDiagrams(locale)) {
      const boxes = diagram.nodes
        .filter((node) => !containers.has(node.type))
        .map((node) => ({ id: node.id, label: node.label, x: node.x, y: node.y, w: node.w, h: node.h }));
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i];
          const b = boxes[j];
          const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
          const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
          assert.ok(
            overlapX <= 0 || overlapY <= 0,
            `${diagram.name}: “${a.label}” overlaps “${b.label}” by ${Math.round(overlapX)}x${Math.round(overlapY)}`
          );
        }
      }
    }
  }
});
