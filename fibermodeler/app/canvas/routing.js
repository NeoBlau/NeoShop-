/**
 * Connection geometry.
 *
 * Anchors are distributed along the element sides so that parallel flows never
 * overlap, and routes are orthogonal with as few bends as possible.  The result
 * is pure data (a list of points) which is used for rendering, hit testing,
 * label placement, SVG export and PDF export alike.
 */
import { center, dist, facingSide, oppositeSide, rectOf, sideNormal, sidePoint, simplify } from '../core/geometry.js';
import { getNotation } from '../notations/index.js';

const STUB = 18;
const GAP = 22;
const MIN_SPACING = 14;

/** Automatic attachment sides based on relative position. */
export function autoSides(sourceRect, targetRect) {
  const a = center(sourceRect);
  const b = center(targetRect);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return { sourceSide: dx >= 0 ? 'right' : 'left', targetSide: dx >= 0 ? 'left' : 'right' };
  }
  return { sourceSide: dy >= 0 ? 'bottom' : 'top', targetSide: dy >= 0 ? 'top' : 'bottom' };
}

function sideOffsetPoint(rect, side, ratio) {
  const p = sidePoint(rect, side);
  if (side === 'left' || side === 'right') return { x: p.x, y: rect.y + rect.h * ratio };
  return { x: rect.x + rect.w * ratio, y: p.y };
}

/**
 * Computes geometry for every edge of a diagram.
 * @returns {Map<string, {points: Array<{x,y}>, sourceSide: string, targetSide: string, labelPoint: {x,y}}>}
 */
export function layoutEdges(diagram, options = {}) {
  const style = options.connectionStyle || 'orthogonal';
  const notation = getNotation(diagram.notation);
  const nodes = new Map(diagram.nodes.map((n) => [n.id, n]));
  const result = new Map();

  // 1. resolve the side each edge end attaches to
  const ends = []; // {edge, nodeId, side, end:'source'|'target', other}
  for (const edge of diagram.edges) {
    const source = nodes.get(edge.source);
    const target = nodes.get(edge.target);
    if (!source || !target) continue;
    let sourceSide = edge.sourceSide;
    let targetSide = edge.targetSide;
    if (!sourceSide || !targetSide) {
      const notationSides = notation.sidesFor(edge.type, source, target) || {};
      const auto = autoSides(rectOf(source), rectOf(target));
      sourceSide = sourceSide || notationSides.sourceSide || auto.sourceSide;
      targetSide = targetSide || notationSides.targetSide || auto.targetSide;
    }
    if (source.id === target.id) {
      sourceSide = 'top';
      targetSide = 'left';
    }
    ends.push({ edge, nodeId: source.id, side: sourceSide, end: 'source', other: center(rectOf(target)) });
    ends.push({ edge, nodeId: target.id, side: targetSide, end: 'target', other: center(rectOf(source)) });
    result.set(edge.id, { sourceSide, targetSide, points: [] });
  }

  // 2. distribute anchors on each (node, side) pair
  const groups = new Map();
  for (const item of ends) {
    const key = `${item.nodeId}|${item.side}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  const anchors = new Map(); // `${edgeId}|${end}` -> point
  for (const [key, list] of groups) {
    const [nodeId, side] = key.split('|');
    const node = nodes.get(nodeId);
    if (!node) continue;
    const rect = rectOf(node);
    const horizontal = side === 'top' || side === 'bottom';
    list.sort((a, b) => (horizontal ? a.other.x - b.other.x : a.other.y - b.other.y));
    const span = horizontal ? rect.w : rect.h;
    const count = list.length;
    const spacing = Math.min(span / (count + 1), Math.max(MIN_SPACING, span / (count + 1)));
    const total = spacing * (count - 1);
    list.forEach((item, i) => {
      const offset = count === 1 ? span / 2 : span / 2 - total / 2 + i * spacing;
      const ratio = Math.min(0.92, Math.max(0.08, offset / span));
      anchors.set(`${item.edge.id}|${item.end}`, sideOffsetPoint(rect, side, ratio));
    });
  }

  // 3. build the polyline for each edge
  for (const edge of diagram.edges) {
    const geom = result.get(edge.id);
    if (!geom) continue;
    const source = nodes.get(edge.source);
    const target = nodes.get(edge.target);
    const start = anchors.get(`${edge.id}|source`) || center(rectOf(source));
    const end = anchors.get(`${edge.id}|target`) || center(rectOf(target));

    let points;
    if (source.id === target.id) {
      points = selfLoop(rectOf(source));
    } else if (edge.routing === 'manual' && edge.waypoints?.length) {
      points = [start, ...edge.waypoints.map((p) => ({ x: p.x, y: p.y })), end];
    } else if (style === 'straight') {
      points = straightRoute(rectOf(source), rectOf(target));
    } else {
      points = orthogonalRoute(start, geom.sourceSide, end, geom.targetSide, rectOf(source), rectOf(target));
    }
    geom.points = simplify(points, 0.6);
    geom.labelPoint = labelAnchor(geom.points);
    geom.length = geom.points.reduce((acc, p, i) => (i ? acc + dist(geom.points[i - 1], p) : 0), 0);
  }
  return result;
}

function straightRoute(sourceRect, targetRect) {
  const a = center(sourceRect);
  const b = center(targetRect);
  return [dockToRect(sourceRect, b), dockToRect(targetRect, a)];
}

function dockToRect(rect, toward) {
  const c = center(rect);
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  if (!dx && !dy) return { ...c };
  const hw = rect.w / 2;
  const hh = rect.h / 2;
  const scale = Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity);
  return { x: c.x + dx * scale, y: c.y + dy * scale };
}

export function orthogonalRoute(start, sourceSide, end, targetSide, sourceRect, targetRect) {
  const sn = sideNormal(sourceSide);
  const tn = sideNormal(targetSide);
  const a = { x: start.x + sn.x * STUB, y: start.y + sn.y * STUB };
  const b = { x: end.x + tn.x * STUB, y: end.y + tn.y * STUB };
  const points = [start, a];

  const sHorizontal = sourceSide === 'left' || sourceSide === 'right';
  const tHorizontal = targetSide === 'left' || targetSide === 'right';

  if (sHorizontal && tHorizontal) {
    const forward = (sn.x > 0 && b.x >= a.x) || (sn.x < 0 && b.x <= a.x);
    if (forward) {
      const midX = (a.x + b.x) / 2;
      points.push({ x: midX, y: a.y }, { x: midX, y: b.y });
    } else {
      const above = Math.min(sourceRect.y, targetRect.y) - GAP;
      const below = Math.max(sourceRect.y + sourceRect.h, targetRect.y + targetRect.h) + GAP;
      const midY = Math.abs(above - a.y) <= Math.abs(below - a.y) ? above : below;
      points.push({ x: a.x, y: midY }, { x: b.x, y: midY });
    }
  } else if (!sHorizontal && !tHorizontal) {
    const forward = (sn.y > 0 && b.y >= a.y) || (sn.y < 0 && b.y <= a.y);
    if (forward) {
      const midY = (a.y + b.y) / 2;
      points.push({ x: a.x, y: midY }, { x: b.x, y: midY });
    } else {
      const left = Math.min(sourceRect.x, targetRect.x) - GAP;
      const right = Math.max(sourceRect.x + sourceRect.w, targetRect.x + targetRect.w) + GAP;
      const midX = Math.abs(left - a.x) <= Math.abs(right - a.x) ? left : right;
      points.push({ x: midX, y: a.y }, { x: midX, y: b.y });
    }
  } else if (sHorizontal) {
    points.push({ x: b.x, y: a.y });
  } else {
    points.push({ x: a.x, y: b.y });
  }

  points.push(b, end);
  return points;
}

function selfLoop(rect) {
  const top = { x: rect.x + rect.w * 0.5, y: rect.y };
  const left = { x: rect.x, y: rect.y + rect.h * 0.5 };
  const up = { x: top.x, y: rect.y - 34 };
  const corner = { x: rect.x - 34, y: rect.y - 34 };
  const side = { x: rect.x - 34, y: left.y };
  return [top, up, corner, side, left];
}

function labelAnchor(points) {
  if (points.length < 2) return points[0] || { x: 0, y: 0 };
  // middle of the longest segment keeps labels off the bends
  let best = null;
  let bestLen = -1;
  for (let i = 1; i < points.length; i++) {
    const len = dist(points[i - 1], points[i]);
    if (len > bestLen) {
      bestLen = len;
      best = { x: (points[i - 1].x + points[i].x) / 2, y: (points[i - 1].y + points[i].y) / 2, horizontal: Math.abs(points[i].x - points[i - 1].x) > Math.abs(points[i].y - points[i - 1].y) };
    }
  }
  return best;
}

/** Geometry for a single edge being drawn interactively. */
export function previewRoute(sourceRect, sourceSide, pointer, targetRect, targetSide) {
  if (!targetRect) {
    const side = sourceSide || facingSide(sourceRect, pointer);
    const start = sidePoint(sourceRect, side);
    const sn = sideNormal(side);
    const a = { x: start.x + sn.x * STUB, y: start.y + sn.y * STUB };
    const horizontal = side === 'left' || side === 'right';
    const mid = horizontal ? { x: a.x, y: pointer.y } : { x: pointer.x, y: a.y };
    return simplify([start, a, mid, pointer], 0.6);
  }
  const auto = autoSides(sourceRect, targetRect);
  const ss = sourceSide || auto.sourceSide;
  const ts = targetSide || auto.targetSide || oppositeSide(ss);
  return simplify(
    orthogonalRoute(sidePoint(sourceRect, ss), ss, sidePoint(targetRect, ts), ts, sourceRect, targetRect),
    0.6
  );
}
