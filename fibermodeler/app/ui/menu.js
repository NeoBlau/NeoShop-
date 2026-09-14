/**
 * Dropdown and context menus.
 * Items: {label, action, shortcut, checked, disabled, separator, submenu, icon, danger}
 */
import { icon } from './icons.js';

let openMenu = null;

export function closeMenus() {
  if (openMenu) {
    openMenu.element.remove();
    openMenu.onClose?.();
    openMenu = null;
  }
  for (const el of document.querySelectorAll('.menu-popup, .context-menu')) el.remove();
  for (const el of document.querySelectorAll('.menu-button.is-open')) el.classList.remove('is-open');
}

if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', (event) => {
    if (openMenu && !event.target.closest('.menu-popup, .context-menu, .menu-button')) closeMenus();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenus();
  });
}

function buildItems(items, popup, onClose) {
  for (const item of items) {
    if (!item || item.hidden) continue;
    if (item.separator) {
      const sep = document.createElement('div');
      sep.className = 'menu-separator';
      popup.appendChild(sep);
      continue;
    }
    if (item.header) {
      const label = document.createElement('div');
      label.className = 'menu-label';
      label.textContent = item.header;
      popup.appendChild(label);
      continue;
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `menu-item${item.checked ? ' is-checked' : ''}`;
    button.disabled = !!item.disabled;
    button.innerHTML =
      `<span class="check">${item.checked ? icon('check', 13) : ''}</span>` +
      `<span class="text">${escapeHtml(item.label)}</span>` +
      (item.submenu ? `<span class="submenu-arrow">${icon('chevronRight', 13)}</span>` : '') +
      (item.shortcut ? `<span class="shortcut">${escapeHtml(item.shortcut)}</span>` : '');
    if (item.submenu) {
      button.addEventListener('pointerenter', () => {
        const rect = button.getBoundingClientRect();
        const items2 = typeof item.submenu === 'function' ? item.submenu() : item.submenu;
        showSubmenu(items2, rect.right - 4, rect.top - 6, popup, onClose);
      });
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const rect = button.getBoundingClientRect();
        const items2 = typeof item.submenu === 'function' ? item.submenu() : item.submenu;
        showSubmenu(items2, rect.right - 4, rect.top - 6, popup, onClose);
      });
    } else {
      button.addEventListener('click', () => {
        closeMenus();
        try {
          item.action?.();
        } catch (err) {
          console.error('[FiberModeler] menu action failed', err);
        }
      });
      button.addEventListener('pointerenter', () => {
        popup.querySelector('.submenu')?.remove();
      });
    }
    popup.appendChild(button);
  }
}

function showSubmenu(items, x, y, parent, onClose) {
  parent.querySelector('.submenu')?.remove();
  const popup = document.createElement('div');
  popup.className = 'menu-popup submenu';
  buildItems(items, popup, onClose);
  document.body.appendChild(popup);
  position(popup, x, y);
  parent.appendChild(Object.assign(document.createElement('span'), { className: 'submenu-ref' }));
  const ref = popup;
  parent.addEventListener(
    'pointerleave',
    () => {
      setTimeout(() => {
        if (!ref.matches(':hover')) ref.remove();
      }, 220);
    },
    { once: true }
  );
}

function position(popup, x, y) {
  const rect = popup.getBoundingClientRect();
  const left = Math.min(x, window.innerWidth - rect.width - 8);
  const top = Math.min(y, window.innerHeight - rect.height - 8);
  popup.style.left = `${Math.max(6, left)}px`;
  popup.style.top = `${Math.max(6, top)}px`;
}

export function showMenu(items, x, y, { anchor, className = 'menu-popup', onClose } = {}) {
  closeMenus();
  const popup = document.createElement('div');
  popup.className = className;
  buildItems(items, popup, onClose);
  document.body.appendChild(popup);
  position(popup, x, y);
  anchor?.classList.add('is-open');
  openMenu = {
    element: popup,
    onClose: () => {
      anchor?.classList.remove('is-open');
      onClose?.();
    },
  };
  return popup;
}

export function showContextMenu(items, x, y) {
  return showMenu(items, x, y, { className: 'context-menu' });
}

export function isMenuOpen() {
  return !!openMenu;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}
