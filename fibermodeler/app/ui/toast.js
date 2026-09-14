/** Transient status messages. */
let container = null;

function host() {
  if (!container) {
    container = document.createElement('div');
    container.className = 'toasts';
    document.body.appendChild(container);
  }
  return container;
}

export function toast(message, { type = '', timeout = 2600 } = {}) {
  const element = document.createElement('div');
  element.className = `toast${type ? ` is-${type}` : ''}`;
  element.textContent = message;
  host().appendChild(element);
  setTimeout(() => {
    element.style.transition = 'opacity .25s ease, transform .25s ease';
    element.style.opacity = '0';
    element.style.transform = 'translateY(8px)';
    setTimeout(() => element.remove(), 260);
  }, timeout);
  return element;
}

export const toastError = (message) => toast(message, { type: 'error', timeout: 4200 });
export const toastSuccess = (message) => toast(message, { type: 'success' });
