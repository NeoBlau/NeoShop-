import { assert, test } from './harness.js';
import { AUTOMATION, TECH_CLASSES } from '../app/library/automation/content.js';
import { TECHS, RISK_TYPES, techLabel } from '../app/library/automation/techs.js';
import { AUTOMATION_SHEET_COUNT, buildAutomationDiagrams, factsFor } from '../app/library/automation/index.js';
import { validateSheet } from '../app/notations/sheet/validate.js';
import { MATRICES } from '../app/library/weg/sheets/matrices.js';
import { WEG_AS_IS, WEG_TO_BE } from '../app/library/weg/index.js';
import { UBER_AS_IS, UBER_TO_BE } from '../app/library/ubereats/index.js';
import { flowShare } from '../app/library/weg/sheets/engine.js';

const cyrillic = /[А-Яа-яЁё]/;
const overlaps = (a, b) => a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;

test('the automation folder holds two reference sheets and four sheets for each process and version', () => {
  assert.equal(AUTOMATION.length, 10, 'eight WEG processes, Uber Eats and the buyer journey');
  assert.equal(AUTOMATION_SHEET_COUNT, 82, 'two + ten × two × four');
  for (const locale of ['ru', 'en']) {
    const diagrams = buildAutomationDiagrams(locale);
    assert.equal(diagrams.length, 82, 'all built');
    assert.ok(diagrams.every((d) => d.meta.library === 'automation'), 'library tag');
    const ids = diagrams.map((d) => d.meta.processId);
    assert.equal(new Set(ids).size, 82, 'identifiers are unique');
    const folders = new Set(diagrams.map((d) => d.meta.folder));
    assert.equal(folders.size, 9, 'a reference folder and four kinds for each of the two versions');
    assert.ok([...folders].every((f) => f.startsWith(locale === 'ru' ? 'Автоматизация' : 'Automation')), 'one root folder');
    assert.equal(diagrams.filter((d) => d.meta.variant === 'as-is').length, 40, 'as is');
    assert.equal(diagrams.filter((d) => d.meta.variant === 'to-be').length, 40, 'to be');
  }
});

test('every sheet is complete, every placeholder is filled and the English build has no Russian', () => {
  for (const locale of ['ru', 'en']) {
    for (const diagram of buildAutomationDiagrams(locale)) {
      assert.equal(validateSheet(diagram).filter((p) => p.severity !== 'info').length, 0, `${diagram.name} is a complete sheet`);
      for (const node of diagram.nodes) {
        assert.ok(!/[{}]/.test(node.label || ''), `${diagram.name}: no placeholder left in "${(node.label || '').slice(0, 40)}"`);
        if (locale === 'en') assert.ok(!cyrillic.test(`${node.label} ${Object.values(node.props || {}).join(' ')}`), `${diagram.name}: "${(node.label || '').slice(0, 40)}" is translated`);
      }
      if (locale === 'en') assert.ok(!cyrillic.test(diagram.meta.description + diagram.meta.folder), `${diagram.name}: metadata is translated`);
      const boxes = diagram.nodes.filter((n) => n.type !== 'sheetTitle');
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) assert.ok(!overlaps(boxes[i], boxes[j]), `${diagram.name}: elements do not overlap`);
    }
  }
});

test('each process has five steps, valid technology codes and a risk and a pilot for both versions', () => {
  for (const entry of AUTOMATION) {
    assert.equal(entry.steps.length, 5, `${entry.key} has five steps`);
    for (const step of entry.steps) {
      for (const code of [...step.tobe.tech, ...step.asis.tech]) assert.ok(TECHS[code], `${entry.key}: ${code} is a known class`);
      assert.ok(step.tobe.why.ru && step.tobe.why.en && step.asis.why.ru && step.asis.why.en && step.asis.step.ru && step.asis.step.en, 'both languages');
      if (!entry.uber && !entry.journey) {
        const matrix = MATRICES.find((m) => m.processId === entry.matrix);
        assert.ok(matrix.items.some((item) => item.id === step.id), `${entry.key}: ${step.id} is a change of the matrix`);
      }
    }
    assert.ok(entry.steps.some((s) => s.id === entry.risk.step), 'the risk is about one of the steps');
    for (const side of ['tobe', 'asis']) {
      assert.ok(RISK_TYPES[entry.risk[side].type], 'a known risk type');
      for (const key of ['desc', 'measure']) assert.ok(entry.risk[side][key].ru.length > 60 && entry.risk[side][key].en.length > 60, `${entry.key}: ${side} ${key} is written`);
      for (const key of ['scale', 'kpi', 'target']) assert.ok(entry.pilot[side][key].ru.length > 20 && entry.pilot[side][key].en.length > 20, `${entry.key}: ${side} pilot ${key} is written`);
    }
    assert.equal(entry.risk.asis.type, 'mess', 'automating a step as it is counts as automating the mess');
  }
  assert.equal(techLabel(['BPM', 'RPA'], 'en'), 'BPM + RPA', 'a combination reads as hyperautomation');
  assert.equal(TECH_CLASSES.length, 5, 'four classes and AI in the reference');
});

test('the AS-IS argument is computed from the models', () => {
  for (const entry of AUTOMATION) {
    const facts = factsFor(entry);
    for (const [key, value] of Object.entries(facts)) assert.ok(Number.isFinite(value) && value >= 0 && value <= 100, `${entry.key}: ${key} is a percentage (${value})`);
    assert.ok(facts.tobeLead > 0 && facts.tobeCost > 0, `${entry.key}: the target model saves something`);
  }
  // where waiting rules the lead time, automating office steps barely moves it
  assert.ok(factsFor(AUTOMATION[0]).autoLead < 5 && factsFor(AUTOMATION[0]).waitShare > 95, 'order to cash is waiting');
  const asis = buildAutomationDiagrams('en').find((d) => d.meta.processId === 'auto-weg-o2c-as-is-tech');
  assert.ok(/Waiting is \d+% of this process/.test(asis.nodes.find((n) => n.props?.role === 'hint').label), 'the figures are on the sheet');
});

test('the figures written into the texts match the specifications', () => {
  const find = (list, id) => list.find((p) => p.id === id);
  const dur = (p, id) => p.spec.nodes.find((n) => n.id === id).props.duration;
  const wait = (p, id) => p.spec.nodes.find((n) => n.id === id).props.waitTime;
  const o2c = find(WEG_AS_IS, 'weg-o2c');
  const o2cTo = find(WEG_TO_BE, 'weg-o2c-tobe');
  assert.equal(flowShare(o2cTo, 'gwStock', 'pick'), 92, 'stock share to be');
  assert.equal(flowShare(o2c, 'gwStock', 'pick'), 78, 'stock share as is');
  assert.equal(flowShare(o2cTo, 'gwScore', 'review'), 4, 'manual review 4%');
  assert.equal(flowShare(o2cTo, 'gwScore', 'atp'), 96, 'scoring releases 96%');
  assert.equal(dur(o2c, 'credit'), 8, 'credit check 8 min');
  const motor = find(WEG_AS_IS, 'weg-make-motor');
  assert.equal(dur(motor, 'coil'), 6, 'winding 6 min');
  assert.equal(wait(motor, 'impreg'), 40, 'impregnation wait 40 min');
  assert.equal(wait(motor, 'paint'), 25, 'paint wait 25 min');
  assert.equal(flowShare(find(WEG_TO_BE, 'weg-make-motor-tobe'), 'gwTest', 'repair'), 1, 'to-be efficiency non-conformities');
  assert.equal(flowShare(motor, 'gwTest', 'repair'), 2.5, 'as-is efficiency non-conformities');
  const buy = find(WEG_AS_IS, 'weg-procurement');
  assert.equal(dur(buy, 'hedge'), 30, 'hedge 30 min');
  assert.equal(dur(buy, 'match'), 10, 'matching 10 min');
  assert.equal(dur(buy, 'audit'), 240, 'audit 240 min');
  assert.equal(buy.spec.nodes.find((n) => n.id === 'audit').props.cost, 3800, 'audit R$ 3.8k');
  const buyTo = find(WEG_TO_BE, 'weg-procurement-tobe');
  assert.equal(flowShare(buyTo, 'gwClass', 'vmi'), 34, 'C-class share');
  assert.equal(flowShare(buyTo, 'gwMatch', 'resolve'), 7, 'matching mismatches');
  const eto = find(WEG_AS_IS, 'weg-eto');
  assert.equal(dur(eto, 'concept'), 420, 'sizing 7 h');
  assert.equal(dur(eto, 'cost'), 120, 'pricing 2 h');
  assert.equal(dur(eto, 'design'), 2400, 'design 2,400 min');
  assert.equal(eto.spec.nodes.find((n) => n.id === 'fat').props.cost, 8500, 'FAT R$ 8.5k');
  assert.equal(find(WEG_TO_BE, 'weg-eto-tobe').spec.nodes.find((n) => n.id === 'twin').props.cost, 9000, 'twin R$ 9k');
  assert.equal(flowShare(find(WEG_TO_BE, 'weg-eto-tobe'), 'gwFit', 'cost'), 68, 'library share');
  const gtd = find(WEG_AS_IS, 'weg-gtd');
  assert.equal(dur(gtd, 'commission'), 1440, 'commissioning 1,440 min');
  assert.equal(dur(gtd, 'typeTest'), 960, 'type test 960 min');
  assert.equal(gtd.spec.nodes.find((n) => n.id === 'typeTest').props.cost, 45000, 'type test R$ 45k');
  assert.equal(dur(gtd, 'design1'), 720, 'preliminary design 720 min');
  assert.equal(wait(gtd, 'dryout'), 1440, 'drying queue 1,440 min');
  assert.equal(flowShare(find(WEG_TO_BE, 'weg-gtd-tobe'), 'gwPlatform', 'platform'), 64, 'platform share');
  const svc = find(WEG_AS_IS, 'weg-service');
  assert.equal(dur(svc, 'remote'), 35, 'remote diagnosis 35 min');
  assert.equal(dur(svc, 'warranty'), 15, 'warranty 15 min');
  assert.equal(wait(svc, 'parts'), 1920, 'parts 4 days');
  assert.equal(wait(svc, 'quote'), 1440, 'quotation 3 days');
  assert.equal(wait(svc, 'pickup'), 960, 'collection 2 days');
  assert.equal(flowShare(svc, 'gwRemote', 'closeRemote'), 35, 'remote closure as is');
  assert.equal(flowShare(find(WEG_TO_BE, 'weg-service-tobe'), 'gwRemote', 'closeRemote'), 58, 'remote closure to be');
  const npd = find(WEG_AS_IS, 'weg-npd');
  assert.equal(wait(npd, 'tooling'), 14400, 'tooling 30 days');
  assert.equal(wait(npd, 'cert'), 19200, 'certification 40 days');
  assert.equal(dur(npd, 'screen'), 960, 'market study 960 min');
  assert.equal(dur(npd, 'concept'), 1920, 'concept 1,920 min');
  assert.equal(flowShare(npd, 'gwClass', 'tune'), 30, 'refinement 30%');
  const exp = find(WEG_AS_IS, 'weg-export');
  assert.equal(wait(exp, 'destClear'), 1920, 'import clearance 4 days');
  assert.equal(wait(exp, 'booking'), 960, 'booking 2 days');
  assert.equal(dur(exp, 'docs'), 90, 'documents 90 min');
  assert.equal(flowShare(exp, 'gwChannel', 'gwChannelJoin'), 84, 'green channel 84%');
  const uber = UBER_AS_IS[0].spec;
  const uberTo = UBER_TO_BE[0].spec;
  assert.equal(uber.edges.find((e) => e.source === 'gwResp' && e.target === 'accepted').props.probability, 90, 'acceptance as is');
  assert.equal(uberTo.edges.find((e) => e.source === 'gwResp' && e.target === 'accepted').props.probability, 97, 'acceptance to be');
  assert.equal(uber.nodes.find((n) => n.id === 'idle').props.duration, 4, 'courier idle 4 min');
  assert.equal(uberTo.nodes.find((n) => n.id === 'idle').props.duration, 1, 'courier idle 1 min');
});
