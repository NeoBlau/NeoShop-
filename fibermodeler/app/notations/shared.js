/**
 * Helpers shared by every notation renderer.
 *
 * Renderers return SVG markup strings: they are cheap to produce, trivial to
 * cache, identical for on-screen rendering and for SVG / PDF export, and they
 * keep the notation modules free of DOM dependencies (so they can be unit
 * tested in Node).
 */

export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function n(value) {
  return Math.round(value * 100) / 100;
}

/* ------------------------------------------------------------------ text */

const AVG = {
  // average advance width per character relative to font size, tuned for the
  // UI font stack; good enough for wrapping without touching the DOM.
  default: 0.52,
  narrow: 0.3,
  wide: 0.86,
};

const NARROW = new Set([...'iljtfrI.,:;!|\'"()[]{} ']);
const WIDE = new Set([...'mwMWШЩЮЖФ@%']);

let measurer = null;

/** Installs a precise measurement function (canvas based) when in a browser. */
export function setTextMeasurer(fn) {
  measurer = fn;
}

export function measure(text, fontSize = 12, bold = false) {
  if (measurer) return measurer(text, fontSize, bold);
  let width = 0;
  for (const ch of String(text)) {
    if (NARROW.has(ch)) width += AVG.narrow;
    else if (WIDE.has(ch)) width += AVG.wide;
    else width += AVG.default;
  }
  return width * fontSize * (bold ? 1.06 : 1);
}

/** Greedy word wrap; breaks over-long words. */
export function wrapText(text, maxWidth, fontSize = 12, bold = false, maxLines = 12) {
  const source = String(text ?? '').trim();
  if (!source) return [];
  const lines = [];
  for (const paragraph of source.split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push('');
      continue;
    }
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (measure(candidate, fontSize, bold) <= maxWidth || !current) {
        if (measure(candidate, fontSize, bold) > maxWidth && !current) {
          // single word longer than the line: hard break it
          let chunk = '';
          for (const ch of word) {
            if (measure(chunk + ch, fontSize, bold) > maxWidth && chunk) {
              lines.push(chunk);
              chunk = ch;
            } else chunk += ch;
          }
          current = chunk;
        } else current = candidate;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  if (lines.length > maxLines) {
    const clipped = lines.slice(0, maxLines);
    clipped[maxLines - 1] = `${clipped[maxLines - 1].slice(0, Math.max(1, clipped[maxLines - 1].length - 1))}…`;
    return clipped;
  }
  return lines;
}

/**
 * Multi-line label as SVG <text>.
 * options: {x, y, width, align, valign, fontSize, bold, color, maxLines, className}
 */
export function textBlock(text, options = {}) {
  const {
    x = 0,
    y = 0,
    width = 100,
    height = 0,
    align = 'center',
    valign = 'middle',
    fontSize = 12,
    bold = false,
    color = 'var(--dg-text)',
    maxLines = 12,
    className = 'el-label',
    lineHeight = 1.25,
  } = options;
  const lines = wrapText(text, width, fontSize, bold, maxLines);
  if (!lines.length) return '';
  const lh = fontSize * lineHeight;
  const blockHeight = lines.length * lh;
  let top;
  if (valign === 'top') top = y + fontSize * 0.95;
  else if (valign === 'bottom') top = y + height - blockHeight + fontSize * 0.95;
  else top = y + (height - blockHeight) / 2 + fontSize * 0.95;
  const anchor = align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle';
  const tx = align === 'left' ? x : align === 'right' ? x + width : x + width / 2;
  const spans = lines
    .map((line, i) => `<tspan x="${n(tx)}" y="${n(top + i * lh)}">${esc(line)}</tspan>`)
    .join('');
  return `<text class="${className}" text-anchor="${anchor}" font-size="${n(fontSize)}"${
    bold ? ' font-weight="600"' : ''
  } fill="${color}">${spans}</text>`;
}

/** Height that a label would take - used for auto-sizing. */
export function textHeight(text, width, fontSize = 12, bold = false, lineHeight = 1.25) {
  return wrapText(text, width, fontSize, bold).length * fontSize * lineHeight;
}

/* ----------------------------------------------------------------- shapes */

export function rect(x, y, w, h, rx = 0, attrs = '') {
  return `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"${rx ? ` rx="${n(rx)}" ry="${n(rx)}"` : ''} ${attrs}/>`;
}

export function circle(cx, cy, r, attrs = '') {
  return `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" ${attrs}/>`;
}

export function path(d, attrs = '') {
  return `<path d="${d}" ${attrs}/>`;
}

export function polygonPoints(points) {
  return points.map((p) => `${n(p.x)},${n(p.y)}`).join(' ');
}

export function polygon(points, attrs = '') {
  return `<polygon points="${polygonPoints(points)}" ${attrs}/>`;
}

export function line(x1, y1, x2, y2, attrs = '') {
  return `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" ${attrs}/>`;
}

/** Diamond centred in the given box. */
export function diamond(x, y, w, h, attrs = '') {
  return polygon(
    [
      { x: x + w / 2, y },
      { x: x + w, y: y + h / 2 },
      { x: x + w / 2, y: y + h },
      { x, y: y + h / 2 },
    ],
    attrs
  );
}

/** Localised name from a {en, ru} record. */
export function localName(record, locale) {
  if (!record) return '';
  if (typeof record === 'string') return record;
  return record[locale] || record.en || Object.values(record)[0] || '';
}
