/**
 * Uber Eats - ordering from McDonald's in Dubai, seen from the platform.
 *
 * What this file is NOT: a set of company figures. Uber does not publish
 * step-level cycle times, courier occupancy, refund rules or per-order costs,
 * and the sandbox this library was written in had no network access to check
 * anything. Every number in the models is therefore an *assumption* made for
 * the purpose of the exercise, tagged `assumption` in the diagram, and meant to
 * be replaced with the company's own data.
 *
 * What it does hold: the structure of the process (actors, hand-offs, decision
 * points) and the local operating context that shapes it. The context items
 * below are well-known general facts about the UAE market, marked as "verify"
 * because nothing here was fetched from a source.
 */

/** Orders per year used for the annual projection (1 000 a day) - an assumption. */
export const ORDERS_PER_DAY = 1000;
export const ORDERS_PER_YEAR = ORDERS_PER_DAY * 365;

/**
 * Loaded hourly cost in AED. Assumptions, not published rates.
 * The courier rate is deliberately an *occupied-time* rate: a courier waiting
 * at the counter cannot take another order, so that time is paid for in
 * practice even when the platform pays per delivery.
 */
export const RATES = {
  support: 38,
  fraud: 52,
  courier: 24,
  settlements: 60,
};

export const ROLE_NAMES = {
  support: { ru: 'Агент поддержки', en: 'Support agent' },
  fraud: { ru: 'Аналитик антифрода', en: 'Fraud analyst' },
  courier: { ru: 'Курьер-партнёр', en: 'Courier partner' },
  settlements: { ru: 'Специалист по расчётам', en: 'Settlements specialist' },
};

/** English label of a Russian role name; unknown names pass through. */
export function roleLabel(name, locale = 'ru') {
  if (locale !== 'en') return name;
  const entry = Object.values(ROLE_NAMES).find((item) => item.ru === name);
  return entry ? entry.en : name;
}

/** Rate card for the diagram settings: `roles('support', 'courier')`. */
export function roles(...keys) {
  return keys.map((key) => ({ id: ROLE_NAMES[key].ru, name: ROLE_NAMES[key].ru, rate: RATES[key] }));
}

/** Role names as the node properties spell them (Russian is the source language). */
export const ROLE = {
  support: ROLE_NAMES.support.ru,
  fraud: ROLE_NAMES.fraud.ru,
  courier: ROLE_NAMES.courier.ru,
  settlements: ROLE_NAMES.settlements.ru,
};

/**
 * Local context that shapes the process. General knowledge, not fetched from
 * a source - hence "verify".
 */
export const CONTEXT = [
  {
    ru: 'Адреса в Дубае: в башнях и на виллах адрес состоит из пина на карте, здания, этажа и квартиры; в городе действует система адресации Makani (10-значный код здания). От точности адреса напрямую зависит время поиска входа курьером.',
    en: 'Addresses in Dubai: in towers and villas an address is a map pin plus building, floor and apartment; the city runs the Makani building-code system (a 10-digit code). The accuracy of the address directly drives how long the courier takes to find the entrance.',
  },
  {
    ru: 'Налог: VAT 5 % в ОАЭ (введён в 2018 г.) применяется к позициям заказа и к сборам платформы.',
    en: 'Tax: 5% VAT in the UAE (introduced in 2018) applies to the order items and to the platform fees.',
  },
  {
    ru: 'Оплата: помимо карты и Apple Pay в регионе заметна доля оплаты наличными курьеру. Это отдельная ветка со своим риском и учётом денег у курьера.',
    en: 'Payment: besides card and Apple Pay, cash paid to the courier remains significant in the region. It is a separate branch with its own risk and cash accounting.',
  },
  {
    ru: 'Безопасность пищи: ресторан работает под надзором муниципалитета Дубая; платформа отвечает за сохранность и своевременность доставки, а не за приготовление.',
    en: 'Food safety: the restaurant operates under Dubai Municipality supervision; the platform is responsible for the safe and timely delivery, not for the cooking.',
  },
  {
    ru: 'Курьеры: доставка на мотоциклах и автомобилях регулируется транспортным регулятором эмирата (RTA); летняя жара снижает скорость и доступность курьеров в дневные часы.',
    en: 'Couriers: motorbike and car delivery is regulated by the emirate transport authority (RTA); summer heat lowers courier speed and availability in daytime hours.',
  },
  {
    ru: 'Сезонность: в Рамадан пики спроса смещаются на время ифтара, а в дневные часы поста спрос падает.',
    en: 'Seasonality: during Ramadan demand peaks move to iftar time and drops during the fasting hours.',
  },
];

export function contextBlock(locale = 'ru') {
  const head = locale === 'ru' ? 'Контекст рынка (общеизвестное, проверьте перед использованием):' : 'Market context (general knowledge, verify before relying on it):';
  return `${head}\n${CONTEXT.map((item) => `• ${item[locale] || item.en}`).join('\n')}`;
}

export function dataNote(locale = 'ru') {
  return locale === 'ru'
    ? 'Откуда цифры. Здесь нет ни одной цифры из отчётности Uber или McDonald\'s: пооперационные нормативы, доли веток, ставки и стоимости компании не публикуют, а при подготовке модели не было доступа к сети, чтобы что-либо сверить. Поэтому ВСЕ параметры помечены как «отраслевое допущение». Они подобраны правдоподобно для городской доставки, чтобы показать механику процесса и расчёта, и должны быть заменены данными самой компании перед любым решением. Присутствие и условия работы сервиса в Дубае на текущий момент проверьте независимо.'
    : 'Where the numbers come from. There is not a single figure from Uber\'s or McDonald\'s reporting here: step-level norms, branch shares, rates and costs are not published, and no network access was available while preparing the model to check anything. Every parameter is therefore tagged "assumption". They are set plausibly for urban delivery to show the mechanics of the process and of the calculation, and must be replaced with the company\'s own data before any decision. Check independently whether and on what terms the service operates in Dubai today.';
}

/** Conventions every diagram of this library follows - printed in the documentation. */
export function conventionsBlock(locale = 'ru') {
  return locale === 'ru'
    ? `Как читать числа в этих схемах (соглашения):
• Время клиента и ресторана — это ОЖИДАНИЕ (waitTime): у платформы нет трудозатрат на то, что клиент выбирает блюда, а кухня собирает заказ. Оно входит в срок, но не в трудозатраты и не в стоимость.
• Автоматические шаги платформы не занимают людей: у них нет роли, только стоимость транзакции в AED (карта, карты и маршруты, SMS).
• Курьер — ресурс платформы: его ВРЕМЯ ЗАНЯТО, пока он едет, ждёт у стойки и ищет вход, поэтому эти шаги учитываются как трудозатраты по ставке занятого времени. Ожидание предложения заказа — не занятое время.
• Валюта — AED. Ставки — полная стоимость часа (допущение).
• Годовой объём — условные ${ORDERS_PER_DAY.toLocaleString('ru-RU')} заказов в день.
• Завершённым считается заказ, доставленный клиенту; отмены, блокировки и недоставки — нет.`
    : `How to read the numbers in these diagrams (conventions):
• Customer and restaurant time is WAITING (waitTime): the platform spends no labour while the customer chooses and the kitchen prepares. It counts toward lead time but not toward work or cost.
• Automated platform steps occupy nobody: they carry no role, only a transaction cost in AED (card, maps, SMS).
• The courier is a platform resource: their time is OCCUPIED while riding, waiting at the counter and finding the entrance, so those steps count as work at an occupied-time rate. Waiting for an order offer is not occupied time.
• Currency is AED. Rates are fully loaded hourly costs (an assumption).
• The annual volume is a notional ${ORDERS_PER_DAY.toLocaleString('en-US')} orders a day.
• An order counts as completed when it is delivered to the customer; cancellations, blocks and failed deliveries do not.`;
}
