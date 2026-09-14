/** Periodic crash-safe autosave into IndexedDB. */
import { saveProjectRecord, setState, getState, storageAvailable } from './db.js';

const RECOVERY_KEY = 'recovery';

export class Autosave {
  constructor({ doc, settings, onSaved, onError }) {
    this.doc = doc;
    this.settings = settings;
    this.onSaved = onSaved;
    this.onError = onError;
    this.timer = null;
    this.lastHash = '';
    this.start();
    settings.on('change', ({ path }) => {
      if (!path || path.startsWith('autosave')) this.start();
    });
  }

  start() {
    this.stop();
    if (!storageAvailable() || !this.settings.get('autosave.enabled', true)) return;
    const interval = Math.max(10, Number(this.settings.get('autosave.intervalSec', 30))) * 1000;
    this.timer = setInterval(() => this.tick(), interval);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async tick(force = false) {
    try {
      const project = this.doc.project;
      const hash = `${project.id}:${project.meta.modified}:${project.diagrams.length}`;
      if (!force && hash === this.lastHash) return false;
      this.lastHash = hash;
      await saveProjectRecord(project);
      await setState(RECOVERY_KEY, { projectId: project.id, savedAt: new Date().toISOString() });
      this.onSaved?.(new Date());
      return true;
    } catch (err) {
      this.onError?.(err);
      return false;
    }
  }

  async flush() {
    return this.tick(true);
  }
}

export async function recoveryInfo() {
  if (!storageAvailable()) return null;
  try {
    return (await getState(RECOVERY_KEY)) || null;
  } catch {
    return null;
  }
}
