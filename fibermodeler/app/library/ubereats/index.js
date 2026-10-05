/**
 * Uber Eats library: ordering McDonald's food in Dubai, seen from the platform.
 *
 * One business process in two versions - the current state (AS-IS) and the
 * target state (TO-BE) - built by the same pipeline as every other shipped
 * library. See `facts.js` for why every number here is an assumption.
 */
import { buildLibraryDiagram, buildLibraryDiagrams, localizeSpec as localizeWithRoles, pick, variantFolder } from '../shared.js';
import { contextBlock, dataNote, roleLabel } from './facts.js';
import { uberAsIs } from './asis.js';
import { uberToBe } from './tobe.js';

/** Root folder shown in the model explorer; the variants are its sub-folders. */
export const UBER_FOLDER = 'Uber Eats';

export function uberFolder(variant, locale = 'ru') {
  return variantFolder(UBER_FOLDER, variant, locale);
}

export const UBER_AS_IS = [uberAsIs];
export const UBER_TO_BE = [uberToBe];
export const UBER_PROCESSES = [...UBER_AS_IS, ...UBER_TO_BE];

const UBER_BUILD = {
  library: 'ubereats',
  // nothing here comes from the company's own disclosure
  author: 'FiberModeler — modelling assumptions',
  roleName: roleLabel,
};

/** Resolves every `{ ru, en }` pair of a specification into one language. */
export function localizeSpec(spec, locale = 'ru') {
  return localizeWithRoles(spec, locale, roleLabel);
}

export function buildUberDiagram(process, locale = 'ru') {
  return buildLibraryDiagram(process, locale, { ...UBER_BUILD, folder: uberFolder(process.variant, locale) });
}

export function buildUberDiagrams(locale = 'ru') {
  return buildLibraryDiagrams(UBER_PROCESSES, locale, UBER_BUILD, (process) => uberFolder(process.variant, locale));
}

export function uberProjectDocumentation(locale = 'ru') {
  const ru = locale === 'ru';
  const head = ru
    ? `Uber Eats, Дубай — заказ еды из McDonald's со стороны платформы: ${UBER_PROCESSES.length} модели BPMN 2.0 (как есть и как будет) с рассчитываемыми параметрами времени, ресурсов и стоимости в AED.`
    : `Uber Eats, Dubai - ordering McDonald's food from the platform's side: ${UBER_PROCESSES.length} BPMN 2.0 models (as is and to be) with calculable time, resource and cost parameters in AED.`;
  const list = UBER_PROCESSES.map((process) => `• ${pick(process.name, locale)} — ${pick(process.description, locale)}`).join('\n');
  return `${head}\n\n${list}\n\n${dataNote(locale)}\n\n${contextBlock(locale)}`;
}
