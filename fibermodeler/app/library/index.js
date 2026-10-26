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
import { ALFA_PROCESSES, alfaProjectDocumentation, buildAlfaDiagrams } from './alfabank/index.js';
import { UBER_PROCESSES, buildUberDiagrams, uberProjectDocumentation } from './ubereats/index.js';
import { TRADECASE_COUNT, buildTradecaseDiagrams, tradecaseDocumentation } from './tradecase/index.js';
import { AUTOMATION_SHEET_COUNT, automationDocumentation, buildAutomationDiagrams } from './automation/index.js';
import { WEG_JOURNEY_PROCESSES, buildWegJourneyDiagrams } from './weg/journey/index.js';
import { WEG_SHEET_COUNT, buildWegSheetDiagrams, wegSheetsDocumentation } from './weg/sheets/index.js';

/** `meta.library` values of the shipped libraries. */
export const LIBRARY_IDS = ['weg', 'wegjourney', 'alfabank', 'tradecase', 'wegsheets', 'automation', 'ubereats'];

export function isLibraryDiagram(diagram) {
  return LIBRARY_IDS.includes(diagram?.meta?.library);
}

export const LIBRARY_PROCESS_COUNT = WEG_PROCESSES.length + WEG_JOURNEY_PROCESSES.length + ALFA_PROCESSES.length + UBER_PROCESSES.length;

export const LIBRARY_SHEET_COUNT = WEG_SHEET_COUNT + AUTOMATION_SHEET_COUNT;
export const LIBRARY_CASE_COUNT = TRADECASE_COUNT;

/** All shipped diagrams, in explorer order: WEG, the buyer's journey, the worksheets, then Uber Eats. */
export function buildAllLibraryDiagrams(locale = 'ru') {
  return [...buildWegDiagrams(locale), ...buildWegJourneyDiagrams(locale), ...buildAlfaDiagrams(locale), ...buildTradecaseDiagrams(locale), ...buildWegSheetDiagrams(locale), ...buildAutomationDiagrams(locale), ...buildUberDiagrams(locale)];
}

export function librariesProjectName(locale = 'ru') {
  return locale === 'en' ? 'Process libraries — WEG, Alfa-Bank and Uber Eats' : 'Библиотеки процессов — WEG, Альфа-Банк и Uber Eats';
}

export function librariesProjectDocumentation(locale = 'ru') {
  const rule = '\n\n' + '─'.repeat(40) + '\n\n';
  return `${wegProjectDocumentation(locale)}${rule}${wegSheetsDocumentation(locale)}${rule}${automationDocumentation(locale)}${rule}${alfaProjectDocumentation(locale)}${rule}${tradecaseDocumentation(locale)}${rule}${uberProjectDocumentation(locale)}`;
}

/** The libraries as one project - what the application opens on start. */
export function createLibrariesProject(locale = 'ru') {
  const project = createProject({
    name: librariesProjectName(locale),
    company: 'WEG S.A.; Alfa-Bank; Uber Eats',
    author: 'FiberModeler',
    description:
      locale === 'en'
        ? 'BPMN 2.0 process libraries with calculable parameters: WEG (eight processes), Alfa-Bank retail lending (as is), Uber Eats in Dubai and a case of an order process redesign (ordering from McDonald\'s), each as is and to be; plus the filled WEG worksheets (impact–effort matrices, implementation risks, the customer journey) and the automation seminar worksheets for every process.'
        : 'Библиотеки процессов BPMN 2.0 с рассчитываемыми параметрами: WEG (восемь процессов), кредитование в Альфа-Банке (как есть), Uber Eats в Дубае и кейс по перепроектированию процесса заказа (заказ из McDonald\'s), каждый как есть и как будет; плюс заполненные рабочие листы WEG (матрицы «эффект — усилия», риски внедрения, путь покупателя) и листы семинара по автоматизации для каждого процесса.',
  });
  project.documentation = librariesProjectDocumentation(locale);
  project.diagrams = buildAllLibraryDiagrams(locale);
  return project;
}
