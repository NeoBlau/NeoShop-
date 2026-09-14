/** ⌘K command palette with fuzzy matching. */
import { t } from '../i18n/index.js';
import { commandList, prettyShortcut } from './commands.js';
import { icon } from './icons.js';

const RECENT_KEY = 'fibermodeler.cmdk.recent';

export function openCommandPalette(app) {
  const commands = commandList(app).filter((command) => command.enabled !== false);
  const recent = loadRecent();
  const overlay = document.createElement('div');
  overlay.className = 'cmdk';
  overlay.innerHTML = `
    <div class="cmdk-box">
      <input class="cmdk-input" type="text" placeholder="${t('cmd.placeholder')}" spellcheck="false">
      <div class="cmdk-list"></div>
    </div>`;
  document.body.appendChild(overlay);
  const input = overlay.querySelector('input');
  const list = overlay.querySelector('.cmdk-list');
  let filtered = sortByRecent(commands, recent);
  let active = 0;

  const render = () => {
    list.innerHTML = filtered.length
      ? filtered
          .map(
            (command, index) =>
              `<div class="cmdk-item${index === active ? ' is-active' : ''}" data-index="${index}">${icon(command.icon || 'command', 16)}<span>${escapeHtml(
                command.label
              )}</span>${command.shortcut ? `<span class="hint">${escapeHtml(prettyShortcut(command.shortcut))}</span>` : ''}</div>`
          )
          .join('')
      : `<div class="empty-note">${t('cmd.empty')}</div>`;
    list.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
  };

  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKey, true);
  };

  const accept = () => {
    const command = filtered[active];
    if (!command) return;
    rememberRecent(command.id);
    close();
    setTimeout(() => command.run(), 0);
  };

  const onKey = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      active = Math.min(filtered.length - 1, active + 1);
      render();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      active = Math.max(0, active - 1);
      render();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      accept();
    }
  };

  input.addEventListener('input', () => {
    const query = input.value.trim().toLowerCase();
    filtered = query ? commands.filter((command) => fuzzy(command.label.toLowerCase(), query) || command.id.includes(query)) : sortByRecent(commands, recent);
    active = 0;
    render();
  });
  list.addEventListener('click', (event) => {
    const item = event.target.closest('.cmdk-item');
    if (!item) return;
    active = Number(item.dataset.index);
    accept();
  });
  overlay.addEventListener('pointerdown', (event) => {
    if (event.target === overlay) close();
  });
  document.addEventListener('keydown', onKey, true);
  render();
  input.focus();
}

function fuzzy(text, query) {
  let index = 0;
  for (const char of query) {
    index = text.indexOf(char, index);
    if (index < 0) return false;
    index++;
  }
  return true;
}

function sortByRecent(commands, recent) {
  const rank = new Map(recent.map((id, index) => [id, index]));
  return [...commands].sort((a, b) => (rank.get(a.id) ?? 999) - (rank.get(b.id) ?? 999));
}

function loadRecent() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
}

function rememberRecent(id) {
  try {
    const list = [id, ...loadRecent().filter((item) => item !== id)].slice(0, 8);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}
