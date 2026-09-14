/**
 * BPMN 2.0 element catalogue.
 *
 * Every entry describes how an element looks, how large it is, which
 * properties it exposes and how it maps onto BPMN 2.0 XML.  The canvas, the
 * palette, the properties panel, the validator and the XML (de)serialiser all
 * read from this single source of truth.
 */
import * as G from './glyphs.js';
import { circle, diamond, esc, line, n, polygon, rect, textBlock } from '../shared.js';

export const EVENT_SIZE = 36;
export const GATEWAY_SIZE = 50;

/* ------------------------------------------------------------ paint utils */

function fillOf(node, fallback) {
  return node.style?.fill || fallback;
}
function strokeOf(node, fallback) {
  return node.style?.stroke || fallback;
}
function textOf(node) {
  return node.style?.textColor || 'var(--el-text)';
}

/* ---------------------------------------------------------------- drawing */

const EVENT_STROKE = {
  start: { width: 1.6, double: false, tint: 'start' },
  intermediateCatch: { width: 1.4, double: true, tint: 'mid' },
  intermediateThrow: { width: 1.4, double: true, tint: 'mid' },
  boundary: { width: 1.4, double: true, tint: 'mid' },
  end: { width: 3.2, double: false, tint: 'end' },
};

function eventGlyph(definition, cx, cy, filled) {
  const size = 16;
  switch (definition) {
    case 'message':
      return G.envelope(cx, cy, size, filled);
    case 'timer':
      return G.clock(cx, cy, size + 2);
    case 'error':
      return G.bolt(cx, cy, size + 2, filled);
    case 'signal':
      return G.triangle(cx, cy, size + 1, filled);
    case 'escalation':
      return G.escalation(cx, cy, size + 1, filled);
    case 'conditional':
      return G.conditional(cx, cy, size);
    case 'link':
      return G.linkArrow(cx, cy, size + 2, filled);
    case 'terminate':
      return G.terminate(cx, cy, size - 2);
    case 'multiple':
      return G.multiple(cx, cy, size, filled);
    default:
      return '';
  }
}

function drawEvent(node, ctx, kind, definition) {
  const spec = EVENT_STROKE[kind] || EVENT_STROKE.start;
  const r = Math.min(node.w, node.h) / 2;
  const cx = node.w / 2;
  const cy = node.h / 2;
  const stroke = strokeOf(node, `var(--ev-${spec.tint}-stroke)`);
  const fill = fillOf(node, `var(--ev-${spec.tint}-fill)`);
  const filled = kind === 'intermediateThrow' || kind === 'end';
  let markup = circle(cx, cy, r - spec.width / 2, `fill="${fill}" stroke="${stroke}" stroke-width="${spec.width}"`);
  if (spec.double) markup += circle(cx, cy, r - spec.width / 2 - 3.2, `fill="none" stroke="${stroke}" stroke-width="${spec.width}"`);
  markup += `<g color="${stroke}">${eventGlyph(definition, cx, cy, filled)}</g>`;
  markup += textBlock(node.label, {
    x: -40,
    y: node.h + 3,
    width: node.w + 80,
    height: 30,
    valign: 'top',
    fontSize: 11.5,
    color: textOf(node),
    maxLines: 3,
  });
  return markup;
}

function taskMarkers(node) {
  const cx = node.w / 2;
  const cy = node.h - 11;
  const markers = [];
  const loop = node.props?.loopType;
  if (loop === 'standard') markers.push(G.loopMarker(0, 0, 13));
  else if (loop === 'multiInstanceParallel') markers.push(G.parallelMarker(0, 0, 13));
  else if (loop === 'multiInstanceSequential') markers.push(G.sequentialMarker(0, 0, 13));
  if (node.props?.isAdhoc) markers.push(G.adhocMarker(0, 0, 13));
  if (!markers.length) return '';
  const step = 18;
  const startX = cx - ((markers.length - 1) * step) / 2;
  return markers
    .map((m, i) => `<g transform="translate(${n(startX + i * step)},${n(cy)})" color="var(--el-stroke)">${m}</g>`)
    .join('');
}

function drawTask(node, ctx, icon, options = {}) {
  const fill = fillOf(node, 'var(--task-fill)');
  const stroke = strokeOf(node, 'var(--task-stroke)');
  const thick = options.thick ? 3 : 1.4;
  let markup = rect(thick / 2, thick / 2, node.w - thick, node.h - thick, 10, `fill="${fill}" stroke="${stroke}" stroke-width="${thick}"`);
  if (options.dashed) {
    markup = rect(
      thick / 2,
      thick / 2,
      node.w - thick,
      node.h - thick,
      10,
      `fill="${fill}" stroke="${stroke}" stroke-width="${thick}" stroke-dasharray="6 4"`
    );
  }
  if (icon) markup += `<g color="var(--el-icon)">${icon(ctx?.preview ? 6 : 7, ctx?.preview ? 6 : 7, ctx?.preview ? 24 : 16)}</g>`;
  markup += textBlock(node.label, {
    x: 8,
    y: 8,
    width: node.w - 16,
    height: node.h - 16,
    fontSize: 12.5,
    color: textOf(node),
    maxLines: 5,
  });
  markup += taskMarkers(node);
  if (options.collapsed) markup += `<g color="var(--el-stroke)">${G.plusBox(node.w / 2, node.h - 10, 13)}</g>`;
  return markup;
}

function drawGateway(node, ctx, marker) {
  const fill = fillOf(node, 'var(--gw-fill)');
  const stroke = strokeOf(node, 'var(--gw-stroke)');
  const cx = node.w / 2;
  const cy = node.h / 2;
  let markup = diamond(1, 1, node.w - 2, node.h - 2, `fill="${fill}" stroke="${stroke}" stroke-width="1.6" stroke-linejoin="round"`);
  markup += `<g color="${stroke}">${marker(cx, cy, node.w)}</g>`;
  markup += textBlock(node.label, {
    x: -40,
    y: node.h + 3,
    width: node.w + 80,
    height: 30,
    valign: 'top',
    fontSize: 11.5,
    color: textOf(node),
    maxLines: 3,
  });
  return markup;
}

const gatewayMarkers = {
  exclusive: (cx, cy, s) => {
    const d = s * 0.2;
    return `<line x1="${n(cx - d)}" y1="${n(cy - d)}" x2="${n(cx + d)}" y2="${n(cy + d)}" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><line x1="${n(
      cx + d
    )}" y1="${n(cy - d)}" x2="${n(cx - d)}" y2="${n(cy + d)}" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`;
  },
  inclusive: (cx, cy, s) => circle(cx, cy, s * 0.22, 'fill="none" stroke="currentColor" stroke-width="2.6"'),
  parallel: (cx, cy, s) => {
    const d = s * 0.26;
    return `<line x1="${n(cx - d)}" y1="${n(cy)}" x2="${n(cx + d)}" y2="${n(cy)}" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><line x1="${n(
      cx
    )}" y1="${n(cy - d)}" x2="${n(cx)}" y2="${n(cy + d)}" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`;
  },
  eventBased: (cx, cy, s) => {
    const r = s * 0.3;
    const pts = [];
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      pts.push({ x: cx + Math.cos(a) * r * 0.62, y: cy + Math.sin(a) * r * 0.62 });
    }
    return (
      circle(cx, cy, r, 'fill="none" stroke="currentColor" stroke-width="1.2"') +
      circle(cx, cy, r * 0.82, 'fill="none" stroke="currentColor" stroke-width="1.2"') +
      polygon(pts, 'fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"')
    );
  },
  complex: (cx, cy, s) => {
    const d = s * 0.26;
    const k = d * 0.7;
    return (
      `<line x1="${n(cx - d)}" y1="${n(cy)}" x2="${n(cx + d)}" y2="${n(cy)}" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>` +
      `<line x1="${n(cx)}" y1="${n(cy - d)}" x2="${n(cx)}" y2="${n(cy + d)}" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>` +
      `<line x1="${n(cx - k)}" y1="${n(cy - k)}" x2="${n(cx + k)}" y2="${n(cy + k)}" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>` +
      `<line x1="${n(cx + k)}" y1="${n(cy - k)}" x2="${n(cx - k)}" y2="${n(cy + k)}" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>`
    );
  },
};

/* ----------------------------------------------------------- prop helpers */

const P = {
  name: { key: 'label', type: 'text', label: { en: 'Name', ru: 'Название' }, group: 'general' },
  id: { key: 'id', type: 'id', label: { en: 'ID', ru: 'Идентификатор' }, group: 'general' },
  description: {
    key: 'description',
    type: 'textarea',
    label: { en: 'Description', ru: 'Описание' },
    group: 'general',
    rows: 2,
  },
  documentation: {
    key: 'documentation',
    type: 'textarea',
    label: { en: 'Documentation', ru: 'Документация' },
    group: 'documentation',
    rows: 5,
  },
};

const LOOP_PROP = {
  key: 'loopType',
  type: 'select',
  label: { en: 'Loop / multi-instance', ru: 'Цикл / экземпляры' },
  group: 'advanced',
  options: [
    { value: '', label: { en: 'None', ru: 'Нет' } },
    { value: 'standard', label: { en: 'Loop', ru: 'Цикл' } },
    { value: 'multiInstanceParallel', label: { en: 'Multi-instance (parallel)', ru: 'Экземпляры (параллельно)' } },
    { value: 'multiInstanceSequential', label: { en: 'Multi-instance (sequential)', ru: 'Экземпляры (последовательно)' } },
  ],
};

const ASSIGNEE_PROP = {
  key: 'assignee',
  type: 'text',
  label: { en: 'Performer / role', ru: 'Исполнитель / роль' },
  group: 'general',
};

function taskProps(extra = []) {
  return [P.name, P.id, ...extra, P.description, LOOP_PROP, P.documentation];
}

function eventProps(extra = []) {
  return [P.name, P.id, ...extra, P.description, P.documentation];
}

/* ------------------------------------------------------------- catalogue */

function eventType(id, kind, definition, name, palette) {
  const tint = EVENT_STROKE[kind].tint;
  return {
    id,
    category: 'event',
    kind,
    definition,
    name,
    palette,
    group: 'events',
    defaultSize: { w: EVENT_SIZE, h: EVENT_SIZE },
    minSize: { w: 24, h: 24 },
    keepSquare: true,
    resizable: true,
    labelPlacement: 'outside',
    tint,
    draw: (node, ctx) => drawEvent(node, ctx, kind, definition),
    props: eventProps(eventExtraProps(definition)),
    bpmn: bpmnMappingForEvent(kind, definition),
  };
}

function eventExtraProps(definition) {
  switch (definition) {
    case 'timer':
      return [
        {
          key: 'timerType',
          type: 'select',
          label: { en: 'Timer type', ru: 'Тип таймера' },
          group: 'general',
          options: [
            { value: 'date', label: { en: 'Date', ru: 'Дата' } },
            { value: 'duration', label: { en: 'Duration', ru: 'Длительность' } },
            { value: 'cycle', label: { en: 'Cycle', ru: 'Цикл' } },
          ],
        },
        { key: 'timerValue', type: 'text', label: { en: 'Timer value', ru: 'Значение' }, group: 'general' },
      ];
    case 'error':
      return [{ key: 'errorCode', type: 'text', label: { en: 'Error code', ru: 'Код ошибки' }, group: 'general' }];
    case 'signal':
      return [{ key: 'signalName', type: 'text', label: { en: 'Signal', ru: 'Сигнал' }, group: 'general' }];
    case 'escalation':
      return [{ key: 'escalationCode', type: 'text', label: { en: 'Escalation code', ru: 'Код эскалации' }, group: 'general' }];
    case 'message':
      return [{ key: 'messageName', type: 'text', label: { en: 'Message', ru: 'Сообщение' }, group: 'general' }];
    case 'conditional':
      return [{ key: 'condition', type: 'text', label: { en: 'Condition', ru: 'Условие' }, group: 'general' }];
    case 'link':
      return [{ key: 'linkName', type: 'text', label: { en: 'Link name', ru: 'Имя связи' }, group: 'general' }];
    default:
      return [];
  }
}

function bpmnMappingForEvent(kind, definition) {
  const element =
    kind === 'start'
      ? 'startEvent'
      : kind === 'end'
        ? 'endEvent'
        : kind === 'boundary'
          ? 'boundaryEvent'
          : kind === 'intermediateThrow'
            ? 'intermediateThrowEvent'
            : 'intermediateCatchEvent';
  const defMap = {
    message: 'messageEventDefinition',
    timer: 'timerEventDefinition',
    error: 'errorEventDefinition',
    signal: 'signalEventDefinition',
    escalation: 'escalationEventDefinition',
    conditional: 'conditionalEventDefinition',
    link: 'linkEventDefinition',
    terminate: 'terminateEventDefinition',
    multiple: null,
  };
  return { element, eventDefinition: definition ? defMap[definition] : null };
}

export const BPMN_TYPES = {};

function register(type) {
  BPMN_TYPES[type.id] = type;
  return type;
}

/* events ------------------------------------------------------------------ */
register(eventType('startEvent', 'start', null, { en: 'Start event', ru: 'Стартовое событие' }, true));
register(eventType('startMessageEvent', 'start', 'message', { en: 'Message start', ru: 'Старт по сообщению' }, true));
register(eventType('startTimerEvent', 'start', 'timer', { en: 'Timer start', ru: 'Старт по таймеру' }, true));
register(eventType('startConditionalEvent', 'start', 'conditional', { en: 'Conditional start', ru: 'Старт по условию' }, true));
register(eventType('startSignalEvent', 'start', 'signal', { en: 'Signal start', ru: 'Старт по сигналу' }, true));
register(eventType('startErrorEvent', 'start', 'error', { en: 'Error start', ru: 'Старт по ошибке' }, false));
register(eventType('startEscalationEvent', 'start', 'escalation', { en: 'Escalation start', ru: 'Старт по эскалации' }, false));

register(eventType('intermediateEvent', 'intermediateCatch', null, { en: 'Intermediate event', ru: 'Промежуточное событие' }, true));
register(eventType('intermediateMessageCatchEvent', 'intermediateCatch', 'message', { en: 'Message receive', ru: 'Получение сообщения' }, true));
register(eventType('intermediateMessageThrowEvent', 'intermediateThrow', 'message', { en: 'Message send', ru: 'Отправка сообщения' }, true));
register(eventType('intermediateTimerEvent', 'intermediateCatch', 'timer', { en: 'Timer', ru: 'Таймер' }, true));
register(eventType('intermediateErrorEvent', 'boundary', 'error', { en: 'Error', ru: 'Ошибка' }, true));
register(eventType('intermediateSignalCatchEvent', 'intermediateCatch', 'signal', { en: 'Signal receive', ru: 'Приём сигнала' }, true));
register(eventType('intermediateSignalThrowEvent', 'intermediateThrow', 'signal', { en: 'Signal send', ru: 'Отправка сигнала' }, false));
register(eventType('intermediateEscalationEvent', 'intermediateThrow', 'escalation', { en: 'Escalation', ru: 'Эскалация' }, true));
register(eventType('intermediateConditionalEvent', 'intermediateCatch', 'conditional', { en: 'Conditional', ru: 'Условие' }, true));
register(eventType('intermediateLinkCatchEvent', 'intermediateCatch', 'link', { en: 'Link (catch)', ru: 'Связь (вход)' }, true));
register(eventType('intermediateLinkThrowEvent', 'intermediateThrow', 'link', { en: 'Link (throw)', ru: 'Связь (выход)' }, true));

register(eventType('endEvent', 'end', null, { en: 'End event', ru: 'Конечное событие' }, true));
register(eventType('endMessageEvent', 'end', 'message', { en: 'Message end', ru: 'Конец с сообщением' }, true));
register(eventType('endErrorEvent', 'end', 'error', { en: 'Error end', ru: 'Конец с ошибкой' }, true));
register(eventType('endSignalEvent', 'end', 'signal', { en: 'Signal end', ru: 'Конец с сигналом' }, true));
register(eventType('endEscalationEvent', 'end', 'escalation', { en: 'Escalation end', ru: 'Конец с эскалацией' }, false));
register(eventType('endTerminateEvent', 'end', 'terminate', { en: 'Terminate', ru: 'Завершение процесса' }, true));

/* activities -------------------------------------------------------------- */
function activityType(id, name, options = {}) {
  return register({
    id,
    category: 'activity',
    name,
    palette: options.palette !== false,
    group: 'activities',
    defaultSize: options.defaultSize || { w: 132, h: 84 },
    paletteSize: { w: 60, h: 42 },
    minSize: { w: 70, h: 48 },
    resizable: true,
    labelPlacement: 'inside',
    container: !!options.container,
    decomposable: !!options.decomposable,
    draw: (node, ctx) => drawTask(node, ctx, options.icon, options),
    props: taskProps(options.extraProps || []),
    bpmn: { element: options.element, taskIcon: options.iconName || null },
  });
}

activityType('task', { en: 'Task', ru: 'Задача' }, { element: 'task' });
activityType('userTask', { en: 'User task', ru: 'Пользовательская задача' }, {
  element: 'userTask',
  icon: G.iconUser,
  extraProps: [ASSIGNEE_PROP],
});
activityType('manualTask', { en: 'Manual task', ru: 'Ручная задача' }, { element: 'manualTask', icon: G.iconManual });
activityType('serviceTask', { en: 'Service task', ru: 'Сервисная задача' }, {
  element: 'serviceTask',
  icon: G.iconGear,
  extraProps: [{ key: 'implementation', type: 'text', label: { en: 'Implementation', ru: 'Реализация' }, group: 'advanced' }],
});
activityType('scriptTask', { en: 'Script task', ru: 'Скриптовая задача' }, {
  element: 'scriptTask',
  icon: G.iconScript,
  extraProps: [{ key: 'script', type: 'textarea', label: { en: 'Script', ru: 'Скрипт' }, group: 'advanced', rows: 4 }],
});
activityType('businessRuleTask', { en: 'Business rule task', ru: 'Задача бизнес-правила' }, {
  element: 'businessRuleTask',
  icon: G.iconRule,
});
activityType('sendTask', { en: 'Send task', ru: 'Задача отправки' }, { element: 'sendTask', icon: G.iconSend });
activityType('receiveTask', { en: 'Receive task', ru: 'Задача получения' }, { element: 'receiveTask', icon: G.iconReceive });
activityType('callActivity', { en: 'Call activity', ru: 'Вызов процесса' }, {
  element: 'callActivity',
  thick: true,
  decomposable: true,
  extraProps: [{ key: 'calledElement', type: 'text', label: { en: 'Called process', ru: 'Вызываемый процесс' }, group: 'general' }],
});
activityType('subProcess', { en: 'Sub-process', ru: 'Подпроцесс' }, {
  element: 'subProcess',
  collapsed: true,
  decomposable: true,
  defaultSize: { w: 150, h: 96 },
});
activityType('eventSubProcess', { en: 'Event sub-process', ru: 'Событийный подпроцесс' }, {
  element: 'subProcess',
  dashed: true,
  collapsed: true,
  decomposable: true,
  defaultSize: { w: 160, h: 96 },
});
activityType('transaction', { en: 'Transaction', ru: 'Транзакция' }, {
  element: 'transaction',
  collapsed: true,
  decomposable: true,
  palette: false,
  defaultSize: { w: 150, h: 96 },
});

/* gateways ---------------------------------------------------------------- */
function gatewayType(id, name, markerKey, element) {
  return register({
    id,
    category: 'gateway',
    name,
    palette: true,
    group: 'gateways',
    defaultSize: { w: GATEWAY_SIZE, h: GATEWAY_SIZE },
    minSize: { w: 30, h: 30 },
    keepSquare: true,
    resizable: true,
    labelPlacement: 'outside',
    draw: (node, ctx) => drawGateway(node, ctx, gatewayMarkers[markerKey]),
    props: [
      P.name,
      P.id,
      {
        key: 'gatewayDirection',
        type: 'select',
        label: { en: 'Direction', ru: 'Направление' },
        group: 'advanced',
        options: [
          { value: 'Unspecified', label: { en: 'Unspecified', ru: 'Не задано' } },
          { value: 'Diverging', label: { en: 'Diverging (split)', ru: 'Ветвление' } },
          { value: 'Converging', label: { en: 'Converging (merge)', ru: 'Слияние' } },
          { value: 'Mixed', label: { en: 'Mixed', ru: 'Смешанное' } },
        ],
      },
      P.description,
      P.documentation,
    ],
    bpmn: { element },
  });
}

gatewayType('exclusiveGateway', { en: 'Exclusive gateway', ru: 'Исключающий шлюз' }, 'exclusive', 'exclusiveGateway');
gatewayType('parallelGateway', { en: 'Parallel gateway', ru: 'Параллельный шлюз' }, 'parallel', 'parallelGateway');
gatewayType('inclusiveGateway', { en: 'Inclusive gateway', ru: 'Включающий шлюз' }, 'inclusive', 'inclusiveGateway');
gatewayType('eventBasedGateway', { en: 'Event-based gateway', ru: 'Событийный шлюз' }, 'eventBased', 'eventBasedGateway');
gatewayType('complexGateway', { en: 'Complex gateway', ru: 'Комплексный шлюз' }, 'complex', 'complexGateway');

/* swimlanes --------------------------------------------------------------- */
register({
  id: 'pool',
  category: 'swimlane',
  name: { en: 'Pool', ru: 'Пул' },
  palette: true,
  group: 'swimlanes',
  defaultSize: { w: 720, h: 260 },
  paletteSize: { w: 120, h: 56 },
  minSize: { w: 240, h: 90 },
  resizable: true,
  container: true,
  zIndex: -20,
  labelPlacement: 'header',
  draw: (node) => {
    const fill = fillOf(node, 'var(--pool-fill)');
    const stroke = strokeOf(node, 'var(--pool-stroke)');
    const headerW = 30;
    return (
      rect(0.5, 0.5, node.w - 1, node.h - 1, 6, `fill="${fill}" stroke="${stroke}" stroke-width="1.4"`) +
      rect(0.5, 0.5, headerW, node.h - 1, 6, `fill="var(--pool-header)" stroke="${stroke}" stroke-width="1.4"`) +
      `<g transform="translate(${n(headerW / 2)},${n(node.h / 2)}) rotate(-90)">${textBlock(node.label, {
        x: -node.h / 2,
        y: -10,
        width: node.h,
        height: 20,
        fontSize: 12.5,
        bold: true,
        color: textOf(node),
        maxLines: 2,
      })}</g>`
    );
  },
  props: [P.name, P.id, { key: 'participant', type: 'text', label: { en: 'Participant', ru: 'Участник' }, group: 'general' }, P.description, P.documentation],
  bpmn: { element: 'participant' },
});

register({
  id: 'lane',
  category: 'swimlane',
  name: { en: 'Lane', ru: 'Дорожка' },
  palette: true,
  group: 'swimlanes',
  defaultSize: { w: 690, h: 120 },
  paletteSize: { w: 120, h: 48 },
  minSize: { w: 200, h: 60 },
  resizable: true,
  container: true,
  zIndex: -10,
  labelPlacement: 'header',
  draw: (node) => {
    const fill = fillOf(node, 'var(--lane-fill)');
    const stroke = strokeOf(node, 'var(--pool-stroke)');
    const headerW = 26;
    return (
      rect(0.5, 0.5, node.w - 1, node.h - 1, 4, `fill="${fill}" stroke="${stroke}" stroke-width="1.1"`) +
      line(headerW, 0.5, headerW, node.h - 0.5, `stroke="${stroke}" stroke-width="1.1"`) +
      `<g transform="translate(${n(headerW / 2)},${n(node.h / 2)}) rotate(-90)">${textBlock(node.label, {
        x: -node.h / 2,
        y: -9,
        width: node.h,
        height: 18,
        fontSize: 11.5,
        color: textOf(node),
        maxLines: 2,
      })}</g>`
    );
  },
  props: [P.name, P.id, { key: 'role', type: 'text', label: { en: 'Role', ru: 'Роль' }, group: 'general' }, P.description, P.documentation],
  bpmn: { element: 'lane' },
});

/* data -------------------------------------------------------------------- */
register({
  id: 'dataObject',
  category: 'data',
  name: { en: 'Data object', ru: 'Объект данных' },
  palette: true,
  group: 'data',
  defaultSize: { w: 44, h: 56 },
  minSize: { w: 28, h: 36 },
  resizable: true,
  labelPlacement: 'outside',
  draw: (node) => {
    const fill = fillOf(node, 'var(--el-fill)');
    const stroke = strokeOf(node, 'var(--data-stroke)');
    const fold = Math.min(14, node.w * 0.32);
    const d = `M 1 1 H ${n(node.w - fold)} L ${n(node.w - 1)} ${n(fold)} V ${n(node.h - 1)} H 1 Z`;
    let markup = `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="1.3" stroke-linejoin="round"/>`;
    markup += `<path d="M ${n(node.w - fold)} 1 V ${n(fold)} H ${n(node.w - 1)}" fill="none" stroke="${stroke}" stroke-width="1.3"/>`;
    if (node.props?.isCollection) {
      markup += G.parallelMarker(node.w / 2, node.h - 8, 10).replace(/currentColor/g, stroke);
    }
    const dir = node.props?.dataDirection;
    if (dir === 'input' || dir === 'output') {
      const filled = dir === 'output';
      markup += `<polygon points="5,8 12,8 12,5 17,11 12,17 12,14 5,14" fill="${filled ? stroke : 'none'}" stroke="${stroke}" stroke-width="1"/>`;
    }
    markup += textBlock(node.label, {
      x: -40,
      y: node.h + 2,
      width: node.w + 80,
      height: 28,
      valign: 'top',
      fontSize: 11,
      color: textOf(node),
      maxLines: 2,
    });
    return markup;
  },
  props: [
    P.name,
    P.id,
    {
      key: 'dataDirection',
      type: 'select',
      label: { en: 'Kind', ru: 'Вид' },
      group: 'general',
      options: [
        { value: '', label: { en: 'Data object', ru: 'Объект данных' } },
        { value: 'input', label: { en: 'Data input', ru: 'Входные данные' } },
        { value: 'output', label: { en: 'Data output', ru: 'Выходные данные' } },
      ],
    },
    { key: 'dataState', type: 'text', label: { en: 'State', ru: 'Состояние' }, group: 'general' },
    { key: 'isCollection', type: 'checkbox', label: { en: 'Collection', ru: 'Коллекция' }, group: 'general' },
    P.description,
    P.documentation,
  ],
  bpmn: { element: 'dataObjectReference' },
});

register({
  id: 'dataInput',
  category: 'data',
  name: { en: 'Data input', ru: 'Входные данные' },
  palette: true,
  group: 'data',
  defaultSize: { w: 44, h: 56 },
  minSize: { w: 28, h: 36 },
  resizable: true,
  labelPlacement: 'outside',
  draw: (node) => BPMN_TYPES.dataObject.draw({ ...node, props: { ...node.props, dataDirection: 'input' } }),
  props: BPMN_TYPES.dataObject.props,
  bpmn: { element: 'dataInput' },
});

register({
  id: 'dataOutput',
  category: 'data',
  name: { en: 'Data output', ru: 'Выходные данные' },
  palette: true,
  group: 'data',
  defaultSize: { w: 44, h: 56 },
  minSize: { w: 28, h: 36 },
  resizable: true,
  labelPlacement: 'outside',
  draw: (node) => BPMN_TYPES.dataObject.draw({ ...node, props: { ...node.props, dataDirection: 'output' } }),
  props: BPMN_TYPES.dataObject.props,
  bpmn: { element: 'dataOutput' },
});

register({
  id: 'dataStore',
  category: 'data',
  name: { en: 'Data store', ru: 'Хранилище данных' },
  palette: true,
  group: 'data',
  defaultSize: { w: 58, h: 52 },
  minSize: { w: 36, h: 32 },
  resizable: true,
  labelPlacement: 'outside',
  draw: (node) => {
    const fill = fillOf(node, 'var(--el-fill)');
    const stroke = strokeOf(node, 'var(--data-stroke)');
    const ry = Math.min(9, node.h * 0.18);
    const w = node.w - 2;
    const h = node.h - 2;
    let markup =
      `<path d="M 1 ${n(1 + ry)} a ${n(w / 2)} ${n(ry)} 0 0 1 ${n(w)} 0 v ${n(h - 2 * ry)} a ${n(w / 2)} ${n(ry)} 0 0 1 ${n(
        -w
      )} 0 z" fill="${fill}" stroke="${stroke}" stroke-width="1.3"/>` +
      `<path d="M 1 ${n(1 + ry)} a ${n(w / 2)} ${n(ry)} 0 0 0 ${n(w)} 0" fill="none" stroke="${stroke}" stroke-width="1.3"/>`;
    for (let i = 1; i <= 2; i++) {
      markup += `<path d="M 1 ${n(1 + ry + i * ry * 0.7)} a ${n(w / 2)} ${n(ry)} 0 0 0 ${n(w)} 0" fill="none" stroke="${stroke}" stroke-width="0.9" opacity="0.7"/>`;
    }
    markup += textBlock(node.label, {
      x: -40,
      y: node.h + 2,
      width: node.w + 80,
      height: 28,
      valign: 'top',
      fontSize: 11,
      color: textOf(node),
      maxLines: 2,
    });
    return markup;
  },
  props: [P.name, P.id, { key: 'capacity', type: 'text', label: { en: 'Capacity', ru: 'Ёмкость' }, group: 'advanced' }, P.description, P.documentation],
  bpmn: { element: 'dataStoreReference' },
});

/* artifacts --------------------------------------------------------------- */
register({
  id: 'textAnnotation',
  category: 'artifact',
  name: { en: 'Text annotation', ru: 'Текстовое примечание' },
  palette: true,
  group: 'artifacts',
  defaultSize: { w: 170, h: 56 },
  paletteSize: { w: 74, h: 46 },
  minSize: { w: 80, h: 30 },
  resizable: true,
  labelPlacement: 'inside',
  draw: (node) => {
    const stroke = strokeOf(node, 'var(--el-stroke)');
    return (
      `<path d="M 10 1 H 1 V ${n(node.h - 1)} H 10" fill="none" stroke="${stroke}" stroke-width="1.3"/>` +
      textBlock(node.label, {
        x: 14,
        y: 4,
        width: node.w - 18,
        height: node.h - 8,
        align: 'left',
        valign: 'top',
        fontSize: 12,
        color: textOf(node),
        maxLines: 6,
      })
    );
  },
  props: [{ ...P.name, label: { en: 'Text', ru: 'Текст' }, type: 'textarea', rows: 3 }, P.id, P.documentation],
  bpmn: { element: 'textAnnotation' },
});

register({
  id: 'group',
  category: 'artifact',
  name: { en: 'Group', ru: 'Группа' },
  palette: true,
  group: 'artifacts',
  defaultSize: { w: 260, h: 180 },
  paletteSize: { w: 76, h: 52 },
  minSize: { w: 100, h: 80 },
  resizable: true,
  container: true,
  zIndex: -5,
  labelPlacement: 'header',
  draw: (node) => {
    const stroke = strokeOf(node, 'var(--el-stroke)');
    return (
      rect(1, 1, node.w - 2, node.h - 2, 12, `fill="none" stroke="${stroke}" stroke-width="1.4" stroke-dasharray="10 5 2 5"`) +
      textBlock(node.label, {
        x: 10,
        y: 4,
        width: node.w - 20,
        height: 18,
        align: 'left',
        valign: 'top',
        fontSize: 11.5,
        bold: true,
        color: textOf(node),
        maxLines: 1,
      })
    );
  },
  props: [P.name, P.id, { key: 'categoryValue', type: 'text', label: { en: 'Category', ru: 'Категория' }, group: 'general' }, P.documentation],
  bpmn: { element: 'group' },
});

/* --------------------------------------------------------------- edges */

export const BPMN_EDGE_TYPES = {
  sequenceFlow: {
    id: 'sequenceFlow',
    name: { en: 'Sequence flow', ru: 'Поток управления' },
    palette: true,
    marker: 'arrow-filled',
    startMarker: null,
    dash: null,
    props: [
      { key: 'label', type: 'text', label: { en: 'Name', ru: 'Название' }, group: 'general' },
      { key: 'id', type: 'id', label: { en: 'ID', ru: 'Идентификатор' }, group: 'general' },
      { key: 'condition', type: 'text', label: { en: 'Condition', ru: 'Условие' }, group: 'general' },
      { key: 'isDefault', type: 'checkbox', label: { en: 'Default flow', ru: 'Поток по умолчанию' }, group: 'general' },
      { key: 'documentation', type: 'textarea', label: { en: 'Documentation', ru: 'Документация' }, group: 'documentation', rows: 4 },
    ],
    bpmn: { element: 'sequenceFlow' },
  },
  messageFlow: {
    id: 'messageFlow',
    name: { en: 'Message flow', ru: 'Поток сообщений' },
    palette: true,
    marker: 'arrow-open',
    startMarker: 'circle-open',
    dash: '8 5',
    props: [
      { key: 'label', type: 'text', label: { en: 'Name', ru: 'Название' }, group: 'general' },
      { key: 'id', type: 'id', label: { en: 'ID', ru: 'Идентификатор' }, group: 'general' },
      { key: 'messageName', type: 'text', label: { en: 'Message', ru: 'Сообщение' }, group: 'general' },
      { key: 'documentation', type: 'textarea', label: { en: 'Documentation', ru: 'Документация' }, group: 'documentation', rows: 4 },
    ],
    bpmn: { element: 'messageFlow' },
  },
  association: {
    id: 'association',
    name: { en: 'Association', ru: 'Ассоциация' },
    palette: true,
    marker: null,
    dash: '3 4',
    props: [
      { key: 'label', type: 'text', label: { en: 'Name', ru: 'Название' }, group: 'general' },
      { key: 'id', type: 'id', label: { en: 'ID', ru: 'Идентификатор' }, group: 'general' },
      {
        key: 'associationDirection',
        type: 'select',
        label: { en: 'Direction', ru: 'Направление' },
        group: 'general',
        options: [
          { value: 'None', label: { en: 'None', ru: 'Нет' } },
          { value: 'One', label: { en: 'One way', ru: 'Односторонняя' } },
          { value: 'Both', label: { en: 'Both ways', ru: 'Двусторонняя' } },
        ],
      },
    ],
    bpmn: { element: 'association' },
  },
  dataAssociation: {
    id: 'dataAssociation',
    name: { en: 'Data association', ru: 'Связь с данными' },
    palette: false,
    marker: 'arrow-open',
    dash: '3 4',
    props: [
      { key: 'label', type: 'text', label: { en: 'Name', ru: 'Название' }, group: 'general' },
      { key: 'id', type: 'id', label: { en: 'ID', ru: 'Идентификатор' }, group: 'general' },
    ],
    bpmn: { element: 'dataOutputAssociation' },
  },
};

/* ------------------------------------------------------------- palette */

export const BPMN_PALETTE = [
  { id: 'events', name: { en: 'Events', ru: 'События' } },
  { id: 'activities', name: { en: 'Activities', ru: 'Действия' } },
  { id: 'gateways', name: { en: 'Gateways', ru: 'Шлюзы' } },
  { id: 'swimlanes', name: { en: 'Swimlanes', ru: 'Дорожки' } },
  { id: 'data', name: { en: 'Data', ru: 'Данные' } },
  { id: 'artifacts', name: { en: 'Artifacts', ru: 'Артефакты' } },
  { id: 'connectors', name: { en: 'Connections', ru: 'Связи' } },
];

/** Type ids grouped for the "change type" menus. */
export const BPMN_CONVERT_GROUPS = {
  activity: ['task', 'userTask', 'manualTask', 'serviceTask', 'scriptTask', 'businessRuleTask', 'sendTask', 'receiveTask', 'callActivity', 'subProcess', 'eventSubProcess'],
  gateway: ['exclusiveGateway', 'parallelGateway', 'inclusiveGateway', 'eventBasedGateway', 'complexGateway'],
  event: Object.values(BPMN_TYPES).filter((t) => t.category === 'event').map((t) => t.id),
  data: ['dataObject', 'dataInput', 'dataOutput', 'dataStore'],
  artifact: ['textAnnotation', 'group'],
  swimlane: ['pool', 'lane'],
};
