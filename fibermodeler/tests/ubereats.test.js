import { assert, test } from './harness.js';
import {
  UBER_AS_IS,
  UBER_FOLDER,
  UBER_PROCESSES,
  UBER_TO_BE,
  buildUberDiagrams,
  uberFolder,
} from '../app/library/ubereats/index.js';
import { ROLE_NAMES, roleLabel } from '../app/library/ubereats/facts.js';
import {
  LIBRARY_IDS,
  buildAllLibraryDiagrams,
  createLibrariesProject,
  isLibraryDiagram,
} from '../app/library/index.js';
import { validateBpmn } from '../app/notations/bpmn/validate.js';
import { analyzeProcess } from '../app/analysis/simulate.js';
import { compareProcesses, completionShare } from '../app/analysis/compare.js';
import { normalizeProject } from '../app/core/model.js';

const [asIs] = UBER_AS_IS;
const [toBe] = UBER_TO_BE;
const GATEWAYS_WITH_SHARES = ['exclusiveGateway', 'inclusiveGateway', 'eventBasedGateway'];
const docStub = (project) => ({
  project,
  diagram: (id) => project.diagrams.find((d) => d.id === id) || null,
  childDiagrams: () => [],
});
const specNode = (process, id) => process.spec.nodes.find((n) => n.id === id);

test('Uber Eats ships the order process in a current and a target version', () => {
  assert.equal(UBER_PROCESSES.length, 2, 'two models');
  assert.equal(asIs.variant, 'as-is', 'the first is the current state');
  assert.equal(toBe.variant, 'to-be', 'the second is the target state');
  assert.equal(toBe.baselineId, asIs.id, 'the target names its baseline');
  assert.equal(asIs.analysis.volumePerYear, toBe.analysis.volumePerYear, 'the same annual volume on both sides');
  assert.equal(asIs.analysis.currency, 'AED', 'priced in dirhams');
  assert.deepEqual(asIs.analysis.roles, toBe.analysis.roles, 'the same rate card, so the comparison is fair');
  for (const process of UBER_PROCESSES) {
    assert.ok(process.name.ru && process.name.en, `${process.id} is named in both languages`);
    assert.ok(process.description.ru && process.description.en, `${process.id} is described in both languages`);
    assert.ok(process.spec.nodes.length >= 70, `${process.id} is detailed (${process.spec.nodes.length} elements)`);
  }
  assert.deepEqual(
    asIs.spec.lanes.map((lane) => lane.id),
    toBe.spec.lanes.map((lane) => lane.id),
    'the same actors in both versions'
  );
});

test('every Uber Eats specification is internally consistent', () => {
  for (const process of UBER_PROCESSES) {
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
      if (edge.label) assert.ok(edge.label.ru && edge.label.en, `${process.id}: edge label in both languages`);
    }
  }
});

test('nothing in the Uber Eats models claims to come from a report or a source', () => {
  // the models were written without network access: every number is an assumption
  for (const process of UBER_PROCESSES) {
    for (const node of process.spec.nodes) {
      const props = node.props || {};
      const carriesNumbers = props.duration !== undefined || props.waitTime !== undefined || props.cost !== undefined;
      if (carriesNumbers) assert.equal(props.dataSource, 'assumption', `${process.id}/${node.id} is tagged as an assumption`);
      assert.ok(props.dataSource !== 'report' && props.dataSource !== 'derived', `${process.id}/${node.id} does not claim a source`);
    }
    for (const locale of ['ru', 'en']) {
      const text = process.documentation[locale];
      assert.ok(text.length > 1500, `${process.id}/${locale}: documentation is substantial`);
      assert.ok(!/https?:\/\//.test(text), `${process.id}/${locale}: no source links that were never checked`);
    }
  }
  assert.ok(/допущени/.test(asIs.documentation.ru), 'the Russian documentation says the numbers are assumptions');
  assert.ok(/assumption/.test(asIs.documentation.en), 'the English documentation says the numbers are assumptions');
});

test('roles are priced and translatable', () => {
  const known = new Set(Object.values(ROLE_NAMES).map((role) => role.ru));
  for (const process of UBER_PROCESSES) {
    const priced = new Set(process.analysis.roles.map((role) => role.name));
    for (const node of process.spec.nodes) {
      const role = node.props?.resource;
      if (!role) continue;
      assert.ok(known.has(role), `${process.id}/${node.id}: "${role}" is a defined role`);
      assert.ok(priced.has(role), `${process.id}/${node.id}: "${role}" has an hourly rate`);
    }
    for (const role of process.analysis.roles) assert.ok(role.rate > 0, `${role.name} has a rate`);
  }
  assert.equal(roleLabel('Курьер-партнёр', 'en'), 'Courier partner', 'roles translate');
  assert.equal(roleLabel('Курьер-партнёр', 'ru'), 'Курьер-партнёр', 'and keep their Russian name');
  assert.equal(roleLabel('Неизвестная', 'en'), 'Неизвестная', 'unknown roles pass through');
});

test('branch shares add up to 100% at every decision, and event gateways lead to events', () => {
  for (const process of UBER_PROCESSES) {
    const outgoing = new Map();
    for (const edge of process.spec.edges) {
      if (edge.type && edge.type !== 'sequenceFlow') continue;
      if (!outgoing.has(edge.source)) outgoing.set(edge.source, []);
      outgoing.get(edge.source).push(edge);
    }
    for (const [source, flows] of outgoing) {
      const node = specNode(process, source);
      if (!GATEWAYS_WITH_SHARES.includes(node?.type) || flows.length < 2) continue;
      const sum = flows.reduce((total, edge) => total + (edge.props?.probability ?? 0), 0);
      assert.close(sum, 100, 0.01, `${process.id}/${source}: branch shares`);
      if (node.type === 'eventBasedGateway') {
        for (const edge of flows) {
          const target = specNode(process, edge.target);
          assert.ok(
            /CatchEvent$|^intermediateTimerEvent$|^receiveTask$/.test(target.type),
            `${process.id}: an event-based gateway may only lead to events or receive tasks (got ${target.type})`
          );
        }
      }
    }
  }
});

test('both Uber Eats diagrams build, sit in their folders and pass BPMN validation without warnings', () => {
  for (const locale of ['ru', 'en']) {
    const diagrams = buildUberDiagrams(locale);
    assert.equal(diagrams.length, 2, 'two diagrams');
    const doc = docStub({ diagrams });
    for (const diagram of diagrams) {
      assert.equal(diagram.meta.library, 'ubereats', `${diagram.name}: marked as library content`);
      assert.equal(diagram.meta.folder, uberFolder(diagram.meta.variant, locale), `${diagram.name}: variant folder`);
      assert.ok(diagram.meta.folder.startsWith(`${UBER_FOLDER}/`), `${diagram.name}: nested under Uber Eats`);
      assert.equal(diagram.meta.analysis.currency, 'AED', `${diagram.name}: AED`);
      assert.ok(diagram.nodes.filter((n) => n.type === 'lane').length === 6, `${diagram.name}: six lanes`);
      const problems = validateBpmn(diagram, doc);
      const errors = problems.filter((p) => p.severity === 'error');
      const warnings = problems.filter((p) => p.severity === 'warning');
      assert.equal(errors.length, 0, `${diagram.name}: ${errors.map((e) => e.messageKey).join(', ')}`);
      assert.equal(warnings.length, 0, `${diagram.name}: ${warnings.map((e) => e.messageKey).join(', ')}`);
    }
  }
});

test('no two elements of an Uber Eats diagram overlap, and none leaves its lane', () => {
  const containers = new Set(['pool', 'lane', 'group']);
  for (const locale of ['ru', 'en']) {
    for (const diagram of buildUberDiagrams(locale)) {
      const lanes = diagram.nodes.filter((node) => node.type === 'lane');
      const boxes = diagram.nodes.filter((node) => !containers.has(node.type));
      for (const node of boxes) {
        const lane = lanes.find((item) => item.id === node.parent);
        assert.ok(lane, `${diagram.name}: “${node.label}” belongs to a lane`);
        assert.ok(node.y >= lane.y - 1 && node.y + node.h <= lane.y + lane.h + 1, `${diagram.name}: “${node.label}” stays inside its lane`);
      }
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i];
          const b = boxes[j];
          const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
          const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
          assert.ok(overlapX <= 0 || overlapY <= 0, `${diagram.name}: “${a.label}” overlaps “${b.label}”`);
        }
      }
    }
  }
});

test('both Uber Eats diagrams calculate cleanly', () => {
  for (const diagram of buildUberDiagrams('ru')) {
    const result = analyzeProcess(diagram);
    assert.ok(result.ok, `${diagram.name}: analysis ran`);
    assert.equal(result.issues.length, 0, `${diagram.name}: ${result.issues.map((i) => i.code).join(', ')}`);
    assert.ok(result.totals.leadExpected > result.totals.workMinutes, `${diagram.name}: lead time includes the waiting`);
    assert.ok(result.totals.leadExpected > 20 && result.totals.leadExpected < 90, `${diagram.name}: lead time is plausible for a delivery (${result.totals.leadExpected} min)`);
    assert.ok(result.totals.costPerRun > 5 && result.totals.costPerRun < 60, `${diagram.name}: cost per order is plausible (${result.totals.costPerRun} AED)`);
    const share = completionShare(diagram, result);
    assert.ok(share > 0.7 && share < 1, `${diagram.name}: ${Math.round(share * 100)}% of the started orders are delivered`);
    const courier = result.resources.find((r) => r.role === 'Курьер-партнёр');
    const support = result.resources.find((r) => r.role === 'Агент поддержки');
    assert.ok(courier && support, `${diagram.name}: couriers and support agents show up as resources`);
    assert.ok(courier.fte > support.fte, `${diagram.name}: couriers are the dominant resource`);
  }
});

test('the kitchen and the courier arrive together, so no idle time is hidden or invented', () => {
  for (const diagram of buildUberDiagrams('en')) {
    const result = analyzeProcess(diagram);
    const row = (re) => result.nodes.find((r) => re.test(r.label));
    const kitchen = row(/^The kitchen prepares/);
    const courierEnd = row(/^Wait (briefly )?for the (hand-over|order)/);
    assert.ok(kitchen && courierEnd, `${diagram.name}: both branches found`);
    assert.ok(Math.abs(kitchen.finish - courierEnd.finish) < 0.5, `${diagram.name}: branches end ${kitchen.finish} vs ${courierEnd.finish} min`);
  }
});

test('the target model beats the current one on lead time, work, headcount and cost per delivered order', () => {
  const [baseline, target] = buildUberDiagrams('ru');
  const comparison = compareProcesses(baseline, target);
  assert.ok(comparison, 'the comparison is computed');
  const by = Object.fromEntries(comparison.rows.map((row) => [row.key, row]));
  assert.ok(by.lead.to < by.lead.from, `lead time improves (${by.lead.from} -> ${by.lead.to})`);
  assert.ok(by.work.to < by.work.from, `work per order improves (${by.work.from} -> ${by.work.to})`);
  assert.ok(by.fte.to < by.fte.from, `headcount improves (${by.fte.from} -> ${by.fte.to})`);
  assert.ok(by.costPerCompletion.to < by.costPerCompletion.from, `cost per delivered order improves (${by.costPerCompletion.from} -> ${by.costPerCompletion.to})`);
  assert.ok(comparison.completion.to > comparison.completion.from, 'more of the started orders are delivered');
});

test('demand and physics are held equal, so the gain is the process and not the market', () => {
  // fewer closed restaurants, a quicker customer or a shorter road would flatter
  // the comparison; each of these must be identical on both sides
  for (const id of ['browse', 'cart']) {
    assert.equal(specNode(toBe, id).props.waitTime, specNode(asIs, id).props.waitTime, `${id}: the customer takes as long`);
  }
  for (const id of ['promo', 'toRest', 'toCust', 'zone', 'price']) {
    const a = specNode(asIs, id).props;
    const b = specNode(toBe, id).props;
    assert.equal(b.duration, a.duration, `${id}: duration unchanged`);
    assert.equal(b.cost, a.cost, `${id}: cost unchanged`);
  }
  const shares = (process, id) =>
    process.spec.edges.filter((e) => e.source === id).map((e) => `${e.target}:${e.props?.probability}`).sort().join('|');
  assert.equal(shares(toBe, 'gwOpen'), shares(asIs, 'gwOpen'), 'the share of closed or overloaded restaurants is unchanged');
  // cooking may only shift a little: it is the restaurant's, not the platform's
  const prepare = (process) => specNode(process, 'prepare').props.waitTime;
  assert.ok(prepare(toBe) >= prepare(asIs) * 0.9, 'cooking time is not what makes the target look better');
});

test('the documentation carries the computed comparison and is not copied between versions', () => {
  for (const locale of ['ru', 'en']) {
    const [baseline, target] = buildUberDiagrams(locale);
    assert.ok(!baseline.meta.documentation.includes('|---|---|---|---|'), `${locale}: the baseline has no comparison table`);
    assert.ok(target.meta.documentation.includes('|---|---|---|---|'), `${locale}: the target carries the comparison table`);
    assert.ok(target.meta.documentation !== baseline.meta.documentation, `${locale}: the two versions are documented separately`);
    assert.ok(/AED/.test(target.meta.documentation), `${locale}: the comparison is in dirhams`);
  }
});

test('Uber Eats localisation resolves to plain strings in both languages', () => {
  const [ru] = buildUberDiagrams('ru');
  const [en] = buildUberDiagrams('en');
  assert.ok(ru.name !== en.name, 'the two languages differ');
  const resources = (diagram) => new Set(diagram.nodes.map((n) => n.props?.resource).filter(Boolean));
  assert.ok(resources(en).has('Courier partner') && !resources(en).has('Курьер-партнёр'), 'English diagrams use English roles');
  assert.ok(resources(ru).has('Курьер-партнёр'), 'Russian diagrams use Russian roles');
  for (const diagram of [ru, en]) {
    for (const node of diagram.nodes) {
      for (const value of Object.values(node.props || {})) {
        assert.ok(typeof value !== 'object' || value === null, `${diagram.name}/${node.label}: no bilingual leftovers in props`);
      }
    }
    for (const role of diagram.meta.analysis.roles) assert.equal(typeof role.name, 'string', 'rate card names are strings');
  }
});

test('an Uber Eats diagram survives a save / load round trip', () => {
  const diagrams = buildUberDiagrams('ru');
  const restored = normalizeProject(JSON.parse(JSON.stringify({ name: 'x', diagrams })));
  assert.equal(restored.diagrams.length, 2, 'both diagrams survive');
  for (let i = 0; i < 2; i++) {
    const before = diagrams[i];
    const after = restored.diagrams[i];
    assert.equal(after.meta.folder, before.meta.folder, 'folder survives');
    assert.equal(after.meta.baselineId, before.meta.baselineId, 'baseline link survives');
    assert.equal(after.nodes.length, before.nodes.length, 'node count survives');
    const a = analyzeProcess(before);
    const b = analyzeProcess(after);
    assert.close(b.totals.costPerRun, a.totals.costPerRun, 0.01, 'cost survives');
    assert.close(b.totals.leadExpected, a.totals.leadExpected, 0.01, 'lead time survives');
  }
});

test('the application opens on every shipped library, each in its own folders', () => {
  assert.deepEqual(LIBRARY_IDS, ['weg', 'ubereats'], 'two libraries are shipped');
  for (const locale of ['ru', 'en']) {
    const project = createLibrariesProject(locale);
    assert.equal(project.diagrams.length, 18, 'sixteen WEG models and two Uber Eats models');
    assert.ok(project.diagrams.every(isLibraryDiagram), 'every diagram is library content');
    const folders = new Set(project.diagrams.map((d) => d.meta.folder));
    assert.equal(folders.size, 4, 'two roots, two versions each');
    const ids = project.diagrams.map((d) => d.meta.processId);
    assert.equal(new Set(ids).size, ids.length, 'process identifiers are unique across the libraries');
    assert.ok(project.documentation.includes('WEG') && project.documentation.includes('Uber Eats'), 'the project notes cover both');
    assert.equal(project.diagrams.filter((d) => d.meta.library === 'weg').length, 16, 'WEG is unchanged');
  }
  assert.equal(isLibraryDiagram({ meta: { library: 'weg' } }), true, 'a WEG diagram counts');
  assert.equal(isLibraryDiagram({ meta: {} }), false, 'a user diagram does not');
  assert.equal(isLibraryDiagram(null), false, 'and null is safe');
  assert.equal(buildAllLibraryDiagrams('ru').length, 18, 'the flat builder agrees');
});
