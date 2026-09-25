/**
 * The fast-food counter at the end of the street.
 *
 * Its shape is deliberately the shape of a real Italian fast-food menu —
 * panini, full menus with a side and a drink, chicken and fish, fries and
 * snacks, salads, café and desserts, a children's menu, drinks, sauces —
 * because that is the ordering flow buyers already know how to use. The brand
 * is ours: names, prices and photography are the project's own, so nothing
 * here borrows a trademark it has no right to. BRAND below is the only place
 * that decides what the counter is called.
 *
 * Prices are euro cents. Text carries its three languages with it rather than
 * living in the dictionaries: forty items times three fields is data, and data
 * belongs in one place next to the thing it describes.
 */

export const BRAND = {
  /** Shown on the stand, the tab and the receipt. */
  name: 'Neo Burger',
  tagline: {
    it: 'Dal 1998, su questa strada',
    ru: 'С 1998 года на этой улице',
    en: 'On this street since 1998',
  },
  /** Minutes the kitchen needs before a courier can take the bag. */
  kitchenMinutes: 7,
  deliveryFeeCents: 190,
  freeDeliveryFromCents: 2500,
  currency: 'EUR',
} as const;

export type FoodLocale = 'it' | 'ru' | 'en';

export interface FoodText {
  it: string;
  ru: string;
  en: string;
}

export const FOOD_CATEGORIES = [
  'panini',
  'menu',
  'pollo',
  'patatine',
  'insalate',
  'caffe',
  'bimbi',
  'bevande',
  'salse',
] as const;
export type FoodCategoryId = (typeof FOOD_CATEGORIES)[number];

export interface FoodCategory {
  id: FoodCategoryId;
  name: FoodText;
  /** One line under the heading, the way a menu board reads. */
  note: FoodText;
}

export const CATEGORIES: readonly FoodCategory[] = [
  {
    id: 'menu',
    name: { it: 'Menu completi', ru: 'Полные меню', en: 'Full menus' },
    note: {
      it: 'Panino, patatine e bevanda. Scegli la taglia.',
      ru: 'Панини, картошка и напиток. Размер на выбор.',
      en: 'A panino, fries and a drink. Pick the size.',
    },
  },
  {
    id: 'panini',
    name: { it: 'Panini', ru: 'Панини', en: 'Panini' },
    note: {
      it: 'Carne di manzo cotta alla piastra, pane tostato.',
      ru: 'Говядина на гриле, поджаренная булочка.',
      en: 'Beef off the grill, bun toasted to order.',
    },
  },
  {
    id: 'pollo',
    name: { it: 'Pollo e pesce', ru: 'Курица и рыба', en: 'Chicken and fish' },
    note: {
      it: 'Filetti impanati e fritti al momento.',
      ru: 'Филе в панировке, обжаривается при заказе.',
      en: 'Breaded fillets, fried to order.',
    },
  },
  {
    id: 'patatine',
    name: { it: 'Patatine e snack', ru: 'Картошка и снеки', en: 'Fries and snacks' },
    note: {
      it: 'Tagliate ogni mattina, fritte due volte.',
      ru: 'Нарезаем утром, обжариваем дважды.',
      en: 'Cut each morning, fried twice.',
    },
  },
  {
    id: 'insalate',
    name: { it: 'Insalate', ru: 'Салаты', en: 'Salads' },
    note: {
      it: 'Verdure dal mercato, condimento a parte.',
      ru: 'Овощи с рынка, соус отдельно.',
      en: 'Vegetables from the market, dressing on the side.',
    },
  },
  {
    id: 'caffe',
    name: { it: 'Caffè e dolci', ru: 'Кафе и десерты', en: 'Café and desserts' },
    note: {
      it: 'Espresso vero, non da distributore.',
      ru: 'Настоящий эспрессо, не из автомата.',
      en: 'Real espresso, not from a machine in the corner.',
    },
  },
  {
    id: 'bimbi',
    name: { it: 'Menu bimbi', ru: 'Детское меню', en: "Children's menu" },
    note: {
      it: 'Porzione piccola, frutta invece delle patatine se vuoi.',
      ru: 'Маленькая порция, фрукты вместо картошки по желанию.',
      en: 'A small portion, fruit instead of fries if you like.',
    },
  },
  {
    id: 'bevande',
    name: { it: 'Bevande', ru: 'Напитки', en: 'Drinks' },
    note: {
      it: 'Alla spina, ghiaccio a richiesta.',
      ru: 'Разливные, лёд по желанию.',
      en: 'On tap, ice if you want it.',
    },
  },
  {
    id: 'salse',
    name: { it: 'Salse', ru: 'Соусы', en: 'Sauces' },
    note: {
      it: 'Le prime due sono incluse nel menu.',
      ru: 'Первые два соуса входят в меню.',
      en: 'The first two come with a full menu.',
    },
  },
];

export type FoodBadge = 'new' | 'spicy' | 'veg' | 'popular';

export interface FoodSize {
  id: 'S' | 'M' | 'L';
  name: FoodText;
  /** Added to the item's base price. */
  deltaCents: number;
  /** Added to the item's base energy. */
  deltaKcal: number;
}

export const SIZES: readonly FoodSize[] = [
  { id: 'S', name: { it: 'Piccola', ru: 'Маленькая', en: 'Small' }, deltaCents: 0, deltaKcal: 0 },
  { id: 'M', name: { it: 'Media', ru: 'Средняя', en: 'Medium' }, deltaCents: 60, deltaKcal: 110 },
  { id: 'L', name: { it: 'Grande', ru: 'Большая', en: 'Large' }, deltaCents: 110, deltaKcal: 220 },
];

export interface FoodItem {
  id: string;
  category: FoodCategoryId;
  name: FoodText;
  note: FoodText;
  /** À la carte price, in euro cents, for the smallest size. */
  priceCents: number;
  kcal: number;
  badges?: readonly FoodBadge[];
  /** Present when the item comes in sizes. */
  sized?: boolean;
  /** Ids of items that may be added to this one. */
  extras?: readonly string[];
  /**
   * A full menu: one panino, one side and one drink. Priced as its own item,
   * below the sum of the three, which is the whole point of a combo.
   */
  combo?: { panino: string; side: string; drink: string };
  /** What the photo fetcher searches for. Kept with the item so the two cannot drift. */
  photoQuery: string;
}

export const ITEMS: readonly FoodItem[] = [
  // ── Panini ────────────────────────────────────────────────────────────────
  {
    id: 'neo-classic',
    category: 'panini',
    name: { it: 'Neo Classic', ru: 'Neo Classic', en: 'Neo Classic' },
    note: {
      it: 'Manzo, cetriolo, cipolla, senape, ketchup.',
      ru: 'Говядина, огурец, лук, горчица, кетчуп.',
      en: 'Beef, pickle, onion, mustard, ketchup.',
    },
    priceCents: 290,
    kcal: 490,
    extras: ['extra-cheese', 'extra-bacon', 'extra-patty'],
    photoQuery: 'classic hamburger',
  },
  {
    id: 'neo-double',
    category: 'panini',
    name: { it: 'Neo Double', ru: 'Neo Double', en: 'Neo Double' },
    note: {
      it: 'Due hamburger, doppio cheddar, salsa affumicata.',
      ru: 'Две котлеты, двойной чеддер, копчёный соус.',
      en: 'Two patties, double cheddar, smoked sauce.',
    },
    priceCents: 620,
    kcal: 780,
    badges: ['popular'],
    extras: ['extra-cheese', 'extra-bacon'],
    photoQuery: 'double cheeseburger',
  },
  {
    id: 'neo-bacon',
    category: 'panini',
    name: { it: 'Gran Bacon', ru: 'Гран Бекон', en: 'Gran Bacon' },
    note: {
      it: 'Pancetta croccante, cheddar fuso, cipolla caramellata.',
      ru: 'Хрустящий бекон, плавленый чеддер, карамелизованный лук.',
      en: 'Crisp bacon, melted cheddar, caramelised onion.',
    },
    priceCents: 690,
    kcal: 820,
    extras: ['extra-cheese', 'extra-patty'],
    photoQuery: 'bacon cheeseburger',
  },
  {
    id: 'neo-spicy',
    category: 'panini',
    name: { it: 'Diavola', ru: 'Дьявола', en: 'Diavola' },
    note: {
      it: 'Manzo, jalapeño, salsa piccante calabrese.',
      ru: 'Говядина, халапеньо, острый калабрийский соус.',
      en: 'Beef, jalapeño, hot Calabrian sauce.',
    },
    priceCents: 650,
    kcal: 750,
    badges: ['spicy', 'new'],
    extras: ['extra-cheese', 'extra-bacon'],
    photoQuery: 'spicy burger jalapeno',
  },
  {
    id: 'neo-veg',
    category: 'panini',
    name: { it: 'Orto', ru: 'Орто', en: 'Orto' },
    note: {
      it: 'Burger di ceci e spinaci, yogurt e limone.',
      ru: 'Котлета из нута со шпинатом, йогурт и лимон.',
      en: 'Chickpea and spinach patty, yoghurt and lemon.',
    },
    priceCents: 570,
    kcal: 520,
    badges: ['veg'],
    photoQuery: 'veggie burger',
  },

  // ── Chicken and fish ──────────────────────────────────────────────────────
  {
    id: 'crispy-chicken',
    category: 'pollo',
    name: { it: 'Crispy Pollo', ru: 'Криспи Курица', en: 'Crispy Chicken' },
    note: {
      it: 'Filetto impanato, insalata, maionese all’aglio.',
      ru: 'Филе в панировке, салат, чесночный майонез.',
      en: 'Breaded fillet, lettuce, garlic mayonnaise.',
    },
    priceCents: 590,
    kcal: 640,
    badges: ['popular'],
    photoQuery: 'crispy chicken sandwich',
  },
  {
    id: 'chicken-wrap',
    category: 'pollo',
    name: { it: 'Wrap Pollo', ru: 'Ролл с курицей', en: 'Chicken wrap' },
    note: {
      it: 'Piadina, pollo grigliato, verdure, salsa allo yogurt.',
      ru: 'Лепёшка, курица на гриле, овощи, йогуртовый соус.',
      en: 'Flatbread, grilled chicken, vegetables, yoghurt sauce.',
    },
    priceCents: 520,
    kcal: 480,
    photoQuery: 'chicken wrap',
  },
  {
    id: 'nuggets-6',
    category: 'pollo',
    name: { it: 'Bocconcini 6 pezzi', ru: 'Наггетсы 6 штук', en: 'Nuggets, 6 pieces' },
    note: {
      it: 'Petto di pollo, panatura leggera.',
      ru: 'Куриная грудка в лёгкой панировке.',
      en: 'Chicken breast in a light coating.',
    },
    priceCents: 390,
    kcal: 280,
    extras: ['sauce-bbq', 'sauce-curry'],
    photoQuery: 'chicken nuggets',
  },
  {
    id: 'fish-panino',
    category: 'pollo',
    name: { it: 'Panino di pesce', ru: 'Панини с рыбой', en: 'Fish panino' },
    note: {
      it: 'Merluzzo, salsa tartara, pane ai semi.',
      ru: 'Треска, соус тартар, булочка с семечками.',
      en: 'Cod, tartare sauce, seeded bun.',
    },
    priceCents: 540,
    kcal: 510,
    photoQuery: 'fish burger sandwich',
  },

  // ── Fries and snacks ──────────────────────────────────────────────────────
  {
    id: 'patatine',
    category: 'patatine',
    name: { it: 'Patatine', ru: 'Картошка фри', en: 'Fries' },
    note: {
      it: 'Sale grosso, fritte due volte.',
      ru: 'Крупная соль, двойная обжарка.',
      en: 'Coarse salt, fried twice.',
    },
    priceCents: 240,
    kcal: 320,
    sized: true,
    badges: ['popular'],
    photoQuery: 'french fries',
  },
  {
    id: 'patatine-cheese',
    category: 'patatine',
    name: { it: 'Patatine al cheddar', ru: 'Картошка с чеддером', en: 'Cheddar fries' },
    note: {
      it: 'Cheddar fuso e pancetta croccante.',
      ru: 'Плавленый чеддер и хрустящий бекон.',
      en: 'Melted cheddar and crisp bacon.',
    },
    priceCents: 350,
    kcal: 520,
    sized: true,
    photoQuery: 'cheese fries bacon',
  },
  {
    id: 'anelli-cipolla',
    category: 'patatine',
    name: { it: 'Anelli di cipolla', ru: 'Луковые кольца', en: 'Onion rings' },
    note: {
      it: 'Otto anelli, panatura alla birra.',
      ru: 'Восемь колец в пивном кляре.',
      en: 'Eight rings in beer batter.',
    },
    priceCents: 330,
    kcal: 410,
    photoQuery: 'onion rings',
  },
  {
    id: 'mozzarelline',
    category: 'patatine',
    name: { it: 'Mozzarelline', ru: 'Моцарелла палочки', en: 'Mozzarella sticks' },
    note: {
      it: 'Sei pezzi, salsa al pomodoro.',
      ru: 'Шесть штук, томатный соус.',
      en: 'Six pieces, tomato sauce.',
    },
    priceCents: 420,
    kcal: 460,
    badges: ['veg'],
    photoQuery: 'mozzarella sticks',
  },

  // ── Salads ────────────────────────────────────────────────────────────────
  {
    id: 'insalata-pollo',
    category: 'insalate',
    name: { it: 'Insalata con pollo', ru: 'Салат с курицей', en: 'Chicken salad' },
    note: {
      it: 'Pollo grigliato, pomodorini, grana.',
      ru: 'Курица на гриле, черри, грана.',
      en: 'Grilled chicken, cherry tomatoes, grana.',
    },
    priceCents: 590,
    kcal: 320,
    photoQuery: 'grilled chicken salad bowl',
  },
  {
    id: 'insalata-orto',
    category: 'insalate',
    name: { it: 'Insalata dell’orto', ru: 'Овощной салат', en: 'Garden salad' },
    note: {
      it: 'Misticanza, carote, ceci, semi di zucca.',
      ru: 'Микс салатов, морковь, нут, тыквенные семечки.',
      en: 'Leaves, carrot, chickpeas, pumpkin seeds.',
    },
    priceCents: 450,
    kcal: 210,
    badges: ['veg'],
    photoQuery: 'green garden salad',
  },

  // ── Café and desserts ─────────────────────────────────────────────────────
  {
    id: 'espresso',
    category: 'caffe',
    name: { it: 'Espresso', ru: 'Эспрессо', en: 'Espresso' },
    note: {
      it: 'Miscela italiana, 25 ml.',
      ru: 'Итальянская смесь, 25 мл.',
      en: 'Italian blend, 25 ml.',
    },
    priceCents: 110,
    kcal: 2,
    photoQuery: 'espresso cup',
  },
  {
    id: 'cappuccino',
    category: 'caffe',
    name: { it: 'Cappuccino', ru: 'Капучино', en: 'Cappuccino' },
    note: {
      it: 'Latte montato a mano.',
      ru: 'Молоко взбито вручную.',
      en: 'Milk steamed by hand.',
    },
    priceCents: 180,
    kcal: 120,
    badges: ['popular'],
    photoQuery: 'cappuccino latte art',
  },
  {
    id: 'cornetto',
    category: 'caffe',
    name: { it: 'Cornetto', ru: 'Корнетто', en: 'Cornetto' },
    note: {
      it: 'Sfogliato, crema o vuoto.',
      ru: 'Слоёный, с кремом или пустой.',
      en: 'Flaky, with cream or plain.',
    },
    priceCents: 170,
    kcal: 280,
    photoQuery: 'croissant pastry',
  },
  {
    id: 'gelato',
    category: 'caffe',
    name: { it: 'Gelato', ru: 'Мороженое', en: 'Ice cream' },
    note: {
      it: 'Fiordilatte, cioccolato o pistacchio.',
      ru: 'Сливочное, шоколад или фисташка.',
      en: 'Cream, chocolate or pistachio.',
    },
    priceCents: 250,
    kcal: 310,
    photoQuery: 'ice cream cone',
  },
  {
    id: 'muffin',
    category: 'caffe',
    name: { it: 'Muffin al cioccolato', ru: 'Шоколадный маффин', en: 'Chocolate muffin' },
    note: { it: 'Cuore fondente.', ru: 'С растопленной начинкой.', en: 'Molten middle.' },
    priceCents: 220,
    kcal: 390,
    photoQuery: 'chocolate muffin',
  },

  // ── Children ──────────────────────────────────────────────────────────────
  {
    id: 'bimbi-burger',
    category: 'bimbi',
    name: { it: 'Menu bimbi, panino', ru: 'Детское меню, панини', en: "Children's menu, panino" },
    note: {
      it: 'Hamburger piccolo, patatine piccole, succo, gioco.',
      ru: 'Маленький бургер, маленькая картошка, сок, игрушка.',
      en: 'Small burger, small fries, juice, a toy.',
    },
    priceCents: 490,
    kcal: 520,
    photoQuery: 'kids meal burger fries',
  },
  {
    id: 'bimbi-nuggets',
    category: 'bimbi',
    name: {
      it: 'Menu bimbi, bocconcini',
      ru: 'Детское меню, наггетсы',
      en: "Children's menu, nuggets",
    },
    note: {
      it: 'Quattro bocconcini, frutta, succo, gioco.',
      ru: 'Четыре наггетса, фрукты, сок, игрушка.',
      en: 'Four nuggets, fruit, juice, a toy.',
    },
    priceCents: 490,
    kcal: 420,
    photoQuery: 'chicken nuggets plate',
  },

  // ── Drinks ────────────────────────────────────────────────────────────────
  {
    id: 'cola',
    category: 'bevande',
    name: { it: 'Cola', ru: 'Кола', en: 'Cola' },
    note: {
      it: 'Alla spina, ghiaccio a richiesta.',
      ru: 'Разливная, лёд по желанию.',
      en: 'On tap, ice on request.',
    },
    priceCents: 210,
    kcal: 180,
    sized: true,
    photoQuery: 'cola glass ice',
  },
  {
    id: 'aranciata',
    category: 'bevande',
    name: { it: 'Aranciata', ru: 'Апельсиновая', en: 'Orangeade' },
    note: {
      it: 'Arance siciliane, 12%.',
      ru: 'Сицилийские апельсины, 12%.',
      en: 'Sicilian oranges, 12%.',
    },
    priceCents: 210,
    kcal: 150,
    sized: true,
    photoQuery: 'orange soda glass',
  },
  {
    id: 'acqua',
    category: 'bevande',
    name: { it: 'Acqua', ru: 'Вода', en: 'Water' },
    note: {
      it: 'Naturale o frizzante, 0,5 l.',
      ru: 'Без газа или с газом, 0,5 л.',
      en: 'Still or sparkling, 0.5 l.',
    },
    priceCents: 120,
    kcal: 0,
    photoQuery: 'water bottle glass',
  },
  {
    id: 'milkshake',
    category: 'bevande',
    name: { it: 'Milkshake', ru: 'Милкшейк', en: 'Milkshake' },
    note: {
      it: 'Vaniglia, fragola o cioccolato.',
      ru: 'Ваниль, земляника или шоколад.',
      en: 'Vanilla, strawberry or chocolate.',
    },
    priceCents: 320,
    kcal: 430,
    sized: true,
    badges: ['popular'],
    photoQuery: 'milkshake glass straw',
  },
  {
    id: 'succo',
    category: 'bevande',
    name: { it: 'Succo di mela', ru: 'Яблочный сок', en: 'Apple juice' },
    note: { it: 'Senza zuccheri aggiunti.', ru: 'Без добавленного сахара.', en: 'No added sugar.' },
    priceCents: 160,
    kcal: 110,
    photoQuery: 'apple juice glass',
  },

  // ── Sauces and extras ─────────────────────────────────────────────────────
  {
    id: 'sauce-bbq',
    category: 'salse',
    name: { it: 'Salsa barbecue', ru: 'Соус барбекю', en: 'Barbecue sauce' },
    note: { it: '25 g.', ru: '25 г.', en: '25 g.' },
    priceCents: 50,
    kcal: 45,
    photoQuery: 'barbecue sauce dip',
  },
  {
    id: 'sauce-curry',
    category: 'salse',
    name: { it: 'Salsa curry', ru: 'Соус карри', en: 'Curry sauce' },
    note: { it: '25 g.', ru: '25 г.', en: '25 g.' },
    priceCents: 50,
    kcal: 40,
    photoQuery: 'curry sauce dip',
  },
  {
    id: 'sauce-aioli',
    category: 'salse',
    name: { it: 'Salsa aioli', ru: 'Соус айоли', en: 'Aioli' },
    note: { it: '25 g, aglio.', ru: '25 г, чеснок.', en: '25 g, garlic.' },
    priceCents: 50,
    kcal: 90,
    photoQuery: 'garlic aioli dip',
  },
  {
    id: 'extra-cheese',
    category: 'salse',
    name: { it: 'Cheddar in più', ru: 'Дополнительный чеддер', en: 'Extra cheddar' },
    note: { it: 'Una fetta.', ru: 'Один ломтик.', en: 'One slice.' },
    priceCents: 70,
    kcal: 80,
    photoQuery: 'cheddar cheese slice',
  },
  {
    id: 'extra-bacon',
    category: 'salse',
    name: { it: 'Pancetta in più', ru: 'Дополнительный бекон', en: 'Extra bacon' },
    note: { it: 'Due strisce.', ru: 'Две полоски.', en: 'Two strips.' },
    priceCents: 110,
    kcal: 120,
    photoQuery: 'crispy bacon strips',
  },
  {
    id: 'extra-patty',
    category: 'salse',
    name: { it: 'Hamburger in più', ru: 'Дополнительная котлета', en: 'Extra patty' },
    note: { it: '100 g di manzo.', ru: '100 г говядины.', en: '100 g of beef.' },
    priceCents: 220,
    kcal: 260,
    photoQuery: 'beef patty grill',
  },

  // ── Full menus ────────────────────────────────────────────────────────────
  {
    id: 'menu-classic',
    category: 'menu',
    name: { it: 'Menu Neo Classic', ru: 'Меню Neo Classic', en: 'Neo Classic menu' },
    note: {
      it: 'Neo Classic, patatine e bevanda.',
      ru: 'Neo Classic, картошка и напиток.',
      en: 'Neo Classic, fries and a drink.',
    },
    priceCents: 640,
    kcal: 990,
    sized: true,
    combo: { panino: 'neo-classic', side: 'patatine', drink: 'cola' },
    photoQuery: 'hamburger and fries',
  },
  {
    id: 'menu-double',
    category: 'menu',
    name: { it: 'Menu Neo Double', ru: 'Меню Neo Double', en: 'Neo Double menu' },
    note: {
      it: 'Neo Double, patatine e bevanda.',
      ru: 'Neo Double, картошка и напиток.',
      en: 'Neo Double, fries and a drink.',
    },
    priceCents: 940,
    kcal: 1280,
    sized: true,
    badges: ['popular'],
    combo: { panino: 'neo-double', side: 'patatine', drink: 'cola' },
    photoQuery: 'burger meal fries',
  },
  {
    id: 'menu-bacon',
    category: 'menu',
    name: { it: 'Menu Gran Bacon', ru: 'Меню Гран Бекон', en: 'Gran Bacon menu' },
    note: {
      it: 'Gran Bacon, patatine e bevanda.',
      ru: 'Гран Бекон, картошка и напиток.',
      en: 'Gran Bacon, fries and a drink.',
    },
    priceCents: 990,
    kcal: 1320,
    sized: true,
    combo: { panino: 'neo-bacon', side: 'patatine', drink: 'cola' },
    photoQuery: 'burger basket fries',
  },
  {
    id: 'menu-crispy',
    category: 'menu',
    name: { it: 'Menu Crispy Pollo', ru: 'Меню Криспи Курица', en: 'Crispy Chicken menu' },
    note: {
      it: 'Crispy Pollo, patatine e bevanda.',
      ru: 'Криспи Курица, картошка и напиток.',
      en: 'Crispy Chicken, fries and a drink.',
    },
    priceCents: 890,
    kcal: 1140,
    sized: true,
    combo: { panino: 'crispy-chicken', side: 'patatine', drink: 'cola' },
    photoQuery: 'chicken burger meal combo',
  },
  {
    id: 'menu-veg',
    category: 'menu',
    name: { it: 'Menu Orto', ru: 'Меню Орто', en: 'Orto menu' },
    note: {
      it: 'Orto, patatine e bevanda.',
      ru: 'Орто, картошка и напиток.',
      en: 'Orto, fries and a drink.',
    },
    priceCents: 870,
    kcal: 1020,
    sized: true,
    badges: ['veg'],
    combo: { panino: 'neo-veg', side: 'patatine', drink: 'cola' },
    photoQuery: 'veggie burger meal combo',
  },
];

const BY_ID = new Map(ITEMS.map((item) => [item.id, item]));

export function foodItem(id: string): FoodItem | null {
  return BY_ID.get(id) ?? null;
}

export function itemsInCategory(category: FoodCategoryId): FoodItem[] {
  return ITEMS.filter((item) => item.category === category);
}

export function foodSize(id: string): FoodSize | null {
  return SIZES.find((size) => size.id === id) ?? null;
}

/** Photo file the UI expects for an item. The fetcher writes exactly these. */
export function foodPhoto(id: string): string {
  return `/food/${id}.webp`;
}

export interface FoodChoice {
  itemId: string;
  quantity: number;
  /** Only meaningful for a sized item; ignored otherwise. */
  sizeId?: 'S' | 'M' | 'L';
  /** Ids of extras added to this line. */
  extraIds?: readonly string[];
}

export interface FoodLine {
  choice: FoodChoice;
  item: FoodItem;
  unitCents: number;
  totalCents: number;
  kcal: number;
}

/**
 * Price of one unit, with its size and extras.
 *
 * A size on an item that has none is not an error worth refusing an order
 * over — it is dropped, and the base price stands.
 */
export function unitPrice(choice: FoodChoice): number {
  const item = foodItem(choice.itemId);
  if (!item) return 0;

  const size = item.sized && choice.sizeId ? foodSize(choice.sizeId) : null;
  const extras = (choice.extraIds ?? []).reduce(
    (sum, id) => sum + (foodItem(id)?.priceCents ?? 0),
    0,
  );

  return item.priceCents + (size?.deltaCents ?? 0) + extras;
}

export function unitKcal(choice: FoodChoice): number {
  const item = foodItem(choice.itemId);
  if (!item) return 0;

  const size = item.sized && choice.sizeId ? foodSize(choice.sizeId) : null;
  const extras = (choice.extraIds ?? []).reduce((sum, id) => sum + (foodItem(id)?.kcal ?? 0), 0);

  return item.kcal + (size?.deltaKcal ?? 0) + extras;
}

/** What a combo would cost bought as three separate items, for the saving line. */
export function comboAlaCarteCents(item: FoodItem, sizeId: 'S' | 'M' | 'L' = 'S'): number | null {
  if (!item.combo) return null;

  const parts = [item.combo.panino, item.combo.side, item.combo.drink];
  return parts.reduce((sum, id) => sum + unitPrice({ itemId: id, quantity: 1, sizeId: sizeId }), 0);
}

export interface FoodBill {
  lines: FoodLine[];
  itemsCents: number;
  deliveryCents: number;
  totalCents: number;
  kcal: number;
  /** Cents saved against buying every combo's parts separately. */
  savedCents: number;
}

/**
 * Turns choices into a bill.
 *
 * Unknown ids are dropped rather than throwing: the cart lives in the
 * browser's storage, and a menu that changed under it must not leave someone
 * unable to open their own basket.
 */
export function bill(choices: readonly FoodChoice[], forDelivery = true): FoodBill {
  const lines: FoodLine[] = [];
  let itemsCents = 0;
  let kcal = 0;
  let savedCents = 0;

  for (const choice of choices) {
    const item = foodItem(choice.itemId);
    if (!item || choice.quantity < 1) continue;

    const unitCents = unitPrice(choice);
    const lineKcal = unitKcal(choice) * choice.quantity;
    const totalCents = unitCents * choice.quantity;

    lines.push({ choice, item, unitCents, totalCents, kcal: lineKcal });
    itemsCents += totalCents;
    kcal += lineKcal;

    const alaCarte = comboAlaCarteCents(item, choice.sizeId ?? 'S');
    if (alaCarte !== null) savedCents += Math.max(0, alaCarte - unitCents) * choice.quantity;
  }

  const deliveryCents =
    !forDelivery || itemsCents === 0 || itemsCents >= BRAND.freeDeliveryFromCents
      ? 0
      : BRAND.deliveryFeeCents;

  return {
    lines,
    itemsCents,
    deliveryCents,
    totalCents: itemsCents + deliveryCents,
    kcal,
    savedCents,
  };
}

/** Minutes from confirmation to the door, the way a delivery app quotes it. */
export function etaMinutes(bill: FoodBill): number {
  // Every line adds a little to the kitchen, but a bag of twelve items does
  // not take twelve times as long: the grill runs in parallel.
  const kitchen = BRAND.kitchenMinutes + Math.ceil(bill.lines.length / 3);
  const ride = 9;
  return kitchen + ride;
}

export const DELIVERY_STAGES = ['placed', 'kitchen', 'courier', 'riding', 'arrived'] as const;
export type DeliveryStage = (typeof DELIVERY_STAGES)[number];

/**
 * The share of the total time each stage takes.
 *
 * Fixed rather than random: a tracking screen that jumps about looks broken,
 * and a courier who arrives before the kitchen is finished looks worse.
 */
export const STAGE_SHARE: Record<DeliveryStage, number> = {
  placed: 0.06,
  kitchen: 0.34,
  courier: 0.1,
  riding: 0.45,
  arrived: 0.05,
};

/** Which stage an order is in, from the fraction of its journey that has passed. */
export function stageAt(progress: number): DeliveryStage {
  let passed = 0;
  for (const stage of DELIVERY_STAGES) {
    passed += STAGE_SHARE[stage];
    if (progress < passed) return stage;
  }
  return 'arrived';
}
