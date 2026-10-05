/**
 * WEG process library.
 *
 * Eight BPMN 2.0 models of WEG S.A.'s main business processes, grounded in the
 * company's public disclosure (see `facts.js`). The library is shipped with the
 * application: it is loaded on start-up into a "WEG" folder of the model
 * explorer, so every user sees the diagrams on entering the program.
 *
 * Each process is stored as a notation-neutral specification and turned into a
 * real diagram (identity, geometry, lanes, routed connections) by the same
 * pipeline the templates and the table builder use.
 */
import { createProject } from '../../core/model.js';
import { WEG, WEG_SOURCES, dataNote, roleLabel } from './facts.js';
import { buildLibraryDiagram, buildLibraryDiagrams, localizeSpec as localizeWithRoles, pick, variantFolder } from '../shared.js';
import { orderToCash } from './asis/p1-order-to-cash.js';
import { motorManufacturing } from './asis/p2-motor-manufacturing.js';
import { procurement } from './asis/p3-procurement.js';
import { engineerToOrder } from './asis/p4-engineer-to-order.js';
import { transformerProject } from './asis/p5-transformer-project.js';
import { serviceProcess } from './asis/p6-service.js';
import { newProduct } from './asis/p7-new-product.js';
import { exportProcess } from './asis/p8-export-customs.js';
import { orderToCashToBe } from './tobe/p1-order-to-cash.js';
import { motorManufacturingToBe } from './tobe/p2-motor-manufacturing.js';
import { procurementToBe } from './tobe/p3-procurement.js';
import { engineerToOrderToBe } from './tobe/p4-engineer-to-order.js';
import { transformerProjectToBe } from './tobe/p5-transformer-project.js';
import { serviceProcessToBe } from './tobe/p6-service.js';
import { newProductToBe } from './tobe/p7-new-product.js';
import { exportProcessToBe } from './tobe/p8-export-customs.js';

/** Root folder shown in the model explorer; the variants are its sub-folders. */
export const WEG_FOLDER = 'WEG';

/** `WEG/Как есть (AS-IS)` - the explorer splits the path into nested folders. */
export function wegFolder(variant, locale = 'ru') {
  return variantFolder(WEG_FOLDER, variant, locale);
}

export const WEG_AS_IS = [
  orderToCash,
  motorManufacturing,
  procurement,
  engineerToOrder,
  transformerProject,
  serviceProcess,
  newProduct,
  exportProcess,
].sort((a, b) => a.order - b.order);

export const WEG_TO_BE = [
  orderToCashToBe,
  motorManufacturingToBe,
  procurementToBe,
  engineerToOrderToBe,
  transformerProjectToBe,
  serviceProcessToBe,
  newProductToBe,
  exportProcessToBe,
].sort((a, b) => a.order - b.order);

/** Current state first, then the target state - the order of the explorer. */
export const WEG_PROCESSES = [...WEG_AS_IS, ...WEG_TO_BE];

/* ------------------------------------------------------------ build */

const WEG_BUILD = {
  library: 'weg',
  author: 'WEG S.A. — public disclosure',
  roleName: roleLabel,
};

/** Resolves every `{ ru, en }` pair of a specification into one language. */
export function localizeSpec(spec, locale = 'ru') {
  return localizeWithRoles(spec, locale, roleLabel);
}

/** One library process -> one ready diagram placed in its WEG folder. */
export function buildWegDiagram(process, locale = 'ru') {
  return buildLibraryDiagram(process, locale, { ...WEG_BUILD, folder: wegFolder(process.variant, locale) });
}

/** Every library process as diagrams, in the documented order. */
export function buildWegDiagrams(locale = 'ru') {
  return buildLibraryDiagrams(WEG_PROCESSES, locale, WEG_BUILD, (process) => wegFolder(process.variant, locale));
}

export function wegProjectName(locale = 'ru') {
  return locale === 'en' ? 'WEG — business process library' : 'WEG — библиотека бизнес-процессов';
}

export function wegProjectDocumentation(locale = 'ru') {
  const head =
    locale === 'en'
      ? `WEG S.A. business process library — ${WEG_PROCESSES.length} BPMN 2.0 models with calculable time, resource and cost parameters.

WEG in ${WEG.year}: net revenue R$ ${(WEG.revenue / 1e9).toFixed(1)}bn, EBITDA R$ ${(WEG.ebitda / 1e9).toFixed(2)}bn, net income R$ ${(WEG.netIncome / 1e9).toFixed(2)}bn, ROIC ${(WEG.roic * 100).toFixed(1)}%, more than ${WEG.employees.toLocaleString('en-US')} employees, ${WEG.plants} plants in ${WEG.countries} countries, more than ${(WEG.motorsPerYear / 1e6).toFixed(0)} million motors a year, ${(WEG.externalShare * 100).toFixed(1)}% of revenue from outside Brazil.

Open the Analysis tab (⌥⇧A) to recalculate lead time, cost, resource demand and the bottleneck of the selected diagram; every parameter can be edited in the Properties panel and the totals follow.`
      : `Библиотека бизнес-процессов WEG S.A. — ${WEG_PROCESSES.length} моделей BPMN 2.0 с рассчитываемыми параметрами времени, ресурсов и стоимости.

WEG в ${WEG.year} году: выручка R$ ${(WEG.revenue / 1e9).toFixed(1)} млрд, EBITDA R$ ${(WEG.ebitda / 1e9).toFixed(2)} млрд, чистая прибыль R$ ${(WEG.netIncome / 1e9).toFixed(2)} млрд, ROIC ${(WEG.roic * 100).toFixed(1)} %, более ${WEG.employees.toLocaleString('ru-RU')} сотрудников, ${WEG.plants} производственных площадок в ${WEG.countries} странах, более ${(WEG.motorsPerYear / 1e6).toFixed(0)} млн двигателей в год, ${(WEG.externalShare * 100).toFixed(1)} % выручки — вне Бразилии.

Вкладка «Анализ» (⌥⇧A) пересчитывает длительность, стоимость, потребность в ресурсах и узкое место выбранной схемы; любой параметр правится в панели свойств, и итоги пересчитываются сразу.`;

  const list = WEG_PROCESSES.map((process) => `• ${pick(process.name, locale)} — ${pick(process.description, locale)}`).join('\n');
  const sources = WEG_SOURCES.map((item) => `• ${item.title[locale] || item.title.en} — ${item.url}`).join('\n');
  const sourceHead = locale === 'en' ? 'Public sources:' : 'Источники публичных данных:';
  return `${head}\n\n${list}\n\n${dataNote(locale)}\n\n${sourceHead}\n${sources}`;
}

/** The library as a stand-alone project - what the application opens on start. */
export function createWegProject(locale = 'ru') {
  const project = createProject({
    name: wegProjectName(locale),
    company: 'WEG S.A.',
    author: 'FiberModeler',
    description:
      locale === 'en'
        ? 'Eight BPMN 2.0 models of WEG main business processes with calculable parameters.'
        : 'Восемь моделей BPMN 2.0 по основным бизнес-процессам WEG с рассчитываемыми параметрами.',
  });
  project.documentation = wegProjectDocumentation(locale);
  project.diagrams = buildWegDiagrams(locale);
  return project;
}

/** Adds the library to an existing project, replacing an older copy of it. */
export function addWegLibrary(project, locale = 'ru') {
  const kept = project.diagrams.filter((diagram) => diagram.meta?.library !== 'weg');
  project.diagrams = [...kept, ...buildWegDiagrams(locale)];
  return project;
}
