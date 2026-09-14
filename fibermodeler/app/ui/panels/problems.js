/** Validation results panel. */
import { i18n, t } from '../../i18n/index.js';
import { localName } from '../../notations/index.js';
import { icon } from '../icons.js';

export class Problems {
  constructor(element, context) {
    this.el = element;
    this.doc = context.doc;
    this.app = context.app;
    this.problems = [];
    this.body = element.querySelector('.bottom-body');
    this.counter = element.querySelector('.title');
    this.body.addEventListener('click', (event) => {
      const row = event.target.closest('.problem-row');
      if (!row) return;
      const problem = this.problems[Number(row.dataset.index)];
      if (problem) this.app.revealProblem(problem);
    });
  }

  setProblems(problems) {
    this.problems = problems;
    this.render();
  }

  get counts() {
    return {
      error: this.problems.filter((p) => p.severity === 'error').length,
      warning: this.problems.filter((p) => p.severity === 'warning').length,
      info: this.problems.filter((p) => p.severity === 'info').length,
    };
  }

  render() {
    const locale = i18n.locale;
    this.counter.textContent = `${t('problems.title')} — ${t('problems.count', { count: this.problems.length })}`;
    if (!this.problems.length) {
      this.body.innerHTML = `<div class="empty-note">${t('problems.none')}</div>`;
      return;
    }
    this.body.innerHTML = this.problems
      .map((problem, index) => {
        const diagram = this.doc.diagram(problem.diagramId);
        const message = formatMessage(problem, locale);
        const iconName = problem.severity === 'error' ? 'error' : problem.severity === 'warning' ? 'warning' : 'info';
        const color = problem.severity === 'error' ? 'var(--danger)' : problem.severity === 'warning' ? 'var(--warning)' : 'var(--accent)';
        return (
          `<div class="problem-row severity-${problem.severity}" data-index="${index}">` +
          `<span class="problem-icon" style="color:${color}">${icon(iconName, 15)}</span>` +
          `<span class="problem-text">${escapeHtml(message)}</span>` +
          `<span class="where">${escapeHtml(diagram?.name || '')}</span>` +
          '</div>'
        );
      })
      .join('');
  }
}

export function formatMessage(problem, locale = 'en') {
  const template = localName(problem.message, locale) || problem.messageKey;
  return template.replace(/\{(\w+)\}/g, (match, key) => (problem.params?.[key] !== undefined ? problem.params[key] : match));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}
