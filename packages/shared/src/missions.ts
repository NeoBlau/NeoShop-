/**
 * Missions: a product, a room, and a short scripted demonstration in it.
 *
 * The showroom's promise is that a buyer sees a thing work before paying for
 * it. On the street that means pressing a button on a plinth. A mission is the
 * fuller version: the product in a room where its job makes sense — a vacuum
 * on a floor, a recliner in a lounge — with steps that ask the buyer to do
 * something rather than watch a video.
 *
 * Buying never depends on finishing one. A mission is worth a discount code at
 * the end, and the product is in the cart the whole time if that is what
 * somebody wants.
 *
 * What the server can and cannot check is written down here rather than
 * assumed: steps happen in a browser, so the server verifies *order* and
 * *pace* — no skipping ahead, no finishing a two-minute mission in four
 * seconds — and does not pretend to verify that a camera really pointed at a
 * chair. MINIMUM_PACE is that honesty made numeric.
 */

export interface MissionText {
  ru: string;
  en: string;
}

export type MissionGoal =
  // ── In a demo room, about one product ────────────────────────────────────
  /** Press the button that plays this clip, and let it finish. */
  | { kind: 'play'; clip: string; seconds: number }
  /** Walk to within this many metres of the product. */
  | { kind: 'approach'; metres: number }
  /** Stand and watch for this long. */
  | { kind: 'watch'; seconds: number }
  /** Answer a question about what just happened. */
  | { kind: 'answer'; options: MissionText[]; correct: number }
  // ── Out on the location, about the place ─────────────────────────────────
  /** Cover this much ground on foot, anywhere in the location. */
  | { kind: 'stroll'; metres: number }
  /** Come within `metres` of this many different supplier frontages. */
  | { kind: 'frontages'; count: number; metres: number }
  /** Get this many different vendors talking. */
  | { kind: 'vendors'; count: number }
  /** Play an action on this many different products, out on the plinths. */
  | { kind: 'demos'; count: number }
  /** Reach something the location's own map knows how to find. */
  | { kind: 'landmark'; landmark: 'counter' | 'concierge' | 'far-end'; metres: number };

export interface MissionStep {
  id: string;
  prompt: MissionText;
  /** Shown once the step is done, as the reason it mattered. */
  done: MissionText;
  goal: MissionGoal;
}

export interface Mission {
  id: string;
  /**
   * Where it happens.
   *
   * `zone` is the original kind: a product alone in a room built for it.
   * `street` is the same contract — ordered steps, a pace floor, a code at
   * the end — carried out on a main location instead, with objectives the
   * browser can observe while somebody walks around. The server does not
   * distinguish them, and should not have to: what it guards is the run.
   */
  where: 'zone' | 'street';
  /** The product this demonstrates, by slug, as the seed writes it. */
  productSlug: string;
  /** The demo zone it happens in, by id, as the zone build writes it. */
  zone?: string;
  /**
   * Which main locations a street quest is offered in. Absent means all of
   * them, which suits a quest whose objectives are about frontages and
   * vendors rather than about a particular street.
   */
  locations?: readonly string[];
  title: MissionText;
  intro: MissionText;
  outro: MissionText;
  steps: readonly MissionStep[];
  /** Percentage off the product, issued as a code on completion. */
  percentOff: number;
}

/**
 * The demo rooms this project builds, by id.
 *
 * Here rather than read off disk because two sides need it and neither owns
 * it: the server validates a supplier's choice of room against this list, and
 * the cabinet offers it as a menu. What a given checkout has actually built is
 * a separate question, answered by `zones.json` — `make zones` is optional,
 * and a supplier should be told their room is missing rather than shown a
 * mission that opens onto nothing.
 */
export const DEMO_ZONES = ['loft', 'gallery', 'billiards', 'bedroom'] as const;
export type DemoZone = (typeof DEMO_ZONES)[number];

/**
 * The fraction of a step's own time a buyer must at least spend on it.
 *
 * Not 1: a clip can be watched at a glance and a buyer who already knows the
 * product should not be made to sit through it. Not 0 either, or a script in
 * the console collects a discount instantly.
 */
export const MINIMUM_PACE = 0.5;

/** Seconds a step is expected to take, for the pace check and the progress bar. */
export function stepSeconds(step: MissionStep): number {
  switch (step.goal.kind) {
    case 'play':
      return step.goal.seconds;
    case 'watch':
      return step.goal.seconds;
    case 'approach':
      return 6;
    case 'answer':
      return 8;
    // Walking takes as long as walking takes. A metre and a half a second is
    // a shade under the player's own speed, so the pace floor stays honest
    // without punishing somebody who took the direct route.
    case 'stroll':
      return step.goal.metres / 1.5;
    case 'frontages':
      return step.goal.count * 12;
    case 'vendors':
      return step.goal.count * 10;
    case 'demos':
      return step.goal.count * 8;
    case 'landmark':
      return 25;
  }
}

export function missionSeconds(mission: Mission): number {
  return mission.steps.reduce((total, step) => total + stepSeconds(step), 0);
}

/** The soonest a completion can honestly arrive, in milliseconds. */
export function earliestCompletion(mission: Mission): number {
  return Math.round(missionSeconds(mission) * MINIMUM_PACE * 1000);
}

export const MISSIONS: readonly Mission[] = [
  {
    id: 'vacuum-loft',
    where: 'zone',
    productSlug: 'robot-vacuum-domovoy-x2',
    zone: 'loft',
    title: { ru: 'Уборка в лофте', en: 'Cleaning the loft' },
    intro: {
      ru: 'Пылесос стоит на базе посреди лофта. Посмотрите, как он работает в настоящей комнате, а не на подиуме.',
      en: 'The vacuum is docked in the middle of the loft. See it work in a real room rather than on a plinth.',
    },
    outro: {
      ru: 'Вы видели полный цикл: съезд с базы, щётки, проход по комнате. Промокод на этот товар — ваш.',
      en: 'You have seen the whole cycle: undocking, the brushes, a pass across the room. The code for this product is yours.',
    },
    percentOff: 10,
    steps: [
      {
        id: 'approach',
        prompt: { ru: 'Подойдите к базе', en: 'Walk up to the dock' },
        done: {
          ru: 'Отсюда видно и корпус, и лидар на крышке.',
          en: 'From here you can see the body and the lidar on the lid.',
        },
        goal: { kind: 'approach', metres: 2.2 },
      },
      {
        id: 'brushes',
        prompt: { ru: 'Раскрутите щётки', en: 'Spin the brushes' },
        done: {
          ru: 'Две боковые щётки заметают мусор под корпус, к основной турбине.',
          en: 'Two side brushes sweep debris under the body, towards the main turbine.',
        },
        goal: { kind: 'play', clip: 'brushes_spin', seconds: 4 },
      },
      {
        id: 'undock',
        prompt: { ru: 'Отправьте его с базы', en: 'Send it off the dock' },
        done: {
          ru: 'Съезжает назад и разворачивается на месте — в узком проходе это важно.',
          en: 'It reverses out and turns on the spot, which matters in a narrow gap.',
        },
        goal: { kind: 'play', clip: 'undock', seconds: 3.2 },
      },
      {
        id: 'clean',
        prompt: { ru: 'Запустите уборку', en: 'Start the cleaning run' },
        done: {
          ru: 'Змейка с перекрытием полосы: так не остаётся пропущенных дорожек.',
          en: 'A boustrophedon with overlap: no missed strips.',
        },
        goal: { kind: 'play', clip: 'clean_pattern', seconds: 12 },
      },
      {
        id: 'quiz',
        prompt: {
          ru: 'Почему он ездит змейкой, а не по кругу?',
          en: 'Why the back-and-forth pattern rather than circles?',
        },
        done: {
          ru: 'Верно: полосы с перекрытием покрывают площадь без пропусков.',
          en: 'Right: overlapping strips cover the area without gaps.',
        },
        goal: {
          kind: 'answer',
          options: [
            { ru: 'Так быстрее разряжается', en: 'It drains the battery faster' },
            {
              ru: 'Полосы с перекрытием не оставляют пропусков',
              en: 'Overlapping strips leave no gaps',
            },
            { ru: 'Чтобы не пугать кота', en: 'To avoid startling the cat' },
          ],
          correct: 1,
        },
      },
    ],
  },
  {
    id: 'chair-billiards',
    where: 'zone',
    productSlug: 'recliner-kronos',
    zone: 'billiards',
    title: { ru: 'Кресло в бильярдной', en: 'The chair in the billiards room' },
    intro: {
      ru: 'Кресло стоит там, где в него садятся между партиями. Разложите его полностью.',
      en: 'The chair is where you would sit between frames. Put it all the way back.',
    },
    outro: {
      ru: 'Вы прошли механику целиком: спинка, подножка, возврат. Промокод ваш.',
      en: 'You have been through the whole mechanism: back, footrest, return. The code is yours.',
    },
    percentOff: 8,
    steps: [
      {
        id: 'approach',
        prompt: { ru: 'Подойдите к кресту', en: 'Walk up to the chair' },
        done: { ru: 'Обивка и строчка видны вблизи.', en: 'Upholstery and stitching, up close.' },
        goal: { kind: 'approach', metres: 2 },
      },
      {
        id: 'recline',
        prompt: { ru: 'Разложите спинку', en: 'Recline the back' },
        done: {
          ru: 'Спинка идёт до 140 градусов без отрыва от пола.',
          en: 'The back goes to 140 degrees without leaving the floor.',
        },
        goal: { kind: 'play', clip: 'recline', seconds: 3 },
      },
      {
        id: 'footrest',
        prompt: { ru: 'Поднимите подножку', en: 'Raise the footrest' },
        done: {
          ru: 'Подножка работает отдельно от спинки.',
          en: 'The footrest works independently of the back.',
        },
        goal: { kind: 'play', clip: 'footrest_up', seconds: 2.5 },
      },
      {
        id: 'upright',
        prompt: { ru: 'Верните в исходное', en: 'Sit it upright again' },
        done: { ru: 'Возврат одним движением.', en: 'Back in one movement.' },
        goal: { kind: 'play', clip: 'sit_upright', seconds: 2.5 },
      },
    ],
  },
  {
    id: 'lamp-gallery',
    where: 'zone',
    productSlug: 'desk-lamp-meridian',
    zone: 'gallery',
    title: { ru: 'Лампа в галерее', en: 'The lamp in the gallery' },
    intro: {
      ru: 'Галерея — место, где свет решает всё. Посмотрите, как складывается и наклоняется лампа.',
      en: 'A gallery is where light decides everything. See how the lamp folds and tilts.',
    },
    outro: {
      ru: 'Складывается в плоскость и наклоняется на 90 градусов. Промокод ваш.',
      en: 'Folds flat, tilts through ninety degrees. The code is yours.',
    },
    percentOff: 12,
    steps: [
      {
        id: 'approach',
        prompt: { ru: 'Подойдите к лампе', en: 'Walk up to the lamp' },
        done: { ru: 'Видно шарнир и кабельный канал.', en: 'The hinge and the cable channel.' },
        goal: { kind: 'approach', metres: 1.8 },
      },
      {
        id: 'unfold',
        prompt: { ru: 'Разложите её', en: 'Unfold it' },
        done: { ru: 'Из плоского положения — одним движением.', en: 'From flat, in one movement.' },
        goal: { kind: 'play', clip: 'fold_open', seconds: 2.5 },
      },
      {
        id: 'tilt',
        prompt: { ru: 'Наклоните плафон', en: 'Tilt the head' },
        done: {
          ru: 'Плафон держит угол без подтяжки винта.',
          en: 'The head holds its angle without tightening a screw.',
        },
        goal: { kind: 'play', clip: 'head_tilt', seconds: 2 },
      },
      {
        id: 'watch',
        prompt: { ru: 'Посмотрите на свет', en: 'Look at the light' },
        done: { ru: 'Пятно ровное, без кольца по краю.', en: 'An even pool, no ring at the edge.' },
        goal: { kind: 'watch', seconds: 5 },
      },
    ],
  },
  {
    id: 'drone-gallery',
    where: 'zone',
    productSlug: 'inspection-drone-skyeye',
    zone: 'gallery',
    title: { ru: 'Осмотр в галерее', en: 'An inspection in the gallery' },
    intro: {
      ru: 'Дрон осматривает то, к чему не подойти. Галерея с высокими потолками — как раз такой случай.',
      en: 'The drone inspects what you cannot reach. A gallery with high ceilings is exactly that.',
    },
    outro: {
      ru: 'Взлёт, стабилизация, обзор камерой. Промокод ваш.',
      en: 'Take-off, hold, a camera sweep. The code is yours.',
    },
    percentOff: 10,
    steps: [
      {
        id: 'approach',
        prompt: { ru: 'Подойдите к дрону', en: 'Walk up to the drone' },
        done: { ru: 'Четыре луча, подвес снизу.', en: 'Four arms, the gimbal underneath.' },
        goal: { kind: 'approach', metres: 2 },
      },
      {
        id: 'rotors',
        prompt: { ru: 'Раскрутите винты', en: 'Spin the rotors' },
        done: {
          ru: 'Винты складные, раскрываются от тяги.',
          en: 'Folding props, opened by thrust.',
        },
        goal: { kind: 'play', clip: 'rotors_spin', seconds: 3 },
      },
      {
        id: 'takeoff',
        prompt: { ru: 'Поднимите его', en: 'Take it up' },
        done: { ru: 'Висит без сноса.', en: 'Holds position without drifting.' },
        goal: { kind: 'play', clip: 'takeoff', seconds: 3 },
      },
      {
        id: 'scan',
        prompt: { ru: 'Осмотрите зал', en: 'Scan the room' },
        done: { ru: 'Подвес развязан от корпуса.', en: 'The gimbal is decoupled from the body.' },
        goal: { kind: 'play', clip: 'camera_scan', seconds: 4 },
      },
    ],
  },
  {
    id: 'antenna-loft',
    where: 'zone',
    productSlug: 'antenna-orbita-1-2',
    zone: 'loft',
    title: { ru: 'Антенна у окна', en: 'The dish by the window' },
    intro: {
      ru: 'Лофт с видом на город — там, где ставят тарелку. Разверните её и поймайте сигнал.',
      en: 'A loft over the city is where a dish goes. Deploy it and find the signal.',
    },
    outro: {
      ru: 'Развернули, навели, сложили. Промокод ваш.',
      en: 'Deployed, aimed, folded. The code is yours.',
    },
    percentOff: 15,
    steps: [
      {
        id: 'approach',
        prompt: { ru: 'Подойдите к антенне', en: 'Walk up to the dish' },
        done: { ru: 'Зеркало сложено, как при перевозке.', en: 'Folded, the way it ships.' },
        goal: { kind: 'approach', metres: 2.4 },
      },
      {
        id: 'deploy',
        prompt: { ru: 'Разверните зеркало', en: 'Deploy the dish' },
        done: { ru: 'Раскрывается без инструмента.', en: 'Opens without a tool.' },
        goal: { kind: 'play', clip: 'deploy', seconds: 3.5 },
      },
      {
        id: 'track',
        prompt: { ru: 'Поймайте сигнал', en: 'Find the signal' },
        done: { ru: 'Наведение по двум осям, автоматически.', en: 'Two-axis aiming, automatic.' },
        goal: { kind: 'play', clip: 'track_signal', seconds: 4 },
      },
      {
        id: 'fold',
        prompt: { ru: 'Сложите обратно', en: 'Fold it back' },
        done: { ru: 'В кейс — за один приём.', en: 'Into the case in one go.' },
        goal: { kind: 'play', clip: 'fold', seconds: 3 },
      },
    ],
  },

  // ── Out on the locations ─────────────────────────────────────────────────
  //
  // The same contract as a room mission — ordered steps, a pace floor, a code
  // at the end — with objectives a browser can watch somebody do while they
  // walk about. They exist because the street is worth walking and nothing was
  // asking anybody to walk it: a buyer who arrives, clicks the nearest plinth
  // and leaves has seen one frontage out of six.
  {
    id: 'street-round',
    where: 'street',
    productSlug: 'desk-lamp-meridian',
    title: { ru: 'Обход витрин', en: 'The round of the frontages' },
    intro: {
      ru: 'Пройдите вдоль всех витрин, а не только до первой. На каждой стоит свой поставщик и свой продавец — и по дороге станет видно, чем они друг от друга отличаются.',
      en: 'Walk the length of the frontages rather than stopping at the first. Each one is a different supplier with a different person on it, and the walk is what shows you the difference.',
    },
    outro: {
      ru: 'Вы обошли выставку целиком и поговорили с теми, кто за ней стоит. Промокод на настольную лампу — ваш.',
      en: 'You have been round the whole showroom and spoken to the people behind it. The code for the desk lamp is yours.',
    },
    percentOff: 7,
    steps: [
      {
        id: 'walk',
        prompt: { ru: 'Пройдите сто метров', en: 'Cover a hundred metres' },
        done: {
          ru: 'Отсюда видно, что выставка не заканчивается на первой витрине.',
          en: 'From here it is obvious the showroom does not end at the first frontage.',
        },
        goal: { kind: 'stroll', metres: 100 },
      },
      {
        id: 'frontages',
        prompt: { ru: 'Подойдите к трём витринам', en: 'Walk up to three frontages' },
        done: {
          ru: 'У каждого поставщика своя полка: техника, свет, мебель. Вывеска над витриной — его имя.',
          en: 'Each supplier has their own shelf: electronics, lighting, furniture. The board over the frontage is their name.',
        },
        goal: { kind: 'frontages', count: 3, metres: 7 },
      },
      {
        id: 'vendors',
        prompt: { ru: 'Поговорите с двумя продавцами', en: 'Talk to two of the vendors' },
        done: {
          ru: 'Отвечают по написанному — и это нарочно: продавец, который сочиняет условия доставки, хуже продавца, который повторяется.',
          en: 'They answer from a script, on purpose: a seller who improvises delivery terms is worse than one who repeats themselves.',
        },
        goal: { kind: 'vendors', count: 2 },
      },
      {
        id: 'demos',
        prompt: { ru: 'Включите два товара', en: 'Switch two products on' },
        done: {
          ru: 'Это и есть смысл выставки: механизм видно до покупки, а не после.',
          en: 'That is what the showroom is for: you see the mechanism before you pay, not after.',
        },
        goal: { kind: 'demos', count: 2 },
      },
    ],
  },
  {
    id: 'street-counter',
    where: 'street',
    productSlug: 'robot-vacuum-domovoy-x2',
    locations: ['street'],
    title: { ru: 'До конца улицы', en: 'To the end of the street' },
    intro: {
      ru: 'В тупике за витринами стоит стойка Neo Burger. Дойдите до неё — заодно увидите, докуда улица вообще идёт.',
      en: 'There is a Neo Burger counter in the dead end past the frontages. Walk to it, and find out how far the street actually goes.',
    },
    outro: {
      ru: 'Дошли. Обед — в отдельной вкладке, там же симуляция доставки. Промокод на пылесос — ваш.',
      en: 'You made it. Lunch is its own tab, delivery simulation included. The code for the vacuum is yours.',
    },
    percentOff: 6,
    steps: [
      {
        id: 'walk',
        prompt: { ru: 'Идите вдоль улицы', en: 'Head down the street' },
        done: { ru: 'Половина пути.', en: 'Halfway.' },
        goal: { kind: 'stroll', metres: 60 },
      },
      {
        id: 'counter',
        prompt: { ru: 'Дойдите до стойки', en: 'Reach the counter' },
        done: {
          ru: 'Стойка стоит там, где улица кончается — это место нашла сама карта проходимости, а не координата в коде.',
          en: 'The counter stands where the street runs out — a spot the walkable map found, not a coordinate typed into the source.',
        },
        goal: { kind: 'landmark', landmark: 'counter', metres: 4 },
      },
    ],
  },
  {
    id: 'grove-round',
    where: 'street',
    productSlug: 'recliner-kronos',
    locations: ['grove'],
    title: { ru: 'Поляна по кругу', en: 'Around the clearing' },
    intro: {
      ru: 'Площадки в роще стоят по краям поляны, спиной к лесу. Обойдите их — и заодно поймёте, где кончается трава и начинается откос.',
      en: 'The plots in the grove stand around the edge of the clearing with their backs to the trees. Go round them, and find out where the grass stops and the bank starts.',
    },
    outro: {
      ru: 'Вы обошли поляну. Промокод на кресло — ваш.',
      en: 'You have been round the clearing. The code for the recliner is yours.',
    },
    percentOff: 7,
    steps: [
      {
        id: 'walk',
        prompt: { ru: 'Пройдите восемьдесят метров', en: 'Cover eighty metres' },
        done: {
          ru: 'Поляна длиннее, чем кажется от тропы.',
          en: 'The clearing is longer than it looks from the path.',
        },
        goal: { kind: 'stroll', metres: 80 },
      },
      {
        id: 'frontages',
        prompt: { ru: 'Обойдите четыре площадки', en: 'Visit four of the plots' },
        done: {
          ru: 'Каждая площадка — ровная земля, вписанная в склон: ниже был бы обрыв, выше — насыпь.',
          en: 'Each plot is level ground blended into the slope: lower and it would be a pit, higher and it would be a bench.',
        },
        goal: { kind: 'frontages', count: 4, metres: 8 },
      },
      {
        id: 'demos',
        prompt: { ru: 'Включите товар', en: 'Switch a product on' },
        done: {
          ru: 'Товары одни и те же в любой локации — меняется только то, где вы на них смотрите.',
          en: 'The products are the same in every location; only where you look at them changes.',
        },
        goal: { kind: 'demos', count: 1 },
      },
    ],
  },
];

const BY_ID = new Map(MISSIONS.map((mission) => [mission.id, mission]));

// Only the room missions are looked up by product: a product card offers "see
// it in its own room", and a street quest is not that — it is offered by the
// location, not by the thing it happens to pay out on.
const BY_SLUG = new Map(
  MISSIONS.filter((mission) => mission.where === 'zone').map((mission) => [
    mission.productSlug,
    mission,
  ]),
);

export function mission(id: string): Mission | null {
  return BY_ID.get(id) ?? null;
}

export function missionForProduct(slug: string): Mission | null {
  return BY_SLUG.get(slug) ?? null;
}

/**
 * A mission by id, looking at the ones a supplier wrote as well as ours.
 *
 * The platform's own are constants in this file; a supplier's arrive with the
 * world response, already converted into this same shape by the server. Ours
 * win a collision, which cannot happen — theirs are cuids — but is written
 * down rather than assumed.
 */
export function missionIn(id: string, authored: readonly Mission[]): Mission | null {
  return mission(id) ?? authored.find((entry) => entry.id === id) ?? null;
}

/** The room mission offered on a product's card, from either source. */
export function missionForProductIn(slug: string, authored: readonly Mission[]): Mission | null {
  return (
    missionForProduct(slug) ??
    authored.find((entry) => entry.where === 'zone' && entry.productSlug === slug) ??
    null
  );
}

export function missionsInZone(zone: string): Mission[] {
  return MISSIONS.filter((entry) => entry.where === 'zone' && entry.zone === zone);
}

/** The quests on offer out on a main location. */
export function streetQuests(location: string): Mission[] {
  return MISSIONS.filter(
    (entry) =>
      entry.where === 'street' &&
      (entry.locations === undefined || entry.locations.includes(location)),
  );
}

export function stepIndex(mission: Mission, stepId: string): number {
  return mission.steps.findIndex((step) => step.id === stepId);
}

export interface PaceVerdict {
  ok: boolean;
  /** Milliseconds the buyer would still have to spend. */
  shortBy: number;
}

/**
 * Whether a completion arriving now is believable.
 *
 * The server calls this with the run's own start time. It is the whole of the
 * anti-abuse story for missions, and deliberately a modest one: the point is
 * to stop a loop in the console from minting discount codes, not to prove
 * somebody watched.
 */
export function pace(mission: Mission, startedAt: number, now: number): PaceVerdict {
  const needed = earliestCompletion(mission);
  const elapsed = now - startedAt;
  return { ok: elapsed >= needed, shortBy: Math.max(0, needed - elapsed) };
}
