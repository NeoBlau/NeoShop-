/** Identifier helpers. Ids are stable, human readable and XML-NCName safe. */
const counters = new Map();

export function uid(prefix = 'id') {
  const n = (counters.get(prefix) || 0) + 1;
  counters.set(prefix, n);
  const rand = Math.random().toString(36).slice(2, 7);
  return `${prefix}_${n}${rand}`;
}

/** Deterministic counter reset - used by tests and by project import. */
export function resetIds() {
  counters.clear();
}

/** Makes sure an id is unique inside `taken` (a Set of strings). */
export function uniqueId(base, taken) {
  let candidate = sanitizeId(base);
  let i = 2;
  while (taken.has(candidate)) candidate = `${sanitizeId(base)}_${i++}`;
  taken.add(candidate);
  return candidate;
}

export function sanitizeId(value) {
  const s = String(value || 'id').replace(/[^A-Za-z0-9_.-]/g, '_');
  return /^[A-Za-z_]/.test(s) ? s : `_${s}`;
}
