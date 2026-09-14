/**
 * BPMN 2.0 XML import / export (OMG schema with BPMN-DI diagram interchange).
 * Round trips through Camunda Modeler / Bizagi / bpmn.io.
 */
import { BPMN_TYPES } from '../notations/bpmn/types.js';
import { poolOf } from '../notations/bpmn/rules.js';
import { createDiagram, createEdge, createNode } from '../core/model.js';
import { sanitizeId, uid, uniqueId } from '../core/id.js';
import { layoutEdges } from '../canvas/routing.js';
import { XmlWriter, findAll, findFirst, parseXml, textOf } from './xml.js';

const NS = {
  'xmlns:bpmn': 'http://www.omg.org/spec/BPMN/20100524/MODEL',
  'xmlns:bpmndi': 'http://www.omg.org/spec/BPMN/20100524/DI',
  'xmlns:dc': 'http://www.omg.org/spec/DD/20100524/DC',
  'xmlns:di': 'http://www.omg.org/spec/DD/20100524/DI',
  'xmlns:fm': 'https://fibermodeler.app/schema',
};

const EVENT_DEFINITIONS = {
  messageEventDefinition: 'message',
  timerEventDefinition: 'timer',
  errorEventDefinition: 'error',
  signalEventDefinition: 'signal',
  escalationEventDefinition: 'escalation',
  conditionalEventDefinition: 'conditional',
  linkEventDefinition: 'link',
  terminateEventDefinition: 'terminate',
};

/** element+definition -> our type id */
function reverseMap() {
  const map = new Map();
  for (const type of Object.values(BPMN_TYPES)) {
    if (!type.bpmn?.element) continue;
    const key = `${type.bpmn.element}|${type.bpmn.eventDefinition ? EVENT_DEFINITIONS[type.bpmn.eventDefinition] || '' : ''}`;
    if (!map.has(key)) map.set(key, type.id);
  }
  return map;
}

const REVERSE = reverseMap();

/* ------------------------------------------------------------------ export */

export function exportBpmnXml(diagram, options = {}) {
  const w = new XmlWriter();
  const ids = new Set();
  const idOf = new Map();
  for (const item of [...diagram.nodes, ...diagram.edges]) {
    idOf.set(item.id, uniqueId(sanitizeId(item.id), ids));
  }

  const pools = diagram.nodes.filter((n) => n.type === 'pool');
  const lanes = diagram.nodes.filter((n) => n.type === 'lane');
  const flowNodes = diagram.nodes.filter((n) => {
    const type = BPMN_TYPES[n.type];
    return type && ['event', 'activity', 'gateway', 'data', 'artifact'].includes(type.category);
  });

  const processes = [];
  if (pools.length) {
    for (const pool of pools) {
      processes.push({
        id: uniqueId(`Process_${sanitizeId(pool.label || pool.id)}`, ids),
        pool,
        nodes: flowNodes.filter((n) => poolOf(diagram, n)?.id === pool.id),
        lanes: lanes.filter((l) => l.parent === pool.id || insideRect(pool, l)),
      });
    }
    const orphans = flowNodes.filter((n) => !poolOf(diagram, n));
    if (orphans.length) processes.push({ id: uniqueId('Process_default', ids), pool: null, nodes: orphans, lanes: [] });
  } else {
    processes.push({ id: uniqueId('Process_1', ids), pool: null, nodes: flowNodes, lanes: [] });
  }

  const processOf = new Map();
  for (const process of processes) for (const node of process.nodes) processOf.set(node.id, process);

  const sequenceFlows = diagram.edges.filter((e) => e.type === 'sequenceFlow');
  const messageFlows = diagram.edges.filter((e) => e.type === 'messageFlow');
  const associations = diagram.edges.filter((e) => e.type === 'association' || e.type === 'dataAssociation');

  w.open('bpmn:definitions', {
    ...NS,
    id: `Definitions_${sanitizeId(diagram.id)}`,
    targetNamespace: 'https://fibermodeler.app/bpmn',
    exporter: 'FiberModeler',
    exporterVersion: options.version || '1.0',
  });

  const collaborationId = 'Collaboration_1';
  if (pools.length || messageFlows.length) {
    w.open('bpmn:collaboration', { id: collaborationId });
    for (const process of processes) {
      if (!process.pool) continue;
      w.leaf('bpmn:participant', {
        id: idOf.get(process.pool.id),
        name: process.pool.label || '',
        processRef: process.id,
      });
    }
    for (const flow of messageFlows) {
      w.leaf('bpmn:messageFlow', {
        id: idOf.get(flow.id),
        name: flow.label || '',
        sourceRef: idOf.get(flow.source),
        targetRef: idOf.get(flow.target),
      });
    }
    w.close();
  }

  for (const process of processes) {
    w.open('bpmn:process', { id: process.id, isExecutable: 'false' });
    if (process.lanes.length) {
      w.open('bpmn:laneSet', { id: `${process.id}_laneSet` });
      for (const lane of process.lanes) {
        w.open('bpmn:lane', { id: idOf.get(lane.id), name: lane.label || '' });
        for (const node of process.nodes) {
          if (node.parent === lane.id || insideRect(lane, node)) {
            w.leaf('bpmn:flowNodeRef', {}, idOf.get(node.id));
          }
        }
        w.close();
      }
      w.close();
    }

    for (const node of process.nodes) {
      writeNode(w, node, diagram, idOf, sequenceFlows);
    }
    for (const flow of sequenceFlows) {
      if (processOf.get(flow.source) !== process) continue;
      const attrs = {
        id: idOf.get(flow.id),
        name: flow.label || '',
        sourceRef: idOf.get(flow.source),
        targetRef: idOf.get(flow.target),
      };
      if (flow.props?.condition) {
        w.open('bpmn:sequenceFlow', attrs);
        w.leaf('bpmn:conditionExpression', { 'xsi:type': 'bpmn:tFormalExpression' }, flow.props.condition);
        w.close();
      } else {
        w.leaf('bpmn:sequenceFlow', attrs);
      }
    }
    for (const assoc of associations) {
      if (!processOf.has(assoc.source) && !processOf.has(assoc.target)) continue;
      if ((processOf.get(assoc.source) || processOf.get(assoc.target)) !== process) continue;
      w.leaf('bpmn:association', {
        id: idOf.get(assoc.id),
        sourceRef: idOf.get(assoc.source),
        targetRef: idOf.get(assoc.target),
        associationDirection: assoc.props?.associationDirection || 'None',
      });
    }
    w.close();
  }

  /* diagram interchange */
  const geometries = layoutEdges(diagram, { connectionStyle: options.connectionStyle || 'orthogonal' });
  w.open('bpmndi:BPMNDiagram', { id: `BPMNDiagram_${sanitizeId(diagram.id)}` });
  w.open('bpmndi:BPMNPlane', {
    id: `BPMNPlane_${sanitizeId(diagram.id)}`,
    bpmnElement: pools.length ? collaborationId : processes[0].id,
  });
  for (const node of diagram.nodes) {
    const attrs = { id: `${idOf.get(node.id)}_di`, bpmnElement: idOf.get(node.id) };
    if (node.type === 'pool' || node.type === 'lane') attrs.isHorizontal = 'true';
    w.open('bpmndi:BPMNShape', attrs);
    w.leaf('dc:Bounds', { x: node.x, y: node.y, width: node.w, height: node.h });
    w.close();
  }
  for (const edge of diagram.edges) {
    const geom = geometries.get(edge.id);
    if (!geom) continue;
    w.open('bpmndi:BPMNEdge', { id: `${idOf.get(edge.id)}_di`, bpmnElement: idOf.get(edge.id) });
    for (const point of geom.points) w.leaf('di:waypoint', { x: round(point.x), y: round(point.y) });
    w.close();
  }
  w.close();
  w.close();
  return w.toString();
}

function writeNode(w, node, diagram, idOf, sequenceFlows) {
  const type = BPMN_TYPES[node.type];
  if (!type?.bpmn?.element) return;
  const tag = `bpmn:${type.bpmn.element}`;
  const attrs = { id: idOf.get(node.id), name: node.label || '' };
  if (node.type === 'eventSubProcess') attrs.triggeredByEvent = 'true';
  if (node.type === 'callActivity' && node.props?.calledElement) attrs.calledElement = node.props.calledElement;
  if (node.props?.isCollection) attrs.isCollection = 'true';

  const incoming = sequenceFlows.filter((e) => e.target === node.id);
  const outgoing = sequenceFlows.filter((e) => e.source === node.id);
  const documentation = node.props?.documentation || node.props?.description;
  const hasBody = incoming.length || outgoing.length || type.bpmn.eventDefinition || documentation;
  if (!hasBody) {
    w.leaf(tag, attrs);
    return;
  }
  w.open(tag, attrs);
  if (documentation) w.leaf('bpmn:documentation', {}, documentation);
  for (const edge of incoming) w.leaf('bpmn:incoming', {}, idOf.get(edge.id));
  for (const edge of outgoing) w.leaf('bpmn:outgoing', {}, idOf.get(edge.id));
  if (type.bpmn.eventDefinition) {
    const defAttrs = { id: `${idOf.get(node.id)}_def` };
    if (type.definition === 'timer' && node.props?.timerValue) {
      w.open(`bpmn:${type.bpmn.eventDefinition}`, defAttrs);
      const tag2 = { date: 'timeDate', duration: 'timeDuration', cycle: 'timeCycle' }[node.props.timerType || 'duration'];
      w.leaf(`bpmn:${tag2}`, {}, node.props.timerValue);
      w.close();
    } else {
      w.leaf(`bpmn:${type.bpmn.eventDefinition}`, defAttrs);
    }
  }
  w.close();
}

function insideRect(container, node) {
  const cx = node.x + node.w / 2;
  const cy = node.y + node.h / 2;
  return cx >= container.x && cx <= container.x + container.w && cy >= container.y && cy <= container.y + container.h;
}

function round(v) {
  return Math.round(v * 100) / 100;
}

/* ------------------------------------------------------------------ import */

export function importBpmnXml(source, options = {}) {
  const root = parseXml(source);
  const definitions = findFirst(root, 'definitions');
  if (!definitions) throw new Error('No <bpmn:definitions> element found');

  const diagram = createDiagram({ notation: 'bpmn', name: options.name || 'Imported process' });
  const nodesById = new Map();
  const idMap = new Map(); // xml id -> our id
  const shapes = new Map();
  const edgeWaypoints = new Map();

  for (const shape of findAll(definitions, 'BPMNShape')) {
    const bounds = findFirst(shape, 'Bounds');
    if (!bounds) continue;
    shapes.set(shape.attrs.bpmnElement, {
      x: Number(bounds.attrs.x) || 0,
      y: Number(bounds.attrs.y) || 0,
      w: Number(bounds.attrs.width) || 100,
      h: Number(bounds.attrs.height) || 80,
    });
  }
  for (const di of findAll(definitions, 'BPMNEdge')) {
    const points = di.children
      .filter((c) => c.tag === 'waypoint')
      .map((p) => ({ x: Number(p.attrs.x) || 0, y: Number(p.attrs.y) || 0 }));
    if (points.length) edgeWaypoints.set(di.attrs.bpmnElement, points);
  }

  const addNode = (xmlId, typeId, label, extraProps = {}) => {
    const geometry = shapes.get(xmlId) || null;
    const descriptor = BPMN_TYPES[typeId] || BPMN_TYPES.task;
    const node = createNode({
      id: uid('node'),
      type: typeId,
      x: geometry?.x ?? 0,
      y: geometry?.y ?? 0,
      w: geometry?.w ?? descriptor.defaultSize.w,
      h: geometry?.h ?? descriptor.defaultSize.h,
      label: label || '',
      props: { importedId: xmlId, ...extraProps },
    });
    diagram.nodes.push(node);
    nodesById.set(node.id, node);
    idMap.set(xmlId, node.id);
    return node;
  };

  /* pools */
  const participants = findAll(definitions, 'participant');
  const processRefs = new Map();
  for (const participant of participants) {
    const node = addNode(participant.attrs.id, 'pool', participant.attrs.name);
    if (participant.attrs.processRef) processRefs.set(participant.attrs.processRef, node.id);
  }

  const processes = findAll(definitions, 'process');
  for (const process of processes) {
    const poolId = processRefs.get(process.attrs.id) || null;
    for (const child of process.children) {
      if (child.tag === 'laneSet') {
        for (const lane of child.children.filter((c) => c.tag === 'lane')) {
          const node = addNode(lane.attrs.id, 'lane', lane.attrs.name);
          node.parent = poolId;
          node.props.flowNodeRefs = lane.children.filter((c) => c.tag === 'flowNodeRef').map((c) => textOf(c));
        }
        continue;
      }
      const typeId = typeForElement(child);
      if (!typeId) continue;
      const node = addNode(child.attrs.id, typeId, child.attrs.name, extractProps(child));
      node.parent = poolId;
    }
  }

  /* lane membership */
  for (const lane of diagram.nodes.filter((n) => n.type === 'lane')) {
    for (const ref of lane.props.flowNodeRefs || []) {
      const id = idMap.get(ref);
      const node = nodesById.get(id);
      if (node) node.parent = lane.id;
    }
    delete lane.props.flowNodeRefs;
  }

  /* edges */
  const edgeTags = { sequenceFlow: 'sequenceFlow', messageFlow: 'messageFlow', association: 'association', dataOutputAssociation: 'dataAssociation', dataInputAssociation: 'dataAssociation' };
  for (const [tag, type] of Object.entries(edgeTags)) {
    for (const element of findAll(definitions, tag)) {
      const source = idMap.get(element.attrs.sourceRef);
      const target = idMap.get(element.attrs.targetRef);
      if (!source || !target) continue;
      const condition = findFirst(element, 'conditionExpression');
      const edge = createEdge({
        id: uid('edge'),
        type,
        source,
        target,
        label: element.attrs.name || '',
        props: {
          importedId: element.attrs.id,
          ...(condition ? { condition: textOf(condition) } : {}),
          ...(element.attrs.associationDirection ? { associationDirection: element.attrs.associationDirection } : {}),
        },
      });
      const waypoints = edgeWaypoints.get(element.attrs.id);
      if (waypoints && waypoints.length > 2) {
        edge.routing = 'manual';
        edge.waypoints = waypoints.slice(1, -1);
      }
      diagram.edges.push(edge);
    }
  }

  return { diagram, hasLayout: shapes.size > 0 };
}

function typeForElement(element) {
  const tag = element.tag;
  const definitionChild = element.children.find((c) => EVENT_DEFINITIONS[c.tag]);
  const definition = definitionChild ? EVENT_DEFINITIONS[definitionChild.tag] : '';
  if (tag === 'subProcess' && element.attrs.triggeredByEvent === 'true') return 'eventSubProcess';
  const direct = REVERSE.get(`${tag}|${definition}`);
  if (direct) return direct;
  const fallback = REVERSE.get(`${tag}|`);
  if (fallback) return fallback;
  if (tag === 'boundaryEvent') return 'intermediateErrorEvent';
  return null;
}

function extractProps(element) {
  const props = {};
  const documentation = findFirst(element, 'documentation');
  if (documentation) props.documentation = textOf(documentation);
  if (element.attrs.calledElement) props.calledElement = element.attrs.calledElement;
  if (element.attrs.isCollection === 'true') props.isCollection = true;
  const timer = findFirst(element, 'timerEventDefinition');
  if (timer) {
    const date = findFirst(timer, 'timeDate');
    const duration = findFirst(timer, 'timeDuration');
    const cycle = findFirst(timer, 'timeCycle');
    const found = date || duration || cycle;
    if (found) {
      props.timerType = date ? 'date' : duration ? 'duration' : 'cycle';
      props.timerValue = textOf(found);
    }
  }
  return props;
}
