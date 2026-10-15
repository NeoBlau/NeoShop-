/**
 * Worksheet checks.
 *
 * They read as a to-do list for whoever fills the sheet in: what is still
 * empty, what is outside the matrix, what the instructions ask for but the
 * sheet does not have yet. Nothing here is a hard error - a half-filled
 * worksheet is a normal state - so everything is a warning or a note.
 */
import { matrixQuadrant, parseScores } from './types.js';

const MSG = {
  itemEmpty: { en: 'Change card {no} is still empty', ru: 'Карточка изменения {no} пока пустая' },
  fewItems: { en: 'The sheet asks for 3–5 changes, there are {count}', ru: 'В листе нужно 3–5 изменений, сейчас {count}' },
  manyItems: { en: 'The sheet is built for 3–5 changes, there are {count}: pick the strongest', ru: 'Лист рассчитан на 3–5 изменений, сейчас {count}: оставьте самые сильные' },
  outside: { en: '“{name}” is outside the matrix: place it in one of the four quadrants', ru: '«{name}» лежит вне матрицы: поставьте в один из четырёх квадрантов' },
  noBoard: { en: 'There are change cards but no matrix board to place them on', ru: 'Есть карточки изменений, но нет доски матрицы' },
  whyMissing: {
    en: 'There are “quick wins” but no explanation of why to implement the first one first',
    ru: 'Есть «быстрые победы», но нет пояснения, почему внедрять первой именно эту',
  },
  whyEmpty: { en: 'Explain in one sentence why the quick win goes first', ru: 'Объясните одним предложением, почему быстрая победа идёт первой' },
  duplicateNo: { en: 'Number {no} is used by more than one card', ru: 'Номер {no} стоит у нескольких карточек' },
  answerEmpty: { en: 'Answer the question: “{question}”', ru: 'Ответьте на вопрос: «{question}»' },
  stageEmpty: { en: 'A journey stage has no name', ru: 'У этапа пути нет названия' },
  cellsEmpty: { en: '{count} journey cell(s) are still empty', ru: 'Пустых ячеек пути: {count}' },
  curveCount: {
    en: 'The emotion curve has {scores} value(s) for {stages} stage(s)',
    ru: 'В кривой эмоций {scores} знач., а этапов {stages}',
  },
  curveRange: { en: 'Emotion scores must be between −2 and +2', ru: 'Оценки эмоций должны быть от −2 до +2' },
  duplicateId: { en: 'Duplicate identifier “{id}”', ru: 'Идентификатор «{id}» дублируется' },
};

function problem(severity, key, params, target) {
  return { severity, messageKey: key, message: MSG[key], params: params || {}, ...target };
}

const rectOf = (node) => ({ x: node.x, y: node.y, w: node.w, h: node.h });

export function validateSheet(diagram) {
  const problems = [];
  const add = (severity, key, params, element) =>
    problems.push(problem(severity, key, params, { diagramId: diagram.id, elementId: element?.id }));
  const nodes = diagram.nodes;

  const seen = new Set();
  for (const node of nodes) {
    if (seen.has(node.id)) add('error', 'duplicateId', { id: node.id }, node);
    seen.add(node.id);
  }

  const ofType = (type) => nodes.filter((node) => node.type === type);

  /* impact / effort matrix */
  const items = ofType('sheetItem');
  const board = ofType('sheetBoard')[0];
  if (items.length && !board) add('warning', 'noBoard', {}, items[0]);
  if (items.length || board) {
    const filled = items.filter((item) => (item.label || '').trim());
    for (const item of items) {
      if (!(item.label || '').trim()) add('warning', 'itemEmpty', { no: item.props?.no || '' }, item);
    }
    if (items.length < 3) add('warning', 'fewItems', { count: items.length }, items[0] || board);
    if (items.length > 5) add('info', 'manyItems', { count: items.length }, items[5]);

    const numbers = new Map();
    for (const item of items) {
      const no = item.props?.no;
      if (!no) continue;
      numbers.set(no, (numbers.get(no) || 0) + 1);
    }
    for (const [no, count] of numbers) if (count > 1) add('info', 'duplicateNo', { no }, items.find((item) => item.props?.no === no));

    if (board) {
      let quickWins = 0;
      for (const item of filled) {
        const quadrant = matrixQuadrant(board, rectOf(item));
        if (!quadrant) add('warning', 'outside', { name: item.label.split('\n')[0].slice(0, 60) }, item);
        if (quadrant === 'win') quickWins++;
      }
      if (quickWins) {
        const why = nodes.find((node) => node.type === 'sheetText' && node.props?.role === 'why');
        if (!why) add('warning', 'whyMissing', {}, board);
        else if (!(why.label || '').trim()) add('warning', 'whyEmpty', {}, why);
      }
    }
  }

  /* question sheets */
  for (const question of ofType('sheetQuestion')) {
    if (!(question.label || '').trim()) {
      add('warning', 'answerEmpty', { question: (question.props?.question || '').slice(0, 70) }, question);
    }
  }

  /* customer journey */
  const stages = ofType('journeyStage');
  if (stages.length) {
    for (const stage of stages) if (!(stage.label || '').trim()) add('warning', 'stageEmpty', {}, stage);
    const empty = ofType('journeyCell').filter((cell) => !(cell.label || '').trim());
    if (empty.length) add('warning', 'cellsEmpty', { count: empty.length }, empty[0]);
    for (const curve of ofType('journeyCurve')) {
      const scores = parseScores(curve.props?.scores);
      if (scores.length !== stages.length) add('warning', 'curveCount', { scores: scores.length, stages: stages.length }, curve);
      if (scores.some((value) => value < -2 || value > 2)) add('warning', 'curveRange', {}, curve);
    }
  }
  return problems;
}
