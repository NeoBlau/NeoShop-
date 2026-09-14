/** Line icon set (24x24 grid, stroked) + live element previews for the palette. */
import { getNotation } from '../notations/index.js';

const P = {
  new: 'M6 3h8l4 4v14H6z M14 3v4h4',
  open: 'M3 7h6l2 2h10v10H3z',
  save: 'M5 3h11l3 3v15H5z M8 3v6h7V3 M8 21v-7h8v7',
  undo: 'M9 14 4 9l5-5 M4 9h9a6 6 0 0 1 0 12H8',
  redo: 'M15 14l5-5-5-5 M20 9h-9a6 6 0 0 0 0 12h5',
  cut: 'M6 3v10l12 8 M18 3v10L6 21 M6 6.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  copy: 'M9 9h11v11H9z M5 15H4V4h11v1',
  paste: 'M9 3h6v3H9z M7 5H5v16h14V5h-2',
  delete: 'M4 7h16 M9 7V4h6v3 M6 7l1 14h10l1-14 M10 11v6 M14 11v6',
  duplicate: 'M8 8h12v12H8z M4 16V4h12',
  zoomIn: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.3-4.3 M11 8v6 M8 11h6',
  zoomOut: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.3-4.3 M8 11h6',
  fit: 'M4 9V4h5 M20 9V4h-5 M4 15v5h5 M20 15v5h-5',
  grid: 'M4 4h16v16H4z M10 4v16 M16 4v16 M4 10h16 M4 16h16',
  layout: 'M4 5h6v5H4z M14 5h6v5h-6z M9 15h6v5H9z M7 10v3h10v-3 M12 13v2',
  validate: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12l2 2 4-4',
  export: 'M12 15V3 M8 7l4-4 4 4 M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4',
  import: 'M12 3v12 M8 11l4 4 4-4 M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4',
  print: 'M7 8V3h10v5 M7 18H4v-7h16v7h-3 M7 14h10v7H7z',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.3-4.3',
  command: 'M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3z',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7.5 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.6 14H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 7.5l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 3.6V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.5 1.4l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z M12 1v3 M12 20v3 M4.2 4.2l2.1 2.1 M17.7 17.7l2.1 2.1 M1 12h3 M20 12h3 M4.2 19.8l2.1-2.1 M17.7 6.3l2.1-2.1',
  moon: 'M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z',
  panelLeft: 'M3 4h18v16H3z M9 4v16',
  panelRight: 'M3 4h18v16H3z M15 4v16',
  panelBottom: 'M3 4h18v16H3z M3 15h18',
  sparkles: 'M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z M18 15l.8 2.2 2.2.8-2.2.8L18 21l-.8-2.2-2.2-.8 2.2-.8z',
  table: 'M4 5h16v14H4z M4 10h16 M4 15h16 M10 5v14 M15 5v14',
  plus: 'M12 5v14 M5 12h14',
  minus: 'M5 12h14',
  chevronRight: 'M9 6l6 6-6 6',
  chevronDown: 'M6 9l6 6 6-6',
  chevronLeft: 'M15 6l-6 6 6 6',
  close: 'M6 6l12 12 M18 6L6 18',
  check: 'M5 12.5l5 5L19 7',
  folder: 'M3 7h6l2 2h10v10H3z',
  file: 'M6 3h8l4 4v14H6z',
  diagram: 'M4 4h6v5H4z M14 15h6v5h-6z M7 9v6h10v0 M17 9V4h3v5z',
  decompose: 'M9 3h6v4H9z M3 17h6v4H3z M15 17h6v4h-6z M12 7v4 M12 11H6v6 M12 11h6v6',
  hand: 'M7 11V5.5a1.5 1.5 0 1 1 3 0V11 M10 11V4.5a1.5 1.5 0 1 1 3 0V11 M13 11V6a1.5 1.5 0 1 1 3 0v7 M16 10.5a1.5 1.5 0 1 1 3 0V15a6 6 0 0 1-6 6h-1a7 7 0 0 1-7-7v-2.5a1.5 1.5 0 1 1 3 0',
  cursor: 'M5 3l14 7-6 2-2 6z',
  link: 'M10 14a4 4 0 0 0 6 .5l2-2a4 4 0 1 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-6-.5l-2 2A4 4 0 1 0 11.7 17l1-1',
  text: 'M5 6V4h14v2 M12 4v16 M9 20h6',
  warning: 'M12 3l9.5 17h-19z M12 10v5 M12 18h.01',
  error: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M9 9l6 6 M15 9l-6 6',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 11v5 M12 8h.01',
  alignLeft: 'M4 3v18 M7 7h10 M7 13h6',
  alignCenterH: 'M12 3v18 M7 7h10 M9 13h6',
  alignRight: 'M20 3v18 M7 7h10 M11 13h6',
  alignTop: 'M3 4h18 M7 7v10 M13 7v6',
  alignMiddleV: 'M3 12h18 M7 7v10 M13 9v6',
  alignBottom: 'M3 20h18 M7 7v10 M13 11v6',
  distributeH: 'M4 3v18 M20 3v18 M11 7v10',
  distributeV: 'M3 4h18 M3 20h18 M7 11h10',
  route: 'M4 6h6a4 4 0 0 1 4 4v4a4 4 0 0 0 4 4h2 M17 16l3 2-3 2',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  history: 'M3 12a9 9 0 1 0 3-6.7 M3 4v5h5 M12 8v4l3 2',
  language: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M3 12h18 M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M9.5 9.5a2.5 2.5 0 1 1 3 2.5v1.5 M12 17h.01',
  map: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z M9 4v14 M15 6v14',
};

export function icon(name, size = 17, extra = '') {
  const d = P[name] || P.file;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d
    .split(' M')
    .map((part, i) => `<path d="${i === 0 ? part : `M${part}`}"/>`)
    .join('')}</svg>`;
}

export function iconEl(name, size = 17) {
  const wrapper = document.createElement('span');
  wrapper.className = 'icon';
  wrapper.innerHTML = icon(name, size);
  return wrapper;
}

/** Live preview of a diagram element, used in the palette and properties. */
export function elementPreview(notationId, typeId, box = 34) {
  const notation = getNotation(notationId);
  const type = notation.nodeTypes[typeId];
  if (type) {
    const size = type.paletteSize || type.defaultSize;
    const ratio = Math.min(box / size.w, box / size.h);
    const node = {
      id: 'preview',
      type: typeId,
      x: 0,
      y: 0,
      w: size.w,
      h: size.h,
      label: '',
      props: {},
      style: {},
    };
    let markup;
    try {
      markup = type.draw(node, { preview: true });
    } catch {
      markup = '';
    }
    const pad = 1.5 / ratio;
    return `<svg viewBox="${-pad} ${-pad} ${size.w + pad * 2} ${size.h + pad * 2}" preserveAspectRatio="xMidYMid meet">${markup}</svg>`;
  }
  const edge = notation.edgeTypes[typeId];
  if (edge) {
    const dash = edge.dash ? ` stroke-dasharray="${edge.dash}"` : '';
    const head =
      edge.marker === 'arrow-open'
        ? '<polyline points="26,5 32,9 26,13" fill="none" stroke="var(--flow-stroke)" stroke-width="1.4"/>'
        : edge.marker === null
          ? ''
          : `<polygon points="26,5.5 33,9 26,12.5" fill="var(--flow-stroke)"/>`;
    const start = edge.startMarker === 'circle-open' ? '<circle cx="4" cy="9" r="2.6" fill="none" stroke="var(--flow-stroke)" stroke-width="1.3"/>' : '';
    return `<svg viewBox="0 0 36 18"><line x1="4" y1="9" x2="29" y2="9" stroke="var(--flow-stroke)" stroke-width="1.5"${dash}/>${head}${start}</svg>`;
  }
  return icon('file', box);
}

export const BRAND_MARK = `
<svg class="brand-mark" viewBox="0 0 40 40" fill="none" aria-hidden="true">
  <defs>
    <linearGradient id="fm-brand" x1="6" y1="4" x2="34" y2="36" gradientUnits="userSpaceOnUse">
      <stop stop-color="var(--accent)"/>
      <stop offset="1" stop-color="#5ac8fa"/>
    </linearGradient>
  </defs>
  <rect x="2" y="2" width="36" height="36" rx="10" fill="url(#fm-brand)"/>
  <path d="M11 27c4.5 0 4.5-14 9-14s4.5 14 9 14" stroke="#fff" stroke-width="2.6" stroke-linecap="round" fill="none" opacity="0.95"/>
  <circle cx="11" cy="27" r="3" fill="#fff"/>
  <circle cx="29" cy="27" r="3" fill="#fff"/>
  <circle cx="20" cy="13" r="3" fill="#fff"/>
</svg>`;
