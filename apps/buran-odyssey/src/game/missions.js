// Mission start states. Every scenario is placed with real orbital
// mechanics against the live ephemeris at the chosen date: circular orbits
// from v = √(μ/r) in the body's true equatorial frame, entry interfaces from a
// great-circle approach to a real landing site.

import * as THREE from 'three';
import { DEG } from '../core/constants.js';
import { elementsToState } from '../physics/kepler.js';

function equatorialBasis(body) {
  const Z = body.pole.clone();
  const X = body._node.clone();
  const Y = new THREE.Vector3().crossVectors(Z, X);
  return new THREE.Matrix4().makeBasis(X, Y, Z);
}

// Body axes from forward and "up" (x fwd, y right, z down).
export function orientation(fwd, up) {
  const x = fwd.clone().normalize();
  const z = up.clone().addScaledVector(x, -up.dot(x)).normalize().negate();
  const y = new THREE.Vector3().crossVectors(z, x);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

export function circularOrbit(body, altitude, incDeg = 0, lanDeg = 0, argLatDeg = 0) {
  const a = body.radius + altitude;
  const { r, v } = elementsToState(
    { a, e: 0, i: incDeg * DEG, Omega: lanDeg * DEG, omega: 0, M: argLatDeg * DEG },
    body.gm,
  );
  const m = equatorialBasis(body);
  r.applyMatrix4(m);
  v.applyMatrix4(m);
  const q = orientation(v, r); // prograde, belly toward the planet
  return { r, v, q };
}

// Entry interface `range` metres up-track of a site, arriving on azimuth `az`.
export function entryState(body, site, range, altitude, speed, gammaDeg, azDeg, alphaDeg) {
  const T = body.dirFromLatLon(site.lat, site.lon).applyQuaternion(body.quat);
  const N = body.pole.clone().addScaledVector(T, -body.pole.dot(T)).normalize();
  const E = new THREE.Vector3().crossVectors(N, T);
  const d = N.clone()
    .multiplyScalar(Math.cos(azDeg * DEG))
    .addScaledVector(E, Math.sin(azDeg * DEG));
  const A = new THREE.Vector3().crossVectors(T, d).normalize();
  const S = T.clone().applyAxisAngle(A, -range / body.radius);
  const dS = new THREE.Vector3().crossVectors(A, S).normalize();
  const r = S.clone().multiplyScalar(body.radius + altitude);
  const g = gammaDeg * DEG;
  const vSurf = dS
    .clone()
    .multiplyScalar(speed * Math.cos(g))
    .addScaledVector(S, speed * Math.sin(g));
  const v = vSurf.clone().add(body.surfaceVelocity(r));
  const vh = vSurf.clone().normalize();
  const upPerp = S.clone().addScaledVector(vh, -S.dot(vh)).normalize();
  const fwd = vh
    .clone()
    .multiplyScalar(Math.cos(alphaDeg * DEG))
    .addScaledVector(upPerp, Math.sin(alphaDeg * DEG));
  return { r, v, q: orientation(fwd, upPerp) };
}

export function groundState(body, site, headingDeg, clearance = 5.35) {
  const dirB = body.dirFromLatLon(site.lat, site.lon);
  const h = body.terrain ? body.terrain.groundHeight(dirB.x, dirB.y, dirB.z) : 0;
  const S = dirB.clone().applyQuaternion(body.quat);
  const r = S.clone().multiplyScalar(body.radius + h + clearance);
  const N = body.pole.clone().addScaledVector(S, -body.pole.dot(S)).normalize();
  const E = new THREE.Vector3().crossVectors(N, S);
  const fwd = N.multiplyScalar(Math.cos(headingDeg * DEG)).addScaledVector(
    E,
    Math.sin(headingDeg * DEG),
  );
  return { r, v: body.surfaceVelocity(r), q: orientation(fwd, S) };
}

export const MISSIONS = [
  {
    id: 'leo',
    title: 'Низкая околоземная орбита',
    body: 'earth',
    brief:
      '400 км, наклонение 51,6° (как у МКС). Освойтесь с управлением, затем тормозной импульс и вход в атмосферу.',
    setup: (b) => ({ ...circularOrbit(b, 400e3, 51.6, 40, 200), sas: 'prograde' }),
  },
  {
    id: 'entry-earth',
    siteIndex: 0,
    title: 'Возвращение на Байконур',
    body: 'earth',
    brief:
      'Высота 120 км, 7,6 км/с, угол атаки 38°. 6500 км до полосы «Юбилейный»: гасите энергию креном. Повторите посадку 15 ноября 1988 года.',
    setup: (b) => ({
      ...entryState(b, b.def.sites[0], 6500e3, 120e3, 7600, -1.1, 50, 38),
      gear: false,
      site: 0,
    }),
  },
  {
    id: 'runway',
    siteIndex: 0,
    title: 'Взлёт с Байконура',
    body: 'earth',
    brief:
      'На полосе, шасси выпущено, баки полны. Плазменные двигатели дают тяговооружённость 1,5 — взлёт и выход на орбиту.',
    setup: (b) => ({ ...groundState(b, b.def.sites[0], 150), gear: true, landed: true }),
  },
  {
    id: 'moon-orbit',
    title: 'Окололунная орбита',
    body: 'moon',
    brief: '100 км над Луной. Реголит, моря и кратеры — реальный рельеф LOLA.',
    setup: (b) => ({ ...circularOrbit(b, 100e3, 12, 0, 10), sas: 'retrograde' }),
  },
  {
    id: 'moon-descent',
    siteIndex: 0,
    title: 'Посадка: Море Спокойствия',
    body: 'moon',
    brief:
      '15 км над поверхностью, 420 км до места посадки «Аполлона-11». Гасите орбитальную скорость и садитесь вертикально.',
    setup: (b) => ({
      ...entryState(b, b.def.sites[0], 420e3, 15e3, 1690, 0, 90, 180),
      sas: 'retrograde',
      site: 0,
      gear: true,
    }),
  },
  {
    id: 'mars-entry',
    siteIndex: 0,
    title: 'Вход в атмосферу Марса',
    body: 'mars',
    brief:
      'Интерфейс входа 125 км, 3,3 км/с после схода с орбиты. Планируйте к горе Олимп в разреженном CO₂: атмосфера гасит лишь часть скорости, последние километры — на плазменных двигателях.',
    setup: (b) => ({
      ...entryState(b, b.def.sites[0], 1600e3, 125e3, 3300, -5, 80, 40),
      gear: false,
      site: 0,
    }),
  },
  {
    id: 'mars-valles',
    siteIndex: 1,
    title: 'Долина Маринер',
    body: 'mars',
    brief: '8 км над каньоном Копратес на дозвуке. Спуститесь в каньон глубиной 7 км.',
    setup: (b) => ({
      ...entryState(b, b.def.sites[1], 60e3, 12e3, 420, -3, 90, 8),
      gear: false,
      site: 1,
    }),
  },
  {
    id: 'venus',
    title: 'Орбита Венеры',
    body: 'venus',
    brief:
      '450 км над облачным слоем серной кислоты. 92 бара и 737 K у поверхности — корпус выдержит, электроника — ограниченное время.',
    setup: (b) => ({ ...circularOrbit(b, 450e3, 20, 0, 0), sas: 'retrograde' }),
  },
  {
    id: 'europa',
    title: 'Орбита Европы',
    body: 'europa',
    brief: '100 км над ледяной корой Европы, под которой — океан. Юпитер заполняет полнеба.',
    setup: (b) => ({ ...circularOrbit(b, 100e3, 5, 0, 60), sas: 'retrograde' }),
  },
  {
    id: 'titan',
    title: 'Титан',
    body: 'titan',
    brief:
      '650 км над оранжевой дымкой. 1,5 бар, 94 K: плотная атмосфера и слабая гравитация — идеальный планирующий спуск.',
    setup: (b) => ({ ...circularOrbit(b, 650e3, 10, 0, 0), sas: 'retrograde' }),
  },
  {
    id: 'saturn',
    title: 'Кольца Сатурна',
    body: 'saturn',
    brief: 'Орбита в плоскости колец, 36 000 км над облаками.',
    setup: (b) => ({ ...circularOrbit(b, 36000e3, 3, 0, 0), sas: 'prograde' }),
  },
  {
    id: 'sandbox-deep',
    title: 'Песочница: глубокий космос',
    body: 'earth',
    brief:
      'Высокая орбита Земли, варп-двигатель разблокирован без научной программы. Откройте звёздную карту (U).',
    sandbox: true,
    setup: (b) => ({ ...circularOrbit(b, 20000e3, 0, 0, 0), sas: 'prograde' }),
  },
];
