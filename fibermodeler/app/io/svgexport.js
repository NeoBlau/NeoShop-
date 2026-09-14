/** SVG export helpers shared by the file exporters and the PDF writer. */
import { diagramToSvg, EXPORT_VARS, exportCss } from '../canvas/canvas.js';

const VAR_RE = /var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)/g;

/** Replaces every var(--x) with a literal value so the file is self contained. */
export function inlineCssVars(markup, vars = EXPORT_VARS) {
  let result = markup;
  for (let i = 0; i < 4 && VAR_RE.test(result); i++) {
    VAR_RE.lastIndex = 0;
    result = result.replace(VAR_RE, (match, name, fallback) => vars[name] ?? (fallback ? fallback.trim() : '#000000'));
  }
  return result;
}

export function exportDiagramSvg(diagram, doc, options = {}) {
  const vars = { ...EXPORT_VARS, ...(options.vars || {}) };
  const svg = diagramToSvg(diagram, doc, { ...options, css: exportCss(vars) });
  return options.inlineVars === false ? svg : inlineCssVars(svg, vars);
}
