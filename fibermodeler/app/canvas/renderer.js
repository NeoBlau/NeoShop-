/**
 * Turns model elements into SVG markup.
 *
 * Everything is produced as strings: the same functions feed the live canvas,
 * the SVG export and (through the SVG parser) the PDF export, so what you see
 * is exactly what you get in every output format.
 */
import { fmt, pointAlong, roundedPath } from '../core/geometry.js';
import { esc, n, textBlock } from '../notations/shared.js';
import { getNotation } from '../notations/index.js';

const ARROW_LENGTH = 11;
const ARROW_WIDTH = 4.2;

export function nodeMarkup(node, descriptor, ctx = {}) {
  if (!descriptor) return '';
  try {
    return descriptor.draw(node, ctx) || '';
  } catch (err) {
    console.error('[FiberModeler] failed to draw node', node.id, err);
    return `<rect x="0" y="0" width="${n(node.w)}" height="${n(node.h)}" fill="none" stroke="var(--danger)" stroke-dasharray="4 3"/>`;
  }
}

export function nodeElementHtml(node, descriptor, ctx) {
  return (
    `<g class="node" data-id="${esc(node.id)}" data-type="${esc(node.type)}" transform="translate(${n(node.x)},${n(node.y)})">` +
    nodeMarkup(node, descriptor, ctx) +
    '</g>'
  );
}

function arrowHead(points, style, color) {
  if (points.length < 2) return '';
  const end = points[points.length - 1];
  const prev = points[points.length - 2];
  const angle = Math.atan2(end.y - prev.y, end.x - prev.x);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const base = { x: end.x - cos * ARROW_LENGTH, y: end.y - sin * ARROW_LENGTH };
  const left = { x: base.x - sin * ARROW_WIDTH, y: base.y + cos * ARROW_WIDTH };
  const right = { x: base.x + sin * ARROW_WIDTH, y: base.y - cos * ARROW_WIDTH };
  const pts = `${fmt(left.x)},${fmt(left.y)} ${fmt(end.x)},${fmt(end.y)} ${fmt(right.x)},${fmt(right.y)}`;
  switch (style) {
    case 'arrow-open':
      return `<polyline class="edge-arrow" points="${pts}" fill="none" stroke="${color}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 'arrow-hollow':
      return `<polygon class="edge-arrow" points="${pts}" fill="var(--canvas-bg)" stroke="${color}" stroke-width="1.3"/>`;
    case 'arrow-filled':
    default:
      return `<polygon class="edge-arrow" points="${pts}" fill="${color}" stroke="${color}" stroke-width="1"/>`;
  }
}

function startMarker(points, style, color) {
  if (!style || points.length < 2) return '';
  const start = points[0];
  if (style === 'circle-open') {
    return `<circle class="edge-start" cx="${fmt(start.x)}" cy="${fmt(start.y)}" r="3.4" fill="var(--canvas-bg)" stroke="${color}" stroke-width="1.3"/>`;
  }
  return '';
}

/** IDEF0 tunnel brackets - "( )" at an arrow end. */
function tunnel(points, atStart, color) {
  const p = atStart ? points[0] : points[points.length - 1];
  const q = atStart ? points[1] : points[points.length - 2];
  if (!p || !q) return '';
  const angle = Math.atan2(q.y - p.y, q.x - p.x);
  const r = 7;
  const x = p.x + Math.cos(angle) * 9;
  const y = p.y + Math.sin(angle) * 9;
  const deg = (angle * 180) / Math.PI;
  return `<path class="edge-tunnel" d="M ${fmt(-r * 0.6)} ${fmt(-r)} A ${r} ${r} 0 0 0 ${fmt(-r * 0.6)} ${fmt(
    r
  )}" transform="translate(${fmt(x)},${fmt(y)}) rotate(${fmt(deg)})" fill="none" stroke="${color}" stroke-width="1.4"/>`;
}

export function edgeMarkup(edge, geom, descriptor, options = {}) {
  if (!geom || geom.points.length < 2) return '';
  const color = edge.style?.stroke || options.defaultColor || 'var(--flow-stroke)';
  const rounded = options.smooth !== false;
  const d = rounded ? roundedPath(geom.points, 7) : `M ${geom.points.map((p) => `${fmt(p.x)} ${fmt(p.y)}`).join(' L ')}`;
  const dash = descriptor?.dash ? ` stroke-dasharray="${descriptor.dash}"` : '';
  let markup = `<path class="edge-hit" d="${d}" fill="none" stroke="transparent" stroke-width="12"/>`;
  markup += `<path class="edge-line" d="${d}" fill="none" stroke="${color}" stroke-width="${edge.style?.width || 1.5}"${dash} stroke-linejoin="round" stroke-linecap="round"/>`;
  markup += arrowHead(geom.points, descriptor?.marker === null ? null : descriptor?.marker || 'arrow-filled', color);
  markup += startMarker(geom.points, descriptor?.startMarker, color);
  if (edge.props?.isDefault) {
    const p = pointAlong(geom.points, 0.08);
    const a = (p.angle || 0) + Math.PI / 2;
    markup += `<line class="edge-default" x1="${fmt(p.x - Math.cos(a) * 6 - Math.cos(p.angle || 0) * 4)}" y1="${fmt(
      p.y - Math.sin(a) * 6 - Math.sin(p.angle || 0) * 4
    )}" x2="${fmt(p.x + Math.cos(a) * 6)}" y2="${fmt(p.y + Math.sin(a) * 6)}" stroke="${color}" stroke-width="1.6"/>`;
  }
  if (edge.props?.tunnelSource) markup += tunnel(geom.points, true, color);
  if (edge.props?.tunnelTarget) markup += tunnel(geom.points, false, color);
  if (edge.props?.icom) {
    const p = geom.points[geom.points.length - 1];
    markup += `<text class="edge-icom" x="${fmt(p.x - 6)}" y="${fmt(p.y - 6)}" font-size="10" fill="var(--accent)">${esc(edge.props.icom)}</text>`;
  }
  const label = edge.label || (edge.props?.condition ? `[${edge.props.condition}]` : '');
  if (label) {
    const lp = geom.labelPoint || geom.points[0];
    const width = Math.max(60, Math.min(160, (geom.length || 100) * 0.6));
    markup +=
      `<g class="edge-label" transform="translate(${fmt(lp.x)},${fmt(lp.y - 9)})">` +
      textBlock(label, {
        x: -width / 2,
        y: -8,
        width,
        height: 16,
        fontSize: 11,
        color: edge.style?.textColor || 'var(--el-text)',
        maxLines: 2,
        className: 'edge-label-text',
      }) +
      '</g>';
  }
  return markup;
}

export function edgeElementHtml(edge, geom, descriptor, options) {
  return (
    `<g class="edge" data-id="${esc(edge.id)}" data-type="${esc(edge.type)}">` +
    edgeMarkup(edge, geom, descriptor, options) +
    '</g>'
  );
}

/** Full diagram markup - used by the exporters and by the initial render. */
export function diagramMarkup(diagram, geometries, options = {}) {
  const notation = getNotation(diagram.notation);
  const back = [];
  const front = [];
  for (const node of sortedNodes(diagram)) {
    const descriptor = notation.nodeTypes[node.type];
    const ctx = { decomposed: options.decomposedIds?.has(node.id), locale: options.locale };
    const html = nodeElementHtml(node, descriptor, ctx);
    if ((descriptor?.zIndex || 0) < 0) back.push(html);
    else front.push(html);
  }
  const edges = [];
  for (const edge of diagram.edges) {
    const descriptor = notation.edgeTypes[edge.type];
    edges.push(edgeElementHtml(edge, geometries.get(edge.id), descriptor, options));
  }
  return { back: back.join(''), edges: edges.join(''), front: front.join('') };
}

/** Containers first, then the rest - keeps pools behind their content. */
export function sortedNodes(diagram) {
  const notation = getNotation(diagram.notation);
  return [...diagram.nodes].sort((a, b) => {
    const za = notation.nodeTypes[a.type]?.zIndex || 0;
    const zb = notation.nodeTypes[b.type]?.zIndex || 0;
    if (za !== zb) return za - zb;
    return 0;
  });
}
