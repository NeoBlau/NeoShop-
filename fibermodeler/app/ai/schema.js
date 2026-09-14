/**
 * Model specification -> real diagrams.
 *
 * One shared pipeline for templates, the table builder and every generator
 * (offline or AI): a specification only describes *what* is in the model, this
 * module gives it identity, geometry and notation-correct connections.
 */
import { createDiagram, createEdge, createNode } from '../core/model.js';
import { uid } from '../core/id.js';
import { BPMN_TYPES } from '../notations/bpmn/types.js';
import { IDEF0_EDGE_TYPES, IDEF0_TYPES } from '../notations/idef0/types.js';
import { layeredLayout } from '../layout/layered.js';
import { idef0Layout } from '../layout/idef0layout.js';

const LANE_PADDING = 44;
const SATELLITE_TYPES = ['dataObject', 'dataStore', 'dataInput', 'dataOutput', 'textAnnotation'];
const LANE_MIN_HEIGHT = 130;
const POOL_HEADER = 30;

export function text(value, locale = 'ru') {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  return value[locale] || value.en || value.ru || '';
}

/** Describes what a generator is allowed to return - also used as AI prompt doc. */
export const SPEC_DOC = `{
  "notation": "bpmn" | "idef0",
  "name": "diagram name",
  "lanes": [{ "id": "sales", "label": "Sales" }],
  "nodes": [{ "id": "n1", "type": "userTask", "label": "Check order", "lane": "sales", "props": {} }],
  "edges": [{ "source": "n1", "target": "n2", "type": "sequenceFlow", "label": "yes", "condition": "paid" }],
  "context": { "label": "...", "inputs": [], "controls": [], "outputs": [], "mechanisms": [] },
  "functions": [{ "number": "A1", "label": "...", "inputs": [], "controls": [], "outputs": [], "mechanisms": [] }]
}`;

/* ------------------------------------------------------------------ BPMN */

export function buildBpmnDiagram(spec, options = {}) {
  const locale = options.locale || 'ru';
  const diagram = createDiagram({ notation: 'bpmn', name: options.name || text(spec.name, locale) || 'Process' });
  const idMap = new Map();

  const lanes = Array.isArray(spec.lanes) ? spec.lanes.filter(Boolean) : [];
  const laneNodes = new Map();
  let pool = null;
  if (lanes.length) {
    pool = createNode({ type: 'pool', x: 0, y: 0, w: 900, h: 200, label: text(spec.poolLabel, locale) || diagram.name });
    diagram.nodes.push(pool);
    lanes.forEach((lane) => {
      const node = createNode({
        type: 'lane',
        x: POOL_HEADER,
        y: 0,
        w: 860,
        h: LANE_MIN_HEIGHT,
        label: text(lane.label ?? lane, locale),
        parent: pool.id,
      });
      diagram.nodes.push(node);
      laneNodes.set(lane.id ?? String(lane), node);
    });
  }

  for (const item of spec.nodes || []) {
    const typeId = BPMN_TYPES[item.type] ? item.type : guessBpmnType(item);
    const descriptor = BPMN_TYPES[typeId];
    const node = createNode({
      id: uid('node'),
      type: typeId,
      x: 0,
      y: 0,
      w: item.w || descriptor.defaultSize.w,
      h: item.h || descriptor.defaultSize.h,
      label: text(item.label, locale),
      props: item.props || {},
      parent: laneNodes.get(item.lane)?.id || null,
    });
    diagram.nodes.push(node);
    idMap.set(item.id ?? node.label, node.id);
  }

  for (const item of spec.edges || []) {
    const source = idMap.get(item.source);
    const target = idMap.get(item.target);
    if (!source || !target) continue;
    diagram.edges.push(
      createEdge({
        id: uid('edge'),
        type: item.type && ['sequenceFlow', 'messageFlow', 'association', 'dataAssociation'].includes(item.type) ? item.type : 'sequenceFlow',
        source,
        target,
        label: text(item.label, locale),
        props: item.condition ? { condition: item.condition } : {},
      })
    );
  }

  layoutBpmn(diagram, { lanes: [...laneNodes.values()], pool });
  return diagram;
}

function guessBpmnType(item) {
  const label = String(text(item.label, 'ru')).toLowerCase();
  if (item.type === 'gateway' || /\?$/.test(label)) return 'exclusiveGateway';
  if (item.type === 'start') return 'startEvent';
  if (item.type === 'end') return 'endEvent';
  return 'task';
}

/** Layered layout that also arranges the swimlane bands. */
export function layoutBpmn(diagram, { lanes = [], pool = null } = {}) {
  const changes = layeredLayout(diagram, { direction: 'LR', layerGap: 72, nodeGap: 46, margin: 80 });
  for (const change of changes) {
    const node = diagram.nodes.find((n) => n.id === change.id);
    if (node) Object.assign(node, change);
  }
  if (!lanes.length) return diagram;

  const flowNodes = diagram.nodes.filter((n) => !['pool', 'lane'].includes(n.type));
  const byLane = new Map(lanes.map((lane) => [lane.id, []]));
  for (const node of flowNodes) {
    const list = byLane.get(node.parent);
    if (list) list.push(node);
    else (byLane.get(lanes[0].id) || []).push(node);
  }

  const left = Math.min(...flowNodes.map((n) => n.x), 0);
  const right = Math.max(...flowNodes.map((n) => n.x + n.w), 400);
  const laneWidth = right - left + 140;
  const SATELLITE_ROOM = 104;
  const satelliteOwners = new Set();
  for (const node of diagram.nodes) {
    if (!SATELLITE_TYPES.includes(node.type)) continue;
    const link = diagram.edges.find((e) => e.source === node.id || e.target === node.id);
    if (link) satelliteOwners.add(link.source === node.id ? link.target : link.source);
  }

  let cursorY = 70;
  for (const lane of lanes) {
    const nodes = byLane.get(lane.id) || [];
    const rows = groupByColumn(nodes);
    // leave room above the flow when the lane carries data objects or notes
    const headroom = nodes.some((node) => satelliteOwners.has(node.id)) ? SATELLITE_ROOM : 0;
    const height = Math.max(LANE_MIN_HEIGHT + headroom, rows * 110 + LANE_PADDING + headroom);
    lane.x = 60 + POOL_HEADER;
    lane.y = cursorY;
    lane.w = laneWidth;
    lane.h = height;
    // vertical placement inside the band
    const columns = new Map();
    for (const node of nodes) {
      const key = Math.round(node.x / 40);
      const index = columns.get(key) || 0;
      columns.set(key, index + 1);
      node.x = node.x - left + 60 + POOL_HEADER + 40;
      node.y = Math.round(
        lane.y + headroom + LANE_PADDING / 2 + index * 108 + (height - headroom - LANE_PADDING - (rows - 1) * 108 - node.h) / 2
      );
    }
    cursorY += height;
  }
  placeSatellites(diagram, lanes);
  restackLanes(diagram, lanes, pool);
  return diagram;
}


/** Data objects and annotations follow their owner, staying inside its lane. */
function placeSatellites(diagram, lanes) {
  const SATELLITES = SATELLITE_TYPES;
  const laneById = new Map(lanes.map((lane) => [lane.id, lane]));
  for (const node of diagram.nodes) {
    if (!SATELLITES.includes(node.type)) continue;
    const link = diagram.edges.find((e) => e.source === node.id || e.target === node.id);
    const ownerId = link ? (link.source === node.id ? link.target : link.source) : null;
    const owner = ownerId ? diagram.nodes.find((n) => n.id === ownerId) : null;
    if (!owner) continue;
    node.parent = owner.parent || node.parent;
    node.x = Math.round(owner.x + owner.w / 2 - node.w / 2);
    node.y = Math.round(owner.y - node.h - 24);
    const lane = laneById.get(node.parent);
    if (!lane) continue;
    const top = lane.y + 6;
    const bottom = lane.y + lane.h - node.h - 6;
    if (node.y < top) {
      // no room above: try below the owner, otherwise beside it
      const below = owner.y + owner.h + 24;
      if (below <= bottom) node.y = Math.round(below);
      else {
        node.y = Math.round(Math.min(Math.max(owner.y, top), bottom));
        node.x = Math.round(owner.x + owner.w + 26);
      }
    }
    node.y = Math.round(Math.min(Math.max(node.y, top), Math.max(top, bottom)));
  }
}

/** Grows every lane to its content and stacks the lanes again. */
function restackLanes(diagram, lanes, pool) {
  if (!lanes.length) return;
  const members = new Map(lanes.map((lane) => [lane.id, []]));
  for (const node of diagram.nodes) {
    if (['pool', 'lane'].includes(node.type)) continue;
    const list = members.get(node.parent);
    if (list) list.push(node);
  }
  let cursor = lanes[0].y;
  for (const lane of lanes) {
    const list = members.get(lane.id) || [];
    const shift = cursor - lane.y;
    lane.y = cursor;
    for (const node of list) node.y += shift;
    if (list.length) {
      const top = Math.min(...list.map((n) => n.y));
      const bottom = Math.max(...list.map((n) => n.y + n.h));
      const needed = bottom - top + LANE_PADDING;
      if (needed > lane.h) {
        const extra = needed - lane.h;
        lane.h = Math.round(needed);
        for (const node of list) node.y += Math.round(Math.max(0, lane.y + LANE_PADDING / 2 - top));
        void extra;
      }
    }
    cursor = lane.y + lane.h;
  }
  if (pool) {
    pool.x = lanes[0].x - POOL_HEADER;
    pool.y = lanes[0].y;
    pool.w = lanes[0].w + POOL_HEADER;
    pool.h = cursor - lanes[0].y;
  }
}

function groupByColumn(nodes) {
  const columns = new Map();
  for (const node of nodes) {
    const key = Math.round(node.x / 40);
    columns.set(key, (columns.get(key) || 0) + 1);
  }
  return Math.max(1, ...columns.values());
}

/* ----------------------------------------------------------------- IDEF0 */

/**
 * Builds an IDEF0 model: a context diagram (A-0) plus, when sub functions are
 * given, its decomposition (A0). Returns the list of created diagrams.
 */
export function buildIdef0Diagrams(spec, options = {}) {
  const locale = options.locale || 'ru';
  const name = options.name || text(spec.name, locale) || 'IDEF0';
  const contextSpec = spec.context || {
    label: name,
    inputs: spec.inputs || [],
    controls: spec.controls || [],
    outputs: spec.outputs || [],
    mechanisms: spec.mechanisms || [],
  };

  const context = createDiagram({ notation: 'idef0', name: 'A-0' });
  context.meta.kind = 'context';
  context.meta.description = text(contextSpec.label, locale);
  const contextBox = createNode({
    id: uid('node'),
    type: 'idef0Function',
    x: 380,
    y: 260,
    w: 260,
    h: 140,
    label: text(contextSpec.label, locale) || name,
    props: { number: 'A0' },
  });
  context.nodes.push(contextBox);
  addIcomArrows(context, contextBox, contextSpec, locale);
  const title = createNode({
    type: 'idef0Title',
    x: 300,
    y: 560,
    w: 440,
    h: 54,
    label: name,
    props: { number: 'A-0' },
  });
  context.nodes.push(title);
  applyIdef0Layout(context);

  const diagrams = [context];

  const functions = spec.functions || [];
  if (functions.length) {
    const child = createDiagram({ notation: 'idef0', name: 'A0', parentDiagramId: context.id, parentNodeId: contextBox.id });
    child.meta.parentNumber = 'A0';
    child.meta.description = text(contextSpec.label, locale);
    const boxes = new Map();
    functions.forEach((fn, index) => {
      const node = createNode({
        id: uid('node'),
        type: 'idef0Function',
        x: 0,
        y: 0,
        w: 200,
        h: 120,
        label: text(fn.label, locale),
        props: { number: fn.number || `A${index + 1}` },
      });
      child.nodes.push(node);
      boxes.set(node.props.number, node);
    });

    /* connect functions whose output matches another function's input */
    const outputs = new Map();
    functions.forEach((fn, index) => {
      const node = child.nodes[index];
      for (const output of fn.outputs || []) outputs.set(text(output, locale), node);
    });

    functions.forEach((fn, index) => {
      const node = child.nodes[index];
      for (const [role, list] of [
        ['input', fn.inputs || []],
        ['control', fn.controls || []],
        ['mechanism', fn.mechanisms || []],
      ]) {
        for (const item of list) {
          const label = text(item, locale);
          const producer = outputs.get(label);
          if (producer && producer.id !== node.id) {
            child.edges.push(makeIdef0Edge(producer, node, role, label));
          } else {
            const anchor = makeAnchor(child, label, role);
            child.edges.push(makeIdef0Edge(anchor, node, role, ''));
          }
        }
      }
      for (const item of fn.outputs || []) {
        const label = text(item, locale);
        const consumed = functions.some((other, otherIndex) =>
          otherIndex !== index &&
          [...(other.inputs || []), ...(other.controls || []), ...(other.mechanisms || [])].some((x) => text(x, locale) === label)
        );
        if (!consumed) {
          const anchor = makeAnchor(child, label, 'output');
          child.edges.push(makeIdef0Edge(node, anchor, 'output', ''));
        }
      }
    });

    const childTitle = createNode({ type: 'idef0Title', x: 0, y: 0, w: 440, h: 54, label: text(contextSpec.label, locale) || name, props: { number: 'A0' } });
    child.nodes.push(childTitle);
    applyIdef0Layout(child);
    diagrams.push(child);
  }

  return diagrams;
}

function addIcomArrows(diagram, box, spec, locale) {
  for (const [role, list] of [
    ['input', spec.inputs || []],
    ['control', spec.controls || []],
    ['output', spec.outputs || []],
    ['mechanism', spec.mechanisms || []],
  ]) {
    for (const item of list) {
      const label = text(item, locale);
      const anchor = makeAnchor(diagram, label, role);
      diagram.edges.push(role === 'output' ? makeIdef0Edge(box, anchor, role, '') : makeIdef0Edge(anchor, box, role, ''));
    }
  }
}

function makeAnchor(diagram, label, role) {
  const letter = { input: 'I', control: 'C', output: 'O', mechanism: 'M' }[role] || 'I';
  const used = diagram.nodes.filter((n) => n.type === 'idef0Anchor' && (n.props?.icom || '').startsWith(letter)).length;
  const node = createNode({
    id: uid('node'),
    type: 'idef0Anchor',
    x: 0,
    y: 0,
    w: Math.min(190, Math.max(90, label.length * 7 + 30)),
    h: 26,
    label,
    props: { icom: `${letter}${used + 1}`, role },
  });
  diagram.nodes.push(node);
  return node;
}

function makeIdef0Edge(source, target, role, label) {
  const type = { input: 'idef0Input', control: 'idef0Control', output: 'idef0Output', mechanism: 'idef0Mechanism' }[role] || 'idef0Input';
  const spec = IDEF0_EDGE_TYPES[type];
  return createEdge({
    id: uid('edge'),
    type,
    source: source.id,
    target: target.id,
    label,
    sourceSide: role === 'mechanism' ? 'right' : spec.sourceSide,
    targetSide: spec.targetSide,
  });
}

export function applyIdef0Layout(diagram) {
  const changes = idef0Layout(diagram);
  for (const change of changes) {
    const node = diagram.nodes.find((n) => n.id === change.id);
    if (node) Object.assign(node, change);
  }
  return diagram;
}

/* --------------------------------------------------------------- generic */

/** Turns any specification into diagrams ready to be added to a project. */
export function buildDiagrams(spec, options = {}) {
  if (!spec) return [];
  if (spec.notation === 'idef0' || spec.context || spec.functions) return buildIdef0Diagrams(spec, options);
  return [buildBpmnDiagram(spec, options)];
}

/** Defensive normalisation of a specification coming from an external model. */
export function normalizeSpec(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Empty response');
  const spec = { ...raw };
  if (typeof spec.name !== 'string') spec.name = String(spec.name?.ru || spec.name?.en || 'Model');
  if (spec.notation !== 'idef0') spec.notation = 'bpmn';
  spec.nodes = Array.isArray(spec.nodes) ? spec.nodes.filter((n) => n && (n.id || n.label)) : [];
  spec.edges = Array.isArray(spec.edges) ? spec.edges.filter((e) => e && e.source && e.target) : [];
  spec.lanes = Array.isArray(spec.lanes) ? spec.lanes : [];
  if (spec.notation === 'bpmn' && !spec.nodes.length) throw new Error('No nodes in the response');
  if (spec.notation === 'idef0' && !spec.context && !spec.functions?.length) throw new Error('No IDEF0 functions in the response');
  for (const node of spec.nodes) {
    if (!node.id) node.id = uid('spec');
    if (!BPMN_TYPES[node.type] && !IDEF0_TYPES[node.type]) node.type = guessBpmnType(node);
  }
  return spec;
}
