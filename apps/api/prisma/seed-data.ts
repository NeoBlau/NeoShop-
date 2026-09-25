/**
 * The accounts, pavilions and products the demo world is built from.
 *
 * A module of its own so it can be read without running the seed: importing
 * `seed.ts` connects to the database and seeds, and the cross-check in
 * `apps/api/test/mission-assets.test.ts` wants the data, not the side effect.
 * That check is the reason this is not simply a section of the seed: every
 * clip named below is a promise that the model carries it, and nothing was
 * holding anybody to it.
 */
import type { InteractionType, ProductCategory } from '@3dsfera/shared';

export interface SupplierSeed {
  key: string;
  email: string;
  companyName: string;
  legalName: string;
  taxId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  pavilionTitle?: string;
}

export const suppliers: SupplierSeed[] = [
  {
    key: 'orbita',
    email: 'antenna@demo.3dsfera.local',
    companyName: 'Орбита Связь',
    legalName: 'ООО «Орбита Связь»',
    taxId: '7701234567',
    status: 'APPROVED',
    pavilionTitle: 'Орбита Связь — антенны и связь',
  },
  {
    key: 'domovoy',
    email: 'robotics@demo.3dsfera.local',
    companyName: 'Домовой Роботикс',
    legalName: 'ООО «Домовой Роботикс»',
    taxId: '7809876543',
    status: 'APPROVED',
    pavilionTitle: 'Домовой Роботикс — техника для дома',
  },
  {
    key: 'kronos',
    email: 'furniture@demo.3dsfera.local',
    companyName: 'Мебель Кронос',
    legalName: 'ИП Кронов А. В.',
    taxId: '5405551234',
    status: 'PENDING',
  },
];

export interface InteractionSeed {
  type: InteractionType;
  clipName?: string;
  label: string;
  labelEn: string;
  loop?: boolean;
}

export interface ProductSeed {
  supplierKey: string;
  slug: string;
  file: string;
  title: string;
  description: string;
  category: ProductCategory;
  priceCents: number;
  stock: number;
  weightGrams: number;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  status: 'PENDING' | 'PUBLISHED';
  interactions: InteractionSeed[];
}

export const products: ProductSeed[] = [
  {
    supplierKey: 'orbita',
    slug: 'antenna-orbita-1-2',
    file: 'antenna-orbita.glb',
    title: 'Антенна спутниковая «Орбита 1.2»',
    description:
      'Офсетная антенна 120 см с моторизованным приводом. Разворачивается одним движением и сама доводит тарелку до спутника. Крепление на стену или мачту, ветровая нагрузка до 30 м/с.',
    category: 'ELECTRONICS',
    priceCents: 1_899_000,
    stock: 25,
    weightGrams: 9_400,
    lengthMm: 1_250,
    widthMm: 700,
    heightMm: 340,
    status: 'PUBLISHED',
    interactions: [
      {
        type: 'GLTF_ANIMATION',
        clipName: 'deploy',
        label: 'Развернуть антенну',
        labelEn: 'Deploy the antenna',
      },
      {
        type: 'GLTF_ANIMATION',
        clipName: 'track_signal',
        label: 'Поймать сигнал',
        labelEn: 'Track the signal',
        loop: true,
      },
      { type: 'GLTF_ANIMATION', clipName: 'fold', label: 'Сложить', labelEn: 'Fold it back' },
    ],
  },
  {
    supplierKey: 'domovoy',
    slug: 'robot-vacuum-domovoy-x2',
    file: 'robot-vacuum.glb',
    title: 'Робот-пылесос «Домовой X2»',
    description:
      'Лидарная навигация, влажная уборка, база самоочистки. Строит карту квартиры за один проход и обходит провода. Ёмкость пылесборника 0,4 л, работа до 180 минут.',
    category: 'HOME_APPLIANCES',
    priceCents: 3_499_000,
    stock: 60,
    weightGrams: 3_800,
    lengthMm: 350,
    widthMm: 350,
    heightMm: 98,
    status: 'PUBLISHED',
    interactions: [
      // The clips are the ones the ingested model carries. Two of them drive
      // the vacuum across a floor, which is why the mission zone exists: on a
      // plinth two thirds of a metre wide, `brushes_spin` is the one that
      // shows the mechanism without driving off the marble.
      {
        type: 'GLTF_ANIMATION',
        clipName: 'brushes_spin',
        label: 'Раскрутить щётки',
        labelEn: 'Spin the brushes',
        loop: true,
      },
      {
        type: 'GLTF_ANIMATION',
        clipName: 'undock',
        label: 'Съехать с базы',
        labelEn: 'Leave the dock',
      },
      {
        type: 'GLTF_ANIMATION',
        clipName: 'clean_pattern',
        label: 'Запустить уборку',
        labelEn: 'Start cleaning',
        loop: true,
      },
    ],
  },
  {
    supplierKey: 'orbita',
    slug: 'inspection-drone-skyeye',
    file: 'inspection-drone.glb',
    title: 'Дрон осмотровый «Skyeye»',
    description:
      'Квадрокоптер для осмотра антенн и кровли. Камера на подвесе, 34 минуты полёта, ветроустойчивость 12 м/с. Складные лучи, кейс в комплекте.',
    category: 'ELECTRONICS',
    priceCents: 8_990_000,
    stock: 8,
    weightGrams: 1_250,
    lengthMm: 480,
    widthMm: 480,
    heightMm: 160,
    status: 'PUBLISHED',
    interactions: [
      {
        type: 'GLTF_ANIMATION',
        clipName: 'rotors_spin',
        label: 'Раскрутить винты',
        labelEn: 'Spin the rotors',
        loop: true,
      },
      { type: 'GLTF_ANIMATION', clipName: 'takeoff', label: 'Взлететь', labelEn: 'Take off' },
      {
        type: 'GLTF_ANIMATION',
        clipName: 'camera_scan',
        label: 'Осмотреть местность',
        labelEn: 'Scan around',
      },
    ],
  },
  {
    supplierKey: 'domovoy',
    slug: 'desk-lamp-meridian',
    file: 'desk-lamp.glb',
    title: 'Настольная лампа «Меридиан»',
    description:
      'Складной светильник с регулируемой цветовой температурой 2700–5600 К. Алюминиевые тяги, утяжелённое основание, поворот плафона на 180°.',
    category: 'LIGHTING',
    priceCents: 649_000,
    stock: 120,
    weightGrams: 1_900,
    lengthMm: 220,
    widthMm: 220,
    heightMm: 520,
    status: 'PUBLISHED',
    interactions: [
      { type: 'GLTF_ANIMATION', clipName: 'fold_open', label: 'Разложить', labelEn: 'Unfold' },
      {
        type: 'GLTF_ANIMATION',
        clipName: 'head_tilt',
        label: 'Наклонить плафон',
        labelEn: 'Tilt the head',
      },
    ],
  },
  {
    supplierKey: 'kronos',
    slug: 'recliner-kronos',
    file: 'recliner-chair.glb',
    title: 'Кресло-реклайнер «Кронос»',
    description:
      'Раскладывается в лежачее положение одним движением. Каркас из бука, наполнитель — холлофайбер высокой плотности, съёмные чехлы.',
    category: 'FURNITURE',
    priceCents: 5_490_000,
    stock: 14,
    weightGrams: 38_000,
    lengthMm: 900,
    widthMm: 950,
    heightMm: 1_060,
    // Its supplier is still under review, so the product waits in the
    // moderation queue — that is what stage 5 will be looking at.
    status: 'PENDING',
    interactions: [
      {
        type: 'GLTF_ANIMATION',
        clipName: 'recline',
        label: 'Разложить кресло',
        labelEn: 'Recline the chair',
      },
      {
        type: 'GLTF_ANIMATION',
        clipName: 'footrest_up',
        label: 'Поднять подножку',
        labelEn: 'Raise the footrest',
      },
      {
        type: 'GLTF_ANIMATION',
        clipName: 'sit_upright',
        label: 'Вернуть в исходное',
        labelEn: 'Sit upright',
      },
    ],
  },
];
