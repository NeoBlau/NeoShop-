/** Small pictograms used inside BPMN events and tasks. Local coordinates. */
import { n } from '../shared.js';

const S = (v) => n(v);

export function envelope(cx, cy, size, filled) {
  const w = size;
  const h = size * 0.72;
  const x = cx - w / 2;
  const y = cy - h / 2;
  const fill = filled ? 'currentColor' : 'none';
  const stroke = filled ? 'var(--el-glyph-invert)' : 'currentColor';
  return (
    `<rect x="${S(x)}" y="${S(y)}" width="${S(w)}" height="${S(h)}" fill="${fill}" stroke="currentColor" stroke-width="1.2"/>` +
    `<path d="M ${S(x)} ${S(y)} L ${S(cx)} ${S(y + h * 0.62)} L ${S(x + w)} ${S(y)}" fill="none" stroke="${stroke}" stroke-width="1.2"/>`
  );
}

export function clock(cx, cy, size) {
  const r = size / 2;
  let ticks = '';
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    ticks += `<line x1="${S(cx + Math.sin(a) * r * 0.78)}" y1="${S(cy - Math.cos(a) * r * 0.78)}" x2="${S(
      cx + Math.sin(a) * r
    )}" y2="${S(cy - Math.cos(a) * r)}" stroke="currentColor" stroke-width="0.9"/>`;
  }
  return (
    `<circle cx="${S(cx)}" cy="${S(cy)}" r="${S(r)}" fill="none" stroke="currentColor" stroke-width="1.2"/>` +
    ticks +
    `<path d="M ${S(cx)} ${S(cy)} L ${S(cx)} ${S(cy - r * 0.62)} M ${S(cx)} ${S(cy)} L ${S(cx + r * 0.45)} ${S(
      cy + r * 0.3
    )}" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>`
  );
}

export function bolt(cx, cy, size, filled) {
  const s = size / 2;
  const pts = [
    [-0.9, 0.85],
    [-0.25, -0.3],
    [0.15, 0.1],
    [0.9, -0.85],
    [0.25, 0.35],
    [-0.2, -0.05],
  ]
    .map(([x, y]) => `${S(cx + x * s)},${S(cy + y * s)}`)
    .join(' ');
  return `<polygon points="${pts}" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>`;
}

export function triangle(cx, cy, size, filled) {
  const r = size / 2;
  const pts = [
    [0, -r],
    [r * 0.92, r * 0.62],
    [-r * 0.92, r * 0.62],
  ]
    .map(([x, y]) => `${S(cx + x)},${S(cy + y)}`)
    .join(' ');
  return `<polygon points="${pts}" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>`;
}

export function escalation(cx, cy, size, filled) {
  const r = size / 2;
  const pts = [
    [0, -r],
    [r * 0.72, r * 0.8],
    [0, r * 0.1],
    [-r * 0.72, r * 0.8],
  ]
    .map(([x, y]) => `${S(cx + x)},${S(cy + y)}`)
    .join(' ');
  return `<polygon points="${pts}" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>`;
}

export function conditional(cx, cy, size) {
  const w = size * 0.82;
  const h = size * 0.92;
  const x = cx - w / 2;
  const y = cy - h / 2;
  let lines = '';
  for (let i = 1; i <= 3; i++) {
    const ly = y + (h / 4) * i;
    lines += `<line x1="${S(x + w * 0.16)}" y1="${S(ly)}" x2="${S(x + w * 0.84)}" y2="${S(ly)}" stroke="currentColor" stroke-width="1"/>`;
  }
  return `<rect x="${S(x)}" y="${S(y)}" width="${S(w)}" height="${S(h)}" fill="none" stroke="currentColor" stroke-width="1.2"/>${lines}`;
}

export function linkArrow(cx, cy, size, filled) {
  const w = size;
  const h = size * 0.55;
  const x = cx - w / 2;
  const pts = [
    [x, cy - h / 2],
    [x + w * 0.58, cy - h / 2],
    [x + w * 0.58, cy - h * 0.85],
    [x + w, cy],
    [x + w * 0.58, cy + h * 0.85],
    [x + w * 0.58, cy + h / 2],
    [x, cy + h / 2],
  ]
    .map(([px, py]) => `${S(px)},${S(py)}`)
    .join(' ');
  return `<polygon points="${pts}" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>`;
}

export function terminate(cx, cy, size) {
  return `<circle cx="${S(cx)}" cy="${S(cy)}" r="${S(size / 2)}" fill="currentColor"/>`;
}

export function multiple(cx, cy, size, filled) {
  const r = size / 2;
  const pts = [];
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    pts.push(`${S(cx + Math.cos(a) * r)},${S(cy + Math.sin(a) * r)}`);
  }
  return `<polygon points="${pts.join(' ')}" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>`;
}

/* ------------------------------------------------------------ task icons */

export function iconUser(x, y, s) {
  return (
    `<rect x="${S(x)}" y="${S(y)}" width="${S(s)}" height="${S(s)}" rx="2" fill="none" stroke="currentColor" stroke-width="1"/>` +
    `<circle cx="${S(x + s / 2)}" cy="${S(y + s * 0.36)}" r="${S(s * 0.17)}" fill="none" stroke="currentColor" stroke-width="1"/>` +
    `<path d="M ${S(x + s * 0.2)} ${S(y + s * 0.86)} a ${S(s * 0.3)} ${S(s * 0.3)} 0 0 1 ${S(s * 0.6)} 0" fill="none" stroke="currentColor" stroke-width="1"/>`
  );
}

export function iconManual(x, y, s) {
  return (
    `<path d="M ${S(x + s * 0.1)} ${S(y + s * 0.62)} v ${S(-s * 0.18)} a ${S(s * 0.08)} ${S(s * 0.08)} 0 0 1 ${S(s * 0.16)} 0 ` +
    `v ${S(-s * 0.2)} a ${S(s * 0.08)} ${S(s * 0.08)} 0 0 1 ${S(s * 0.16)} 0 v ${S(s * 0.04)} ` +
    `a ${S(s * 0.08)} ${S(s * 0.08)} 0 0 1 ${S(s * 0.16)} 0 v ${S(s * 0.06)} ` +
    `a ${S(s * 0.08)} ${S(s * 0.08)} 0 0 1 ${S(s * 0.16)} 0 v ${S(s * 0.34)} ` +
    `a ${S(s * 0.26)} ${S(s * 0.26)} 0 0 1 ${S(-s * 0.26)} ${S(s * 0.26)} h ${S(-s * 0.18)} ` +
    `a ${S(s * 0.3)} ${S(s * 0.3)} 0 0 1 ${S(-s * 0.3)} ${S(-s * 0.3)} z" fill="none" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>`
  );
}

export function iconGear(x, y, s) {
  const cx = x + s / 2;
  const cy = y + s / 2;
  const r = s * 0.3;
  let teeth = '';
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    teeth += `<line x1="${S(cx + Math.cos(a) * r)}" y1="${S(cy + Math.sin(a) * r)}" x2="${S(
      cx + Math.cos(a) * s * 0.46
    )}" y2="${S(cy + Math.sin(a) * s * 0.46)}" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`;
  }
  return (
    teeth +
    `<circle cx="${S(cx)}" cy="${S(cy)}" r="${S(r)}" fill="none" stroke="currentColor" stroke-width="1.2"/>` +
    `<circle cx="${S(cx)}" cy="${S(cy)}" r="${S(r * 0.38)}" fill="none" stroke="currentColor" stroke-width="1"/>`
  );
}

export function iconScript(x, y, s) {
  let lines = '';
  for (let i = 1; i <= 3; i++) {
    lines += `<line x1="${S(x + s * 0.26)}" y1="${S(y + s * (0.12 + i * 0.2))}" x2="${S(x + s * 0.74)}" y2="${S(
      y + s * (0.12 + i * 0.2)
    )}" stroke="currentColor" stroke-width="1"/>`;
  }
  return (
    `<path d="M ${S(x + s * 0.18)} ${S(y + s * 0.06)} c ${S(s * 0.2)} ${S(s * 0.12)} ${S(-s * 0.2)} ${S(s * 0.18)} 0 ${S(
      s * 0.3
    )} v ${S(s * 0.58)} c ${S(-s * 0.2)} ${S(-s * 0.12)} ${S(s * 0.2)} ${S(-s * 0.18)} 0 ${S(-s * 0.3)} z" fill="none" stroke="currentColor" stroke-width="0"/>` +
    `<path d="M ${S(x + s * 0.2)} ${S(y + s * 0.08)} h ${S(s * 0.6)} v ${S(s * 0.84)} h ${S(-s * 0.6)} z" fill="none" stroke="currentColor" stroke-width="1"/>` +
    lines
  );
}

export function iconRule(x, y, s) {
  return (
    `<rect x="${S(x + s * 0.1)}" y="${S(y + s * 0.16)}" width="${S(s * 0.8)}" height="${S(s * 0.68)}" fill="none" stroke="currentColor" stroke-width="1"/>` +
    `<line x1="${S(x + s * 0.1)}" y1="${S(y + s * 0.38)}" x2="${S(x + s * 0.9)}" y2="${S(y + s * 0.38)}" stroke="currentColor" stroke-width="1"/>` +
    `<line x1="${S(x + s * 0.1)}" y1="${S(y + s * 0.61)}" x2="${S(x + s * 0.9)}" y2="${S(y + s * 0.61)}" stroke="currentColor" stroke-width="1"/>` +
    `<line x1="${S(x + s * 0.38)}" y1="${S(y + s * 0.38)}" x2="${S(x + s * 0.38)}" y2="${S(y + s * 0.84)}" stroke="currentColor" stroke-width="1"/>`
  );
}

export function iconSend(x, y, s) {
  return envelope(x + s / 2, y + s / 2, s * 0.9, true);
}

export function iconReceive(x, y, s) {
  return envelope(x + s / 2, y + s / 2, s * 0.9, false);
}

export function plusBox(cx, cy, s) {
  return (
    `<rect x="${S(cx - s / 2)}" y="${S(cy - s / 2)}" width="${S(s)}" height="${S(s)}" fill="none" stroke="currentColor" stroke-width="1.2"/>` +
    `<line x1="${S(cx - s * 0.28)}" y1="${S(cy)}" x2="${S(cx + s * 0.28)}" y2="${S(cy)}" stroke="currentColor" stroke-width="1.2"/>` +
    `<line x1="${S(cx)}" y1="${S(cy - s * 0.28)}" x2="${S(cx)}" y2="${S(cy + s * 0.28)}" stroke="currentColor" stroke-width="1.2"/>`
  );
}

export function loopMarker(cx, cy, s) {
  return `<path d="M ${S(cx + s * 0.4)} ${S(cy - s * 0.1)} a ${S(s * 0.42)} ${S(s * 0.42)} 0 1 1 ${S(-s * 0.16)} ${S(
    -s * 0.28
  )}" fill="none" stroke="currentColor" stroke-width="1.3"/><polygon points="${S(cx + s * 0.44)},${S(cy - s * 0.44)} ${S(
    cx + s * 0.5
  )},${S(cy - s * 0.02)} ${S(cx + s * 0.08)},${S(cy - s * 0.2)}" fill="currentColor"/>`;
}

export function parallelMarker(cx, cy, s) {
  let bars = '';
  for (let i = -1; i <= 1; i++) {
    bars += `<line x1="${S(cx + i * s * 0.26)}" y1="${S(cy - s * 0.4)}" x2="${S(cx + i * s * 0.26)}" y2="${S(
      cy + s * 0.4
    )}" stroke="currentColor" stroke-width="1.6"/>`;
  }
  return bars;
}

export function sequentialMarker(cx, cy, s) {
  let bars = '';
  for (let i = -1; i <= 1; i++) {
    bars += `<line x1="${S(cx - s * 0.4)}" y1="${S(cy + i * s * 0.26)}" x2="${S(cx + s * 0.4)}" y2="${S(
      cy + i * s * 0.26
    )}" stroke="currentColor" stroke-width="1.6"/>`;
  }
  return bars;
}

export function adhocMarker(cx, cy, s) {
  return `<path d="M ${S(cx - s * 0.45)} ${S(cy + s * 0.1)} q ${S(s * 0.22)} ${S(-s * 0.5)} ${S(s * 0.45)} 0 q ${S(
    s * 0.22
  )} ${S(s * 0.5)} ${S(s * 0.45)} 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`;
}
