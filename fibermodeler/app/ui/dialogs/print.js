/**
 * Print dialog: paper size, orientation, fit or manual scale, live preview and
 * automatic tiling across pages when the drawing does not fit one sheet.
 */
import { t } from '../../i18n/index.js';
import { buttonRow, openDialog } from '../dialog.js';
import { exportDiagramSvg } from '../../io/svgexport.js';
import { PAGE_SIZES } from '../../io/pdf.js';

const MM_PER_PT = 25.4 / 72;

export function openPrint(app) {
  const diagram = app.activeDiagram;
  if (!diagram) return null;
  const state = {
    pageSize: app.settings.get('export.pageSize', 'A4'),
    orientation: app.settings.get('export.orientation', 'landscape'),
    fit: true,
    scale: 100,
    header: true,
  };

  const body = document.createElement('div');
  body.innerHTML = `
    <div class="field-row">
      <div class="field"><label>${t('print.pageSize')}</label><select class="select" data-role="size">${Object.keys(PAGE_SIZES)
        .map((size) => `<option value="${size}">${size}</option>`)
        .join('')}</select></div>
      <div class="field"><label>${t('print.orientation')}</label><select class="select" data-role="orientation">
        <option value="landscape">${t('print.landscape')}</option>
        <option value="portrait">${t('print.portrait')}</option>
      </select></div>
    </div>
    <div class="field-row">
      <div class="field"><label class="checkbox"><input type="checkbox" data-role="fit" checked> ${t('print.fit')}</label></div>
      <div class="field"><label>${t('print.scale')}</label><input class="input" type="number" data-role="scale" value="100" min="10" max="400" disabled></div>
    </div>
    <div class="field"><label class="checkbox"><input type="checkbox" data-role="header" checked> ${t('print.header')}</label></div>
    <div class="preview-pages" data-role="preview"></div>`;

  const sizeSelect = body.querySelector('[data-role="size"]');
  const orientationSelect = body.querySelector('[data-role="orientation"]');
  const fitInput = body.querySelector('[data-role="fit"]');
  const scaleInput = body.querySelector('[data-role="scale"]');
  const headerInput = body.querySelector('[data-role="header"]');
  const preview = body.querySelector('[data-role="preview"]');
  sizeSelect.value = state.pageSize;
  orientationSelect.value = state.orientation;

  const update = () => {
    state.pageSize = sizeSelect.value;
    state.orientation = orientationSelect.value;
    state.fit = fitInput.checked;
    state.scale = Number(scaleInput.value) || 100;
    state.header = headerInput.checked;
    scaleInput.disabled = state.fit;
    app.settings.set('export.pageSize', state.pageSize);
    app.settings.set('export.orientation', state.orientation);
    renderPreview();
  };

  const renderPreview = () => {
    const pages = buildPages(app, diagram, state);
    preview.innerHTML = '';
    pages.forEach((page) => {
      const box = document.createElement('div');
      box.className = 'preview-page';
      const ratio = page.height / page.width;
      box.style.width = '320px';
      box.style.height = `${Math.round(320 * ratio)}px`;
      box.innerHTML = page.svg;
      preview.appendChild(box);
    });
  };

  for (const element of [sizeSelect, orientationSelect, fitInput, scaleInput, headerInput]) {
    element.addEventListener('change', update);
  }

  const dialog = openDialog({ title: t('print.title'), body, width: 'wide' });
  dialog.footer.appendChild(
    buttonRow([
      'spacer',
      { label: t('dialog.cancel'), action: () => dialog.close() },
      {
        label: t('print.print'),
        variant: 'primary',
        action: () => {
          printPages(app, diagram, state);
          dialog.close();
        },
      },
    ])
  );
  update();
  return dialog;
}

/** Splits the diagram into printable pages (tiling when it does not fit). */
export function buildPages(app, diagram, state) {
  const [w, h] = PAGE_SIZES[state.pageSize] || PAGE_SIZES.A4;
  const width = state.orientation === 'landscape' ? h : w;
  const height = state.orientation === 'landscape' ? w : h;
  const margin = 28;
  const svg = exportDiagramSvg(diagram, app.doc, { background: '#ffffff', margin: 16 });
  const viewBox = /viewBox="([^"]+)"/.exec(svg);
  const [vx, vy, vw, vh] = viewBox ? viewBox[1].split(/\s+/).map(Number) : [0, 0, 800, 600];
  const usableW = width - margin * 2;
  const usableH = height - margin * 2 - (state.header ? 22 : 0);

  const fitScale = Math.min(usableW / vw, usableH / vh);
  const scale = state.fit ? fitScale : (state.scale / 100) * fitScale * Math.max(1, vw / usableW);
  const pageW = usableW / scale;
  const pageH = usableH / scale;
  const cols = Math.max(1, Math.ceil(vw / pageW - 0.02));
  const rows = Math.max(1, Math.ceil(vh / pageH - 0.02));

  const pages = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const box = `${vx + col * pageW} ${vy + row * pageH} ${pageW} ${pageH}`;
      const pageSvg = svg
        .replace(/viewBox="[^"]+"/, `viewBox="${box}"`)
        .replace(/width="\d+"/, `width="${Math.round(usableW)}"`)
        .replace(/height="\d+"/, `height="${Math.round(usableH)}"`);
      pages.push({ svg: pageSvg, width, height, index: pages.length + 1, total: cols * rows });
    }
  }
  return pages;
}

function printPages(app, diagram, state) {
  const pages = buildPages(app, diagram, state);
  const sheet = document.createElement('div');
  sheet.className = 'print-sheet';
  const [w, h] = PAGE_SIZES[state.pageSize] || PAGE_SIZES.A4;
  const width = state.orientation === 'landscape' ? h : w;
  const height = state.orientation === 'landscape' ? w : h;
  const styleId = 'fm-print-style';
  document.getElementById(styleId)?.remove();
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `@page { size: ${state.pageSize} ${state.orientation}; margin: 10mm; }
    .print-page { width: ${Math.round(width * MM_PER_PT - 20)}mm; height: ${Math.round(height * MM_PER_PT - 20)}mm; padding: 0; }`;
  document.head.appendChild(style);

  sheet.innerHTML = pages
    .map(
      (page) =>
        `<div class="print-page">${
          state.header
            ? `<div class="print-header"><span>${escapeHtml(app.doc.project.name)} — ${escapeHtml(diagram.name)}</span><span>${page.index} / ${page.total}</span></div>`
            : ''
        }<div class="print-figure">${page.svg}</div></div>`
    )
    .join('');
  document.body.appendChild(sheet);
  document.body.classList.add('is-printing');
  const cleanup = () => {
    document.body.classList.remove('is-printing');
    sheet.remove();
    style.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  setTimeout(() => {
    window.print();
    setTimeout(cleanup, 800);
  }, 60);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}
