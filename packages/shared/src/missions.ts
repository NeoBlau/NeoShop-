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
  /** Press the button that plays this clip, and let it finish. */
  | { kind: 'play'; clip: string; seconds: number }
  /** Walk to within this many metres of the product. */
  | { kind: 'approach'; metres: number }
  /** Stand and watch for this long. */
  | { kind: 'watch'; seconds: number }
  /** Answer a question about what just happened. */
  | { kind: 'answer'; options: MissionText[]; correct: number };

export interface MissionStep {
  id: string;
  prompt: MissionText;
  /** Shown once the step is done, as the reason it mattered. */
  done: MissionText;
  goal: MissionGoal;
}

export interface Mission {
  id: string;
  /** The product this demonstrates, by slug, as the seed writes it. */
  productSlug: string;
  /** The demo zone it happens in, by id, as the zone build writes it. */
  zone: string;
  title: MissionText;
  intro: MissionText;
  outro: MissionText;
  steps: readonly MissionStep[];
  /** Percentage off the product, issued as a code on completion. */
  percentOff: number;
}

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
    productSlug: 'recliner-chair-fjord',
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
    productSlug: 'desk-lamp-lumen',
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
];

const BY_ID = new Map(MISSIONS.map((mission) => [mission.id, mission]));
const BY_SLUG = new Map(MISSIONS.map((mission) => [mission.productSlug, mission]));

export function mission(id: string): Mission | null {
  return BY_ID.get(id) ?? null;
}

export function missionForProduct(slug: string): Mission | null {
  return BY_SLUG.get(slug) ?? null;
}

export function missionsInZone(zone: string): Mission[] {
  return MISSIONS.filter((entry) => entry.zone === zone);
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
