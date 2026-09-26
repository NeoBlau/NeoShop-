// Headless flight-dynamics checks (run by `pnpm test`): the same modules the
// game uses, stepped at the game's fixed 240 Hz without any rendering.
//
//  1. Kepler round trip: elements -> state -> elements, and a full orbit of
//     numerical integration returning to its start.
//  2. Earth entry from 120 km / 7.6 km/s at 38° AoA: peak TPS temperature
//     stays under the 1920 K limit and peak load under 2 g (Buran: ~1.6 g).
//  3. Rest on the Baikonur runway at 1 g, then a take-off roll on the plasma
//     drive leaves the ground below 320 m/s.
//  4. Gear touchdown: 2 m/s survives, 7 m/s collapses the gear.

import assert from 'node:assert/strict';
import * as THREE from 'three';
import { StarSystem } from '../src/physics/bodies.js';
import { SOLAR_SYSTEM } from '../src/data/solarSystem.js';
import { Ship, PHYSICS_DT } from '../src/physics/ship.js';
import { MISSIONS } from '../src/game/missions.js';
import { SolHeightProvider } from '../src/world/heightfield.js';
import { Terrain } from '../src/world/terrain.js';
import { elementsToState, stateToElements, propagateUniversal } from '../src/physics/kepler.js';

const T0 = 8.1e8;
const baseCtrl = {
  pitch: 0,
  yaw: 0,
  roll: 0,
  throttle: 0,
  tx: 0,
  ty: 0,
  tz: 0,
  rcs: true,
  sas: false,
  sasMode: 'hold',
  gear: 0,
  brakes: false,
  speedBrake: 0,
};

function setup(id, withTerrain) {
  const m = MISSIONS.find((x) => x.id === id);
  const sys = new StarSystem(SOLAR_SYSTEM, { sol: true });
  sys.update(T0);
  const body = sys.get(m.body);
  if (withTerrain) {
    const prov = new SolHeightProvider(body);
    body.heightProvider = prov;
    body.terrain = new Terrain(body, prov, null, { detailNoise: () => 0 });
  }
  const st = m.setup(body);
  const ship = new Ship();
  ship.setState(body, st.r, st.v, st.q);
  return { ship, body, st };
}

function run(ship, ctrl, seconds, t, each) {
  const n = Math.round(seconds / PHYSICS_DT);
  for (let i = 0; i < n; i++) {
    t += PHYSICS_DT;
    if (i % 12 === 0) ship.sampleEnvironment();
    ship.step(PHYSICS_DT, ctrl, t);
    each?.(ship);
    if (ship.destroyed) break;
  }
  ship.sampleEnvironment();
  return t;
}

// 1 ---------------------------------------------------------------------------
{
  const mu = 3.986004418e14;
  const el = { a: 7.0e6, e: 0.1, i: 0.9, Omega: 1.2, omega: 0.4, M: 2.0 };
  const { r, v } = elementsToState(el, mu);
  const back = stateToElements(r, v, mu);
  assert.ok(
    Math.abs(back.a - el.a) < 1e-3 && Math.abs(back.e - el.e) < 1e-9,
    'elements round trip',
  );
  const r0 = r.clone();
  propagateUniversal(r, v, mu, back.period);
  assert.ok(r.distanceTo(r0) < 1e-3 * r0.length(), 'universal propagation closes the orbit');
  // Symplectic integration of one LEO orbit: energy drift below 1e-6.
  const { ship } = setup('leo');
  const e0 = ship.v.lengthSq() / 2 - ship.ref.gm / ship.r.length();
  run(ship, { ...baseCtrl, sas: false }, 5550, T0);
  const e1 = ship.v.lengthSq() / 2 - ship.ref.gm / ship.r.length();
  assert.ok(Math.abs((e1 - e0) / e0) < 1e-6, `orbit energy drift ${(e1 - e0) / e0}`);
  console.log('✓ orbital mechanics');
}

// 2 ---------------------------------------------------------------------------
{
  const { ship } = setup('entry-earth');
  let maxT = 0,
    maxG = 0;
  run(ship, baseCtrl, 2400, T0, (s) => {
    maxT = Math.max(maxT, s.hullTemp);
    if (s.altitude < 100e3) maxG = Math.max(maxG, s.gForce);
  });
  assert.ok(!ship.destroyed, 'entry survived: ' + ship.destroyReason);
  assert.ok(maxT > 1300 && maxT < 1920, `peak TPS temperature ${maxT.toFixed(0)} K`);
  assert.ok(maxG < 2.0, `peak load ${maxG.toFixed(2)} g`);
  assert.ok(ship.surfaceSpeed < 5000, `entry decelerated to ${ship.surfaceSpeed.toFixed(0)} m/s`);
  console.log(`✓ Earth entry: peak ${maxT.toFixed(0)} K, ${maxG.toFixed(2)} g`);
}

// 3 ---------------------------------------------------------------------------
{
  const { ship } = setup('runway', true);
  const ctrl = { ...baseCtrl, gear: 1, sas: true };
  ship.sasTarget = ship.q.clone();
  let t = run(ship, ctrl, 6, T0);
  assert.ok(
    !ship.destroyed && ship.landed,
    `rests on the runway (${ship.destroyReason} v=${ship.surfaceSpeed.toFixed(3)} w=${ship.w.length().toFixed(4)} c=${ship.contactCount} galt=${ship.groundAltitude.toFixed(2)})`,
  );
  assert.ok(Math.abs(ship.gForce - 1) < 0.05, `1 g on the ground (${ship.gForce.toFixed(3)})`);
  let liftoff = null;
  t = run(ship, { ...ctrl, throttle: 1 }, 30, t);
  ship.sasTarget = null;
  run(ship, { ...ctrl, throttle: 1, pitch: 0.6, sas: false }, 15, t, (s) => {
    if (liftoff === null && s.contactCount === 0) liftoff = s.surfaceSpeed;
  });
  assert.ok(!ship.destroyed, 'take-off: ' + ship.destroyReason);
  assert.ok(liftoff !== null && liftoff < 320, `lift-off at ${liftoff?.toFixed(0)} m/s`);
  console.log(`✓ runway: lift-off at ${liftoff.toFixed(0)} m/s`);
}

// 4 ---------------------------------------------------------------------------
for (const [vs, survive] of [
  [2, true],
  [7, false],
]) {
  const { ship, st } = setup('runway', true);
  const up = st.r.clone().normalize();
  ship.r.addScaledVector(up, 3);
  ship.v.addScaledVector(up, -vs);
  run(ship, { ...baseCtrl, gear: 1 }, 4, T0);
  assert.equal(!ship.destroyed, survive, `touchdown at ${vs} m/s`);
}
console.log('✓ landing gear limits');
void THREE;
