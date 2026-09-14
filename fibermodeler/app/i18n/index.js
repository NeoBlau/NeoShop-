import { Emitter } from '../core/events.js';
import { en } from './en.js';
import { ru } from './ru.js';

export const LOCALES = { en, ru };
export const LOCALE_NAMES = { en: 'English', ru: 'Русский' };

class I18n extends Emitter {
  constructor() {
    super();
    this.locale = 'ru';
    this.dict = LOCALES.ru;
  }

  setLocale(locale) {
    const next = LOCALES[locale] ? locale : 'en';
    if (next === this.locale) return;
    this.locale = next;
    this.dict = LOCALES[next];
    if (typeof document !== 'undefined') document.documentElement.lang = next;
    this.emit('change', next);
  }

  /** t('menu.file') / t('msg.nodes', {count: 3}) */
  t(key, params) {
    let value = this.dict[key];
    if (value === undefined) value = LOCALES.en[key];
    if (value === undefined) value = key;
    if (params) {
      value = value.replace(/\{(\w+)\}/g, (m, name) => (params[name] !== undefined ? params[name] : m));
    }
    return value;
  }
}

export const i18n = new I18n();
export const t = (key, params) => i18n.t(key, params);

/** Applies translations to every [data-i18n] element inside `root`. */
export function localizeDom(root = document) {
  for (const el of root.querySelectorAll('[data-i18n]')) {
    el.textContent = t(el.dataset.i18n);
  }
  for (const el of root.querySelectorAll('[data-i18n-title]')) {
    el.title = t(el.dataset.i18nTitle);
  }
  for (const el of root.querySelectorAll('[data-i18n-placeholder]')) {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  }
  for (const el of root.querySelectorAll('[data-i18n-aria]')) {
    el.setAttribute('aria-label', t(el.dataset.i18nAria));
  }
}
