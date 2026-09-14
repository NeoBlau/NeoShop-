/**
 * IDEF0 "staircase" layout: boxes are placed on the diagonal from the upper
 * left to the lower right, boundary arrows are pinned to the diagram frame.
 */
const DEFAULTS = { startX: 200, startY: 120, stepX: 250, stepY: 150, boxW: 190, boxH: 110, anchorGap: 150 };

export function idef0Layout(diagram, options = {}) {
  const opt = { ...DEFAULTS, ...options };
  const functions = diagram.nodes.filter((n) => n.type === 'idef0Function');
  if (!functions.length) return [];
  const changes = [];

  const order = topologicalOrder(diagram, functions);
  order.forEach((node, index) => {
    const x = Math.round(opt.startX + index * opt.stepX);
    const y = Math.round(opt.startY + index * opt.stepY);
    if (node.x !== x || node.y !== y) changes.push({ id: node.id, x, y });
  });

  const positions = new Map(order.map((node, index) => [node.id, {
    x: opt.startX + index * opt.stepX,
    y: opt.startY + index * opt.stepY,
    w: node.w,
    h: node.h,
  }]));

  // boundary anchors sit outside the block of function boxes, spread along the
  // side of the box they belong to so that neither arrows nor labels collide
  const left = Math.min(...[...positions.values()].map((p) => p.x));
  const right = Math.max(...[...positions.values()].map((p) => p.x + p.w));
  const top = Math.min(...[...positions.values()].map((p) => p.y));
  const bottom = Math.max(...[...positions.values()].map((p) => p.y + p.h));

  const anchors = diagram.nodes.filter((n) => n.type === 'idef0Anchor');
  const groups = new Map();
  for (const anchor of anchors) {
    const edge = diagram.edges.find((e) => e.source === anchor.id || e.target === anchor.id);
    const role = edge ? roleOf(edge.type) : anchor.props?.role || 'input';
    const boxId = edge ? (edge.source === anchor.id ? edge.target : edge.source) : null;
    const key = `${role}|${boxId}`;
    if (!groups.has(key)) groups.set(key, { role, boxId, items: [] });
    groups.get(key).items.push(anchor);
  }

  let laneIndex = { input: 0, control: 0, output: 0, mechanism: 0 };
  for (const group of groups.values()) {
    const box = group.boxId ? positions.get(group.boxId) : null;
    const count = group.items.length;
    group.items.forEach((anchor, i) => {
      const ratio = (i + 1) / (count + 1);
      const step = laneIndex[group.role] ?? 0;
      let x = anchor.x;
      let y = anchor.y;
      if (group.role === 'input') {
        x = left - opt.anchorGap - anchor.w - step * 24;
        y = (box ? box.y + box.h * ratio : top + i * 46) - anchor.h / 2;
      } else if (group.role === 'control') {
        x = (box ? box.x + box.w * ratio : left + i * 180) - anchor.w / 2;
        y = top - 96 - (count - 1 - i) * 38 - step * 12;
      } else if (group.role === 'output') {
        x = right + opt.anchorGap + step * 24;
        y = (box ? box.y + box.h * ratio : top + i * 46) - anchor.h / 2;
      } else {
        x = (box ? box.x + box.w * ratio : left + i * 180) - anchor.w / 2;
        y = bottom + 78 + i * 38 + step * 12;
      }
      anchor.__x = Math.round(x);
      anchor.__y = Math.round(y);
    });
    laneIndex[group.role] = (laneIndex[group.role] ?? 0) + 1;
  }

  let lowestAnchor = bottom;
  for (const anchor of anchors) {
    if (anchor.__x === undefined) continue;
    const x = anchor.__x;
    const y = anchor.__y;
    lowestAnchor = Math.max(lowestAnchor, y + anchor.h);
    delete anchor.__x;
    delete anchor.__y;
    if (anchor.x !== x || anchor.y !== y) changes.push({ id: anchor.id, x, y });
  }

  // title block below everything else
  const title = diagram.nodes.find((n) => n.type === 'idef0Title');
  if (title) {
    const x = Math.round(left);
    const y = Math.round(lowestAnchor + 70);
    if (title.x !== x || title.y !== y) changes.push({ id: title.id, x, y });
  }

  return changes;
}

function roleOf(type) {
  return {
    idef0Input: 'input',
    idef0Control: 'control',
    idef0Output: 'output',
    idef0Mechanism: 'mechanism',
    idef0Call: 'mechanism',
  }[type] || 'input';
}

function topologicalOrder(diagram, functions) {
  const byId = new Map(functions.map((f) => [f.id, f]));
  const incoming = new Map(functions.map((f) => [f.id, 0]));
  const next = new Map(functions.map((f) => [f.id, []]));
  for (const edge of diagram.edges) {
    if (!byId.has(edge.source) || !byId.has(edge.target)) continue;
    if (roleOf(edge.type) === 'mechanism') continue;
    next.get(edge.source).push(edge.target);
    incoming.set(edge.target, incoming.get(edge.target) + 1);
  }
  const queue = functions
    .filter((f) => incoming.get(f.id) === 0)
    .sort((a, b) => numberOf(a) - numberOf(b));
  const result = [];
  const seen = new Set();
  while (queue.length) {
    const node = queue.shift();
    if (seen.has(node.id)) continue;
    seen.add(node.id);
    result.push(node);
    for (const id of next.get(node.id) || []) {
      incoming.set(id, incoming.get(id) - 1);
      if (incoming.get(id) <= 0 && !seen.has(id)) queue.push(byId.get(id));
    }
  }
  // append anything left (cycles)
  for (const fn of functions.sort((a, b) => numberOf(a) - numberOf(b))) if (!seen.has(fn.id)) result.push(fn);
  return result;
}

function numberOf(node) {
  const match = /(\d+)/.exec(node.props?.number || '');
  return match ? Number(match[1]) : 999;
}
