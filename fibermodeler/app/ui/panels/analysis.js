/**
 * Process calculation panel.
 *
 * Shows what the model costs and how long it takes, recomputed from the
 * element parameters every time the diagram changes. Every row links back to
 * the element on the canvas, and every number carries the source of its input
 * data (public report / derived / assumption).
 */
import { i18n, t } from '../../i18n/index.js';
import { analyzeProcess } from '../../analysis/simulate.js';
import { analysisSettings, formatDuration, formatMoney, round } from '../../analysis/parameters.js';
import { compareProcesses } from '../../analysis/compare.js';
import { icon } from '../icons.js';
import { downloadText, safeFileName } from '../../io/files.js';

const SOURCE_LABEL = {
  report: 'analysis.sourceReport',
  derived: 'analysis.sourceDerived',
  assumption: 'analysis.sourceAssumption',
};

export class AnalysisPanel {
  constructor(element, context) {
    this.el = element;
    this.doc = context.doc;
    this.history = context.history;
    this.selection = context.selection;
    this.app = context.app;
    this.result = null;
  }

  get diagram() {
    return this.app.activeDiagram;
  }

  render() {
    const diagram = this.diagram;
    this.el.innerHTML = '';
    if (!diagram) {
      this.note(t('canvas.emptyNoDiagram'));
      return;
    }
    if (diagram.notation !== 'bpmn') {
      this.note(t('analysis.needBpmn'));
      return;
    }
    const result = analyzeProcess(diagram);
    this.result = result;
    if (!result.ok) {
      this.note(t('analysis.empty'), t('analysis.emptyHint'));
      return;
    }
    const settings = result.settings;
    const locale = i18n.locale;
    const money = (value) => formatMoney(value, settings.currency, locale);

    /* headline numbers */
    const kpis = [
      { label: t('analysis.lead'), value: formatDuration(result.totals.leadExpected, locale), hint: `${t('analysis.leadCritical')}: ${formatDuration(result.totals.leadCritical, locale)}` },
      { label: t('analysis.work'), value: formatDuration(result.totals.workMinutes, locale), hint: `${t('analysis.steps')}: ${result.totals.steps}` },
      { label: t('analysis.wait'), value: formatDuration(result.totals.waitMinutes, locale), hint: `${t('analysis.waitShare')}: ${result.totals.waitShare}%` },
      { label: t('analysis.cost'), value: money(result.totals.costPerRun), hint: `${t('analysis.costLabour')}: ${money(result.totals.labourCost)}` },
    ];
    if (result.totals.reworkDelay > 0) {
      kpis[0].hint = `${t('analysis.rework')}: ${formatDuration(result.totals.reworkDelay, locale)}`;
    }
    const grid = document.createElement('div');
    grid.className = 'kpi-grid';
    grid.innerHTML = kpis
      .map(
        (kpi) =>
          `<div class="kpi"><div class="kpi-label">${escapeHtml(kpi.label)}</div><div class="kpi-value">${escapeHtml(
            kpi.value
          )}</div><div class="kpi-hint">${escapeHtml(kpi.hint)}</div></div>`
      )
      .join('');
    this.el.appendChild(grid);

    if (result.bottleneck) {
      const row = document.createElement('div');
      row.className = 'note clickable';
      row.innerHTML = `<b>${t('analysis.bottleneck')}:</b> ${escapeHtml(result.bottleneck.label)} — ${escapeHtml(
        formatDuration(result.bottleneck.totalMinutes, locale)
      )} ${escapeHtml(t('analysis.perCase'))}`;
      row.addEventListener('click', () => this.app.canvas.revealElement(result.bottleneck.id));
      this.el.appendChild(row);
    }

    /* comparison with the baseline version of the same process */
    this.renderComparison(diagram, locale);

    /* annual projection */
    if (settings.volumePerYear > 0) {
      const annual = this.section(t('analysis.annual'));
      const table = document.createElement('table');
      table.className = 'grid';
      table.innerHTML = `<tbody>
        <tr><td>${t('analysis.volume')}</td><td class="num-cell">${formatNumber(settings.volumePerYear, locale)}</td></tr>
        <tr><td>${t('analysis.annualHours')}</td><td class="num-cell">${formatNumber(result.annual.hours, locale)}</td></tr>
        <tr><td>${t('analysis.annualCost')}</td><td class="num-cell">${escapeHtml(money(result.annual.cost))}</td></tr>
        <tr><td>${t('analysis.fte')}</td><td class="num-cell">${formatNumber(result.annual.fte, locale)}</td></tr>
      </tbody>`;
      annual.appendChild(table);
    }

    /* resources */
    if (result.resources.length) {
      const section = this.section(t('analysis.resources'));
      const table = document.createElement('table');
      table.className = 'grid';
      table.innerHTML =
        `<thead><tr><th>${t('analysis.role')}</th><th>${t('analysis.perCase')}</th><th>${t('analysis.hoursYear')}</th><th>${t('analysis.fte')}</th></tr></thead>` +
        `<tbody>${result.resources
          .map(
            (row) =>
              `<tr><td>${escapeHtml(row.role)}${row.rate ? `<div class="sub">${escapeHtml(money(row.rate))}/${locale === 'ru' ? 'ч' : 'h'}</div>` : ''}</td>` +
              `<td class="num-cell">${escapeHtml(formatDuration(row.minutesPerRun, locale))}</td>` +
              `<td class="num-cell">${formatNumber(row.hoursPerYear, locale)}</td>` +
              `<td class="num-cell">${formatNumber(row.fte, locale)}</td></tr>`
          )
          .join('')}</tbody>`;
      section.appendChild(table);
    }

    /* steps */
    const stepsSection = this.section(t('analysis.stepTable'));
    const steps = document.createElement('table');
    steps.className = 'grid steps-table';
    steps.innerHTML =
      `<thead><tr><th>${t('props.name')}</th><th>${t('analysis.runs')}</th><th>${t('analysis.time')}</th><th>${t('analysis.cost')}</th></tr></thead>` +
      `<tbody>${result.nodes
        .filter((row) => row.category === 'activity' || row.duration || row.totalCost)
        .map(
          (row) =>
            `<tr data-id="${escapeHtml(row.id)}"><td>${escapeHtml(row.label)}${
              row.resource ? `<div class="sub">${escapeHtml(row.resource)}${row.resourceQty > 1 ? ` ×${row.resourceQty}` : ''}</div>` : ''
            }${sourceTag(row.dataSource)}</td>` +
            `<td class="num-cell">${formatNumber(row.runs, locale)}</td>` +
            `<td class="num-cell">${escapeHtml(formatDuration(row.totalMinutes, locale))}</td>` +
            `<td class="num-cell">${escapeHtml(money(row.totalCost))}</td></tr>`
        )
        .join('')}</tbody>`;
    steps.addEventListener('click', (event) => {
      const row = event.target.closest('tr[data-id]');
      if (row) this.app.canvas.revealElement(row.dataset.id);
    });
    stepsSection.appendChild(steps);

    /* data quality */
    if (result.issues.length) {
      const section = this.section(t('analysis.issues'));
      for (const issue of result.issues) {
        const row = document.createElement('div');
        row.className = `problem-row severity-${issue.severity}`;
        row.style.padding = '6px 0';
        row.innerHTML = `<span class="problem-icon" style="color:${
          issue.severity === 'warning' ? 'var(--warning)' : 'var(--accent)'
        }">${icon(issue.severity === 'warning' ? 'warning' : 'info', 14)}</span><span>${escapeHtml(formatIssue(issue, locale))}</span>`;
        if (issue.elementId) row.addEventListener('click', () => this.app.canvas.revealElement(issue.elementId));
        section.appendChild(row);
      }
    }

    /* calculation settings */
    const settingsSection = this.section(t('analysis.settings'));
    settingsSection.appendChild(
      this.numberField(t('analysis.volume'), settings.volumePerYear, (value) => this.updateSettings({ volumePerYear: Math.max(0, value) }))
    );
    const row = document.createElement('div');
    row.className = 'field-row';
    row.appendChild(this.numberField(t('analysis.hoursPerFte'), settings.hoursPerFte, (value) => this.updateSettings({ hoursPerFte: Math.max(1, value) })));
    row.appendChild(this.textField(t('analysis.currency'), settings.currency, (value) => this.updateSettings({ currency: value || 'R$' })));
    settingsSection.appendChild(row);

    /* role rates */
    const roles = settings.roles || [];
    const rolesTable = document.createElement('table');
    rolesTable.className = 'grid';
    rolesTable.innerHTML =
      `<thead><tr><th>${t('analysis.role')}</th><th>${t('analysis.rate')}</th><th></th></tr></thead><tbody>${roles
        .map(
          (role, index) =>
            `<tr><td><input data-role-name="${index}" value="${escapeHtml(role.name || role.id || '')}"></td>` +
            `<td><input data-role-rate="${index}" type="number" value="${Number(role.rate) || 0}"></td>` +
            `<td class="act"><button class="icon-btn" data-role-remove="${index}">${icon('close', 12)}</button></td></tr>`
        )
        .join('')}</tbody>`;
    rolesTable.addEventListener('change', (event) => {
      const nameInput = event.target.closest('[data-role-name]');
      const rateInput = event.target.closest('[data-role-rate]');
      const next = roles.map((role) => ({ ...role }));
      if (nameInput) {
        const index = Number(nameInput.dataset.roleName);
        next[index] = { ...next[index], id: nameInput.value.trim(), name: nameInput.value.trim() };
      } else if (rateInput) {
        const index = Number(rateInput.dataset.roleRate);
        next[index] = { ...next[index], rate: Number(rateInput.value) || 0 };
      } else return;
      this.updateSettings({ roles: next });
    });
    rolesTable.addEventListener('click', (event) => {
      const remove = event.target.closest('[data-role-remove]');
      if (!remove) return;
      const index = Number(remove.dataset.roleRemove);
      this.updateSettings({ roles: roles.filter((_, position) => position !== index) });
    });
    settingsSection.appendChild(rolesTable);

    const actions = document.createElement('div');
    actions.className = 'inline-actions';
    const addRole = document.createElement('button');
    addRole.className = 'btn';
    addRole.textContent = t('analysis.addRole');
    addRole.addEventListener('click', () =>
      this.updateSettings({ roles: [...roles, { id: '', name: '', rate: 0 }] })
    );
    const csv = document.createElement('button');
    csv.className = 'btn';
    csv.textContent = t('analysis.exportCsv');
    csv.addEventListener('click', () => this.exportCsv());
    actions.append(addRole, csv);
    settingsSection.appendChild(actions);

    const legend = document.createElement('div');
    legend.className = 'note';
    legend.style.marginTop = '12px';
    legend.textContent = t('analysis.sourceLegend');
    this.el.appendChild(legend);
  }

  /* ---------------------------------------------------------------- utils */

  note(title, hint) {
    const box = document.createElement('div');
    box.className = 'props-empty';
    box.innerHTML = `${icon('validate', 40)}<div>${escapeHtml(title)}</div>${hint ? `<div style="margin-top:8px;font-size:var(--fs-sm)">${escapeHtml(hint)}</div>` : ''}`;
    this.el.appendChild(box);
  }

  section(title) {
    const section = document.createElement('div');
    section.className = 'props-section';
    section.innerHTML = `<h4>${escapeHtml(title)}</h4>`;
    this.el.appendChild(section);
    return section;
  }

  numberField(label, value, onChange) {
    return this.field(label, value, onChange, 'number');
  }

  textField(label, value, onChange) {
    return this.field(label, value, onChange, 'text');
  }

  field(label, value, onChange, type) {
    const wrapper = document.createElement('div');
    wrapper.className = 'field';
    wrapper.innerHTML = `<label>${escapeHtml(label)}</label>`;
    const input = document.createElement('input');
    input.className = 'input';
    input.type = type;
    input.value = value ?? '';
    input.addEventListener('change', () => onChange(type === 'number' ? Number(input.value) || 0 : input.value));
    input.addEventListener('keydown', (event) => event.stopPropagation());
    wrapper.appendChild(input);
    return wrapper;
  }

  updateSettings(patch) {
    const diagram = this.diagram;
    if (!diagram) return;
    const next = { ...analysisSettings(diagram), ...patch };
    this.history.run('analysis', diagram.id, (doc) => doc.updateDiagram(diagram.id, { meta: { analysis: next } }));
    this.render();
    this.app.refreshCanvas();
  }

  /**
   * When a diagram names another one as its baseline (`meta.baselineId`), show
   * both sides next to each other. Both are recomputed live, so editing either
   * model moves the comparison.
   */
  renderComparison(diagram, locale) {
    const baselineId = diagram.meta?.baselineId;
    if (!baselineId) return;
    const baseline = this.doc.project.diagrams.find((item) => item.meta?.processId === baselineId);
    if (!baseline) return;
    const comparison = compareProcesses(baseline, diagram);
    if (!comparison) return;
    const money = (value) => formatMoney(value, comparison.currency, locale);
    const format = (row, value) => {
      if (row.kind === 'duration') return formatDuration(value, locale);
      if (row.kind === 'money') return money(value);
      return formatNumber(value, locale);
    };
    const section = this.section(t('compare.title'));
    const open = document.createElement('div');
    open.className = 'note clickable';
    open.innerHTML = `<b>${t('compare.baseline')}:</b> ${escapeHtml(baseline.name)}`;
    open.addEventListener('click', () => this.app.openDiagram(baseline.id));
    section.appendChild(open);

    const table = document.createElement('table');
    table.className = 'grid compare-table';
    const rows = comparison.rows
      .map((row) => {
        const delta = `${row.deltaPct > 0 ? '+' : ''}${row.deltaPct.toFixed(1)}%`;
        const cls = row.deltaPct === 0 ? '' : row.improved ? 'delta-good' : 'delta-bad';
        return `<tr><td>${escapeHtml(t(row.labelKey))}</td><td class="num-cell">${escapeHtml(
          format(row, row.from)
        )}</td><td class="num-cell">${escapeHtml(format(row, row.to))}</td><td class="num-cell ${cls}">${escapeHtml(
          delta
        )}</td></tr>`;
      })
      .join('');
    table.innerHTML =
      `<thead><tr><th></th><th class="num-cell">${t('compare.asIs')}</th><th class="num-cell">${t(
        'compare.toBe'
      )}</th><th class="num-cell">${t('compare.delta')}</th></tr></thead><tbody>${rows}</tbody>`;
    section.appendChild(table);

    const done = document.createElement('div');
    done.className = 'compare-hint';
    done.textContent = t('compare.completion', {
      from: round(comparison.completion.from * 100, 1),
      to: round(comparison.completion.to * 100, 1),
    });
    section.appendChild(done);
  }

  exportCsv() {
    const diagram = this.diagram;
    const result = this.result;
    if (!diagram || !result?.ok) return;
    const settings = result.settings;
    const rows = [
      ['#', 'Step', 'Type', 'Lane', 'Runs per case', 'Processing min', 'Waiting min', 'Total min', 'Resource', 'Units', `Cost, ${settings.currency}`, 'Data source'],
      ...result.nodes.map((row, index) => [
        index + 1,
        row.label,
        row.type,
        row.lane,
        row.runs,
        row.duration,
        row.wait,
        row.totalMinutes,
        row.resource,
        row.resourceQty,
        row.totalCost,
        row.dataSource,
      ]),
      [],
      ['Lead time (expected), min', result.totals.leadExpected],
      ['Critical path, min', result.totals.leadCritical],
      ['Work time, min', result.totals.workMinutes],
      ['Waiting, min', result.totals.waitMinutes],
      [`Cost per case, ${settings.currency}`, result.totals.costPerRun],
      ['Cases per year', settings.volumePerYear],
      [`Cost per year, ${settings.currency}`, result.annual.cost],
      ['Headcount, FTE', result.annual.fte],
    ];
    const csv = rows
      .map((row) => row.map((cell) => (typeof cell === 'string' && /[",;\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(';'))
      .join('\n');
    downloadText(`﻿${csv}`, safeFileName(`${diagram.name} - calculation`, '.csv'), 'text/csv;charset=utf-8');
  }
}

function sourceTag(kind) {
  if (!kind || !SOURCE_LABEL[kind]) return '';
  return `<span class="tag tag-${kind}">${escapeHtml(t(SOURCE_LABEL[kind]))}</span>`;
}

export function formatIssue(issue, locale = 'ru') {
  const template = issue.message?.[locale] || issue.message?.en || issue.code;
  return template.replace(/\{(\w+)\}/g, (match, key) => (issue.params?.[key] !== undefined ? issue.params[key] : match));
}

function formatNumber(value, locale) {
  const number = Number(value) || 0;
  return number.toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US', { maximumFractionDigits: 2 });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}
