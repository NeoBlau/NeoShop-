import { assert, test } from './harness.js';
import { ALFA_AS_IS, ALFA_FOLDER, ALFA_PROCESSES, alfaFolder, buildAlfaDiagrams } from '../app/library/alfabank/index.js';
import { SOURCES, roleLabel } from '../app/library/alfabank/facts.js';
import { validateBpmn } from '../app/notations/bpmn/validate.js';
import { analyzeProcess } from '../app/analysis/simulate.js';
import { completionShare } from '../app/analysis/compare.js';
import { hasAnalysisData } from '../app/analysis/parameters.js';

const cyrillic = /[А-Яа-яЁё]/;
const GATEWAYS = ['exclusiveGateway', 'inclusiveGateway', 'eventBasedGateway'];
const docStub = (diagrams) => ({ project: { diagrams }, diagram: (id) => diagrams.find((d) => d.id === id) || null, childDiagrams: () => [] });

test('the bank library ships the lending process as is, in its own folder', () => {
  assert.equal(ALFA_AS_IS.length, 1, 'one process');
  assert.equal(ALFA_PROCESSES.length, 1, 'and only the current state');
  for (const locale of ['ru', 'en']) {
    const [diagram] = buildAlfaDiagrams(locale);
    assert.equal(diagram.meta.library, 'alfabank', 'library tag');
    assert.equal(diagram.meta.variant, 'as-is', 'variant');
    assert.equal(diagram.meta.folder, alfaFolder('as-is', locale), 'folder');
    assert.ok(diagram.meta.folder.startsWith(locale === 'ru' ? `${ALFA_FOLDER}/` : 'Alfa-Bank/'), 'nested under the bank');
    assert.equal(diagram.meta.analysis.currency, 'RUB', 'roubles');
    assert.equal(diagram.nodes.filter((n) => n.type === 'lane').length, 7, 'seven lanes');
  }
});

test('the bank diagram is valid BPMN, calculable, and its branch shares add up', () => {
  for (const locale of ['ru', 'en']) {
    const [diagram] = buildAlfaDiagrams(locale);
    const problems = validateBpmn(diagram, docStub([diagram]));
    assert.equal(problems.filter((p) => p.severity !== 'info').length, 0, problems.map((p) => p.messageKey).join(', '));
    assert.ok(hasAnalysisData(diagram), 'carries parameters');
    const result = analyzeProcess(diagram);
    assert.ok(result.ok && result.totals.leadExpected > 0 && result.totals.costPerRun > 0, 'produces a calculation');
    const done = completionShare(diagram, result);
    assert.ok(done > 0.3 && done < 0.8, `a plausible share of applications ends in a disbursed loan (${done.toFixed(2)})`);
  }
  const process = ALFA_AS_IS[0];
  const outgoing = new Map();
  for (const edge of process.spec.edges) {
    if (edge.type && edge.type !== 'sequenceFlow') continue;
    if (!outgoing.has(edge.source)) outgoing.set(edge.source, []);
    outgoing.get(edge.source).push(edge);
  }
  for (const [source, flows] of outgoing) {
    const node = process.spec.nodes.find((n) => n.id === source);
    if (!GATEWAYS.includes(node?.type) || flows.length < 2) continue;
    const sum = flows.reduce((total, edge) => total + (edge.props?.probability ?? 0), 0);
    assert.close(sum, 100, 0.01, `${source}: branch shares`);
  }
});

test('no number is presented as the bank\'s own: every parameter is an assumption', () => {
  const process = ALFA_AS_IS[0];
  for (const step of process.spec.nodes) {
    if (!step.props) continue;
    if (step.props.duration || step.props.waitTime || step.props.cost) {
      assert.equal(step.props.dataSource, 'assumption', `${step.id} is tagged as an assumption`);
    }
  }
  const [ru, en] = [process.documentation.ru, process.documentation.en];
  assert.ok(ru.includes('Ни одна цифра') && en.includes('Not one figure'), 'the documentation says so in both languages');
  assert.ok(ru.includes('проверьте') && en.includes('verify'), 'the public items are marked to be verified');
});

test('the documentation cites only the sources it found and states what could not be opened', () => {
  const allowed = SOURCES.map((s) => s.url);
  for (const text of [ALFA_AS_IS[0].documentation.ru, ALFA_AS_IS[0].documentation.en]) {
    const urls = text.match(/https?:\/\/[^\s)]+/g) || [];
    assert.ok(urls.length >= 3, 'the sources are listed');
    for (const url of urls) assert.ok(allowed.includes(url), `${url} is a known source`);
    for (const url of allowed) assert.ok(text.includes(url), `${url} is cited`);
  }
  assert.ok(ALFA_AS_IS[0].documentation.ru.includes('открыть не удалось'), 'it says the bank page could not be opened');
  assert.ok(SOURCES.some((s) => /aggregator|агрегатор/.test(s.title.en + s.title.ru)), 'third-party sources are labelled as such');
});

test('every element sits in a lane and none overlaps; the English build has no Russian', () => {
  const containers = new Set(['pool', 'lane', 'group']);
  const roleName = roleLabel('Клиентский менеджер', 'en');
  assert.equal(roleName, 'Client manager', 'roles translate');
  for (const locale of ['ru', 'en']) {
    const [diagram] = buildAlfaDiagrams(locale);
    const lanes = diagram.nodes.filter((n) => n.type === 'lane');
    const boxes = diagram.nodes.filter((n) => !containers.has(n.type));
    for (const node of boxes) {
      const lane = lanes.find((item) => item.id === node.parent);
      assert.ok(lane, `“${node.label}” belongs to a lane`);
      assert.ok(node.y >= lane.y - 1 && node.y + node.h <= lane.y + lane.h + 1, `“${node.label}” stays inside its lane`);
      if (locale === 'en') assert.ok(!cyrillic.test(`${node.label} ${node.props?.resource || ''}`), `“${node.label}” is translated`);
    }
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        assert.ok(Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) <= 0 || Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) <= 0, `“${a.label}” overlaps “${b.label}”`);
      }
    }
    if (locale === 'en') {
      assert.ok(!cyrillic.test(diagram.meta.documentation + diagram.meta.description), 'documentation is translated');
      for (const role of diagram.meta.analysis.roles) assert.ok(!cyrillic.test(role.name), `${role.name} is translated`);
    }
  }
});
