import { assert, test } from './harness.js';
import { getNotation } from '../app/notations/index.js';
import { SHEET_TEMPLATES } from '../app/notations/sheet/templates.js';
import { buildSheetDiagrams, placeCards, quadrantForScores } from '../app/notations/sheet/build.js';
import { matrixGeometry, matrixQuadrant, parseScores } from '../app/notations/sheet/types.js';
import { validateSheet } from '../app/notations/sheet/validate.js';
import { buildDiagrams } from '../app/ai/schema.js';
import { MATRICES } from '../app/library/weg/sheets/matrices.js';
import { RISKS } from '../app/library/weg/sheets/risks.js';
import { WEG_SHEET_COUNT, buildWegSheetDiagrams, scoreMatrix } from '../app/library/weg/sheets/index.js';
import { WEG_AS_IS, WEG_TO_BE } from '../app/library/weg/index.js';
import { stepRow, flowShare } from '../app/library/weg/sheets/engine.js';
import { createLibrariesProject } from '../app/library/index.js';
import { normalizeProject } from '../app/core/model.js';

const sheet = getNotation('sheet');
const overlaps = (a, b) => a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;

test('the worksheet notation draws every element type and forbids connections', () => {
  for (const type of Object.values(sheet.nodeTypes)) {
    const markup = type.draw({ id: 'n', type: type.id, x: 0, y: 0, w: type.defaultSize.w, h: type.defaultSize.h, label: 'Text', props: { scores: '1, 0, -1', no: '1', tone: 'pain' } }, {});
    assert.ok(markup.includes('<'), `${type.id} produces markup`);
  }
  assert.equal(sheet.canConnect({}, {}, {}, null).ok, false, 'worksheet cards cannot be connected');
  assert.deepEqual(Object.keys(sheet.edgeTypes), [], 'no edge types');
});

test('the three empty templates build and the checks read as a to-do list', () => {
  assert.equal(SHEET_TEMPLATES.length, 3, 'matrix, risks, journey');
  for (const template of SHEET_TEMPLATES) {
    for (const locale of ['ru', 'en']) {
      const diagrams = buildDiagrams(template.spec, { locale, name: 'x' });
      assert.equal(diagrams.length, 1, 'one diagram');
      assert.equal(diagrams[0].notation, 'sheet', 'sheet notation');
      assert.ok(validateSheet(diagrams[0]).length > 0, `${template.id} has things left to fill in`);
    }
  }
});

test('cards are placed where their scores say, never on top of each other', () => {
  const board = { x: 0, y: 0, w: 940, h: 600 };
  const items = [];
  for (let impact = 1; impact <= 10; impact += 3) for (let effort = 1; effort <= 10; effort += 3) items.push({ impact, effort });
  items.push({ impact: 10, effort: 1 }, { impact: 9, effort: 2 });
  const positions = placeCards(items, board);
  const rects = items.map((item, i) => ({ ...positions.get(i), item }));
  rects.forEach((a, i) => {
    const centre = { x: a.x + a.w / 2, y: a.y + a.h / 2, w: 1, h: 1 };
    assert.equal(matrixQuadrant(board, { x: centre.x, y: centre.y, w: 0, h: 0 }), quadrantForScores(a.item.impact, a.item.effort), `card ${i} sits in the quadrant of its scores`);
    for (let j = i + 1; j < rects.length; j++) assert.ok(!overlaps(a, rects[j]), `cards ${i} and ${j} do not overlap`);
  });
  const geometry = matrixGeometry(board);
  assert.ok(geometry.quadrants.win.w > 0 && geometry.quadrants.drop.h > 0, 'four quadrants');
  assert.deepEqual(parseScores('1, 0; -2 x 3'), [1, 0, -2, 3], 'scores parse');
});

test('the checks notice a quick win without a reason and an emotion curve of the wrong length', () => {
  const [matrix] = buildSheetDiagrams({ kind: 'matrix', title: 't', items: [{ label: 'a', impact: 9, effort: 2 }, { label: 'b', impact: 2, effort: 8 }, { label: 'c', impact: 3, effort: 3 }], why: '' }, { locale: 'en' });
  assert.ok(validateSheet(matrix).some((p) => p.messageKey === 'whyEmpty'), 'asks for the reason');
  matrix.nodes.find((n) => n.props?.role === 'why').label = 'Because.';
  assert.equal(validateSheet(matrix).length, 0, 'a complete sheet is clean');
  const journey = buildSheetDiagrams(SHEET_TEMPLATES[2].spec, { locale: 'en' })[0];
  journey.nodes.find((n) => n.type === 'journeyCurve').props.scores = '1, 2';
  assert.ok(validateSheet(journey).some((p) => p.messageKey === 'curveCount'), 'curve length is checked');
});

test('worksheets survive a project round trip', () => {
  const project = createLibrariesProject('ru');
  const restored = normalizeProject(JSON.parse(JSON.stringify(project)));
  const sheets = restored.diagrams.filter((d) => d.notation === 'sheet');
  assert.equal(sheets.length, WEG_SHEET_COUNT, 'worksheets keep their notation');
  assert.ok(sheets.every((d) => d.id.startsWith('sheet') || d.id.length > 0), 'ids survive');
});

/* ------------------------------------------------------- the WEG worksheets */

const cyrillic = /[А-Яа-яЁё]/;

test('the library carries eight matrices, eight risk sheets and two journeys', () => {
  assert.equal(MATRICES.length, 8, 'a matrix per process');
  assert.equal(RISKS.length, 8, 'a risk sheet per process');
  assert.equal(WEG_SHEET_COUNT, 18, 'eighteen worksheets');
  for (const locale of ['ru', 'en']) {
    const diagrams = buildWegSheetDiagrams(locale);
    assert.equal(diagrams.length, 18, 'all built');
    const kinds = diagrams.map((d) => d.meta.sheet.kind);
    assert.equal(kinds.filter((k) => k === 'matrix').length, 8, 'matrices');
    assert.equal(kinds.filter((k) => k === 'risks').length, 8, 'risk sheets');
    assert.equal(kinds.filter((k) => k === 'journey').length, 2, 'journeys');
    const ids = diagrams.map((d) => d.meta.processId);
    assert.equal(new Set(ids).size, 18, 'process identifiers are unique');
    assert.ok(diagrams.every((d) => d.meta.library === 'wegsheets'), 'library tag');
    assert.ok(diagrams.every((d) => d.meta.folder.startsWith('WEG/')), 'inside the WEG folder');
    assert.ok(diagrams.every((d) => !/https?:\/\//.test(d.meta.documentation || '')), 'no invented links');
  }
});

test('every matrix holds 3–5 changes whose cards sit in the quadrant of their scores', () => {
  for (const entry of MATRICES) {
    const scored = scoreMatrix(entry);
    assert.ok(scored.length >= 3 && scored.length <= 5, `${entry.processId} has 3–5 changes`);
    assert.ok(scored.every((row) => row.impact >= 1 && row.impact <= 10 && row.effort >= 1 && row.effort <= 10), 'scores are 1–10');
    assert.ok(scored.some((row) => row.impact === 10), 'the strongest change is scored 10');
  }
  for (const locale of ['ru', 'en']) {
    const diagrams = buildWegSheetDiagrams(locale).filter((d) => d.meta.sheet.kind === 'matrix');
    diagrams.forEach((diagram, index) => {
      const board = diagram.nodes.find((n) => n.type === 'sheetBoard');
      const items = diagram.nodes.filter((n) => n.type === 'sheetItem');
      const scored = scoreMatrix(MATRICES[index]);
      items.forEach((card, i) => {
        assert.equal(matrixQuadrant(board, card), quadrantForScores(scored[i].impact, scored[i].effort), `${diagram.name}: card ${i + 1} sits in its quadrant`);
        assert.ok(card.label.length <= 64, `${diagram.name}: card ${i + 1} fits (${card.label.length})`);
        assert.ok(card.props.basis, 'every card carries its basis');
      });
      items.forEach((a, i) => items.slice(i + 1).forEach((b) => assert.ok(!overlaps(a, b), `${diagram.name}: cards do not overlap`)));
      assert.equal(validateSheet(diagram).filter((p) => p.severity !== 'info').length, 0, `${diagram.name} is a complete sheet`);
      const why = diagram.nodes.find((n) => n.props?.role === 'why').label;
      assert.ok(why.length > 80 && !/[{}]/.test(why), 'the reason is written and every placeholder is filled');
      const note = diagram.nodes.find((n) => n.props?.role === 'basis').label;
      assert.ok(/R\$/.test(note), 'the note quotes the totals');
    });
  }
});

test('where a matrix has a quick win its reason names the card that goes first', () => {
  for (const entry of MATRICES) {
    const scored = scoreMatrix(entry);
    const wins = scored.filter((row) => row.impact >= 6 && row.effort <= 5);
    const first = scored.find((row) => row.item.id === entry.first);
    assert.ok(first, `${entry.processId} names its first change`);
    if (wins.length) assert.ok(wins.includes(first), `${entry.processId}: the first change is a quick win`);
    else assert.ok(/Быстрых побед нет/.test(entry.why.ru) && /no quick wins/i.test(entry.why.en), `${entry.processId} says plainly there is none`);
  }
});

test('the risk sheets answer all three questions about the change the matrix puts first', () => {
  for (const entry of RISKS) {
    const matrix = MATRICES.find((m) => m.processId === entry.processId);
    assert.equal(entry.itemId, matrix.first, 'the risk sheet follows the matrix');
    assert.equal(entry.answers.length, 3, 'three answers');
  }
  for (const locale of ['ru', 'en']) {
    const diagrams = buildWegSheetDiagrams(locale).filter((d) => d.meta.sheet.kind === 'risks');
    for (const diagram of diagrams) {
      const questions = diagram.nodes.filter((n) => n.type === 'sheetQuestion');
      assert.equal(questions.length, 3, 'three question cards');
      assert.ok(questions.every((q) => q.label.length > 120 && !/[{}]/.test(q.label)), `${diagram.name}: answers are written and filled`);
      assert.equal(validateSheet(diagram).length, 0, 'complete');
    }
  }
});

test('both journeys are complete: nine stages, every cell written, one emotion per stage', () => {
  for (const locale of ['ru', 'en']) {
    const journeys = buildWegSheetDiagrams(locale).filter((d) => d.meta.sheet.kind === 'journey');
    assert.equal(journeys.length, 2, 'as is and to be');
    for (const diagram of journeys) {
      const stages = diagram.nodes.filter((n) => n.type === 'journeyStage');
      const cells = diagram.nodes.filter((n) => n.type === 'journeyCell');
      assert.equal(stages.length, 9, 'nine stages');
      assert.equal(cells.length, 9 * 8, 'eight text rows of nine cells');
      assert.ok(cells.every((c) => c.label.trim() && !/[{}]/.test(c.label)), 'every cell is written, every placeholder filled');
      assert.equal(parseScores(diagram.nodes.find((n) => n.type === 'journeyCurve').props.scores).length, 9, 'a point per stage');
      assert.equal(validateSheet(diagram).length, 0, 'complete');
      for (let i = 0; i < cells.length; i++) for (let j = i + 1; j < cells.length; j++) assert.ok(!overlaps(cells[i], cells[j]), 'cells do not overlap');
    }
  }
});

test('the worksheets are fully bilingual: no Russian in the English build and no English leftovers in Russian cards', () => {
  for (const diagram of buildWegSheetDiagrams('en')) {
    for (const node of diagram.nodes) {
      assert.ok(!cyrillic.test(`${node.label} ${Object.values(node.props || {}).join(' ')}`), `${diagram.name}: "${node.label.slice(0, 40)}" is translated`);
    }
    assert.ok(!cyrillic.test(diagram.meta.documentation + diagram.meta.description + diagram.meta.folder), `${diagram.name}: documentation is translated`);
  }
  for (const diagram of buildWegSheetDiagrams('ru')) {
    for (const node of diagram.nodes.filter((n) => n.type === 'journeyCell' || n.type === 'sheetQuestion')) {
      assert.ok(cyrillic.test(node.label), `${diagram.name}: a Russian build has Russian text`);
    }
  }
});

test('the journey quotes the models: the figures written into cells match the specifications', () => {
  const asis = WEG_AS_IS.find((p) => p.id === 'weg-o2c');
  const tobe = WEG_TO_BE.find((p) => p.id === 'weg-o2c-tobe');
  const svcAsis = WEG_AS_IS.find((p) => p.id === 'weg-service');
  const svcTobe = WEG_TO_BE.find((p) => p.id === 'weg-service-tobe');
  const dur = (process, id) => process.spec.nodes.find((n) => n.id === id).props.duration;
  assert.equal(dur(asis, 'register'), 4, 'registration 4 min');
  assert.equal(dur(asis, 'check'), 12, 'part-number check 12 min');
  assert.equal(dur(asis, 'credit'), 8, 'credit check 8 min');
  assert.equal(dur(tobe, 'validate'), 0.5, 'automatic check 0.5 min');
  assert.equal(dur(tobe, 'score'), 0.3, 'scoring 0.3 min');
  assert.equal(dur(svcAsis, 'register'), 8, 'logging 8 min');
  assert.equal(dur(svcAsis, 'remote'), 35, 'diagnosis 35 min');
  assert.equal(dur(svcAsis, 'warranty'), 15, 'warranty 15 min');
  assert.equal(dur(svcTobe, 'remote'), 18, 'telemetry diagnosis 18 min');
  assert.equal(dur(svcTobe, 'warranty'), 0.4, 'passport warranty 0.4 min');
  assert.equal(dur(svcAsis, 'report'), 30, 'report 30 min');
  assert.equal(dur(svcAsis, 'feedback'), 6, 'rating 6 min');
  assert.equal(flowShare(svcTobe, 'gwRemote', 'closeRemote'), 58, 'remote share');
  assert.equal(flowShare(svcAsis, 'gwRemote', 'closeRemote'), 35, 'old remote share');
  assert.equal(flowShare(svcTobe, 'gwSource', 'predict'), 62, 'monitoring share');
  const wait = (process, id) => process.spec.nodes.find((n) => n.id === id).props.waitTime;
  assert.equal(wait(asis, 'waitProd'), 4320, 'production wait 9 days');
  assert.equal(wait(tobe, 'waitProd'), 1440, 'production wait 3 days');
  assert.equal(wait(svcAsis, 'quote'), 1440, 'quotation approval 3 days');
  assert.equal(wait(svcAsis, 'parts'), 1920, 'parts 4 days');
  assert.equal(wait(svcAsis, 'pickup'), 960, 'collection 2 days');
  assert.ok(stepRow(svcTobe, 'inspect').runs < stepRow(svcAsis, 'inspect').runs, 'fewer cases reach a repair');
});

test('the supplier lead times stay as in the baseline: the target models do not buy speed with promises', () => {
  const wait = (process, id) => process.spec.nodes.find((n) => n.id === id).props.waitTime;
  for (const [asisId, tobeId, step] of [['weg-procurement', 'weg-procurement-tobe', 'leadTime'], ['weg-eto', 'weg-eto-tobe', 'longlead'], ['weg-gtd', 'weg-gtd-tobe', 'longlead']]) {
    const a = WEG_AS_IS.find((p) => p.id === asisId);
    const b = WEG_TO_BE.find((p) => p.id === tobeId);
    assert.equal(wait(b, step), wait(a, step), `${tobeId}: ${step} is unchanged`);
  }
});
