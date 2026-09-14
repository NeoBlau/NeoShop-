import { Emitter } from './events.js';

const STORAGE_KEY = 'fibermodeler.settings.v1';

export const DEFAULT_SETTINGS = {
  language: 'ru',
  theme: 'auto', // light | dark | auto
  accent: 'blue',
  canvas: {
    grid: true,
    gridSize: 10,
    snap: true,
    rulers: true,
    minimap: true,
    guides: true,
    smoothEdges: true,
    connectionStyle: 'orthogonal', // orthogonal | straight
    quickHandles: true,
  },
  autosave: { enabled: true, intervalSec: 30 },
  ai: {
    provider: 'local',
    apiKey: '',
    model: '',
    endpoint: '',
    temperature: 0.2,
  },
  export: { scale: 2, background: 'white', margin: 24, pageSize: 'A4', orientation: 'landscape' },
  ui: { leftPanel: true, rightPanel: true, paletteOpen: true, bottomPanel: false },
  onboarding: { demoOffered: false },
};

function deepMerge(base, patch) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [key, value] of Object.entries(patch || {})) {
    if (value && typeof value === 'object' && !Array.isArray(value) && typeof out[key] === 'object' && out[key]) {
      out[key] = deepMerge(out[key], value);
    } else if (value !== undefined) {
      out[key] = value;
    }
  }
  return out;
}

export class Settings extends Emitter {
  constructor(storage) {
    super();
    this.storage = storage || safeStorage();
    this.values = deepMerge(DEFAULT_SETTINGS, this._load());
  }

  _load() {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  get(path, fallback) {
    const parts = String(path).split('.');
    let value = this.values;
    for (const part of parts) {
      if (value == null) return fallback;
      value = value[part];
    }
    return value === undefined ? fallback : value;
  }

  set(path, value) {
    const parts = String(path).split('.');
    let target = this.values;
    for (let i = 0; i < parts.length - 1; i++) {
      if (typeof target[parts[i]] !== 'object' || target[parts[i]] === null) target[parts[i]] = {};
      target = target[parts[i]];
    }
    const last = parts[parts.length - 1];
    if (target[last] === value) return value;
    target[last] = value;
    this.save();
    this.emit('change', { path, value, settings: this.values });
    return value;
  }

  patch(patch) {
    this.values = deepMerge(this.values, patch);
    this.save();
    this.emit('change', { path: '*', settings: this.values });
  }

  reset() {
    this.values = deepMerge(DEFAULT_SETTINGS, {});
    this.save();
    this.emit('change', { path: '*', settings: this.values });
  }

  save() {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.values));
    } catch {
      /* storage unavailable (private mode) - settings stay in memory */
    }
  }
}

function safeStorage() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('__fm_probe', '1');
      localStorage.removeItem('__fm_probe');
      return localStorage;
    }
  } catch {
    /* ignore */
  }
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}
