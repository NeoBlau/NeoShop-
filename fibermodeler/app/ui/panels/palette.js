/** Element palette: drag & drop source and click-to-place tool picker. */
import { i18n, t } from '../../i18n/index.js';
import { localName, paletteFor } from '../../notations/index.js';
import { elementPreview, icon } from '../icons.js';

export class Palette {
  constructor(element, context) {
    this.el = element;
    this.app = context.app;
    this.notationId = 'bpmn';
    this.filter = '';
    this.activeType = null;
    this.el.innerHTML = `
      <div class="palette-header">
        <span class="palette-title">${t('palette.title')}</span>
        <div style="flex:1"></div>
        <button class="icon-btn collapse" type="button" title="${t('palette.title')}">${icon('chevronLeft', 14)}</button>
      </div>
      <div class="palette-search">
        <input class="input" type="search" placeholder="${t('palette.search')}">
      </div>
      <div class="palette-body"></div>
    `;
    this.body = this.el.querySelector('.palette-body');
    this.search = this.el.querySelector('input');
    this.search.addEventListener('input', () => {
      this.filter = this.search.value.trim().toLowerCase();
      this.render();
    });
    this.el.querySelector('.collapse').addEventListener('click', () => this.toggleCollapsed());
    this.body.addEventListener('click', (event) => {
      const item = event.target.closest('.palette-item');
      if (!item) return;
      this.app.selectPaletteTool(item.dataset.kind, item.dataset.type);
    });
    this.body.addEventListener('dragstart', (event) => {
      const item = event.target.closest('.palette-item');
      if (!item || item.dataset.kind !== 'node') {
        event.preventDefault();
        return;
      }
      event.dataTransfer.setData('application/x-fibermodeler-type', item.dataset.type);
      event.dataTransfer.effectAllowed = 'copy';
    });
    this.tooltip = null;
    this.body.addEventListener('pointerover', (event) => this.showTooltip(event));
    this.body.addEventListener('pointerout', () => this.hideTooltip());
  }

  toggleCollapsed(force) {
    const collapsed = force ?? !this.el.classList.contains('is-collapsed');
    this.el.classList.toggle('is-collapsed', collapsed);
    this.el.querySelector('.collapse').innerHTML = icon(collapsed ? 'chevronRight' : 'chevronLeft', 14);
    this.app.settings.set('ui.paletteOpen', !collapsed);
  }

  setNotation(notationId) {
    if (this.notationId === notationId) return;
    this.notationId = notationId;
    this.render();
  }

  setActiveType(type) {
    this.activeType = type;
    for (const item of this.body.querySelectorAll('.palette-item')) {
      item.classList.toggle('is-active', item.dataset.type === type);
    }
  }

  render() {
    const groups = paletteFor(this.notationId);
    const locale = i18n.locale;
    const html = [];
    for (const group of groups) {
      const items = group.items.filter((item) => {
        if (!this.filter) return true;
        return localName(item.name, locale).toLowerCase().includes(this.filter);
      });
      if (!items.length) continue;
      html.push(`<div class="palette-group-title">${escapeHtml(localName(group.name, locale))}</div>`);
      html.push('<div class="palette-items">');
      for (const item of items) {
        html.push(
          `<div class="palette-item${item.type === this.activeType ? ' is-active' : ''}" draggable="${item.kind === 'node'}" ` +
            `data-kind="${item.kind}" data-type="${escapeHtml(item.type)}" data-name="${escapeHtml(localName(item.name, locale))}">` +
            elementPreview(this.notationId, item.type) +
            '</div>'
        );
      }
      html.push('</div>');
    }
    if (!html.length) html.push(`<div class="tree-empty">${t('search.empty')}</div>`);
    this.body.innerHTML = html.join('');
  }

  showTooltip(event) {
    const item = event.target.closest('.palette-item');
    if (!item) return;
    this.hideTooltip();
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'tooltip';
    this.tooltip.textContent = item.dataset.name;
    document.body.appendChild(this.tooltip);
    const rect = item.getBoundingClientRect();
    this.tooltip.style.left = `${rect.right + 8}px`;
    this.tooltip.style.top = `${rect.top + rect.height / 2 - 12}px`;
  }

  hideTooltip() {
    this.tooltip?.remove();
    this.tooltip = null;
  }

  localize() {
    this.el.querySelector('.palette-title').textContent = t('palette.title');
    this.search.placeholder = t('palette.search');
    this.render();
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}
