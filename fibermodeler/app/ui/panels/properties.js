/**
 * Properties panel.
 *
 * Fields are generated from the type descriptors, so every element exposes
 * exactly the properties its notation defines - and every edit goes through the
 * undo stack.
 */
import { i18n, t } from '../../i18n/index.js';
import { descriptorFor, getNotation, localName } from '../../notations/index.js';
import { elementPreview, icon } from '../icons.js';

const GROUPS = [
  { id: 'general', titleKey: 'props.general' },
  { id: 'advanced', titleKey: 'props.advanced' },
  { id: 'documentation', titleKey: 'props.documentation' },
];

export class Properties {
  constructor(element, context) {
    this.el = element;
    this.doc = context.doc;
    this.selection = context.selection;
    this.history = context.history;
    this.app = context.app;
  }

  get diagram() {
    return this.app.activeDiagram;
  }

  render() {
    const diagram = this.diagram;
    const ids = this.selection.list();
    this.el.innerHTML = '';
    if (!diagram) {
      this.el.innerHTML = `<div class="props-empty">${icon('diagram', 44)}<div>${t('canvas.emptyNoDiagram')}</div></div>`;
      return;
    }
    if (!ids.length) {
      this.renderDiagramProps(diagram);
      return;
    }
    if (ids.length > 1) {
      this.renderMulti(diagram, ids);
      return;
    }
    const element = this.doc.element(diagram.id, ids[0]);
    if (!element) {
      this.renderDiagramProps(diagram);
      return;
    }
    this.renderElement(diagram, element);
  }

  /* ---------------------------------------------------------------- views */

  renderDiagramProps(diagram) {
    const notation = getNotation(diagram.notation);
    const head = document.createElement('div');
    head.className = 'props-title';
    head.innerHTML = `<span class="type-icon">${icon('diagram', 28)}</span><div><div class="type-name">${escapeHtml(
      diagram.name
    )}</div><div class="type-sub">${escapeHtml(localName(notation.name, i18n.locale))}</div></div>`;
    this.el.appendChild(head);

    const section = this.section(t('props.diagram'));
    section.appendChild(
      this.field(t('props.name'), 'text', diagram.name, (value) =>
        this.history.run('rename', diagram.id, (doc) => doc.updateDiagram(diagram.id, { name: value || 'Diagram' }))
      )
    );
    section.appendChild(
      this.field(t('props.author'), 'text', diagram.meta.author || '', (value) =>
        this.history.run('meta', diagram.id, (doc) => doc.updateDiagram(diagram.id, { meta: { author: value } }))
      )
    );
    section.appendChild(
      this.field(t('props.version'), 'text', diagram.meta.version || '', (value) =>
        this.history.run('meta', diagram.id, (doc) => doc.updateDiagram(diagram.id, { meta: { version: value } }))
      )
    );
    section.appendChild(
      this.field(t('props.description'), 'textarea', diagram.meta.description || '', (value) =>
        this.history.run('meta', diagram.id, (doc) => doc.updateDiagram(diagram.id, { meta: { description: value } }))
      )
    );

    const docs = this.section(t('props.documentation'));
    docs.appendChild(
      this.field('', 'textarea', diagram.meta.documentation || '', (value) =>
        this.history.run('doc', diagram.id, (doc) => doc.updateDiagram(diagram.id, { meta: { documentation: value } })), { rows: 6 })
    );

    const stats = document.createElement('div');
    stats.className = 'note';
    stats.textContent = `${t('status.nodes', { count: diagram.nodes.length })} · ${diagram.edges.length} ↔`;
    this.el.appendChild(stats);
  }

  renderMulti(diagram, ids) {
    const head = document.createElement('div');
    head.className = 'props-title';
    head.innerHTML = `<span class="type-icon">${icon('duplicate', 28)}</span><div><div class="type-name">${t('props.multi', {
      count: ids.length,
    })}</div></div>`;
    this.el.appendChild(head);

    const section = this.section(t('model.align'));
    const grid = document.createElement('div');
    grid.className = 'inline-actions';
    const buttons = [
      ['alignLeft', 'left', 'model.alignLeft'],
      ['alignCenterH', 'center', 'model.alignCenter'],
      ['alignRight', 'right', 'model.alignRight'],
      ['alignTop', 'top', 'model.alignTop'],
      ['alignMiddleV', 'middle', 'model.alignMiddle'],
      ['alignBottom', 'bottom', 'model.alignBottom'],
    ];
    for (const [iconName, mode, key] of buttons) {
      const button = document.createElement('button');
      button.className = 'btn ghost';
      button.title = t(key);
      button.innerHTML = icon(iconName, 16);
      button.addEventListener('click', () => this.app.align(mode));
      grid.appendChild(button);
    }
    section.appendChild(grid);

    const distribute = document.createElement('div');
    distribute.className = 'inline-actions';
    for (const [iconName, axis, key] of [
      ['distributeH', 'horizontal', 'model.distributeH'],
      ['distributeV', 'vertical', 'model.distributeV'],
    ]) {
      const button = document.createElement('button');
      button.className = 'btn ghost';
      button.title = t(key);
      button.innerHTML = icon(iconName, 16);
      button.addEventListener('click', () => this.app.distribute(axis));
      distribute.appendChild(button);
    }
    const same = document.createElement('button');
    same.className = 'btn ghost';
    same.textContent = t('model.sameSize');
    same.addEventListener('click', () => this.app.equalizeSize());
    distribute.appendChild(same);
    section.appendChild(distribute);

    this.renderAppearance(diagram, ids.map((id) => this.doc.element(diagram.id, id)).filter(Boolean));
  }

  renderElement(diagram, element) {
    const descriptor = descriptorFor(diagram, element);
    const isNode = diagram.nodes.includes(element);
    const head = document.createElement('div');
    head.className = 'props-title';
    head.innerHTML =
      `<span class="type-icon">${elementPreview(diagram.notation, element.type, 28)}</span>` +
      `<div><div class="type-name">${escapeHtml(element.label || localName(descriptor?.name, i18n.locale) || element.type)}</div>` +
      `<div class="type-sub">${escapeHtml(localName(descriptor?.name, i18n.locale) || element.type)}</div></div>`;
    this.el.appendChild(head);

    const props = descriptor?.props || [];
    for (const group of GROUPS) {
      const fields = props.filter((p) => (p.group || 'general') === group.id);
      if (!fields.length) continue;
      const section = this.section(t(group.titleKey));
      for (const spec of fields) section.appendChild(this.buildField(diagram, element, spec, isNode));
    }

    /* type conversion */
    const notation = getNotation(diagram.notation);
    const convertGroup = Object.entries(notation.convertGroups).find(([, list]) => list.includes(element.type));
    if (convertGroup && convertGroup[1].length > 1) {
      const section = this.section(t('ctx.changeType'));
      const select = document.createElement('select');
      select.className = 'select';
      for (const typeId of convertGroup[1]) {
        const option = document.createElement('option');
        option.value = typeId;
        option.textContent = localName(notation.nodeTypes[typeId]?.name || notation.edgeTypes[typeId]?.name, i18n.locale);
        option.selected = typeId === element.type;
        select.appendChild(option);
      }
      select.addEventListener('change', () => this.app.changeType(element.id, select.value));
      section.appendChild(select);
    }

    if (isNode) this.renderGeometry(diagram, element);
    this.renderAppearance(diagram, [element]);

    if (descriptor?.decomposable || element.type === 'idef0Function') {
      const section = this.section(t('props.decomposition'));
      const child = this.doc.decompositionOf(element.id);
      const button = document.createElement('button');
      button.className = 'btn primary';
      button.textContent = child ? t('props.openDecomposition') : t('props.createDecomposition');
      button.addEventListener('click', () => this.app.openDecomposition(element.id));
      section.appendChild(button);
    }
  }

  renderGeometry(diagram, node) {
    const section = this.section(t('props.geometry'));
    const grid = document.createElement('div');
    grid.className = 'field-row';
    grid.appendChild(this.numberField('X', node.x, (value) => this.applyGeometry(diagram, node, { x: value })));
    grid.appendChild(this.numberField('Y', node.y, (value) => this.applyGeometry(diagram, node, { y: value })));
    section.appendChild(grid);
    const grid2 = document.createElement('div');
    grid2.className = 'field-row';
    grid2.appendChild(this.numberField('W', node.w, (value) => this.applyGeometry(diagram, node, { w: Math.max(10, value) })));
    grid2.appendChild(this.numberField('H', node.h, (value) => this.applyGeometry(diagram, node, { h: Math.max(10, value) })));
    section.appendChild(grid2);
  }

  renderAppearance(diagram, elements) {
    if (!elements.length) return;
    const section = this.section(t('props.appearance'));
    const first = elements[0];
    const row = document.createElement('div');
    row.className = 'field-row';
    row.appendChild(
      this.colorField(t('props.fill'), first.style?.fill || '#ffffff', (value) => this.applyStyle(diagram, elements, { fill: value }))
    );
    row.appendChild(
      this.colorField(t('props.stroke'), first.style?.stroke || '#5b6168', (value) => this.applyStyle(diagram, elements, { stroke: value }))
    );
    section.appendChild(row);
    const row2 = document.createElement('div');
    row2.className = 'field-row';
    row2.appendChild(
      this.colorField(t('props.textColor'), first.style?.textColor || '#1d1d1f', (value) =>
        this.applyStyle(diagram, elements, { textColor: value })
      )
    );
    const reset = document.createElement('button');
    reset.className = 'btn';
    reset.style.marginTop = '18px';
    reset.textContent = t('props.reset');
    reset.addEventListener('click', () => this.applyStyle(diagram, elements, { fill: '', stroke: '', textColor: '' }));
    row2.appendChild(reset);
    section.appendChild(row2);
  }

  /* --------------------------------------------------------------- fields */

  section(title) {
    const section = document.createElement('div');
    section.className = 'props-section';
    if (title) section.innerHTML = `<h4>${escapeHtml(title)}</h4>`;
    this.el.appendChild(section);
    return section;
  }

  field(label, type, value, onChange, options = {}) {
    const wrapper = document.createElement('div');
    wrapper.className = 'field';
    if (label) wrapper.innerHTML = `<label>${escapeHtml(label)}</label>`;
    let input;
    if (type === 'textarea') {
      input = document.createElement('textarea');
      input.className = 'textarea';
      input.rows = options.rows || 3;
    } else {
      input = document.createElement('input');
      input.className = 'input';
      input.type = type === 'number' ? 'number' : 'text';
    }
    input.value = value ?? '';
    if (options.placeholder) input.placeholder = options.placeholder;
    let last = input.value;
    const commit = () => {
      if (input.value === last) return;
      last = input.value;
      onChange(input.value);
    };
    input.addEventListener('change', commit);
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Enter' && type !== 'textarea') input.blur();
    });
    wrapper.appendChild(input);
    return wrapper;
  }

  numberField(label, value, onChange) {
    const wrapper = this.field(label, 'number', value, (raw) => onChange(Number(raw) || 0));
    return wrapper;
  }

  colorField(label, value, onChange) {
    const wrapper = document.createElement('div');
    wrapper.className = 'field';
    wrapper.innerHTML = `<label>${escapeHtml(label)}</label>`;
    const input = document.createElement('input');
    input.className = 'input';
    input.type = 'color';
    input.value = normalizeColor(value);
    input.addEventListener('change', () => onChange(input.value));
    wrapper.appendChild(input);
    return wrapper;
  }

  buildField(diagram, element, spec, isNode) {
    const locale = i18n.locale;
    const label = localName(spec.label, locale);
    const current = readValue(element, spec.key);

    if (spec.type === 'checkbox') {
      const wrapper = document.createElement('div');
      wrapper.className = 'field';
      const box = document.createElement('label');
      box.className = 'checkbox';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = !!current;
      input.addEventListener('change', () => this.commit(diagram, element, spec.key, input.checked, isNode));
      box.appendChild(input);
      box.appendChild(document.createTextNode(label));
      wrapper.appendChild(box);
      return wrapper;
    }

    if (spec.type === 'select') {
      const wrapper = document.createElement('div');
      wrapper.className = 'field';
      wrapper.innerHTML = `<label>${escapeHtml(label)}</label>`;
      const select = document.createElement('select');
      select.className = 'select';
      const currentValue = spec.key === '__role' ? element.type : current ?? '';
      for (const option of spec.options || []) {
        const opt = document.createElement('option');
        opt.value = option.value;
        opt.textContent = localName(option.label, locale);
        opt.selected = String(option.value) === String(currentValue);
        select.appendChild(opt);
      }
      select.addEventListener('change', () => {
        if (spec.key === '__role') this.app.changeType(element.id, select.value);
        else this.commit(diagram, element, spec.key, select.value, isNode);
      });
      wrapper.appendChild(select);
      return wrapper;
    }

    if (spec.type === 'id') {
      return this.field(label, 'text', element.id, (value) => this.app.changeElementId(element.id, value));
    }

    return this.field(label, spec.type === 'textarea' ? 'textarea' : 'text', current ?? '', (value) =>
      this.commit(diagram, element, spec.key, value, isNode), { rows: spec.rows, placeholder: spec.placeholder });
  }

  commit(diagram, element, key, value, isNode) {
    const patch = key === 'label' ? { label: value } : { props: { [key]: value } };
    this.history.run('property', diagram.id, (doc) => {
      if (isNode) doc.updateNode(diagram.id, element.id, patch);
      else doc.updateEdge(diagram.id, element.id, patch);
    });
    this.app.refreshCanvas();
  }

  applyGeometry(diagram, node, patch) {
    this.history.run('geometry', diagram.id, (doc) => doc.updateNode(diagram.id, node.id, patch));
    this.app.refreshCanvas();
  }

  applyStyle(diagram, elements, patch) {
    this.history.run('style', diagram.id, (doc) => {
      for (const element of elements) {
        const isNode = diagram.nodes.includes(element);
        if (isNode) doc.updateNode(diagram.id, element.id, { style: patch });
        else doc.updateEdge(diagram.id, element.id, { style: patch });
      }
    });
    this.app.refreshCanvas();
    this.render();
  }
}

function readValue(element, key) {
  if (key === 'label') return element.label;
  if (key === 'id') return element.id;
  return element.props?.[key];
}

function normalizeColor(value) {
  if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) return value;
  if (typeof value === 'string' && /^#[0-9a-f]{3}$/i.test(value)) {
    return `#${value.slice(1).split('').map((c) => c + c).join('')}`;
  }
  return '#ffffff';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}
