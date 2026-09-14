/**
 * Vector PDF writer.
 *
 * The exported SVG is parsed and translated into PDF drawing operators, so
 * shapes stay vectors and text stays selectable text - including Cyrillic,
 * through an embedded TrueType subset (Identity-H encoded CID font).
 */
import { FIBER_SANS, FIBER_SANS_TTF_BASE64 } from '../assets/fonts/fibersans.js';
import { parseXml } from './xml.js';

export const PAGE_SIZES = {
  A0: [2383.94, 3370.39],
  A1: [1683.78, 2383.94],
  A2: [1190.55, 1683.78],
  A3: [841.89, 1190.55],
  A4: [595.28, 841.89],
  A5: [419.53, 595.28],
  Letter: [612, 792],
};

/* ---------------------------------------------------------------- matrices */

const IDENTITY = [1, 0, 0, 1, 0, 0];

function multiply(a, b) {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

function parseTransform(value) {
  let matrix = IDENTITY;
  const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
  let match;
  while ((match = re.exec(value))) {
    const args = match[2].split(/[\s,]+/).filter(Boolean).map(Number);
    switch (match[1]) {
      case 'matrix':
        matrix = multiply(matrix, args.slice(0, 6));
        break;
      case 'translate':
        matrix = multiply(matrix, [1, 0, 0, 1, args[0] || 0, args[1] || 0]);
        break;
      case 'scale':
        matrix = multiply(matrix, [args[0] ?? 1, 0, 0, args[1] ?? args[0] ?? 1, 0, 0]);
        break;
      case 'rotate': {
        const angle = ((args[0] || 0) * Math.PI) / 180;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        if (args.length >= 3) {
          matrix = multiply(matrix, [1, 0, 0, 1, args[1], args[2]]);
          matrix = multiply(matrix, [cos, sin, -sin, cos, 0, 0]);
          matrix = multiply(matrix, [1, 0, 0, 1, -args[1], -args[2]]);
        } else {
          matrix = multiply(matrix, [cos, sin, -sin, cos, 0, 0]);
        }
        break;
      }
      case 'skewX':
        matrix = multiply(matrix, [1, 0, Math.tan(((args[0] || 0) * Math.PI) / 180), 1, 0, 0]);
        break;
      case 'skewY':
        matrix = multiply(matrix, [1, Math.tan(((args[0] || 0) * Math.PI) / 180), 0, 1, 0, 0]);
        break;
      default:
        break;
    }
  }
  return matrix;
}

/* ------------------------------------------------------------------ colors */

const NAMED = {
  black: [0, 0, 0],
  white: [1, 1, 1],
  none: null,
  transparent: null,
  currentcolor: 'current',
};

function parseColor(value, state) {
  if (value === undefined || value === null || value === '') return undefined;
  const text = String(value).trim().toLowerCase();
  if (text === 'currentcolor') return state?.color ?? [0, 0, 0];
  if (text in NAMED) return NAMED[text] === 'current' ? state?.color ?? [0, 0, 0] : NAMED[text];
  if (text.startsWith('#')) {
    const hex = text.slice(1);
    const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex.slice(0, 6);
    if (full.length !== 6) return [0, 0, 0];
    return [parseInt(full.slice(0, 2), 16) / 255, parseInt(full.slice(2, 4), 16) / 255, parseInt(full.slice(4, 6), 16) / 255];
  }
  const rgb = /rgba?\(([^)]+)\)/.exec(text);
  if (rgb) {
    const parts = rgb[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return [(parts[0] || 0) / 255, (parts[1] || 0) / 255, (parts[2] || 0) / 255];
  }
  return [0, 0, 0];
}

function colorOp(color, stroke) {
  return `${round(color[0])} ${round(color[1])} ${round(color[2])} ${stroke ? 'RG' : 'rg'}`;
}

function round(v) {
  return Math.round((Number(v) || 0) * 1000) / 1000;
}

/* -------------------------------------------------------------- path build */

function rectPath(x, y, w, h, rx, ry) {
  if (!rx && !ry) {
    return [['M', x, y], ['L', x + w, y], ['L', x + w, y + h], ['L', x, y + h], ['Z']];
  }
  const a = Math.min(rx || ry || 0, w / 2);
  const b = Math.min(ry || rx || 0, h / 2);
  const k = 0.5523;
  return [
    ['M', x + a, y],
    ['L', x + w - a, y],
    ['C', x + w - a + a * k, y, x + w, y + b - b * k, x + w, y + b],
    ['L', x + w, y + h - b],
    ['C', x + w, y + h - b + b * k, x + w - a + a * k, y + h, x + w - a, y + h],
    ['L', x + a, y + h],
    ['C', x + a - a * k, y + h, x, y + h - b + b * k, x, y + h - b],
    ['L', x, y + b],
    ['C', x, y + b - b * k, x + a - a * k, y, x + a, y],
    ['Z'],
  ];
}

function ellipsePath(cx, cy, rx, ry) {
  const k = 0.5523;
  return [
    ['M', cx - rx, cy],
    ['C', cx - rx, cy - ry * k, cx - rx * k, cy - ry, cx, cy - ry],
    ['C', cx + rx * k, cy - ry, cx + rx, cy - ry * k, cx + rx, cy],
    ['C', cx + rx, cy + ry * k, cx + rx * k, cy + ry, cx, cy + ry],
    ['C', cx - rx * k, cy + ry, cx - rx, cy + ry * k, cx - rx, cy],
    ['Z'],
  ];
}

function parsePathData(d) {
  const commands = [];
  const tokens = String(d).match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || [];
  let i = 0;
  let cmd = 'M';
  let cx = 0;
  let cy = 0;
  let startX = 0;
  let startY = 0;
  let lastControl = null;
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) cmd = tokens[i++];
    const relative = cmd === cmd.toLowerCase();
    const type = cmd.toUpperCase();
    const rx = (v) => (relative ? cx + v : v);
    const ry = (v) => (relative ? cy + v : v);
    switch (type) {
      case 'M': {
        const x = rx(num());
        const y = ry(num());
        commands.push(['M', x, y]);
        cx = startX = x;
        cy = startY = y;
        cmd = relative ? 'l' : 'L';
        lastControl = null;
        break;
      }
      case 'L': {
        const x = rx(num());
        const y = ry(num());
        commands.push(['L', x, y]);
        cx = x;
        cy = y;
        lastControl = null;
        break;
      }
      case 'H': {
        const x = rx(num());
        commands.push(['L', x, cy]);
        cx = x;
        lastControl = null;
        break;
      }
      case 'V': {
        const y = ry(num());
        commands.push(['L', cx, y]);
        cy = y;
        lastControl = null;
        break;
      }
      case 'C': {
        const x1 = rx(num());
        const y1 = ry(num());
        const x2 = rx(num());
        const y2 = ry(num());
        const x = rx(num());
        const y = ry(num());
        commands.push(['C', x1, y1, x2, y2, x, y]);
        lastControl = { x: x2, y: y2 };
        cx = x;
        cy = y;
        break;
      }
      case 'S': {
        const x2 = rx(num());
        const y2 = ry(num());
        const x = rx(num());
        const y = ry(num());
        const x1 = lastControl ? 2 * cx - lastControl.x : cx;
        const y1 = lastControl ? 2 * cy - lastControl.y : cy;
        commands.push(['C', x1, y1, x2, y2, x, y]);
        lastControl = { x: x2, y: y2 };
        cx = x;
        cy = y;
        break;
      }
      case 'Q': {
        const qx = rx(num());
        const qy = ry(num());
        const x = rx(num());
        const y = ry(num());
        commands.push(quadToCubic(cx, cy, qx, qy, x, y));
        lastControl = { x: qx, y: qy, quad: true };
        cx = x;
        cy = y;
        break;
      }
      case 'T': {
        const x = rx(num());
        const y = ry(num());
        const qx = lastControl?.quad ? 2 * cx - lastControl.x : cx;
        const qy = lastControl?.quad ? 2 * cy - lastControl.y : cy;
        commands.push(quadToCubic(cx, cy, qx, qy, x, y));
        lastControl = { x: qx, y: qy, quad: true };
        cx = x;
        cy = y;
        break;
      }
      case 'A': {
        const rxv = num();
        const ryv = num();
        const rotation = num();
        const largeArc = num();
        const sweep = num();
        const x = rx(num());
        const y = ry(num());
        for (const segment of arcToCubic(cx, cy, rxv, ryv, rotation, largeArc, sweep, x, y)) commands.push(segment);
        cx = x;
        cy = y;
        lastControl = null;
        break;
      }
      case 'Z':
        commands.push(['Z']);
        cx = startX;
        cy = startY;
        lastControl = null;
        break;
      default:
        i++;
        break;
    }
  }
  return commands;
}

function quadToCubic(x0, y0, qx, qy, x, y) {
  return ['C', x0 + (2 / 3) * (qx - x0), y0 + (2 / 3) * (qy - y0), x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y), x, y];
}

function arcToCubic(x0, y0, rx, ry, rotation, largeArc, sweep, x, y) {
  if (!rx || !ry) return [['L', x, y]];
  const phi = (rotation * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (x0 - x) / 2;
  const dy = (y0 - y) / 2;
  const x1 = cos * dx + sin * dy;
  const y1 = -sin * dx + cos * dy;
  let rxs = rx * rx;
  let rys = ry * ry;
  const lambda = (x1 * x1) / rxs + (y1 * y1) / rys;
  if (lambda > 1) {
    const scale = Math.sqrt(lambda);
    rx *= scale;
    ry *= scale;
    rxs = rx * rx;
    rys = ry * ry;
  }
  const sign = largeArc === sweep ? -1 : 1;
  const numerator = Math.max(0, rxs * rys - rxs * y1 * y1 - rys * x1 * x1);
  const denominator = rxs * y1 * y1 + rys * x1 * x1 || 1;
  const coefficient = sign * Math.sqrt(numerator / denominator);
  const cx1 = (coefficient * rx * y1) / ry;
  const cy1 = (-coefficient * ry * x1) / rx;
  const cx = cos * cx1 - sin * cy1 + (x0 + x) / 2;
  const cy = sin * cx1 + cos * cy1 + (y0 + y) / 2;
  const angle = (ux, uy, vx, vy) => {
    const dot = ux * vx + uy * vy;
    const len = Math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy)) || 1;
    let a = Math.acos(Math.min(1, Math.max(-1, dot / len)));
    if (ux * vy - uy * vx < 0) a = -a;
    return a;
  };
  const theta = angle(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry);
  let delta = angle((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry);
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  if (sweep && delta < 0) delta += 2 * Math.PI;
  const segments = Math.ceil(Math.abs(delta / (Math.PI / 2)));
  const step = delta / segments;
  const result = [];
  let start = theta;
  for (let i = 0; i < segments; i++) {
    const end = start + step;
    const k = (4 / 3) * Math.tan(step / 4);
    const p1 = point(cx, cy, rx, ry, cos, sin, start);
    const p2 = point(cx, cy, rx, ry, cos, sin, end);
    const d1 = derivative(rx, ry, cos, sin, start);
    const d2 = derivative(rx, ry, cos, sin, end);
    result.push(['C', p1.x + k * d1.x, p1.y + k * d1.y, p2.x - k * d2.x, p2.y - k * d2.y, p2.x, p2.y]);
    start = end;
  }
  return result;
}

function point(cx, cy, rx, ry, cos, sin, angle) {
  const x = rx * Math.cos(angle);
  const y = ry * Math.sin(angle);
  return { x: cx + cos * x - sin * y, y: cy + sin * x + cos * y };
}

function derivative(rx, ry, cos, sin, angle) {
  const x = -rx * Math.sin(angle);
  const y = ry * Math.cos(angle);
  return { x: cos * x - sin * y, y: sin * x + cos * y };
}

/* ------------------------------------------------------------- SVG walking */

const INHERITED = ['fill', 'stroke', 'stroke-width', 'font-size', 'font-weight', 'text-anchor', 'opacity', 'color', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'fill-opacity', 'stroke-opacity'];

function styleOf(node, parentStyle) {
  const style = { ...parentStyle };
  const inline = {};
  if (node.attrs.style) {
    for (const rule of node.attrs.style.split(';')) {
      const [key, value] = rule.split(':').map((s) => (s || '').trim());
      if (key) inline[key] = value;
    }
  }
  for (const key of INHERITED) {
    const value = inline[key] ?? node.attrs[key];
    if (value !== undefined && value !== '') style[key] = value;
  }
  return style;
}

class ContentBuilder {
  constructor(font) {
    this.ops = [];
    this.font = font;
    this.glyphs = new Set([0]);
    this.alphas = new Map();
  }

  push(op) {
    this.ops.push(op);
  }

  alphaState(fillAlpha, strokeAlpha) {
    const key = `${fillAlpha}|${strokeAlpha}`;
    if (!this.alphas.has(key)) this.alphas.set(key, { name: `GS${this.alphas.size}`, fillAlpha, strokeAlpha });
    return this.alphas.get(key).name;
  }

  toString() {
    return this.ops.join('\n');
  }
}

function emitPath(builder, commands, style, state) {
  const fill = parseColor(style.fill ?? '#000000', state);
  const stroke = parseColor(style.stroke, state);
  const hasFill = fill !== null && fill !== undefined;
  const hasStroke = stroke !== null && stroke !== undefined && Number(style['stroke-width'] ?? 1) !== 0;
  if (!hasFill && !hasStroke) return;

  const opacity = Number(style.opacity ?? 1);
  const fillAlpha = Number(style['fill-opacity'] ?? 1) * opacity;
  const strokeAlpha = Number(style['stroke-opacity'] ?? 1) * opacity;
  builder.push('q');
  if (fillAlpha < 1 || strokeAlpha < 1) builder.push(`/${builder.alphaState(fillAlpha, strokeAlpha)} gs`);
  if (hasFill) builder.push(colorOp(fill, false));
  if (hasStroke) {
    builder.push(colorOp(stroke, true));
    builder.push(`${round(Number(style['stroke-width'] ?? 1))} w`);
    const cap = { butt: 0, round: 1, square: 2 }[style['stroke-linecap']] ?? 0;
    const join = { miter: 0, round: 1, bevel: 2 }[style['stroke-linejoin']] ?? 0;
    builder.push(`${cap} J ${join} j`);
    const dash = style['stroke-dasharray'];
    if (dash && dash !== 'none') {
      const values = dash.split(/[\s,]+/).filter(Boolean).map(Number).filter((v) => Number.isFinite(v));
      builder.push(`[${values.map(round).join(' ')}] 0 d`);
    } else {
      builder.push('[] 0 d');
    }
  }
  for (const command of commands) {
    const [type, ...args] = command;
    const values = [];
    for (let i = 0; i < args.length; i += 2) {
      const p = transformPoint(state.matrix, args[i], args[i + 1]);
      values.push(round(p.x), round(p.y));
    }
    if (type === 'M') builder.push(`${values[0]} ${values[1]} m`);
    else if (type === 'L') builder.push(`${values[0]} ${values[1]} l`);
    else if (type === 'C') builder.push(`${values.join(' ')} c`);
    else if (type === 'Z') builder.push('h');
  }
  builder.push(hasFill && hasStroke ? 'B' : hasFill ? 'f' : 'S');
  builder.push('Q');
}

function transformPoint(matrix, x, y) {
  return { x: matrix[0] * x + matrix[2] * y + matrix[4], y: matrix[1] * x + matrix[3] * y + matrix[5] };
}

function textWidth(text, fontSize) {
  let total = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0);
    const width = FIBER_SANS.widths[String(code)] ?? FIBER_SANS.widths['32'] ?? 600;
    total += width;
  }
  return (total / FIBER_SANS.unitsPerEm) * fontSize;
}

function encodeText(text, builder) {
  let hex = '';
  for (const ch of text) {
    const code = ch.codePointAt(0);
    const gid = FIBER_SANS.gid[String(code)] ?? FIBER_SANS.gid['63'] ?? 0;
    builder.glyphs.add(gid);
    hex += gid.toString(16).padStart(4, '0');
  }
  return hex;
}

function emitText(builder, node, style, state, inherited = {}) {
  const fontSize = Number(style['font-size'] ?? inherited.fontSize ?? 12);
  const anchor = style['text-anchor'] || 'start';
  const bold = String(style['font-weight'] || '').match(/bold|[6-9]00/);
  const color = parseColor(style.fill ?? '#000000', state) || [0, 0, 0];
  const opacity = Number(style.opacity ?? 1) * Number(style['fill-opacity'] ?? 1);

  const runs = [];
  const collect = (element, x, y) => {
    const spans = element.children.filter((c) => c.tag === 'tspan');
    if (spans.length) {
      for (const span of spans) {
        collect(span, span.attrs.x !== undefined ? Number(span.attrs.x) : x, span.attrs.y !== undefined ? Number(span.attrs.y) : y);
      }
      if (element.text.trim()) runs.push({ text: element.text.trim(), x, y });
    } else {
      const text = (element.text || '').replace(/\s+/g, ' ').trim();
      if (text) runs.push({ text, x, y });
    }
  };
  collect(node, Number(node.attrs.x || 0), Number(node.attrs.y || 0));
  if (!runs.length) return;

  builder.push('q');
  if (opacity < 1) builder.push(`/${builder.alphaState(opacity, opacity)} gs`);
  builder.push(colorOp(color, false));
  if (bold) {
    builder.push(colorOp(color, true));
    builder.push(`${round(fontSize * 0.028)} w`);
  }
  builder.push('BT');
  builder.push(`/F1 ${round(fontSize)} Tf`);
  builder.push(bold ? '2 Tr' : '0 Tr');
  for (const run of runs) {
    const width = textWidth(run.text, fontSize);
    let x = run.x;
    if (anchor === 'middle') x -= width / 2;
    else if (anchor === 'end') x -= width;
    const m = multiply(state.matrix, [1, 0, 0, 1, x, run.y]);
    // flip the glyphs back: the page matrix mirrors the Y axis
    const tm = multiply(m, [1, 0, 0, -1, 0, 0]);
    builder.push(`${round(tm[0])} ${round(tm[1])} ${round(tm[2])} ${round(tm[3])} ${round(tm[4])} ${round(tm[5])} Tm`);
    builder.push(`<${encodeText(run.text, builder)}> Tj`);
  }
  builder.push('ET');
  builder.push('Q');
}

function walk(node, builder, state) {
  for (const child of node.children) {
    const style = styleOf(child, state.style);
    const color = child.attrs.color ? parseColor(child.attrs.color, state) : state.color;
    let matrix = state.matrix;
    if (child.attrs.transform) matrix = multiply(matrix, parseTransform(child.attrs.transform));
    const childState = { ...state, matrix, style, color };
    const a = child.attrs;
    switch (child.tag) {
      case 'g':
      case 'svg':
        walk(child, builder, childState);
        break;
      case 'rect':
        emitPath(
          builder,
          rectPath(Number(a.x || 0), Number(a.y || 0), Number(a.width || 0), Number(a.height || 0), Number(a.rx || 0), Number(a.ry || 0)),
          style,
          childState
        );
        break;
      case 'circle':
        emitPath(builder, ellipsePath(Number(a.cx || 0), Number(a.cy || 0), Number(a.r || 0), Number(a.r || 0)), style, childState);
        break;
      case 'ellipse':
        emitPath(builder, ellipsePath(Number(a.cx || 0), Number(a.cy || 0), Number(a.rx || 0), Number(a.ry || 0)), style, childState);
        break;
      case 'line':
        emitPath(builder, [['M', Number(a.x1 || 0), Number(a.y1 || 0)], ['L', Number(a.x2 || 0), Number(a.y2 || 0)]], { fill: 'none', ...style }, childState);
        break;
      case 'polyline':
      case 'polygon': {
        const points = String(a.points || '').trim().split(/[\s,]+/).map(Number);
        const commands = [];
        for (let i = 0; i + 1 < points.length; i += 2) commands.push([i === 0 ? 'M' : 'L', points[i], points[i + 1]]);
        if (child.tag === 'polygon') commands.push(['Z']);
        emitPath(builder, commands, child.tag === 'polyline' ? { fill: 'none', ...style } : style, childState);
        break;
      }
      case 'path':
        emitPath(builder, parsePathData(a.d || ''), style, childState);
        break;
      case 'text':
        emitText(builder, child, style, childState);
        break;
      case 'style':
      case 'defs':
      case 'title':
      case 'desc':
        break;
      default:
        walk(child, builder, childState);
        break;
    }
  }
}

/** Converts an SVG string into PDF operators inside the given page box. */
export function svgToContent(svgMarkup, { x = 0, y = 0, width, height, pageHeight }) {
  const root = parseXml(svgMarkup);
  const svg = root.children.find((c) => c.tag === 'svg');
  if (!svg) throw new Error('Invalid SVG');
  const viewBox = String(svg.attrs.viewBox || '').trim().split(/[\s,]+/).map(Number);
  const vb = viewBox.length === 4 ? { x: viewBox[0], y: viewBox[1], w: viewBox[2], h: viewBox[3] } : { x: 0, y: 0, w: Number(svg.attrs.width) || width, h: Number(svg.attrs.height) || height };
  const scale = Math.min(width / vb.w, height / vb.h);
  const offsetX = x + (width - vb.w * scale) / 2;
  const offsetY = y + (height - vb.h * scale) / 2;

  // page space (y up) <- svg space (y down)
  const base = multiply([1, 0, 0, -1, 0, pageHeight], [scale, 0, 0, scale, offsetX, offsetY]);
  const matrix = multiply(base, [1, 0, 0, 1, -vb.x, -vb.y]);

  const builder = new ContentBuilder(FIBER_SANS);
  walk(svg, builder, {
    matrix,
    style: { fill: '#000000', 'font-size': 12 },
    color: [0, 0, 0],
  });
  return { content: builder.toString(), builder, scale, box: { x: offsetX, y: offsetY, w: vb.w * scale, h: vb.h * scale } };
}

/* ------------------------------------------------------------- PDF writing */

function pdfString(text) {
  return `(${String(text).replace(/[\\()]/g, (c) => `\\${c}`)})`;
}

function base64ToBytes(base64) {
  if (typeof atob === 'function') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  return Uint8Array.from(Buffer.from(base64, 'base64'));
}

/**
 * @param {Array<{width:number,height:number,content:string,alphas:Map,glyphs:Set}>} pages
 */
export function buildPdf(pages, meta = {}) {
  const objects = [];
  const add = (data) => {
    objects.push(data);
    return objects.length; // 1-based object number
  };

  const fontBytes = base64ToBytes(FIBER_SANS_TTF_BASE64);
  const scale = 1000 / FIBER_SANS.unitsPerEm;
  const widths = [];
  const gidWidth = new Map();
  for (const [code, gid] of Object.entries(FIBER_SANS.gid)) {
    gidWidth.set(gid, Math.round((FIBER_SANS.widths[code] || 0) * scale));
  }
  const sortedGids = [...gidWidth.keys()].sort((a, b) => a - b);
  let run = null;
  for (const gid of sortedGids) {
    if (run && gid === run.start + run.values.length) run.values.push(gidWidth.get(gid));
    else {
      if (run) widths.push(`${run.start} [${run.values.join(' ')}]`);
      run = { start: gid, values: [gidWidth.get(gid)] };
    }
  }
  if (run) widths.push(`${run.start} [${run.values.join(' ')}]`);

  const catalogId = 1;
  const pagesId = 2;
  objects.push(null, null); // placeholders for catalog and pages

  const fontFileId = add({ stream: fontBytes, dict: `<< /Length ${fontBytes.length} /Length1 ${fontBytes.length} >>` });
  const descriptorId = add({
    raw: `<< /Type /FontDescriptor /FontName /${FIBER_SANS.name} /Flags 32 /FontBBox [${FIBER_SANS.bbox
      .map((v) => Math.round(v * scale))
      .join(' ')}] /ItalicAngle 0 /Ascent ${Math.round(FIBER_SANS.ascent * scale)} /Descent ${Math.round(
      FIBER_SANS.descent * scale
    )} /CapHeight ${Math.round(FIBER_SANS.capHeight * scale)} /StemV 80 /FontFile2 ${fontFileId} 0 R >>`,
  });
  const cidFontId = add({
    raw: `<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${FIBER_SANS.name} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${descriptorId} 0 R /DW 600 /W [${widths.join(
      ' '
    )}] /CIDToGIDMap /Identity >>`,
  });
  const toUnicode = buildToUnicode();
  const toUnicodeId = add({ stream: new TextEncoder().encode(toUnicode), dict: `<< /Length ${new TextEncoder().encode(toUnicode).length} >>` });
  const fontId = add({
    raw: `<< /Type /Font /Subtype /Type0 /BaseFont /${FIBER_SANS.name} /Encoding /Identity-H /DescendantFonts [${cidFontId} 0 R] /ToUnicode ${toUnicodeId} 0 R >>`,
  });

  const pageIds = [];
  for (const page of pages) {
    const contentBytes = new TextEncoder().encode(page.content);
    const contentId = add({ stream: contentBytes, dict: `<< /Length ${contentBytes.length} >>` });
    const gsEntries = [...(page.alphas?.values() || [])]
      .map((gs) => `/${gs.name} << /Type /ExtGState /ca ${round(gs.fillAlpha)} /CA ${round(gs.strokeAlpha)} >>`)
      .join(' ');
    const pageId = add({
      raw: `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${round(page.width)} ${round(
        page.height
      )}] /Resources << /Font << /F1 ${fontId} 0 R >> /ExtGState << ${gsEntries} >> >> /Contents ${contentId} 0 R >>`,
    });
    pageIds.push(pageId);
  }

  objects[catalogId - 1] = { raw: `<< /Type /Catalog /Pages ${pagesId} 0 R >>` };
  objects[pagesId - 1] = {
    raw: `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`,
  };

  const infoId = add({
    raw: `<< /Title ${pdfString(meta.title || 'FiberModeler diagram')} /Author ${pdfString(
      meta.author || ''
    )} /Creator ${pdfString('FiberModeler')} /Producer ${pdfString('FiberModeler PDF writer')} /CreationDate ${pdfString(
      pdfDate(new Date())
    )} >>`,
  });

  /* serialise */
  const chunks = [];
  const encoder = new TextEncoder();
  let offset = 0;
  const pushText = (text) => {
    const bytes = encoder.encode(text);
    chunks.push(bytes);
    offset += bytes.length;
  };
  const pushBytes = (bytes) => {
    chunks.push(bytes);
    offset += bytes.length;
  };

  pushText('%PDF-1.7\n%âãÏÓ\n');
  const offsets = [];
  objects.forEach((object, index) => {
    offsets[index] = offset;
    pushText(`${index + 1} 0 obj\n`);
    if (object.stream) {
      pushText(`${object.dict}\nstream\n`);
      pushBytes(object.stream);
      pushText('\nendstream\n');
    } else {
      pushText(`${object.raw}\n`);
    }
    pushText('endobj\n');
  });

  const xrefOffset = offset;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const value of offsets) xref += `${String(value).padStart(10, '0')} 00000 n \n`;
  pushText(xref);
  pushText(`trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  return new Blob(chunks, { type: 'application/pdf' });
}

function buildToUnicode() {
  const entries = Object.entries(FIBER_SANS.gid);
  const lines = entries.map(([code, gid]) => `<${gid.toString(16).padStart(4, '0')}> <${Number(code).toString(16).padStart(4, '0')}>`);
  const chunks = [];
  for (let i = 0; i < lines.length; i += 100) {
    const slice = lines.slice(i, i + 100);
    chunks.push(`${slice.length} beginbfchar\n${slice.join('\n')}\nendbfchar`);
  }
  return `/CIDInit /ProcSet findresource begin
12 dict begin
begincmap
/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def
/CMapName /Adobe-Identity-UCS def
/CMapType 2 def
1 begincodespacerange
<0000> <FFFF>
endcodespacerange
${chunks.join('\n')}
endcmap
CMapName currentdict /CMap defineresource pop
end
end`;
}

function pdfDate(date) {
  const pad = (v) => String(v).padStart(2, '0');
  return `D:${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(
    date.getMinutes()
  )}${pad(date.getSeconds())}Z`;
}

/* ----------------------------------------------------------------- helpers */

export function pageSize(name = 'A4', orientation = 'landscape') {
  const size = PAGE_SIZES[name] || PAGE_SIZES.A4;
  return orientation === 'landscape' ? { width: size[1], height: size[0] } : { width: size[0], height: size[1] };
}

/** One SVG -> one PDF page. */
export function svgToPdf(svgMarkup, options = {}) {
  const { width, height } = options.size || pageSize(options.pageSize, options.orientation);
  const margin = options.margin ?? 28;
  const header = options.header ? 26 : 0;
  const result = svgToContent(svgMarkup, {
    x: margin,
    y: margin,
    width: width - margin * 2,
    height: height - margin * 2 - header,
    pageHeight: height,
  });
  let content = result.content;
  if (options.header) {
    const builder = new ContentBuilder(FIBER_SANS);
    builder.push('q');
    builder.push('0.35 0.35 0.38 rg');
    builder.push('BT /F1 10 Tf');
    builder.push(`1 0 0 1 ${round(margin)} ${round(height - margin + 6)} Tm`);
    builder.push(`<${encodeText(options.header, builder)}> Tj`);
    builder.push('ET Q');
    content = `${builder.toString()}\n${content}`;
    for (const gid of builder.glyphs) result.builder.glyphs.add(gid);
  }
  return buildPdf([{ width, height, content, alphas: result.builder.alphas, glyphs: result.builder.glyphs }], options.meta);
}

/** Several SVGs (and optional text pages) into one document. */
export function svgsToPdf(items, options = {}) {
  const pages = [];
  for (const item of items) {
    const { width, height } = item.size || options.size || pageSize(options.pageSize, options.orientation);
    const margin = options.margin ?? 28;
    if (item.kind === 'text') {
      pages.push(textPage(item, width, height, margin));
      continue;
    }
    const header = item.header || options.header;
    const result = svgToContent(item.svg, {
      x: margin,
      y: margin,
      width: width - margin * 2,
      height: height - margin * 2 - (header ? 26 : 0),
      pageHeight: height,
    });
    let content = result.content;
    if (header) {
      const builder = new ContentBuilder(FIBER_SANS);
      builder.push('q 0.35 0.35 0.38 rg BT /F1 10 Tf');
      builder.push(`1 0 0 1 ${round(margin)} ${round(height - margin + 6)} Tm`);
      builder.push(`<${encodeText(header, builder)}> Tj ET Q`);
      content = `${builder.toString()}\n${content}`;
    }
    pages.push({ width, height, content, alphas: result.builder.alphas, glyphs: result.builder.glyphs });
  }
  return buildPdf(pages, options.meta);
}

function textPage(item, width, height, margin) {
  const builder = new ContentBuilder(FIBER_SANS);
  let y = height - margin - 10;
  const write = (text, size, bold) => {
    if (!text) {
      y -= size * 0.6;
      return;
    }
    const maxWidth = width - margin * 2;
    for (const line of wrapForPdf(text, maxWidth, size)) {
      if (y < margin + size) return;
      builder.push('q 0.11 0.11 0.12 rg BT');
      builder.push(`/F1 ${round(size)} Tf ${bold ? '2 Tr ' + round(size * 0.028) + ' w 0.11 0.11 0.12 RG' : '0 Tr'}`);
      builder.push(`1 0 0 1 ${round(margin)} ${round(y)} Tm`);
      builder.push(`<${encodeText(line, builder)}> Tj ET Q`);
      y -= size * 1.45;
    }
    y -= size * 0.5;
  };
  for (const block of item.blocks || []) write(block.text, block.size || 11, block.bold);
  return { width, height, content: builder.toString(), alphas: builder.alphas, glyphs: builder.glyphs };
}

function wrapForPdf(text, maxWidth, fontSize) {
  const lines = [];
  for (const paragraph of String(text).split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (textWidth(candidate, fontSize) > maxWidth && current) {
        lines.push(current);
        current = word;
      } else current = candidate;
    }
    lines.push(current);
  }
  return lines;
}
