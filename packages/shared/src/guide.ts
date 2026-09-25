/**
 * What the guide knows about the worlds.
 *
 * Two answers to every question, and they come from opposite places. The
 * written ones below are the floor: they are reviewed, translated, and true
 * whether or not anything else is running. The other comes from a language
 * model on the buyer's own machine, when they have pointed us at one — and
 * that one is given these same facts as its brief, because a guide that
 * invents a location is worse than a guide that repeats itself.
 *
 * Nothing here is sent to a third party in either case. The scripted answers
 * never leave the bundle, and the local model is local: an endpoint on
 * localhost that the buyer configured, on hardware they own.
 */
import type { ScriptedLine } from './scripted.js';

/** A location, as the guide needs to talk about it. */
export interface GuideLocation {
  id: string;
  title: string;
  blurb: string;
  /** How many supplier plots it has. */
  plots: number;
  /** Triangles at full detail, which is the honest measure of how heavy it is. */
  triangles: number;
  /** Who made the source material and under what licence. */
  credit: string;
}

export const GUIDE_FACTS: readonly ScriptedLine[] = [
  {
    id: 'what',
    question: { ru: 'Что такое локация?', en: 'What is a location?' },
    answer: {
      ru: 'Мир, по которому вы ходите пешком. В каждом есть площадки поставщиков: на них стоят настоящие товары, их можно включить и посмотреть в работе, а потом купить с доставкой. Покупка одинаковая в любой локации и в плоском каталоге.',
      en: 'A world you walk around on foot. Each has supplier plots in it, with real products standing on them that you can switch on and watch working, then buy with delivery. Buying is the same in every location and in the flat catalogue.',
    },
    heard: ['локация', 'выставка', 'мир', 'миры', 'location', 'world', 'what'],
  },
  {
    id: 'choose',
    question: { ru: 'Какую локацию выбрать?', en: 'Which location should I pick?' },
    answer: {
      ru: 'Они различаются только видом и весом. Улица — плотная застройка, витрины в ряд, проще ориентироваться. Роща — открытая поляна в горном лесу, площадки стоят по краям. Товары и цены одни и те же. Если устройство слабое, берите ту, что легче — цифру видно на карточке выбора.',
      en: 'They differ only in how they look and how heavy they are. The street is dense, with shop fronts in a row, and is easier to navigate. The grove is an open clearing in a mountain forest with the plots around its edge. The products and the prices are identical. On a weak machine take the lighter one — the figure is on its card in the picker.',
    },
    // "отличие" rather than "отличаются": the stem comparison keeps five
    // letters of the shorter word, and отличие/отличается share exactly that.
    heard: [
      'выбрать',
      'выбор',
      'лучше',
      'разница',
      'отличие',
      'роща',
      'рощу',
      'улица',
      'улицу',
      'choose',
      'which',
      'difference',
      'grove',
      'street',
    ],
  },
  {
    id: 'move',
    question: { ru: 'Как ходить и осматриваться?', en: 'How do I walk and look around?' },
    answer: {
      ru: 'WASD или стрелки — идти, Shift — быстрее. Осмотреться: потяните мышью по сцене или щёлкните по ней, тогда вид пойдёт за мышью, а Esc вернёт курсор. На телефоне — джойстик слева и свайп по экрану. Ходить можно только там, где есть пол: карта проходимости считается по самой геометрии, поэтому в скалу или в кусты вы не пройдёте.',
      en: 'WASD or the arrows to walk, Shift to go faster. To look around, drag on the scene, or click it and the view follows the mouse until Escape gives the cursor back. On a phone: the stick on the left and a swipe anywhere. You can only walk where there is floor — the walkable map is measured from the geometry itself, so you will not get through a rock or a fern.',
    },
    heard: [
      'ходить',
      'идти',
      'управление',
      'мышь',
      'осмотреться',
      'walk',
      'move',
      'controls',
      'look',
    ],
  },
  {
    id: 'quality',
    question: { ru: 'Тормозит. Что делать?', en: 'It is slow. What can I do?' },
    answer: {
      ru: 'В правом верхнем углу селектор качества: на «низком» локация грузится в разы меньше и рисуется проще. Он и сам опускается, если кадры проседают. Если и это не помогает — «Открыть каталог» внизу справа: те же товары списком, покупка работает так же.',
      en: 'There is a quality selector in the top right: on "low" the location downloads a fraction of the bytes and draws far less. It also steps itself down when the frame rate drops. If that is still not enough, "Open the catalogue" at the bottom right gives you the same products as a list, and buying works the same.',
    },
    heard: [
      'тормозит',
      'лагает',
      'медленно',
      'качество',
      'фпс',
      'slow',
      // Short words must match exactly, so "lag" would miss "lags": the forms
      // are listed rather than stemmed, because three letters is not evidence.
      'lag',
      'lags',
      'lagging',
      'stutter',
      'quality',
      'performance',
    ],
  },
  {
    id: 'plots',
    question: { ru: 'Что за площадки поставщиков?', en: 'What are the supplier plots?' },
    answer: {
      ru: 'Места, которые площадка выдаёт поставщику после проверки компании. Площадку поставщик наполняет сам: загружает модель, настраивает действия, ставит цену. На каждой стоит продавец — с ним можно поговорить про то, что на ней выложено.',
      en: 'Spaces the platform gives a supplier once their company has been checked. The supplier fills their own: they upload the model, configure its actions and set the price. Each one is staffed, and the person on it will talk about what is on it.',
    },
    heard: [
      'площадка',
      'площадки',
      'павильон',
      'поставщик',
      'витрина',
      'plot',
      'plots',
      'pavilion',
      'supplier',
    ],
  },
  {
    id: 'missions',
    question: { ru: 'Что такое мини-миссии?', en: 'What are the mini-missions?' },
    answer: {
      ru: 'Короткий сценарий в отдельной комнате, где товар работает по-настоящему: пылесос выезжает и убирает, кресло раскладывается, антенна разворачивается. За пройденную миссию даётся промокод на скидку. Покупка от миссии не зависит — в корзину можно положить до неё, во время и после.',
      en: 'A short scenario in a room of its own where the product actually works: the vacuum undocks and cleans, the chair reclines, the antenna deploys. Finishing one earns a discount code. Buying does not depend on it — the cart works before, during and after.',
    },
    heard: [
      'миссия',
      'миссии',
      'задание',
      'квест',
      'скидка',
      'промокод',
      'mission',
      'quest',
      'discount',
    ],
  },
  {
    id: 'made',
    question: { ru: 'Из чего сделаны локации?', en: 'What are the locations made of?' },
    answer: {
      ru: 'Из настоящих сканов. Улица — исследовательская сцена Amazon Lumberyard Bistro под CC BY 4.0. Роща собрана из фотограмметрии Poly Haven под CC0: каждое дерево и каждый камень в ней — это фотография дерева и камня, а земля под ними наша. Небо и свет — снятая HDRI, отдаётся с нашего же домена.',
      en: 'Real scans. The street is the Amazon Lumberyard Bistro research scene under CC BY 4.0. The grove is composed from Poly Haven photogrammetry under CC0: every tree and every rock in it is a photograph of a tree and a rock, and the ground they stand on is ours. The sky and the light are a photographed HDRI, served from our own domain.',
    },
    heard: [
      'сделаны',
      'откуда',
      'модели',
      'сканы',
      'лицензия',
      'авторы',
      'made',
      'source',
      'licence',
      'license',
    ],
  },
  {
    id: 'privacy',
    question: { ru: 'Что уходит на сторону?', en: 'What leaves my machine?' },
    answer: {
      ru: 'Из этого чата — ничего, пока вы сами не подключите модель: без неё отвечает сценарий, он лежит в странице. Если подключите — запрос идёт на тот адрес, который вы указали, обычно localhost. Голос продавцов читает браузер локально, а вот микрофон в Chrome отправляет запись в Google — поэтому он выключен, пока его не попросят.',
      en: 'From this chat, nothing, until you connect a model yourself: without one the answers come from a script that ships inside the page. With one, the request goes to the address you gave, normally localhost. The vendors’ voices are read by the browser locally, but the microphone in Chrome sends the recording to Google — which is why it stays off until it is asked for.',
    },
    heard: [
      'приватность',
      'данные',
      'отправляется',
      'уходит',
      'сервер',
      'privacy',
      'data',
      'sent',
      'local',
    ],
  },
];

/**
 * The brief handed to a local model.
 *
 * Everything it is allowed to say is in the message: the scripted answers and
 * whatever the built locations actually report about themselves. A model given
 * a question about a location and no facts will describe a location that does
 * not exist, and it will do it fluently.
 */
export function guideBrief(locations: readonly GuideLocation[], language: 'ru' | 'en'): string {
  const rules =
    language === 'ru'
      ? [
          'Ты — гид по 3D-выставке 3DSFERA. Отвечай коротко, по делу, на русском.',
          'Опирайся только на факты ниже. Если ответа в них нет — скажи, что не знаешь, и предложи спросить консьержа в мире.',
          'Не придумывай локации, товары, цены, сроки доставки и условия возврата.',
        ]
      : [
          'You are the guide to the 3DSFERA showroom. Answer briefly and to the point, in English.',
          'Use only the facts below. If the answer is not in them, say you do not know and suggest asking the concierge in the world.',
          'Never invent locations, products, prices, delivery dates or return terms.',
        ];

  const built =
    locations.length === 0
      ? language === 'ru'
        ? 'Локации в этой сборке не собраны.'
        : 'This build has no locations in it.'
      : locations
          .map(
            (location) =>
              `- ${location.title} (${location.id}): ${location.blurb} ` +
              `${location.plots} plots, ${location.triangles.toLocaleString('en')} triangles. ` +
              `Source: ${location.credit}.`,
          )
          .join('\n');

  const facts = GUIDE_FACTS.map(
    (fact) => `Q: ${fact.question[language]}\nA: ${fact.answer[language]}`,
  ).join('\n\n');

  return `${rules.join('\n')}\n\n--- ${
    language === 'ru' ? 'Собранные локации' : 'Locations in this build'
  } ---\n${built}\n\n--- ${language === 'ru' ? 'Факты' : 'Facts'} ---\n${facts}`;
}
