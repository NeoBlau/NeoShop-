/**
 * Built-in offline generator.
 *
 * This is NOT a language model: it is a deterministic parser with a domain
 * template library.  It reads the description, splits it into steps, guesses
 * the BPMN element type / IDEF0 ICOM role of each fragment from verb and noun
 * markers, and falls back to the closest matching template when the text is
 * only a title.  Everything works without a network connection.
 */
import { BPMN_TEMPLATES, findBpmnTemplate } from '../notations/bpmn/templates.js';
import { IDEF0_TEMPLATES, findIdef0Template } from '../notations/idef0/templates.js';

const SPLIT_RE = /(?:\r?\n|[.;!]+|\s+(?:затем|потом|после чего|после этого|далее|then|next|afterwards)\s+)/i;
const BULLET_RE = /^\s*(?:[-–—*•]|\d+[.)])\s*/;

const KEYWORDS = {
  start: ['начало', 'старт', 'поступ', 'получен', 'обратился', 'заявка', 'инициир', 'start', 'received', 'request comes'],
  end: ['конец', 'заверш', 'закрыт', 'готов', 'отгруж', 'выдан', 'end', 'finish', 'completed', 'closed'],
  decision: ['если', 'проверить', 'проверк', 'решен', 'согласова', 'утвержд', 'выбрать', 'определить', 'оценить', '?', 'if', 'check', 'verify', 'decide', 'approve'],
  parallel: ['параллельно', 'одновременно', 'in parallel', 'simultaneously'],
  user: ['менеджер', 'сотрудник', 'оператор', 'специалист', 'бухгалтер', 'руководител', 'клиент', 'пользователь', 'manager', 'employee', 'operator', 'user', 'customer'],
  service: ['систем', 'автоматическ', 'сервис', 'программ', 'робот', 'скрипт', 'api', 'crm', 'erp', 'automatic', 'service', 'system'],
  manual: ['вручную', 'физическ', 'склад', 'упакова', 'погруз', 'собрать', 'принять товар', 'manually', 'pack', 'load'],
  send: ['отправ', 'уведом', 'сообщ', 'письмо', 'email', 'почт', 'send', 'notify', 'inform'],
  receive: ['получ', 'принять', 'дождат', 'ожида', 'receive', 'await', 'wait for'],
  rule: ['правил', 'политик', 'регламент', 'тариф', 'скоринг', 'норматив', 'rule', 'policy', 'scoring'],
  timer: ['через', 'ждать', 'таймер', 'срок', 'дней', 'часов', 'timer', 'after ', 'deadline'],
  script: ['расчет', 'расчёт', 'вычисл', 'сформир', 'calculate', 'compute', 'generate'],
};

const ACTORS = [
  { match: ['клиент', 'заказчик', 'покупател', 'customer', 'client'], label: { ru: 'Клиент', en: 'Customer' } },
  { match: ['менеджер', 'продавец', 'sales', 'manager'], label: { ru: 'Менеджер', en: 'Manager' } },
  { match: ['бухгалт', 'финанс', 'accounting', 'finance'], label: { ru: 'Бухгалтерия', en: 'Accounting' } },
  { match: ['склад', 'логист', 'warehouse', 'logistics'], label: { ru: 'Склад', en: 'Warehouse' } },
  { match: ['руководител', 'директор', 'head', 'director'], label: { ru: 'Руководитель', en: 'Manager' } },
  { match: ['систем', 'сервис', 'system', 'service', 'crm', 'erp'], label: { ru: 'Система', en: 'System' } },
  { match: ['поддержк', 'support', 'инженер', 'engineer'], label: { ru: 'Поддержка', en: 'Support' } },
  { match: ['hr', 'кадр', 'рекрут', 'recruit'], label: { ru: 'HR', en: 'HR' } },
];

const CONTROL_MARKERS = ['по правил', 'согласно', 'регламент', 'политик', 'стандарт', 'закон', 'требован', 'инструкц', 'договор', 'according to', 'policy', 'regulation', 'standard', 'rules'];
const MECHANISM_MARKERS = ['с помощью', 'используя', 'сотрудник', 'персонал', 'систем', 'оборудован', 'программ', 'using', 'by means of', 'staff', 'equipment', 'software'];
const INPUT_MARKERS = ['вход', 'на основании', 'из ', 'исходн', 'заявк', 'сырь', 'материал', 'input', 'based on'];
const OUTPUT_MARKERS = ['выход', 'результат', 'получ', 'формиру', 'создаёт', 'создает', 'output', 'result', 'produces'];

function has(text, list) {
  const lower = text.toLowerCase();
  return list.some((keyword) => lower.includes(keyword));
}

function splitSteps(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.replace(BULLET_RE, '').trim())
    .filter(Boolean);
  const looksLikeList = lines.length >= 2;
  const raw = looksLikeList ? lines : String(text || '').split(SPLIT_RE);
  return raw
    .flatMap((chunk) => (looksLikeList ? [chunk] : chunk.split(SPLIT_RE)))
    .map((chunk) => chunk.replace(BULLET_RE, '').trim())
    .filter((chunk) => chunk.length > 2);
}

function shortTitle(text) {
  const first = splitSteps(text)[0] || String(text || '').trim();
  return capitalize(first.split(/[:,]/)[0].trim().slice(0, 60));
}

function titleOf(text) {
  const first = splitSteps(text)[0] || String(text || '').trim();
  return capitalize(first.slice(0, 80));
}

function capitalize(value) {
  const trimmed = String(value || '').trim();
  return trimmed ? trimmed[0].toUpperCase() + trimmed.slice(1) : trimmed;
}

function detectActor(step, locale) {
  const lower = step.toLowerCase();
  const explicit = /^([\p{L}\s]{3,24}):\s*/u.exec(step);
  if (explicit) return { id: explicit[1].trim().toLowerCase(), label: capitalize(explicit[1].trim()) };
  for (const actor of ACTORS) {
    if (actor.match.some((m) => lower.includes(m))) return { id: actor.label.en.toLowerCase(), label: actor.label[locale] || actor.label.en };
  }
  return null;
}

function stripActor(step) {
  return capitalize(step.replace(/^([\p{L}\s]{3,24}):\s*/u, '').trim());
}

function classify(step, index, total) {
  const lower = step.toLowerCase();
  if (index === 0 && has(lower, KEYWORDS.start)) return 'start';
  if (index === total - 1 && has(lower, KEYWORDS.end)) return 'end';
  if (lower.includes('?') || (has(lower, KEYWORDS.decision) && /если|if|\?|или|or /i.test(lower))) return 'gateway';
  if (has(lower, KEYWORDS.timer) && /\d/.test(lower)) return 'intermediateTimerEvent';
  if (has(lower, KEYWORDS.send)) return 'sendTask';
  if (has(lower, KEYWORDS.receive) && index > 0) return 'receiveTask';
  if (has(lower, KEYWORDS.rule)) return 'businessRuleTask';
  if (has(lower, KEYWORDS.script)) return 'scriptTask';
  if (has(lower, KEYWORDS.service)) return 'serviceTask';
  if (has(lower, KEYWORDS.manual)) return 'manualTask';
  if (has(lower, KEYWORDS.user)) return 'userTask';
  if (has(lower, KEYWORDS.decision)) return 'userTask';
  return 'task';
}

/* ------------------------------------------------------------------- BPMN */

export function generateBpmnSpec(prompt, { complexity = 'medium', locale = 'ru' } = {}) {
  const steps = splitSteps(prompt);
  const meaningful = steps.filter((s) => s.split(/\s+/).length > 1);

  if (meaningful.length < 2) {
    const template = findBpmnTemplate(prompt) || BPMN_TEMPLATES[0];
    const spec = JSON.parse(JSON.stringify(template.spec));
    spec.name = titleOf(prompt) || spec.name;
    return { spec, source: 'template', templateId: template.id };
  }

  const limit = complexity === 'simple' ? 6 : complexity === 'detailed' ? 18 : 10;
  const chosen = meaningful.slice(0, limit);
  const lanes = new Map();
  const nodes = [];
  const edges = [];

  const addNode = (node) => {
    nodes.push(node);
    return node;
  };

  let previous = null;
  const firstType = classify(chosen[0], 0, chosen.length);
  if (firstType !== 'start') {
    previous = addNode({ id: 'start', type: 'startEvent', label: locale === 'ru' ? 'Начало' : 'Start' });
  }

  // "if X then Y" becomes a gateway plus the action that follows it
  const expanded = [];
  for (const step of chosen) {
    const conditional = /^\s*(?:если|if)\s+([^,]+?)[,]\s*(?:то\s+|then\s+)?(.+)$/i.exec(step);
    if (conditional && conditional[2].split(/\s+/).length > 1) {
      expanded.push({ text: capitalize(conditional[1].trim()), forceGateway: true });
      expanded.push({ text: capitalize(conditional[2].trim()) });
    } else {
      expanded.push({ text: step });
    }
  }

  expanded.forEach((entry, index) => {
    const rawStep = entry.text;
    const actor = detectActor(rawStep, locale);
    if (actor && !lanes.has(actor.id)) lanes.set(actor.id, { id: actor.id, label: actor.label });
    const step = stripActor(rawStep);
    const type = entry.forceGateway ? 'gateway' : classify(step, index, expanded.length);
    const id = `n${index}`;

    if (type === 'gateway') {
      const question = /\?$/.test(step) ? step : `${step.replace(/^(проверить|проверка|check|verify)\s*/i, '')}?`;
      const gateway = addNode({ id, type: 'exclusiveGateway', label: capitalize(question), lane: actor?.id });
      if (previous) edges.push({ source: previous.id, target: id });
      // the "otherwise" branch becomes a visible alternative path
      const alternative = addNode({
        id: `${id}_alt`,
        type: 'sendTask',
        label: locale === 'ru' ? 'Обработать отклонение' : 'Handle rejection',
        lane: actor?.id,
      });
      const altEnd = addNode({ id: `${id}_altend`, type: 'endEvent', label: locale === 'ru' ? 'Отклонено' : 'Rejected', lane: actor?.id });
      edges.push({ source: id, target: alternative.id, label: locale === 'ru' ? 'нет' : 'no' });
      edges.push({ source: alternative.id, target: altEnd.id });
      previous = { id, branch: true };
      return;
    }

    const mapped = type === 'start' ? 'startEvent' : type === 'end' ? 'endEvent' : type;
    const node = addNode({ id, type: mapped, label: capitalize(step), lane: actor?.id });
    if (previous) {
      edges.push({
        source: previous.id,
        target: id,
        label: previous.branch ? (locale === 'ru' ? 'да' : 'yes') : undefined,
      });
    }
    previous = node;
  });

  const lastType = nodes.length ? nodes[nodes.length - 1].type : '';
  if (lastType !== 'endEvent') {
    const end = addNode({ id: 'end', type: 'endEvent', label: locale === 'ru' ? 'Процесс завершён' : 'Process completed', lane: nodes[nodes.length - 1]?.lane });
    edges.push({ source: previous.id, target: end.id, label: previous.branch ? (locale === 'ru' ? 'да' : 'yes') : undefined });
  }

  if (complexity === 'detailed') {
    const document = nodes.find((n) => /счет|счёт|договор|документ|invoice|contract|document/i.test(n.label || ''));
    if (document) {
      nodes.push({ id: 'doc', type: 'dataObject', label: locale === 'ru' ? 'Документ' : 'Document', lane: document.lane });
      edges.push({ source: document.id, target: 'doc', type: 'dataAssociation' });
    }
  }

  return {
    spec: {
      notation: 'bpmn',
      name: titleOf(prompt),
      lanes: [...lanes.values()],
      nodes,
      edges,
    },
    source: 'parser',
  };
}

/* ------------------------------------------------------------------ IDEF0 */

function extractPhrases(text, markers) {
  const found = [];
  for (const sentence of splitSteps(text)) {
    const lower = sentence.toLowerCase();
    for (const marker of markers) {
      const index = lower.indexOf(marker);
      if (index < 0) continue;
      const tail = sentence
        .slice(index + marker.length)
        .replace(/^[\s:—-]+/, '')
        .split(/[,.;]/)[0]
        .trim();
      if (tail.length > 2) found.push(capitalize(tail.slice(0, 48)));
    }
  }
  // drop phrases that are contained in a longer one ("продаж" inside "регламенту продаж")
  const unique = [...new Set(found)];
  return unique
    .filter((phrase) => !unique.some((other) => other !== phrase && other.toLowerCase().includes(phrase.toLowerCase())))
    .slice(0, 4);
}

export function generateIdef0Spec(prompt, { complexity = 'medium', locale = 'ru' } = {}) {
  const steps = splitSteps(prompt);
  const meaningful = steps.filter((s) => s.split(/\s+/).length > 1);
  const title = shortTitle(prompt);

  const inputs = extractPhrases(prompt, INPUT_MARKERS);
  const controls = extractPhrases(prompt, CONTROL_MARKERS);
  const outputs = extractPhrases(prompt, OUTPUT_MARKERS);
  const mechanisms = extractPhrases(prompt, MECHANISM_MARKERS);

  if (meaningful.length < 2 && !inputs.length && !outputs.length) {
    const template = findIdef0Template(prompt) || IDEF0_TEMPLATES[0];
    const spec = JSON.parse(JSON.stringify(template.spec));
    spec.name = title || spec.name;
    spec.context.label = title || spec.context.label;
    return { spec, source: 'template', templateId: template.id };
  }

  const defaults = {
    inputs: locale === 'ru' ? ['Исходные данные'] : ['Source data'],
    controls: locale === 'ru' ? ['Регламент процесса'] : ['Process regulation'],
    outputs: locale === 'ru' ? ['Результат процесса'] : ['Process result'],
    mechanisms: locale === 'ru' ? ['Персонал', 'Информационная система'] : ['Staff', 'Information system'],
  };

  const limit = complexity === 'simple' ? 3 : complexity === 'detailed' ? 6 : 4;
  const icomMarkers = [...INPUT_MARKERS, ...OUTPUT_MARKERS, ...CONTROL_MARKERS, ...MECHANISM_MARKERS];
  const actionSteps = meaningful.filter((step) => !has(step, icomMarkers) || /^(?:[А-ЯA-Z][а-яa-z]+ть|[А-ЯA-Z])/.test(step) === false);
  const functionSteps = (actionSteps.length >= 2 ? actionSteps : meaningful).slice(0, limit);
  const functions = functionSteps.map((step, index) => {
    const label = capitalize(stripActor(step).slice(0, 60));
    const previousOutput = index === 0 ? null : `${locale === 'ru' ? 'Результат шага' : 'Result of step'} A${index}`;
    return {
      number: `A${index + 1}`,
      label,
      inputs: index === 0 ? (inputs.length ? inputs : defaults.inputs) : [previousOutput],
      controls: controls.length ? [controls[index % controls.length]] : defaults.controls,
      outputs:
        index === functionSteps.length - 1
          ? outputs.length
            ? outputs
            : defaults.outputs
          : [`${locale === 'ru' ? 'Результат шага' : 'Result of step'} A${index + 1}`],
      mechanisms: mechanisms.length ? [mechanisms[index % mechanisms.length]] : [defaults.mechanisms[index % defaults.mechanisms.length]],
    };
  });

  return {
    spec: {
      notation: 'idef0',
      name: title,
      context: {
        label: title,
        number: 'A0',
        inputs: inputs.length ? inputs : defaults.inputs,
        controls: controls.length ? controls : defaults.controls,
        outputs: outputs.length ? outputs : defaults.outputs,
        mechanisms: mechanisms.length ? mechanisms : defaults.mechanisms,
      },
      functions,
    },
    source: 'parser',
  };
}

/** Chooses the notation automatically when the user selected "Auto". */
export function detectNotation(prompt) {
  const lower = String(prompt || '').toLowerCase();
  const idef0Score = ['функци', 'idef0', 'вход', 'выход', 'механизм', 'управлени', 'декомпозиц', 'система', 'function', 'icom'].filter((k) =>
    lower.includes(k)
  ).length;
  const bpmnScore = ['процесс', 'шаг', 'заявка', 'клиент', 'затем', 'если', 'bpmn', 'workflow', 'step', 'then'].filter((k) => lower.includes(k)).length;
  return idef0Score > bpmnScore ? 'idef0' : 'bpmn';
}

export function generateLocalSpec(prompt, options = {}) {
  const notation = options.notation && options.notation !== 'auto' ? options.notation : detectNotation(prompt);
  return notation === 'idef0' ? generateIdef0Spec(prompt, options) : generateBpmnSpec(prompt, options);
}
