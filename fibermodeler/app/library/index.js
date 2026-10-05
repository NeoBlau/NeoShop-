/**
 * Every process library shipped with the application.
 *
 * The program opens on all of them, each in its own explorer folder, so every
 * user sees the diagrams on entering. A library is a list of processes plus a
 * builder; this module only combines them, so adding a company means adding a
 * folder next to `weg/` and one line here.
 */
import { createProject } from '../core/model.js';
import { WEG_PROCESSES, buildWegDiagrams, wegProjectDocumentation } from './weg/index.js';
import { UBER_PROCESSES, buildUberDiagrams, uberProjectDocumentation } from './ubereats/index.js';

/** `meta.library` values of the shipped libraries. */
export const LIBRARY_IDS = ['weg', 'ubereats'];

export function isLibraryDiagram(diagram) {
  return LIBRARY_IDS.includes(diagram?.meta?.library);
}

export const LIBRARY_PROCESS_COUNT = WEG_PROCESSES.length + UBER_PROCESSES.length;

/** All shipped diagrams, in explorer order: WEG first, then Uber Eats. */
export function buildAllLibraryDiagrams(locale = 'ru') {
  return [...buildWegDiagrams(locale), ...buildUberDiagrams(locale)];
}

export function librariesProjectName(locale = 'ru') {
  return locale === 'en' ? 'Process libraries — WEG and Uber Eats' : 'Библиотеки процессов — WEG и Uber Eats';
}

export function librariesProjectDocumentation(locale = 'ru') {
  const rule = '\n\n' + '─'.repeat(40) + '\n\n';
  return `${wegProjectDocumentation(locale)}${rule}${uberProjectDocumentation(locale)}`;
}

/** The libraries as one project - what the application opens on start. */
export function createLibrariesProject(locale = 'ru') {
  const project = createProject({
    name: librariesProjectName(locale),
    company: 'WEG S.A.; Uber Eats',
    author: 'FiberModeler',
    description:
      locale === 'en'
        ? 'BPMN 2.0 process libraries with calculable parameters: WEG (eight processes) and Uber Eats in Dubai (ordering from McDonald\'s), each as is and to be.'
        : 'Библиотеки процессов BPMN 2.0 с рассчитываемыми параметрами: WEG (восемь процессов) и Uber Eats в Дубае (заказ из McDonald\'s), каждый как есть и как будет.',
  });
  project.documentation = librariesProjectDocumentation(locale);
  project.diagrams = buildAllLibraryDiagrams(locale);
  return project;
}
