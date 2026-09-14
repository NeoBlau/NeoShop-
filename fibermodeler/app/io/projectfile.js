/**
 * `.fibermodel` project container.
 *
 * A ZIP with a readable structure so that projects stay inspectable and
 * diffable:
 *   mimetype                     - plain marker, first entry
 *   project.json                 - metadata + diagram index
 *   models/bpmn/<id>.json        - one file per diagram
 *   models/idef0/<id>.json
 *   documentation/<id>.md
 *   preview.svg                  - thumbnail of the first diagram
 */
import { clone, createProject, normalizeProject, SCHEMA_VERSION } from '../core/model.js';
import { diagramToSvg } from '../canvas/canvas.js';
import { bytesToText, createZip, readZip } from './zip.js';

export const MIMETYPE = 'application/vnd.fibermodeler.project';
export const FILE_EXTENSION = '.fibermodel';

export async function packProject(project, options = {}) {
  const index = project.diagrams.map((d) => ({
    id: d.id,
    name: d.name,
    notation: d.notation,
    parentDiagramId: d.parentDiagramId,
    parentNodeId: d.parentNodeId,
    file: `models/${d.notation}/${d.id}.json`,
  }));
  const manifest = {
    schema: SCHEMA_VERSION,
    application: 'FiberModeler',
    generator: options.generator || 'FiberModeler 1.0',
    savedAt: new Date().toISOString(),
    id: project.id,
    name: project.name,
    meta: project.meta,
    documentation: project.documentation || '',
    diagrams: index,
  };

  const entries = [
    { name: 'mimetype', data: MIMETYPE },
    { name: 'project.json', data: JSON.stringify(manifest, null, 2) },
  ];
  for (const diagram of project.diagrams) {
    entries.push({ name: `models/${diagram.notation}/${diagram.id}.json`, data: JSON.stringify(diagram, null, 2) });
    if (diagram.meta?.documentation) {
      entries.push({ name: `documentation/${diagram.id}.md`, data: diagram.meta.documentation });
    }
  }
  if (project.documentation) entries.push({ name: 'documentation/project.md', data: project.documentation });
  if (project.diagrams.length) {
    try {
      entries.push({ name: 'preview.svg', data: diagramToSvg(project.diagrams[0], null, { background: '#ffffff' }) });
    } catch {
      /* preview is optional */
    }
  }
  return createZip(entries);
}

export async function unpackProject(buffer) {
  const files = await readZip(buffer);
  const manifestRaw = files.get('project.json');
  if (!manifestRaw) throw new Error('project.json is missing - not a FiberModeler project');
  const manifest = JSON.parse(bytesToText(manifestRaw));
  const project = createProject({ name: manifest.name });
  project.id = manifest.id || project.id;
  project.meta = { ...project.meta, ...(manifest.meta || {}) };
  project.documentation = manifest.documentation || '';
  project.diagrams = [];
  for (const entry of manifest.diagrams || []) {
    const raw = files.get(entry.file) || files.get(`models/${entry.notation}/${entry.id}.json`);
    if (!raw) continue;
    project.diagrams.push(JSON.parse(bytesToText(raw)));
  }
  return normalizeProject(project);
}

/** Plain JSON serialisation (File > Export > JSON and autosave). */
export function projectToJson(project) {
  return JSON.stringify({ ...clone(project), application: 'FiberModeler', schema: SCHEMA_VERSION }, null, 2);
}

export function projectFromJson(text) {
  const raw = JSON.parse(text);
  if (raw.diagrams) return normalizeProject(raw);
  // a single diagram file
  if (raw.nodes && raw.edges) {
    const project = createProject({ name: raw.name || 'Imported' });
    project.diagrams = [raw];
    return normalizeProject(project);
  }
  throw new Error('Unrecognised JSON structure');
}
