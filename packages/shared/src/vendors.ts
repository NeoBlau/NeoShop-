/**
 * The people standing in front of the shops.
 *
 * Scripted, like the concierge, and for the same reason: a seller who
 * improvises can promise a delivery date nobody agreed to. What they add over
 * the concierge is that each one belongs to a pavilion and talks about the
 * things in it — so the answers are written per category rather than per
 * supplier, and a new supplier inherits a vendor who already knows what sort
 * of thing they sell.
 *
 * Voice is a separate concern and lives in the browser: these are the words,
 * and `apps/web/src/features/npc` decides whether they are spoken aloud.
 */

import { PRODUCT_CATEGORIES, type ProductCategory } from './domain.js';
import type { ScriptedLine, ScriptedText } from './scripted.js';

/** A vendor's lines are ordinary scripted lines; the names are kept for clarity. */
export type VendorText = ScriptedText;
export type VendorLine = ScriptedLine;

/** Questions every vendor can answer, whatever they sell. */
export const VENDOR_COMMON: readonly VendorLine[] = [
  {
    id: 'greeting',
    question: { ru: 'Здравствуйте', en: 'Hello' },
    answer: {
      ru: 'Здравствуйте. Смотрите, трогайте, включайте — всё, что стоит на подиумах, работает.',
      en: 'Hello. Look, touch, switch things on — everything on these plinths works.',
    },
    heard: ['здравствуйте', 'привет', 'добрый', 'hello', 'hi'],
  },
  {
    id: 'price',
    question: { ru: 'Сколько стоит?', en: 'How much is it?' },
    answer: {
      ru: 'Цена на табличке под каждым товаром, она же в карточке. Торга нет, скидка бывает за пройденную миссию.',
      en: 'The price is on the plate under each product and in its card. No haggling; a finished mission earns a discount.',
    },
    heard: ['сколько', 'цена', 'стоит', 'price', 'cost', 'much'],
  },
  {
    id: 'try',
    question: { ru: 'Можно посмотреть в работе?', en: 'Can I see it working?' },
    answer: {
      ru: 'Нажмите на товар — в карточке кнопки действий. А если хотите целиком, в отдельной комнате есть миссия.',
      en: 'Click the product — its card has the action buttons. For the full thing, there is a mission in its own room.',
    },
    heard: ['работе', 'показать', 'демо', 'попробовать', 'working', 'demo', 'try'],
  },
  {
    id: 'delivery',
    question: { ru: 'Как с доставкой?', en: 'What about delivery?' },
    answer: {
      ru: 'Привезём по адресу. Адрес видите только вы и администратор, в журналы он не попадает.',
      en: 'We ship to your address. Only you and an administrator see it, and it never reaches the logs.',
    },
    heard: ['доставка', 'привезёте', 'привезете', 'доставите', 'delivery', 'shipping', 'ship'],
  },
  {
    id: 'warranty',
    question: { ru: 'Что с гарантией?', en: 'What about the warranty?' },
    answer: {
      ru: 'Гарантия производителя, срок в карточке товара. Возврат — через поддержку площадки, не через меня.',
      en: "The manufacturer's warranty, with its term in the product card. Returns go through the platform, not through me.",
    },
    heard: ['гарантия', 'гарантией', 'возврат', 'warranty', 'guarantee', 'return'],
  },
  {
    id: 'who',
    question: { ru: 'Чей это магазин?', en: 'Whose shop is this?' },
    answer: {
      ru: 'Павильон нашей компании, название на вывеске. Павильон выдают после проверки, поэтому за витриной живой продавец.',
      en: 'Our pavilion — the name is on the sign. A pavilion is granted after a check, so there is a real seller behind it.',
    },
    heard: ['чей', 'магазин', 'компания', 'кто', 'whose', 'shop', 'company'],
  },
];

/** What a vendor says about the sort of thing they sell. */
export const VENDOR_BY_CATEGORY: Record<ProductCategory, VendorLine> = {
  ELECTRONICS: {
    id: 'about',
    question: { ru: 'Что у вас интересного?', en: 'What is worth a look?' },
    answer: {
      ru: 'Электроника. Смотрите на разъёмы и на то, как складывается — на фотографиях этого не видно, а здесь видно.',
      en: 'Electronics. Look at the connectors and how it folds — a photograph hides that, this does not.',
    },
    heard: ['интересного', 'ассортимент', 'товар', 'товары', 'what', 'assortment'],
  },
  HOME_APPLIANCES: {
    id: 'about',
    question: { ru: 'Что у вас интересного?', en: 'What is worth a look?' },
    answer: {
      ru: 'Бытовая техника. Главное здесь — как она ездит и открывается, а не как выглядит на коробке.',
      en: 'Home appliances. What matters is how they move and open, not how they look on the box.',
    },
    heard: ['интересного', 'ассортимент', 'товар', 'товары', 'what', 'assortment'],
  },
  FURNITURE: {
    id: 'about',
    question: { ru: 'Что у вас интересного?', en: 'What is worth a look?' },
    answer: {
      ru: 'Мебель. Разложите кресло прямо тут — механизм виден целиком, включая то, сколько места ему нужно.',
      en: 'Furniture. Recline the chair right here — you see the whole mechanism, including how much room it needs.',
    },
    heard: ['интересного', 'ассортимент', 'товар', 'товары', 'what', 'assortment'],
  },
  OUTDOOR: {
    id: 'about',
    question: { ru: 'Что у вас интересного?', en: 'What is worth a look?' },
    answer: {
      ru: 'Всё для улицы. Габариты в карточке точные — мы их не округляем в свою пользу.',
      en: 'Things for outdoors. The dimensions in the card are exact; we do not round them in our favour.',
    },
    heard: ['интересного', 'ассортимент', 'товар', 'товары', 'what', 'assortment'],
  },
  LIGHTING: {
    id: 'about',
    question: { ru: 'Что у вас интересного?', en: 'What is worth a look?' },
    answer: {
      ru: 'Свет. Наклоните плафон и посмотрите на пятно — по нему и выбирают, а не по картинке.',
      en: 'Lighting. Tilt the head and look at the pool of light — that is what you choose by, not a picture.',
    },
    heard: ['интересного', 'ассортимент', 'товар', 'товары', 'what', 'assortment'],
  },
  OTHER: {
    id: 'about',
    question: { ru: 'Что у вас интересного?', en: 'What is worth a look?' },
    answer: {
      ru: 'Всё, что не влезло в остальные полки. Спрашивайте про конкретное — расскажу.',
      en: 'Whatever did not fit the other shelves. Ask about something specific and I will tell you.',
    },
    heard: ['интересного', 'ассортимент', 'товар', 'товары', 'what', 'assortment'],
  },
};

/**
 * Names for the people behind the counters.
 *
 * A vendor with a name is somebody you asked; a vendor without one is a sign
 * that talks. The name is picked from this list by the pavilion's own id, so it
 * does not change between visits and does not have to be stored anywhere.
 */
export const VENDOR_NAMES: readonly VendorText[] = [
  { ru: 'Аня', en: 'Anya' },
  { ru: 'Марк', en: 'Mark' },
  { ru: 'Лена', en: 'Lena' },
  { ru: 'Игорь', en: 'Igor' },
  { ru: 'Даша', en: 'Dasha' },
  { ru: 'Тимур', en: 'Timur' },
  { ru: 'Вера', en: 'Vera' },
  { ru: 'Костя', en: 'Kostya' },
];

/** Which of them stands at a given pavilion. Stable for a given id. */
export function vendorName(key: string): VendorText {
  let hash = 0x811c9dc5;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  const first = VENDOR_NAMES[0] ?? { ru: 'Продавец', en: 'Vendor' };
  return VENDOR_NAMES[hash % VENDOR_NAMES.length] ?? first;
}

/**
 * Which shelf a vendor talks about, given what their supplier has out.
 *
 * The most common category on the frontage, because a vendor has one opening
 * line and it should be about the majority of what is behind them. Ties go to
 * whichever came first, which is the order the layout puts them in.
 */
export function dominantCategory(categories: readonly ProductCategory[]): ProductCategory {
  const counted = new Map<ProductCategory, number>();
  for (const category of categories) {
    counted.set(category, (counted.get(category) ?? 0) + 1);
  }

  let best: ProductCategory = 'OTHER';
  let bestCount = 0;
  for (const [category, count] of counted) {
    if (count > bestCount) {
      bestCount = count;
      best = category;
    }
  }

  return best;
}

/** The lines one vendor offers: what they sell, then the common questions. */
export function vendorLines(category: ProductCategory): VendorLine[] {
  const about = VENDOR_BY_CATEGORY[category];
  return [about, ...VENDOR_COMMON];
}

export { PRODUCT_CATEGORIES };
