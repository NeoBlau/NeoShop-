/** Pure geometry helpers. No DOM, no state - fully unit testable. */

export const EPS = 1e-6;

export function rectOf(node) {
  return { x: node.x, y: node.y, w: node.w, h: node.h };
}

export function center(r) {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

export function rectContains(r, p) {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

export function rectIntersects(a, b) {
  return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
}

export function rectContainsRect(outer, inner) {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.h <= outer.y + outer.h
  );
}

export function unionRect(rects) {
  if (!rects.length) return null;
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const r of rects) {
    x1 = Math.min(x1, r.x);
    y1 = Math.min(y1, r.y);
    x2 = Math.max(x2, r.x + r.w);
    y2 = Math.max(y2, r.y + r.h);
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

export function inflate(r, d) {
  return { x: r.x - d, y: r.y - d, w: r.w + 2 * d, h: r.h + 2 * d };
}

export function snap(value, step) {
  return step > 0 ? Math.round(value / step) * step : value;
}

export function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** The four side mid points of a rectangle. */
export function sidePoint(r, side) {
  switch (side) {
    case 'left':
      return { x: r.x, y: r.y + r.h / 2 };
    case 'right':
      return { x: r.x + r.w, y: r.y + r.h / 2 };
    case 'top':
      return { x: r.x + r.w / 2, y: r.y };
    case 'bottom':
    default:
      return { x: r.x + r.w / 2, y: r.y + r.h };
  }
}

export const SIDES = ['top', 'right', 'bottom', 'left'];

export function oppositeSide(side) {
  return { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }[side] || 'left';
}

export function sideNormal(side) {
  return { top: { x: 0, y: -1 }, bottom: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }[
    side
  ];
}

/** Pick the rectangle side that faces `target` most directly. */
export function facingSide(rect, target) {
  const c = center(rect);
  const dx = target.x - c.x;
  const dy = target.y - c.y;
  if (Math.abs(dx) * rect.h >= Math.abs(dy) * rect.w) return dx >= 0 ? 'right' : 'left';
  return dy >= 0 ? 'bottom' : 'top';
}

/** Intersection of the segment (center -> p) with the rectangle border. */
export function dockPoint(rect, p) {
  const c = center(rect);
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  if (Math.abs(dx) < EPS && Math.abs(dy) < EPS) return { ...c };
  const hw = rect.w / 2;
  const hh = rect.h / 2;
  const scale = Math.min(
    Math.abs(dx) < EPS ? Infinity : hw / Math.abs(dx),
    Math.abs(dy) < EPS ? Infinity : hh / Math.abs(dy)
  );
  return { x: c.x + dx * scale, y: c.y + dy * scale };
}

/** Distance from point to segment - used for edge hit testing and waypoint insertion. */
export function pointToSegment(p, a, b) {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const len2 = vx * vx + vy * vy;
  if (len2 < EPS) return { dist: dist(p, a), t: 0, point: { ...a } };
  let t = ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2;
  t = clamp(t, 0, 1);
  const point = { x: a.x + vx * t, y: a.y + vy * t };
  return { dist: dist(p, point), t, point };
}

/** Total length of a polyline. */
export function polylineLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += dist(points[i - 1], points[i]);
  return total;
}

/** Point at a given ratio (0..1) along a polyline. */
export function pointAlong(points, ratio) {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return { ...points[0] };
  const target = polylineLength(points) * clamp(ratio, 0, 1);
  let acc = 0;
  for (let i = 1; i < points.length; i++) {
    const seg = dist(points[i - 1], points[i]);
    if (acc + seg >= target || i === points.length - 1) {
      const t = seg < EPS ? 0 : (target - acc) / seg;
      return {
        x: lerp(points[i - 1].x, points[i].x, t),
        y: lerp(points[i - 1].y, points[i].y, t),
        angle: Math.atan2(points[i].y - points[i - 1].y, points[i].x - points[i - 1].x),
      };
    }
    acc += seg;
  }
  return { ...points[points.length - 1] };
}

/** Removes collinear / duplicated points from a polyline. */
export function simplify(points, tolerance = 0.5) {
  const out = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (last && dist(last, p) < tolerance) continue;
    out.push({ x: p.x, y: p.y });
  }
  for (let i = out.length - 2; i > 0; i--) {
    const a = out[i - 1];
    const b = out[i];
    const c = out[i + 1];
    const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    if (Math.abs(cross) < tolerance) out.splice(i, 1);
  }
  return out;
}

/** Rounded polyline as an SVG path string. */
export function roundedPath(points, radius = 8) {
  if (points.length < 2) return '';
  if (points.length === 2) return `M ${fmt(points[0].x)} ${fmt(points[0].y)} L ${fmt(points[1].x)} ${fmt(points[1].y)}`;
  let d = `M ${fmt(points[0].x)} ${fmt(points[0].y)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const next = points[i + 1];
    const r1 = Math.min(radius, dist(prev, cur) / 2);
    const r2 = Math.min(radius, dist(cur, next) / 2);
    const r = Math.min(r1, r2);
    if (r < 1) {
      d += ` L ${fmt(cur.x)} ${fmt(cur.y)}`;
      continue;
    }
    const p1 = towards(cur, prev, r);
    const p2 = towards(cur, next, r);
    d += ` L ${fmt(p1.x)} ${fmt(p1.y)} Q ${fmt(cur.x)} ${fmt(cur.y)} ${fmt(p2.x)} ${fmt(p2.y)}`;
  }
  const last = points[points.length - 1];
  d += ` L ${fmt(last.x)} ${fmt(last.y)}`;
  return d;
}

export function towards(from, to, distance) {
  const d = dist(from, to);
  if (d < EPS) return { ...from };
  return { x: from.x + ((to.x - from.x) / d) * distance, y: from.y + ((to.y - from.y) / d) * distance };
}

export function fmt(n) {
  return Math.round(n * 100) / 100;
}
