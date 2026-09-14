/**
 * Demo project offered on the first run: one BPMN process with swimlanes and
 * one IDEF0 model with its decomposition, so every feature has something to
 * work on immediately.
 */
import { createProject } from './core/model.js';
import { buildDiagrams } from './ai/schema.js';
import { BPMN_TEMPLATES } from './notations/bpmn/templates.js';
import { IDEF0_TEMPLATES } from './notations/idef0/templates.js';
import { localName } from './notations/index.js';

export function createDemoProject(locale = 'ru') {
  const project = createProject({
    name: locale === 'ru' ? 'Демо-проект FiberModeler' : 'FiberModeler demo project',
    author: 'FiberModeler',
    description:
      locale === 'ru'
        ? 'Показывает возможности редактора: BPMN-процесс с дорожками и модель IDEF0 с декомпозицией.'
        : 'Shows what the editor can do: a BPMN process with lanes and an IDEF0 model with a decomposition.',
  });
  project.documentation =
    locale === 'ru'
      ? 'Демонстрационный проект.\n\n• BPMN «Обработка заказа» — процесс интернет-магазина с тремя дорожками.\n• IDEF0 «Управление заказом» — контекстная диаграмма A-0 и декомпозиция A0.\n\nМеняйте всё свободно: это обычный проект.'
      : 'Demo project.\n\n• BPMN “Order processing” — an online shop process with three lanes.\n• IDEF0 “Order management” — context diagram A-0 and its decomposition A0.\n\nEdit everything freely: it is an ordinary project.';

  const bpmnTemplate = BPMN_TEMPLATES.find((item) => item.id === 'order');
  const idef0Template = IDEF0_TEMPLATES.find((item) => item.id === 'order');

  for (const diagram of buildDiagrams(bpmnTemplate.spec, { locale, name: localName(bpmnTemplate.name, locale) })) {
    diagram.meta.author = 'FiberModeler';
    diagram.meta.documentation =
      locale === 'ru'
        ? 'Процесс обработки заказа интернет-магазина. Проверьте модель (⌘⇧V), попробуйте авторасположение (L) и экспорт в PDF.'
        : 'Online shop order process. Validate it (⌘⇧V), try auto layout (L) and PDF export.';
    project.diagrams.push(diagram);
  }
  for (const diagram of buildDiagrams(idef0Template.spec, { locale, name: localName(idef0Template.name, locale) })) {
    diagram.meta.author = 'FiberModeler';
    project.diagrams.push(diagram);
  }
  return project;
}
