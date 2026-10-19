/**
 * Alfa-Bank - consumer lending and customer service, seen from the bank.
 *
 * What this file is NOT: a set of figures from the bank's operations. Banks do
 * not publish step-level times, branch shares, rates per hour or the cost of a
 * credit-bureau request, so every number inside the process model is an
 * *assumption*, tagged `assumption` in the diagram and meant to be replaced with
 * the bank's own data.
 *
 * What it does hold: the structure of the process as it is publicly described
 * (an online application, an automated decision, a manager's call, documents for
 * larger amounts, signing, disbursement) and a few public figures about the bank.
 * Everything below was read from search results on 19 October 2026; the bank's
 * own site could not be opened from the sandbox, so each item says where it
 * comes from and is marked "verify".
 */

/** Applications a year used for the annual projection - a notional volume, not the bank's. */
export const APPLICATIONS_PER_YEAR = 1_000_000;

/** Loaded hourly cost in RUB. Assumptions, not published rates. */
export const RATES = {
  manager: 750,
  underwriter: 1200,
  security: 1100,
  operations: 650,
  contact: 480,
  collections: 700,
};

export const ROLE_NAMES = {
  manager: { ru: 'Клиентский менеджер', en: 'Client manager' },
  underwriter: { ru: 'Кредитный андеррайтер', en: 'Credit underwriter' },
  security: { ru: 'Специалист службы безопасности', en: 'Security specialist' },
  operations: { ru: 'Операционист', en: 'Operations officer' },
  contact: { ru: 'Оператор контакт-центра', en: 'Contact-centre agent' },
  collections: { ru: 'Специалист по работе с просрочкой', en: 'Collections specialist' },
};

export function roleLabel(name, locale = 'ru') {
  if (locale !== 'en') return name;
  const entry = Object.values(ROLE_NAMES).find((item) => item.ru === name);
  return entry ? entry.en : name;
}

export function roles(...keys) {
  return keys.map((key) => ({ id: ROLE_NAMES[key].ru, name: ROLE_NAMES[key].ru, rate: RATES[key] }));
}

export const ROLE = Object.fromEntries(Object.entries(ROLE_NAMES).map(([key, value]) => [key, value.ru]));

/** Public sources the documentation cites. All of them are pages found by a web search, none was opened on the bank's own site. */
export const SOURCES = [
  {
    id: 'release2024',
    title: { ru: 'Альфа-Банк: чистая прибыль 205,3 млрд рублей по итогам 2024 года (пресс-релиз банка)', en: 'Alfa-Bank: net profit of RUB 205.3bn for 2024 (the bank\'s press release)' },
    url: 'https://alfabank.ru/news/t/release/alfa-bank-poluchil-2053-mlrd-rublei-chistoi-pribili-po-itogam-2024-goda/',
  },
  {
    id: 'cashLoan',
    title: { ru: 'Кредиты наличными в Альфа-Банке (сторонний сайт-агрегатор)', en: 'Cash loans at Alfa-Bank (a third-party aggregator site)' },
    url: 'https://brobank.ru/banki/alfabank/credits/nalichnymi/',
  },
  {
    id: 'cashLoan2',
    title: { ru: 'Альфа-Банк: выдача кредита наличными (сторонний сайт-агрегатор)', en: 'Alfa-Bank: cash loan issue (a third-party aggregator site)' },
    url: 'https://pampadu.ru/affiliate-program/cash-loan/al-fa-bank-pk-vydacha-ru/',
  },
];

/** Context items: what was read, from where, and how far to trust it. */
export const CONTEXT = [
  {
    ru: 'Масштаб банка (по пресс-релизу банка за 2024 год, как его пересказала поисковая выдача; страницу релиза открыть не удалось): чистая прибыль по РСБУ 205,3 млрд рублей, +70 % к 2023 году; портфель розничных кредитов вырос на 29 % за год; число розничных клиентов впервые превысило 37 млн.',
    en: 'The bank\'s scale (from the bank\'s 2024 press release as summarised by a search result; the release page itself could not be opened): net profit under Russian accounting standards RUB 205.3bn, +70% on 2023; the retail loan portfolio grew 29% over the year; the number of retail clients passed 37 million for the first time.',
  },
  {
    ru: 'Как описывают оформление кредита наличными (сторонние сайты-агрегаторы, не сайт банка): онлайн-заявка с личными данными и телефоном; решение приходит в смс, по этим описаниям — от двух минут; при одобрении звонит менеджер и называет сумму и ставку; до 300 тыс. рублей достаточно паспорта, для больших сумм нужна справка о доходах (2-НДФЛ или по форме банка); кредитуются граждане РФ от 21 года.',
    en: 'How cash-loan origination is described (third-party aggregator sites, not the bank\'s site): an online application with personal data and a phone number; the decision comes by SMS, from two minutes according to these descriptions; on approval a manager calls and states the amount and the rate; up to RUB 300k a passport is enough, for larger amounts an income certificate (2-NDFL or on the bank\'s form) is needed; Russian citizens aged 21 and over are lent to.',
  },
  {
    ru: 'Условия (сумма, срок, ставка) в источниках противоречат друг другу, поэтому в модель они не вошли: итоговую ставку банк определяет после рассмотрения заявки.',
    en: 'The terms (amount, maturity, rate) contradict each other across the sources, so they are not in the model: the bank sets the final rate after reviewing the application.',
  },
];

export function sourceList(locale = 'ru') {
  return SOURCES.map((item) => `• ${item.title[locale] || item.title.en} — ${item.url}`).join('\n');
}

export function contextBlock(locale = 'ru') {
  const head = locale === 'ru' ? 'Что известно публично (проверьте перед использованием):' : 'What is publicly known (verify before relying on it):';
  const sources = locale === 'ru' ? 'Источники:' : 'Sources:';
  return `${head}\n${CONTEXT.map((item) => `• ${item[locale] || item.en}`).join('\n')}\n\n${sources}\n${sourceList(locale)}`;
}

export function dataNote(locale = 'ru') {
  return locale === 'ru'
    ? 'Откуда цифры. Ни одна цифра внутри схемы не взята из отчётности или внутренних данных Альфа-Банка: время шагов, доли веток, ставки за час и стоимость запросов банки не публикуют, поэтому все параметры помечены «отраслевое допущение» и должны быть заменены данными банка. Публично известны только масштаб банка и общий порядок оформления кредита, они приведены в конце описания с источниками. Годовой объём (1 млн заявок) — условный, не объём банка.'
    : 'Where the numbers come from. Not one figure inside the diagram comes from Alfa-Bank\'s reporting or internal data: step times, branch shares, hourly rates and the cost of a request are not published by banks, so every parameter is tagged "industry assumption" and should be replaced with the bank\'s own data. Only the bank\'s scale and the general order of loan origination are public; they are listed at the end of the description with their sources. The annual volume (1 million applications) is notional, not the bank\'s.';
}

export function conventionsBlock(locale = 'ru') {
  return locale === 'ru'
    ? `Как читать числа в схеме (соглашения):
• Время клиента — это ОЖИДАНИЕ (waitTime): оно входит в срок, но не в трудозатраты и стоимость банка.
• Автоматические шаги банка не занимают людей: у них нет роли, только стоимость операции в рублях (запрос в бюро кредитных историй, проверка паспорта, смс).
• Люди (менеджер, андеррайтер, служба безопасности, операционист, контакт-центр, взыскание) — шаги с ролью и ставкой полной стоимости часа (допущение).
• Валюта — рубли. Годовой объём — условный ${APPLICATIONS_PER_YEAR.toLocaleString('ru-RU')} заявок в год.
• Завершённой считается заявка, по которой кредит выдан и клиент обслужен; отказы, прекращённые заявки и отказ клиента — нет.`
    : `How to read the numbers in the diagram (conventions):
• Customer time is WAITING (waitTime): it counts toward lead time but not toward the bank's work or cost.
• Automated bank steps occupy nobody: they carry no role, only a transaction cost in roubles (a credit-bureau request, a passport check, an SMS).
• People (manager, underwriter, security, operations, contact centre, collections) are steps with a role and a fully loaded hourly rate (an assumption).
• Currency is the rouble. The annual volume is a notional ${APPLICATIONS_PER_YEAR.toLocaleString('en-US')} applications a year.
• An application counts as completed when the loan is disbursed and the customer is served; rejections, abandoned applications and the customer's refusal do not.`;
}
