import { layeredLayout, fitContainers } from './layered.js';
import { idef0Layout } from './idef0layout.js';

/** Chooses the right algorithm for the notation and returns position changes. */
export function autoLayout(diagram, options = {}) {
  if (diagram.notation === 'idef0') return idef0Layout(diagram, options);
  const changes = layeredLayout(diagram, options);
  return changes;
}

export { layeredLayout, idef0Layout, fitContainers };
export * from './align.js';
