/**
 * Sugiyama style layered layout for flow diagrams (BPMN).
 *
 * 1. cycle-safe layer assignment (longest path from the sources)
 * 2. crossing reduction with barycentre sweeps
 * 3. coordinate assignment with a priority/median pass
 * 4. swimlane aware: nodes stay inside their lane, lanes are resized to fit
 */
import { getNotation } from '../notations/index.js';

const DEFAULTS = {
  direction: 'LR', // LR | TB
  layerGap: 70,
  nodeGap: 40,
  margin: 60,
  laneGap: 24,
};

export function layeredLayout(diagram, options = {}) {
  const opt = { ...DEFAULTS, ...options };
  const notation = getNotation(diagram.notation);
  const isFlow = (node) => {
    const type = notation.nodeTypes[node.type];
    return type && ['event', 'activity', 'gateway', 'function'].includes(type.category);
  };
  const flowNodes = diagram.nodes.filter(isFlow);
  if (!flowNodes.length) return [];

  const ids = new Set(flowNodes.map((n) => n.id));
  const flowEdges = diagram.edges.filter(
    (e) => ids.has(e.source) && ids.has(e.target) && e.source !== e.target && isPrimaryEdge(e)
  );

  const outgoing = new Map(flowNodes.map((n) => [n.id, []]));
  const incoming = new Map(flowNodes.map((n) => [n.id, []]));
  for (const edge of flowEdges) {
    outgoing.get(edge.source).push(edge.target);
    incoming.get(edge.target).push(edge.source);
  }

  /* 1. layering ---------------------------------------------------------- */
  const layer = new Map();
  const temp = new Set();
  const done = new Set();
  const visit = (id) => {
    if (done.has(id)) return layer.get(id);
    if (temp.has(id)) return 0; // cycle: break here
    temp.add(id);
    let best = 0;
    for (const prev of incoming.get(id) || []) {
      best = Math.max(best, visit(prev) + 1);
    }
    temp.delete(id);
    done.add(id);
    layer.set(id, best);
    return best;
  };
  for (const node of flowNodes) visit(node.id);

  const layers = [];
  for (const node of flowNodes) {
    const l = layer.get(node.id) || 0;
    (layers[l] = layers[l] || []).push(node);
  }
  for (let i = 0; i < layers.length; i++) layers[i] = layers[i] || [];

  /* 2. ordering ---------------------------------------------------------- */
  const order = new Map();
  layers.forEach((nodes) => nodes.forEach((node, i) => order.set(node.id, i)));
  for (let pass = 0; pass < 6; pass++) {
    const forward = pass % 2 === 0;
    const range = forward ? [...layers.keys()] : [...layers.keys()].reverse();
    for (const index of range) {
      const nodes = layers[index];
      if (!nodes || nodes.length < 2) continue;
      const neighbours = forward ? incoming : outgoing;
      const scored = nodes.map((node) => {
        const list = (neighbours.get(node.id) || []).map((id) => order.get(id)).filter((v) => v !== undefined);
        const barycentre = list.length ? list.reduce((a, b) => a + b, 0) / list.length : order.get(node.id);
        return { node, barycentre };
      });
      scored.sort((a, b) => a.barycentre - b.barycentre);
      layers[index] = scored.map((s) => s.node);
      layers[index].forEach((node, i) => order.set(node.id, i));
    }
  }

  /* 3. coordinates ------------------------------------------------------- */
  const horizontal = opt.direction === 'LR';
  const changes = [];
  const lanes = diagram.nodes.filter((n) => notation.nodeTypes[n.type]?.category === 'swimlane' && n.type === 'lane');
  const laneOf = new Map();
  if (lanes.length) {
    for (const node of flowNodes) {
      const lane = lanes.find((l) => node.parent === l.id) || lanes.find((l) => inside(l, node));
      if (lane) laneOf.set(node.id, lane.id);
    }
  }

  const layerSizes = layers.map((nodes) => Math.max(...nodes.map((n) => (horizontal ? n.w : n.h)), 0));
  const positions = new Map();
  let cursor = opt.margin;
  layers.forEach((nodes, index) => {
    const size = layerSizes[index];
    // cross-axis placement
    const total = nodes.reduce((acc, n) => acc + (horizontal ? n.h : n.w), 0) + opt.nodeGap * (nodes.length - 1);
    let cross = opt.margin + Math.max(0, (maxCross(layers, horizontal, opt) - total) / 2);
    for (const node of nodes) {
      const main = cursor + (size - (horizontal ? node.w : node.h)) / 2;
      positions.set(node.id, horizontal ? { x: main, y: cross } : { x: cross, y: main });
      cross += (horizontal ? node.h : node.w) + opt.nodeGap;
    }
    cursor += size + opt.layerGap;
  });

  /* median refinement: pull each node towards its neighbours */
  for (let pass = 0; pass < 4; pass++) {
    for (const layerNodes of layers) {
      const sorted = [...layerNodes];
      for (const node of sorted) {
        const neighbours = [...(incoming.get(node.id) || []), ...(outgoing.get(node.id) || [])]
          .map((id) => positions.get(id))
          .filter(Boolean);
        if (!neighbours.length) continue;
        const target =
          neighbours.reduce((acc, p) => acc + (horizontal ? p.y : p.x), 0) / neighbours.length;
        const pos = positions.get(node.id);
        if (horizontal) pos.y = pos.y + (target - pos.y) * 0.5;
        else pos.x = pos.x + (target - pos.x) * 0.5;
      }
      // re-establish separation inside the layer
      const ordered = [...layerNodes].sort((a, b) =>
        horizontal ? positions.get(a.id).y - positions.get(b.id).y : positions.get(a.id).x - positions.get(b.id).x
      );
      for (let i = 1; i < ordered.length; i++) {
        const prev = ordered[i - 1];
        const cur = ordered[i];
        const prevPos = positions.get(prev.id);
        const curPos = positions.get(cur.id);
        const minStart = (horizontal ? prevPos.y + prev.h : prevPos.x + prev.w) + opt.nodeGap;
        if (horizontal && curPos.y < minStart) curPos.y = minStart;
        if (!horizontal && curPos.x < minStart) curPos.x = minStart;
      }
    }
  }

  /* lane constraints */
  if (lanes.length) {
    for (const lane of lanes) {
      const members = flowNodes.filter((n) => laneOf.get(n.id) === lane.id);
      if (!members.length) continue;
      const laneTop = lane.y + 6;
      const laneBottom = lane.y + lane.h - 6;
      for (const node of members) {
        const pos = positions.get(node.id);
        const centre = (laneTop + laneBottom) / 2;
        pos.y = Math.min(Math.max(pos.y, laneTop), Math.max(laneTop, laneBottom - node.h));
        if (members.length === 1) pos.y = centre - node.h / 2;
      }
    }
  }

  for (const node of flowNodes) {
    const pos = positions.get(node.id);
    if (!pos) continue;
    const x = Math.round(pos.x);
    const y = Math.round(pos.y);
    if (x !== node.x || y !== node.y) changes.push({ id: node.id, x, y });
  }

  /* 4. satellites: data objects and annotations follow their owner --------- */
  const moved = new Map(changes.map((c) => [c.id, c]));
  for (const node of diagram.nodes) {
    const type = notation.nodeTypes[node.type];
    if (!type || !['data', 'artifact', 'note'].includes(type.category)) continue;
    const link = diagram.edges.find((e) => e.source === node.id || e.target === node.id);
    if (!link) continue;
    const ownerId = link.source === node.id ? link.target : link.source;
    const owner = diagram.nodes.find((n) => n.id === ownerId);
    if (!owner) continue;
    const ownerPos = moved.get(ownerId) || owner;
    const x = Math.round(ownerPos.x + owner.w / 2 - node.w / 2);
    const y = Math.round(ownerPos.y - node.h - 30);
    if (x !== node.x || y !== node.y) changes.push({ id: node.id, x, y });
  }

  return changes;
}

function maxCross(layers, horizontal, opt) {
  let max = 0;
  for (const nodes of layers) {
    const total = nodes.reduce((acc, n) => acc + (horizontal ? n.h : n.w), 0) + opt.nodeGap * (nodes.length - 1);
    max = Math.max(max, total);
  }
  return max;
}

function inside(container, node) {
  const cx = node.x + node.w / 2;
  const cy = node.y + node.h / 2;
  return cx >= container.x && cx <= container.x + container.w && cy >= container.y && cy <= container.y + container.h;
}

function isPrimaryEdge(edge) {
  return ['sequenceFlow', 'idef0Input', 'idef0Control', 'idef0Output', 'idef0Mechanism', 'idef0Call'].includes(edge.type);
}

/** Resizes pools and lanes so they contain their children again. */
export function fitContainers(diagram) {
  const notation = getNotation(diagram.notation);
  const changes = [];
  const containers = diagram.nodes.filter((n) => notation.nodeTypes[n.type]?.container);
  for (const container of containers) {
    const children = diagram.nodes.filter((n) => n.parent === container.id || (n.id !== container.id && inside(container, n)));
    if (!children.length) continue;
    const minX = Math.min(...children.map((c) => c.x)) - 40;
    const minY = Math.min(...children.map((c) => c.y)) - 30;
    const maxX = Math.max(...children.map((c) => c.x + c.w)) + 40;
    const maxY = Math.max(...children.map((c) => c.y + c.h)) + 30;
    const x = Math.min(container.x, minX - 30);
    const y = Math.min(container.y, minY);
    const w = Math.max(container.w, maxX - x);
    const h = Math.max(container.h, maxY - y);
    if (x !== container.x || y !== container.y || w !== container.w || h !== container.h) {
      changes.push({ id: container.id, x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });
    }
  }
  return changes;
}
