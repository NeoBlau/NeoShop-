/**
 * Public facts about WEG S.A. used by the process library.
 *
 * Everything here comes from WEG's own disclosure (2025 Integrated Annual
 * Report, FY2025 results release, investor-relations profile) or from press
 * coverage of those releases. Nothing in this file is internal company data:
 * WEG does not publish step-level cycle times, so the process parameters in
 * the models are marked as `derived` (computed from these figures) or
 * `assumption` (industry norm, meant to be calibrated by the user).
 */

export const WEG_SOURCES = [
  {
    id: 'annual2025',
    title: {
      ru: 'WEG, Интегрированный годовой отчёт за 2025 год',
      en: 'WEG, 2025 Integrated Annual Report',
    },
    url: 'https://www.weg.net/institutional/BR/en/news/corporate/weg-releases-its-2025-integrated-annual-report-and-highlights-progress-in-sustainability',
  },
  {
    id: 'profile',
    title: { ru: 'WEG, профиль компании (IR)', en: 'WEG, corporate profile (IR)' },
    url: 'https://ri.weg.net/en/weg/corporate-profile/',
  },
  {
    id: 'numbers',
    title: { ru: 'WEG в цифрах', en: 'WEG in numbers' },
    url: 'https://www.weg.net/institutional/BR/en/weg-in-numbers',
  },
  {
    id: 'fy2025',
    title: { ru: 'Результаты за 4-й квартал и 2025 год', en: 'Q4 and FY2025 results coverage' },
    url: 'https://www.infomoney.com.br/mercados/weg-wege3-resultados-quarto-trimestre-2025/',
  },
  {
    id: 'transformers',
    title: {
      ru: 'WEG инвестирует R$ 1,2 млрд в расширение производства трансформаторов',
      en: 'WEG invests R$ 1.2 billion to expand transformer capacity',
    },
    url: 'https://www.weg.net/institutional/BR/en/news/result-and-investiments/weg-announces-that-it-will-invest-r-1-2-billion-to-expand-transformer-production-capacity',
  },
  {
    id: 'generators',
    title: {
      ru: 'WEG инвестирует US$ 165 млн в производство генераторов в Северной Америке',
      en: 'WEG invests US$ 165 million in North American generator capacity',
    },
    url: 'https://www.weg.net/institutional/BR/en/news/corporate/crescimento-no-exterior',
  },
  {
    id: 'verticalization',
    title: {
      ru: 'WEG вложит около R$ 670 млн в вертикальную интеграцию в Мексике и Бразилии',
      en: 'WEG will invest about R$ 670 million in vertical integration in Mexico and Brazil',
    },
    url: 'https://www.weg.net/institutional/BR/en/news/corporate/weg-will-invest-approximately-r-670-million-in-vertical-integration-processes-in-mexico-and-brazil',
  },
  {
    id: 'production',
    title: {
      ru: 'Производственные показатели 2025: более 19 млн двигателей, 67 площадок',
      en: '2025 output: more than 19 million motors across 67 plants',
    },
    url: 'https://www.nsctotal.com.br/economia/weg-revela-numeros-da-producao-historica-que-consolida-lideranca-global-no-setor',
  },
  {
    id: 'astec',
    title: {
      ru: 'Сеть авторизованного сервиса WEG (ASTEC)',
      en: 'WEG authorised technical assistance network (ASTEC)',
    },
    url: 'https://www.weg.net/institutional/BR/en/contact/technical-support',
  },
];

/** Head-line figures of the 2025 financial year. */
export const WEG = {
  year: 2025,
  revenue: 40.8e9, // R$, net operating revenue, +7.4% YoY
  netIncome: 6.38e9, // R$, +5.5% YoY
  ebitda: 8.77e9, // R$
  q4Revenue: 10.247e9,
  q4Ebitda: 2.292e9,
  q4NetIncome: 1.588e9,
  roic: 0.325,
  externalShare: 0.595, // 59-60% of revenue from markets outside Brazil
  employees: 49000, // "more than 49,000"
  plants: 67,
  countries: 18,
  motorsPerYear: 19e6, // "more than 19 million motors"
  paintLitresPerYear: 15e6,
  rndSpend: 1.4e9, // R$
  segments: {
    industrial: 0.516, // Industrial Electro-Electronic Equipment
    gtd: 0.358, // Generation, Transmission & Distribution
    other: 0.126, // Commercial motors & appliances + paints and varnishes
  },
  investments: {
    generatorsUsd: 165e6,
    generatorsBrl: 840e6,
    generatorsPerDay2030: 50,
    transformersBrl: 1.2e9,
    verticalizationBrl: 670e6,
    capacityBrl3y: 1.2e9,
  },
  acquisition2024: { employees: 2800, plants: 10, countries: 7 },
  workingDays: 250,
  serviceNetworkBrazilTransformers: 40,
};

/** Numbers computed from the figures above - shown as "derived" in the models. */
export const DERIVED = {
  motorsPerDay: Math.round(WEG.motorsPerYear / WEG.workingDays), // 76 000
  revenuePerEmployee: Math.round(WEG.revenue / WEG.employees), // ≈ R$ 833 000
  revenuePerWorkingDay: Math.round(WEG.revenue / WEG.workingDays), // ≈ R$ 163 млн
  ebitdaMargin: Math.round((WEG.ebitda / WEG.revenue) * 1000) / 10, // 21.5 %
  rndShare: Math.round((WEG.rndSpend / WEG.revenue) * 1000) / 10, // 3.4 %
  industrialRevenue: Math.round(WEG.revenue * WEG.segments.industrial), // ≈ R$ 21.1 bn
  gtdRevenue: Math.round(WEG.revenue * WEG.segments.gtd), // ≈ R$ 14.6 bn
  externalRevenue: Math.round(WEG.revenue * WEG.externalShare), // ≈ R$ 24.3 bn
};

/**
 * Fully loaded hourly rates used by the models.
 * These are NOT published by WEG - they are conventional Brazilian industry
 * rates and are flagged as assumptions everywhere they are used.
 */
export const RATES = {
  operator: 48,
  technician: 72,
  engineer: 135,
  seniorEngineer: 190,
  planner: 95,
  buyer: 105,
  sales: 115,
  analyst: 90,
  logistics: 70,
  finance: 100,
  quality: 85,
  fieldService: 160,
  customs: 120,
};

/** English labels for the Russian role names used by the process library. */
export const ROLE_LABELS = {
  Оператор: 'Operator',
  'Оператор линии': 'Line operator',
  Намотчик: 'Winder',
  Сборщик: 'Assembler',
  Техник: 'Technician',
  'Техник-испытатель': 'Test technician',
  Инженер: 'Engineer',
  'Инженер-конструктор': 'Design engineer',
  'Ведущий инженер': 'Senior engineer',
  Планировщик: 'Planner',
  Закупщик: 'Buyer',
  'Менеджер по продажам': 'Sales manager',
  Аналитик: 'Analyst',
  Логист: 'Logistics',
  Финансы: 'Finance',
  ОТК: 'Quality',
  'Сервисный инженер': 'Field service',
  'Таможенный брокер': 'Customs broker',
  Казначейство: 'Treasury',
};

/** Role name in the requested language; unknown names are returned as they are. */
export function roleLabel(name, locale = 'ru') {
  if (!name) return name;
  if (locale !== 'en') return name;
  return ROLE_LABELS[name] || name;
}

export function roles(...names) {
  return names.map((name) => ({ id: name, name, rate: RATES[roleKey(name)] ?? 90 }));
}

const ROLE_KEYS = {
  Оператор: 'operator',
  'Оператор линии': 'operator',
  Намотчик: 'operator',
  Сборщик: 'operator',
  Техник: 'technician',
  'Техник-испытатель': 'technician',
  Инженер: 'engineer',
  'Инженер-конструктор': 'engineer',
  'Ведущий инженер': 'seniorEngineer',
  Планировщик: 'planner',
  Закупщик: 'buyer',
  'Менеджер по продажам': 'sales',
  Аналитик: 'analyst',
  Логист: 'logistics',
  Финансы: 'finance',
  ОТК: 'quality',
  'Сервисный инженер': 'fieldService',
  'Таможенный брокер': 'customs',
  Казначейство: 'finance',
  Operator: 'operator',
  Technician: 'technician',
  Engineer: 'engineer',
  'Senior engineer': 'seniorEngineer',
  Planner: 'planner',
  Buyer: 'buyer',
  'Sales manager': 'sales',
  Analyst: 'analyst',
  Logistics: 'logistics',
  Finance: 'finance',
  Quality: 'quality',
  'Field service': 'fieldService',
  'Customs broker': 'customs',
  Treasury: 'finance',
};

function roleKey(name) {
  return ROLE_KEYS[name] || 'analyst';
}

/** Renders the source list as a markdown-ish block for the documentation field. */
export function sourceBlock(ids, locale = 'ru') {
  const header = locale === 'ru' ? 'Источники публичных данных:' : 'Public sources:';
  const lines = WEG_SOURCES.filter((item) => ids.includes(item.id)).map(
    (item) => `• ${item.title[locale] || item.title.en} — ${item.url}`
  );
  return `${header}\n${lines.join('\n')}`;
}

export function dataNote(locale = 'ru') {
  return locale === 'ru'
    ? 'Обозначение источников у параметров: «публичная отчётность» — цифра взята из отчёта WEG; «расчёт из публичных данных» — получена из отчётных цифр по формуле, указанной в описании; «отраслевое допущение» — нормативная оценка, которую нужно откалибровать по собственным данным. WEG не публикует пооперационные нормативы времени, поэтому времена операций — допущения.'
    : 'Parameter source tags: “public report” — the figure comes from WEG disclosure; “derived” — computed from reported figures with the formula given in the description; “assumption” — an industry norm to calibrate with your own data. WEG does not publish step-level cycle times, so operation times are assumptions.';
}
