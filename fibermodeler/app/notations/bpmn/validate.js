/** BPMN model validation rules. */
import { BPMN_TYPES } from './types.js';
import { isArtifact, isDataNode, isFlowNode, isSwimlane, poolOf } from './rules.js';

const MSG = {
  noStart: { en: 'Process has no start event', ru: 'В процессе нет стартового события' },
  noEnd: { en: 'Process has no end event', ru: 'В процессе нет конечного события' },
  noOutgoing: { en: '“{name}” has no outgoing sequence flow', ru: '«{name}» не имеет исходящего потока' },
  noIncoming: { en: '“{name}” has no incoming sequence flow', ru: '«{name}» не имеет входящего потока' },
  startIncoming: { en: 'Start event “{name}” must not have incoming flows', ru: 'Стартовое событие «{name}» не должно иметь входящих потоков' },
  endOutgoing: { en: 'End event “{name}” must not have outgoing flows', ru: 'Конечное событие «{name}» не должно иметь исходящих потоков' },
  gatewaySplit: { en: 'Gateway “{name}” has only one outgoing and one incoming flow', ru: 'Шлюз «{name}» имеет лишь один вход и один выход' },
  danglingEdge: { en: 'Connection points to a missing element', ru: 'Связь ведёт к несуществующему элементу' },
  duplicateId: { en: 'Duplicate identifier “{id}”', ru: 'Идентификатор «{id}» дублируется' },
  outsidePool: { en: '“{name}” is drawn outside of any pool while the diagram uses pools', ru: '«{name}» находится вне пулов, хотя на диаграмме есть пулы' },
  sequenceCrossPool: {
    en: 'Sequence flow “{name}” crosses a pool boundary: use a message flow between pools',
    ru: 'Поток управления «{name}» пересекает границу пула: между пулами нужен поток сообщений',
  },
  gatewayMismatch: {
    en: 'Parallel gateway “{name}” waits for branches of an exclusive split: only one of them ever runs, so the process stops here',
    ru: 'Параллельный шлюз «{name}» ждёт ветки исключающего разветвления: выполняется только одна из них, и процесс здесь зависнет',
  },
  messageSamePool: { en: 'Message flow “{name}” connects elements of the same pool', ru: 'Поток сообщений «{name}» соединяет элементы одного пула' },
  unnamed: { en: '{type} has no name', ru: 'У элемента «{type}» нет названия' },
  conditionMissing: { en: 'Exclusive gateway “{name}” has unconditional outgoing flows', ru: 'У исключающего шлюза «{name}» есть потоки без условий' },
  isolated: { en: '“{name}” is not connected to anything', ru: '«{name}» ни с чем не соединён' },
  subprocessEmpty: { en: 'Sub-process “{name}” has no decomposition diagram', ru: 'У подпроцесса «{name}» нет диаграммы декомпозиции' },
};

function problem(severity, key, params, target) {
  return { severity, messageKey: key, message: MSG[key], params: params || {}, ...target };
}

export function validateBpmn(diagram, doc) {
  const problems = [];
  const nodes = diagram.nodes;
  const edges = diagram.edges;
  const byId = new Map(nodes.map((nd) => [nd.id, nd]));
  const flowNodes = nodes.filter(isFlowNode);
  const seq = edges.filter((e) => e.type === 'sequenceFlow');
  const add = (severity, key, params, target) => problems.push(problem(severity, key, params, target));

  /* identifiers */
  const seen = new Map();
  for (const item of [...nodes, ...edges]) {
    if (seen.has(item.id)) add('error', 'duplicateId', { id: item.id }, { diagramId: diagram.id, elementId: item.id });
    seen.set(item.id, item);
  }

  /* dangling edges */
  for (const edge of edges) {
    if (!byId.has(edge.source) || !byId.has(edge.target)) {
      add('error', 'danglingEdge', {}, { diagramId: diagram.id, elementId: edge.id });
    }
  }

  if (flowNodes.length) {
    const starts = flowNodes.filter((nd) => BPMN_TYPES[nd.type]?.kind === 'start');
    const ends = flowNodes.filter((nd) => BPMN_TYPES[nd.type]?.kind === 'end');
    if (!starts.length) add('error', 'noStart', {}, { diagramId: diagram.id });
    if (!ends.length) add('error', 'noEnd', {}, { diagramId: diagram.id });
  }

  const outgoing = new Map();
  const incoming = new Map();
  for (const edge of seq) {
    outgoing.set(edge.source, (outgoing.get(edge.source) || []).concat(edge));
    incoming.set(edge.target, (incoming.get(edge.target) || []).concat(edge));
  }

  const usesPools = nodes.some((nd) => nd.type === 'pool');

  for (const node of flowNodes) {
    const type = BPMN_TYPES[node.type];
    const out = outgoing.get(node.id) || [];
    const inc = incoming.get(node.id) || [];
    const label = node.label || type?.name?.en || node.type;
    const target = { diagramId: diagram.id, elementId: node.id };

    if (type.kind === 'start') {
      if (inc.length) add('error', 'startIncoming', { name: label }, target);
      if (!out.length) add('error', 'noOutgoing', { name: label }, target);
    } else if (type.kind === 'end') {
      if (out.length) add('error', 'endOutgoing', { name: label }, target);
      if (!inc.length) add('error', 'noIncoming', { name: label }, target);
    } else {
      if (!out.length) add('error', 'noOutgoing', { name: label }, target);
      if (!inc.length) add('error', 'noIncoming', { name: label }, target);
    }

    if (type.category === 'gateway' && out.length <= 1 && inc.length <= 1) {
      add('warning', 'gatewaySplit', { name: label }, target);
    }
    if (type.category === 'gateway' && node.type === 'exclusiveGateway' && out.length > 1) {
      const unconditional = out.filter((e) => !e.props?.condition && !e.props?.isDefault && !e.label);
      if (unconditional.length) add('warning', 'conditionMissing', { name: label }, target);
    }
    if (type.category === 'activity' && !node.label) {
      add('warning', 'unnamed', { type: type.name.en }, target);
    }
    if (type.decomposable && node.type !== 'callActivity' && doc && !doc.decompositionOf(node.id)) {
      add('info', 'subprocessEmpty', { name: label }, target);
    }
    if (usesPools && !poolOf(diagram, node)) {
      add('warning', 'outsidePool', { name: label }, target);
    }
  }

  for (const node of nodes) {
    if (isDataNode(node) || isArtifact(node)) {
      const connected = edges.some((e) => e.source === node.id || e.target === node.id);
      if (!connected) add('info', 'isolated', { name: node.label || node.type }, { diagramId: diagram.id, elementId: node.id });
    }
  }

  /* a sequence flow may not leave its pool */
  for (const edge of seq) {
    const source = byId.get(edge.source);
    const target = byId.get(edge.target);
    if (!source || !target) continue;
    const poolA = poolOf(diagram, source);
    const poolB = poolOf(diagram, target);
    if (poolA && poolB && poolA.id !== poolB.id) {
      const name = edge.label || `${source.label || source.type} → ${target.label || target.type}`;
      add('error', 'sequenceCrossPool', { name }, { diagramId: diagram.id, elementId: edge.id });
    }
  }

  /* a parallel join fed by two branches of one exclusive split never fires */
  const reach = (start) => {
    const seenIds = new Set([start]);
    const queue = [start];
    while (queue.length) {
      const id = queue.shift();
      for (const edge of outgoing.get(id) || []) {
        if (!seenIds.has(edge.target)) {
          seenIds.add(edge.target);
          queue.push(edge.target);
        }
      }
    }
    return seenIds;
  };
  for (const join of flowNodes.filter((nd) => nd.type === 'parallelGateway')) {
    const feeds = incoming.get(join.id) || [];
    if (feeds.length < 2) continue;
    const mismatch = flowNodes
      .filter((nd) => nd.type === 'exclusiveGateway' && (outgoing.get(nd.id) || []).length > 1)
      .some((split) => {
        const reachedBy = (outgoing.get(split.id) || []).map((edge) => reach(edge.target));
        // inputs of the join that belong to exactly one branch of the split
        const owners = feeds
          .map((feed) => reachedBy.flatMap((set, branch) => (set.has(feed.source) ? [branch] : [])))
          .filter((branches) => branches.length === 1)
          .map((branches) => branches[0]);
        return new Set(owners).size >= 2;
      });
    if (mismatch) add('warning', 'gatewayMismatch', { name: join.label || 'AND' }, { diagramId: diagram.id, elementId: join.id });
  }

  for (const edge of edges.filter((e) => e.type === 'messageFlow')) {
    const source = byId.get(edge.source);
    const target = byId.get(edge.target);
    if (!source || !target) continue;
    const poolA = poolOf(diagram, source) || (isSwimlane(source) ? source : null);
    const poolB = poolOf(diagram, target) || (isSwimlane(target) ? target : null);
    if (poolA && poolB && poolA.id === poolB.id) {
      add('error', 'messageSamePool', { name: edge.label || edge.id }, { diagramId: diagram.id, elementId: edge.id });
    }
  }

  return problems;
}
