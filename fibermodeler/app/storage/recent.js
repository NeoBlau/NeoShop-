/** Recently opened projects (kept in localStorage, newest first). */
const KEY = 'fibermodeler.recent.v1';
const LIMIT = 12;

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

function write(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, LIMIT)));
  } catch {
    /* ignore quota / private mode */
  }
}

export function recentProjects() {
  return read();
}

export function rememberProject(project, extra = {}) {
  const list = read().filter((item) => item.id !== project.id);
  list.unshift({
    id: project.id,
    name: project.name,
    updatedAt: new Date().toISOString(),
    diagrams: project.diagrams.length,
    ...extra,
  });
  write(list);
  return list;
}

export function forgetProject(id) {
  write(read().filter((item) => item.id !== id));
}
