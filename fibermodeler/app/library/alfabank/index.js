/**
 * Alfa-Bank library: consumer lending and customer service, seen from the bank.
 *
 * One process in its current state (AS-IS), built by the same pipeline as every
 * other shipped library. See `facts.js` for why every number here is an
 * assumption and what is publicly known.
 */
import { buildLibraryDiagram, buildLibraryDiagrams, localizeSpec as localizeWithRoles, pick, variantFolder } from '../shared.js';
import { contextBlock, dataNote, roleLabel } from './facts.js';
import { alfaAsIs } from './asis.js';

/** Root folder shown in the model explorer; the variants are its sub-folders. */
export const ALFA_FOLDER = 'Альфа-Банк';

export function alfaFolder(variant, locale = 'ru') {
  return variantFolder(locale === 'en' ? 'Alfa-Bank' : ALFA_FOLDER, variant, locale);
}

export const ALFA_AS_IS = [alfaAsIs];
export const ALFA_TO_BE = [];
export const ALFA_PROCESSES = [...ALFA_AS_IS, ...ALFA_TO_BE];

const ALFA_BUILD = {
  library: 'alfabank',
  // nothing inside comes from the bank's own data
  author: 'FiberModeler — modelling assumptions',
  roleName: roleLabel,
};

export function localizeSpec(spec, locale = 'ru') {
  return localizeWithRoles(spec, locale, roleLabel);
}

export function buildAlfaDiagram(process, locale = 'ru') {
  return buildLibraryDiagram(process, locale, { ...ALFA_BUILD, folder: alfaFolder(process.variant, locale) });
}

export function buildAlfaDiagrams(locale = 'ru') {
  return buildLibraryDiagrams(ALFA_PROCESSES, locale, ALFA_BUILD, (process) => alfaFolder(process.variant, locale));
}

export function alfaProjectDocumentation(locale = 'ru') {
  const ru = locale === 'ru';
  const head = ru
    ? `Альфа-Банк — розничное кредитование и обслуживание клиентов со стороны банка: ${ALFA_PROCESSES.length} модель BPMN 2.0 (как есть) с рассчитываемыми параметрами времени, ресурсов и стоимости в рублях.`
    : `Alfa-Bank - retail lending and customer service from the bank's side: ${ALFA_PROCESSES.length} BPMN 2.0 model (as is) with calculable time, resource and cost parameters in roubles.`;
  const list = ALFA_PROCESSES.map((process) => `• ${pick(process.name, locale)} — ${pick(process.description, locale)}`).join('\n');
  return `${head}\n\n${list}\n\n${dataNote(locale)}\n\n${contextBlock(locale)}`;
}
