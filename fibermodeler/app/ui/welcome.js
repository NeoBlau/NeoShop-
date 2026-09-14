/** Start screen with recent projects and a three-step onboarding hint. */
import { t } from '../i18n/index.js';
import { recentProjects } from '../storage/recent.js';
import { BRAND_MARK, icon } from './icons.js';

export function renderWelcome(host, app) {
  const recent = recentProjects();
  host.innerHTML = `
    <div class="welcome-card">
      <div class="welcome-left">
        ${BRAND_MARK.replace('class="brand-mark"', 'style="width:46px;height:46px"')}
        <h1>FiberModeler</h1>
        <p class="sub">${t('welcome.subtitle')}</p>
        <div class="welcome-actions">
          <button class="btn primary" data-action="new">${icon('new', 15)}${t('welcome.new')}</button>
          <button class="btn" data-action="open">${icon('open', 15)}${t('welcome.open')}</button>
          <button class="btn" data-action="demo">${icon('sparkles', 15)}${t('welcome.demo')}</button>
        </div>
        <div class="welcome-steps">
          <div class="welcome-step"><span class="n">1</span><span>${t('welcome.step1')}</span></div>
          <div class="welcome-step"><span class="n">2</span><span>${t('welcome.step2')}</span></div>
          <div class="welcome-step"><span class="n">3</span><span>${t('welcome.step3')}</span></div>
        </div>
      </div>
      <div class="welcome-right">
        <div class="panel-head" style="padding-left:0">${t('welcome.recent')}</div>
        <div class="recent-list">
          ${
            recent.length
              ? recent
                  .map(
                    (entry) =>
                      `<div class="recent-item" data-id="${escapeHtml(entry.id)}"><span class="name">${escapeHtml(
                        entry.name
                      )}</span><span class="meta">${new Date(entry.updatedAt).toLocaleString()} · ${entry.diagrams || 0}</span></div>`
                  )
                  .join('')
              : `<div class="tree-empty">${t('welcome.noRecent')}</div>`
          }
        </div>
      </div>
    </div>`;
  host.hidden = false;
  host.querySelector('[data-action="new"]').addEventListener('click', () => app.newProject());
  host.querySelector('[data-action="open"]').addEventListener('click', () => app.openProjectFile());
  host.querySelector('[data-action="demo"]').addEventListener('click', () => app.openDemoProject());
  for (const item of host.querySelectorAll('.recent-item')) {
    item.addEventListener('click', () => app.openRecent(item.dataset.id));
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}
