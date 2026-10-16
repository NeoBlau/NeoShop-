/**
 * Technology classes of the automation course (lecture 5) and the few extra
 * labels the worksheets need. A step may combine classes: that is what the
 * lecture calls hyperautomation.
 */
export const TECHS = {
  RPA: { ru: 'RPA', en: 'RPA' },
  BPM: { ru: 'BPM', en: 'BPM' },
  CRM: { ru: 'CRM', en: 'CRM' },
  ERP: { ru: 'ERP', en: 'ERP' },
  IDP: { ru: 'AI: IDP (чтение документов)', en: 'AI: IDP (document reading)' },
  PRED: { ru: 'AI: предиктивная аналитика', en: 'AI: predictive analytics' },
  BOT: { ru: 'AI: чат-бот или виртуальный агент', en: 'AI: chatbot or virtual agent' },
  API: { ru: 'Интеграция по API или EDI', en: 'API or EDI integration' },
  DASH: { ru: 'Дашборд KPI', en: 'KPI dashboard' },
  EQUIP: { ru: 'Оборудование (вне четырёх классов ПО)', en: 'Equipment (outside the four software classes)' },
  NONE: { ru: 'Не автоматизировать', en: 'Do not automate' },
};

export const RISK_TYPES = {
  org: { ru: 'Организационный', en: 'Organisational' },
  tech: { ru: 'Технологический', en: 'Technological' },
  mess: { ru: '«Бардак»: шаг ещё не оптимизирован', en: '"Mess": the step is not optimised yet' },
};

export function techLabel(codes, locale) {
  return codes.map((code) => (TECHS[code] || { ru: code, en: code })[locale] || code).join(' + ');
}
