// «Буран-М: Одиссея» — entry point and game loop.
//
// Loop structure: physics advances in fixed 1/240 s steps from an
// accumulator (or analytically on rails at high time warp), completely
// independent of the render rate; rendering then interpolates nothing and
// simply draws the latest state with a floating origin at the camera.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import {
  AU,
  DEG,
  G0,
  J2000_UNIX_MS,
  SOLAR_LUMINOSITY,
  formatDistance,
  formatDuration,
  formatSpeed,
} from './core/constants.js';
import { AssetLoader, TerrainWorkerPool, TextureWorkerPool } from './core/loader.js';
import { SOLAR_SYSTEM } from './data/solarSystem.js';
import { StarSystem } from './physics/bodies.js';
import { Ship, SPEC, PHYSICS_DT, hohmann } from './physics/ship.js';
import { BodyVisual } from './world/bodyVisual.js';
import { Sky } from './world/sky.js';
import { FloraField } from './world/life.js';
import { generateNeighborhood, generateSystem } from './world/procedural.js';
import { BuranModel } from './ship/buranModel.js';
import { SurfaceDust, LocalPuffs, SURFACE_FX } from './fx/particles.js';
import { WarpTunnel } from './fx/warpTunnel.js';
import { Hud } from './ui/hud.js';
import { NavBall } from './ui/navball.js';
import { MapView } from './ui/mapView.js';
import { Input, KEYMAP } from './game/input.js';
import { CameraRig } from './game/cameraRig.js';
import { Science, WARP_REQUIREMENT, siteBearing, siteDistance } from './game/science.js';
import { MISSIONS, circularOrbit } from './game/missions.js';

const QUALITY = {
  ultra: {
    label: 'Ультра (4K)',
    pixelRatio: 2,
    shadow: 4096,
    splitFactor: 3.0,
    stars: 'stars8k',
    maxTex: 8192,
    shipHi: true,
  },
  high: {
    label: 'Высокое',
    pixelRatio: 1.5,
    shadow: 2048,
    splitFactor: 2.5,
    stars: 'stars8k',
    maxTex: 8192,
    shipHi: true,
  },
  medium: {
    label: 'Среднее',
    pixelRatio: 1,
    shadow: 1024,
    splitFactor: 2.0,
    stars: 'stars2k',
    maxTex: 4096,
    shipHi: false,
  },
};
const WARPS = [1, 2, 4, 10, 50, 100, 1000, 10000, 100000, 1000000, 10000000];
const SAS_KEYS = [
  'hold',
  'prograde',
  'retrograde',
  'normal',
  'antiNormal',
  'radialOut',
  'radialIn',
  'target',
];
const SOL_ENTRY = { name: 'Солнечная система', sol: true, distance: 0 };

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem('buran.settings') || '{}');
  } catch {
    return {};
  }
}
function saveSettings(s) {
  try {
    localStorage.setItem('buran.settings', JSON.stringify(s));
  } catch {
    /* storage blocked: settings last for this session only */
  }
}

class Game {
  constructor() {
    this.settings = { quality: 'ultra', ...loadSettings() };
    this.quality = QUALITY[this.settings.quality] ?? QUALITY.ultra;
    this.t = (Date.now() - J2000_UNIX_MS) / 1000;
    this.warpIndex = 0;
    this.acc = 0;
    this.paused = true;
    this.running = false;
    this.throttle = 0;
    this.sas = true;
    this.sasMode = 'hold';
    this.rcs = true;
    this.gearTarget = 0;
    this.gear = 0;
    this.brakes = false;
    this.speedBrake = 0;
    this.speedBrakeTarget = 0;
    this.target = null;
    this.siteIndex = -1;
    this.sandbox = false;
    this.hudVisible = true;
    this.frameTimes = [];
    this.realTime = 0;
    this.warpFx = null;
    this.neighborhood = generateNeighborhood();
  }

  async init() {
    const canvas = document.getElementById('view');
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      logarithmicDepthBuffer: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 5e15);
    this.scene.add(this.camera);

    this.loader = new AssetLoader();
    await this.loader.init();
    this.loader.maxTextureSize = Math.min(
      this.quality.maxTex,
      this.renderer.capabilities.maxTextureSize,
    );
    this.loader.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    this.workers = new TextureWorkerPool();
    this.terrainPool = new TerrainWorkerPool();

    // Light: the system's star, with a tight shadow frustum around the ship.
    this.sunLight = new THREE.DirectionalLight(0xffffff, 3);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(this.quality.shadow, this.quality.shadow);
    const sc = this.sunLight.shadow.camera;
    sc.left = -45;
    sc.right = 45;
    sc.top = 45;
    sc.bottom = -45;
    sc.near = 1;
    sc.far = 800;
    this.sunLight.shadow.bias = -0.0004;
    this.sunLight.shadow.normalBias = 0.05;
    this.scene.add(this.sunLight, this.sunLight.target);
    this.ambient = new THREE.AmbientLight(0xffffff, 0.02);
    this.hemi = new THREE.HemisphereLight(0x88aaff, 0x442211, 0);
    this.scene.add(this.ambient, this.hemi);

    this.sky = new Sky(this.scene);
    this.loader
      .texture(this.quality.stars)
      .then((t) => this.sky.setTexture(t))
      .catch(() => {
        this.loader
          .texture('stars2k')
          .then((t) => this.sky.setTexture(t))
          .catch(() => {});
      });

    // Environment map for the orbiter's glass and metal: the sky itself.
    this.model = new BuranModel({ anisotropy: this.loader.anisotropy, hiRes: this.quality.shipHi });
    this.scene.add(this.model.group);
    this.model.group.traverse((o) => {
      if (o.isMesh) o.frustumCulled = false;
    });
    this.rcsPuffs = new LocalPuffs(this.model.group, 1500, false);
    this.sparks = new LocalPuffs(this.model.group, 1500, true);
    this.explosion = new LocalPuffs(this.scene, 2500, true);
    this.dust = new SurfaceDust(this.scene);
    this.flora = new FloraField();
    this.tunnel = new WarpTunnel(this.camera);

    this.composer = new EffectComposer(
      this.renderer,
      new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }),
    );
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.75, 0.55, 0.92);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.hud = new Hud(document.getElementById('hud'));
    this.navball = new NavBall(
      document.getElementById('navball'),
      document.getElementById('nb-overlay'),
    );
    this.map = new MapView(this.scene, document.getElementById('labels'));
    this.input = new Input();
    this.rig = new CameraRig(this.camera, canvas);
    this.science = new Science((t, k) => this.hud.toast(t, k));
    this.ship = new Ship();

    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.buildMenus();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  resize() {
    const w = window.innerWidth,
      h = window.innerHeight;
    const pr =
      Math.min(window.devicePixelRatio || 1, this.quality.pixelRatio) *
      (this.settings.renderScale || 1);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.width = w;
    this.height = h;
    this.pixelRatio = pr;
  }

  // ------------------------------------------------------------------ systems
  async loadSystem(system, onProgress) {
    if (this.system) {
      for (const b of this.system.bodies) b.visual?.dispose();
    }
    this.system = system;
    system.update(this.t);
    const ctx = {
      loader: this.loader,
      workers: this.workers,
      terrainPool: this.terrainPool,
      quality: this.quality,
    };
    this.map.setSystem(system);
    const visuals = system.bodies.map((b) => new BodyVisual(b, ctx));
    for (const v of visuals) {
      this.scene.add(v.root, v.inertial);
    }
    let done = 0;
    await Promise.all(
      visuals.map((v) =>
        v
          .build()
          .catch((e) => console.error('visual', v.body.id, e))
          .finally(() => onProgress?.(++done / visuals.length)),
      ),
    );
    this.map.setSystem(system);
    this.flora.body = null;
  }

  placeShip(ref, st) {
    this.ship.setState(ref, st.r, st.v, st.q);
    this.ship.events.length = 0;
    this.ship.destroyed = false;
    this.ship.splashed = false;
    this.ship.chuteDeployed = false;
    this.ship.chuteLost = false;
    this.ship.maxG = 0;
    this.ship.refuel();
    this.gearTarget = st.gear ? 1 : 0;
    this.gear = this.gearTarget;
    this.throttle = 0;
    this.sas = true;
    this.sasMode = st.sas ?? 'hold';
    this.ship.sasTarget = st.q.clone();
    this.siteIndex = st.site ?? -1;
    this.target = null;
    this.warpIndex = 0;
    this.acc = 0;
    this.model.group.visible = true;
    this.dust.count = 0;
    this.explosion.count = 0;
    this.rig.mapDist = 0;
    document.getElementById('gameover').classList.add('hidden');
  }

  async startMission(m) {
    this.showLoading('Подготовка миссии…', 0);
    this.paused = true;
    this.sandbox = !!m.sandbox;
    if (!this.system || !this.system.meta.sol) {
      await this.loadSystem(
        new StarSystem(SOLAR_SYSTEM, { name: 'Солнечная система', sol: true, seed: 0 }),
        (p) => this.showLoading('Загрузка текстур и рельефа Солнечной системы…', p * 0.8),
      );
    }
    this.system.update(this.t);
    const body = this.system.get(m.body);
    if (m.siteIndex !== undefined) this.alignDaylight(body, body.def.sites[m.siteIndex]);
    await this.prewarm(body, 0.8);
    const st = m.setup(body);
    if (m.daylight !== false && st.sas) this.daySide(body, st);
    this.placeShip(body, st);
    this.mission = m;
    if (st.landed) {
      await this.prewarm(body, 0.9, this.ship.worldPos());
      Object.assign(this.ship, { landed: true });
    }
    this.hideMenus();
    this.paused = false;
    this.hud.toast(`${m.title}. ${m.brief}`);
  }

  // Orbital starts on the day side: rotate the state about the orbit normal
  // until the ship is roughly under the star.
  daySide(body, st) {
    const sun = this.system.star.pos.clone().sub(body.pos).normalize();
    const n = new THREE.Vector3().crossVectors(st.r, st.v).normalize();
    const sp = sun.clone().addScaledVector(n, -sun.dot(n));
    if (sp.lengthSq() > 1e-6) {
      const ang =
        Math.atan2(new THREE.Vector3().crossVectors(st.r, sp).dot(n), st.r.dot(sp)) - 0.35;
      const q = new THREE.Quaternion().setFromAxisAngle(n, ang);
      st.r.applyQuaternion(q);
      st.v.applyQuaternion(q);
      st.q.premultiply(q);
    }
    return st;
  }

  // Surface scenarios start in the local morning at the target site: advance
  // the clock (never backwards) until the Sun stands ~35° above its horizon.
  alignDaylight(body, site) {
    if (!site || !body.siderealDay) return;
    const t0 = this.t;
    let best = t0,
      bestErr = Infinity;
    for (let k = 0; k < 400; k++) {
      const t = t0 + (k / 400) * Math.min(body.siderealDay, 40 * 86400);
      this.system.update(t);
      const up = body.dirFromLatLon(site.lat, site.lon).applyQuaternion(body.quat);
      const sun = this.system.star.pos.clone().sub(body.pos).normalize();
      const elev = Math.asin(up.dot(sun));
      const rising = new THREE.Vector3().crossVectors(body.angVel, up).dot(sun) > 0;
      const err = Math.abs(elev - 0.6) + (rising ? 0 : 0.5);
      if (err < bestErr) {
        bestErr = err;
        best = t;
      }
    }
    this.t = best;
    this.system.update(this.t);
  }

  // Build terrain around the start point before the player sees it.
  async prewarm(body, p0, focus) {
    if (!body.visual?.terrain) return;
    const cam =
      focus ?? body.pos.clone().add(new THREE.Vector3(1, 0, 0).multiplyScalar(body.radius * 3));
    const start = performance.now();
    while (performance.now() - start < 6000) {
      this.rig.world.copy(cam);
      const f = this.frameContext(cam);
      f.budgetMs = 60;
      body.visual.update(f);
      this.showLoading('Генерация рельефа…', p0 + ((performance.now() - start) / 6000) * 0.2);
      if (!body.visual.pendingChunks) break;
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  frameContext(camPos) {
    const star = this.system.star;
    const dist = camPos.distanceTo(star.pos);
    const L = (star.def.star?.luminosity ?? SOLAR_LUMINOSITY) / SOLAR_LUMINOSITY;
    return {
      origin: camPos,
      camPos,
      camera: this.camera,
      starPos: star.pos,
      t: this.t,
      realTime: this.realTime,
      pixelAngle: (this.camera.fov * DEG) / (this.height * this.pixelRatio),
      budgetMs: 5,
      fluxScale: L / Math.max(1e-6, (dist / AU) ** 2),
    };
  }

  async jumpTo(entry) {
    const ship = this.ship;
    const ref = ship.ref;
    if (!this.science.warpReady && !this.sandbox) {
      this.hud.toast(
        `Варп-двигатель не откалиброван: нужно ${WARP_REQUIREMENT} очков науки (есть ${this.science.points}).`,
        'warn',
      );
      return;
    }
    const clear =
      ref.kind === 'star' ||
      ship.altitude > Math.max(ref.radius * 0.5, ref.atmosphereTop() + 200e3);
    if (!clear) {
      this.hud.toast(
        `Слишком глубоко в гравитационном колодце: поднимитесь выше ${formatDistance(Math.max(ref.radius * 0.5, ref.atmosphereTop() + 200e3))}.`,
        'warn',
      );
      return;
    }
    if (entry.sol && this.system.meta.sol) return;
    if (!entry.sol && this.system.meta.seed === entry.seed) return;
    this.closeStarMap();
    this.warpFx = {
      t: 0,
      entry,
      swapped: false,
      dir: new THREE.Vector3(1, 0, 0).applyQuaternion(ship.q),
    };
    this.hud.toast(
      `Варп-прыжок: ${entry.name}${entry.distance ? ', ' + formatDistance(entry.distance) : ''}`,
    );
  }

  async _swapSystem(entry) {
    this.paused = true;
    let sys;
    if (entry.sol)
      sys = new StarSystem(SOLAR_SYSTEM, { name: 'Солнечная система', sol: true, seed: 0 });
    else {
      const g = generateSystem(entry);
      sys = new StarSystem(g.defs, g.meta);
    }
    await this.loadSystem(sys);
    sys.update(this.t);
    let body;
    if (entry.sol) body = sys.get('earth');
    else {
      const planets = sys.bodies.filter((b) => b.kind === 'planet' || b.kind === 'dwarf');
      body =
        planets.find((b) => b.def.life) ??
        planets.find((b) => b.def.science?.ocean) ??
        planets.find((b) => !b.gasGiant) ??
        planets[0];
    }
    const alt = Math.max(body.atmosphereTop() + 150e3, body.radius * 0.25);
    const st = this.daySide(body, circularOrbit(body, alt, 8, 0, 0));
    const keepFuel = { fuel: this.ship.fuel, rcs: this.ship.rcsFuel };
    this.placeShip(body, { ...st, sas: 'prograde' });
    this.ship.fuel = keepFuel.fuel;
    this.ship.rcsFuel = keepFuel.rcs;
    await this.prewarm(body, 0.9, this.ship.worldPos());
    this.hideLoading();
    this.paused = false;
    const star = sys.star.def;
    this.hud.toast(entry.sol ? 'Возвращение в Солнечную систему.' : `${star.name}: ${star.facts}`);
    this.hud.toast(`${body.name}: ${body.def.surface?.desc ?? ''}`);
  }

  // ------------------------------------------------------------------ controls
  handleInput(dt) {
    const I = this.input;
    if (I.hit('Escape')) {
      if (!document.getElementById('starmap').classList.contains('hidden')) this.closeStarMap();
      else this.togglePause();
    }
    if (I.hit('F1')) document.getElementById('help').classList.toggle('hidden');
    if (I.hit('F2')) {
      this.hudVisible = !this.hudVisible;
      document.getElementById('hud').classList.toggle('hidden', !this.hudVisible);
    }
    if (this.paused) return;
    if (I.down('ShiftLeft') || I.down('ShiftRight'))
      this.throttle = Math.min(1, this.throttle + dt * 0.6);
    if (I.down('ControlLeft') || I.down('ControlRight'))
      this.throttle = Math.max(0, this.throttle - dt * 0.6);
    if (I.hit('KeyZ')) this.throttle = 1;
    if (I.hit('KeyX')) this.throttle = 0;
    if (I.hit('KeyT')) {
      this.sas = !this.sas;
      this.ship.sasTarget = this.ship.q.clone();
      this.hud.toast(`SAS ${this.sas ? 'включена' : 'выключена'}`);
    }
    for (let i = 0; i < 8; i++) {
      if (I.hit('Digit' + (i + 1))) {
        this.sasMode = SAS_KEYS[i];
        this.sas = true;
        this.ship.sasTarget = this.ship.q.clone();
      }
    }
    if (I.hit('KeyR')) this.rcs = !this.rcs;
    if (I.hit('KeyG')) this.gearTarget = this.gearTarget ? 0 : 1;
    this.brakes = I.down('KeyB');
    if (I.hit('KeyF')) this.speedBrakeTarget = this.speedBrakeTarget ? 0 : 1;
    if (I.hit('KeyP')) this.toggleChute();
    if (I.hit('Period')) this.setWarp(this.warpIndex + 1);
    if (I.hit('Comma')) this.setWarp(this.warpIndex - 1);
    if (I.hit('Slash')) this.setWarp(0);
    if (I.hit('KeyM')) this.rig.map = !this.rig.map;
    if (I.hit('KeyV')) this.rig.cycle();
    if (I.hit('Tab')) this.cycleTarget();
    if (I.hit('KeyY')) this.cycleSite();
    if (I.hit('KeyU')) this.openStarMap();
    if (I.hit('KeyO')) this.tryRefuel();
  }

  setWarp(i) {
    this.warpIndex = Math.max(0, Math.min(WARPS.length - 1, i));
  }

  railsAllowed() {
    const s = this.ship;
    if (s.lock) return true;
    const ref = s.ref;
    if (this.throttle > 0) return 'двигатель работает';
    if (ref.atmosphere && s.altitude < ref.atmosphere.top) return 'в атмосфере';
    if (s.contactCount > 0 && !s.landed) return 'касание грунта';
    if (s.landed) return true;
    if (isFinite(s.groundAltitude) && s.groundAltitude < 10000 + (ref.maxTerrain || 0) * 0)
      return 'близко к поверхности';
    return true;
  }

  toggleChute() {
    const s = this.ship;
    if (s.chuteDeployed) {
      s.chuteDeployed = false;
      this.hud.toast('Парашюты отстрелены');
      return;
    }
    if (s.airDensity < 1e-4) return this.hud.toast('Парашюты бесполезны без атмосферы', 'warn');
    s.chuteDeployed = true;
    s.chuteLost = false;
    this.hud.toast(
      s.surfaceSpeed > SPEC.chuteMaxSpeed
        ? 'Скорость слишком велика — купола порвёт!'
        : 'Тормозные парашюты выпущены',
      s.surfaceSpeed > SPEC.chuteMaxSpeed ? 'warn' : '',
    );
  }

  cycleTarget() {
    const list = this.system.bodies.filter((b) => b !== this.ship.ref);
    const i = this.target ? list.indexOf(this.target) : -1;
    this.target = i + 1 < list.length ? list[i + 1] : null;
    this.hud.toast(this.target ? `Цель: ${this.target.name}` : 'Цель снята');
  }

  cycleSite() {
    const sites = this.ship.ref.def.sites || [];
    if (!sites.length) return this.hud.toast('Для этого тела нет каталогизированных мест посадки');
    this.siteIndex = this.siteIndex + 1 < sites.length ? this.siteIndex + 1 : -1;
    this.hud.toast(
      this.siteIndex >= 0 ? `Место посадки: ${sites[this.siteIndex].name}` : 'Место посадки снято',
    );
  }

  tryRefuel() {
    const s = this.ship;
    const p = s.ref.def.surface?.particles;
    const isru =
      ['ice', 'soil', 'dust-red', 'hydrocarbon', 'water'].includes(p) || s.ref.def.science?.ocean;
    if (!s.landed) return this.hud.toast('Дозаправка возможна только после посадки', 'warn');
    if (!isru)
      return this.hud.toast('Здесь нет воды или летучих для получения рабочего тела', 'warn');
    s.lockToSurface();
    s.refuel();
    this.t += 6 * 3600;
    this.hud.toast(`Рабочее тело восполнено из местных ресурсов (6 ч). ${s.ref.name}.`);
  }

  // ------------------------------------------------------------------ loop
  frame() {
    const now = performance.now();
    const realDt = Math.min(0.1, this.last ? (now - this.last) / 1000 : 1 / 60);
    this.last = now;
    this.realTime += realDt;
    this.frameTimes.push(realDt);
    if (this.frameTimes.length > 60) this.frameTimes.shift();
    if (!this.system || !this.ship.ref) {
      this.input.endFrame();
      return;
    }
    this.handleInput(realDt);
    const axes = this.input.update(realDt);
    const ship = this.ship;

    // Actuators
    this.gear +=
      Math.sign(this.gearTarget - this.gear) *
      Math.min(Math.abs(this.gearTarget - this.gear), realDt / 3.5);
    this.speedBrake +=
      Math.sign(this.speedBrakeTarget - this.speedBrake) *
      Math.min(Math.abs(this.speedBrakeTarget - this.speedBrake), realDt / 2);
    if (this.sas && this.sasMode === 'hold') {
      const active = Math.abs(axes.pitch) + Math.abs(axes.yaw) + Math.abs(axes.roll) > 0.01;
      if (active) ship.sasTarget = null;
      else if (!ship.sasTarget && ship.w.length() < 0.01) ship.sasTarget = ship.q.clone();
    }
    const targetDir = this.target ? this.target.pos.clone().sub(ship.worldPos()).normalize() : null;
    const ctrl = {
      pitch: axes.pitch,
      yaw: axes.yaw,
      roll: axes.roll,
      throttle: ship.destroyed ? 0 : this.throttle,
      tx: (this.input.down('KeyH') ? 1 : 0) - (this.input.down('KeyN') ? 1 : 0),
      ty: (this.input.down('KeyL') ? 1 : 0) - (this.input.down('KeyJ') ? 1 : 0),
      tz: (this.input.down('KeyK') ? 1 : 0) - (this.input.down('KeyI') ? 1 : 0),
      rcs: this.rcs,
      sas: this.sas,
      sasMode: this.sasMode,
      gear: this.gear,
      brakes: this.brakes,
      speedBrake: this.speedBrake,
      targetDir,
    };

    // Physics
    let warpNote = '';
    if (!this.paused && !this.warpFx?.swapping) {
      let warp = WARPS[this.warpIndex];
      const rails = warp > 4 ? this.railsAllowed() : false;
      if (warp > 4 && rails !== true) {
        warpNote = `физика ×4: ${rails}`;
        warp = 4;
      }
      ship.sampleEnvironment();
      if (warp > 4) {
        if (ship.landed) ship.lockToSurface();
        const res = ship.propagateOnRails(realDt * warp, this.system, this.t, this.sasMode);
        this.t = res.t;
        if (!res.ok) {
          this.setWarp(0);
          this.hud.toast('Ускорение времени снято: приближение к атмосфере/рельефу', 'warn');
        }
      } else {
        if (ship.lock && this.throttle > 0) ship.unlock();
        if (ship.lock && warp <= 4) ship.unlock();
        this.acc += realDt * warp;
        let n = 0;
        while (this.acc >= PHYSICS_DT && n < 2400) {
          this.t += PHYSICS_DT;
          ship.step(PHYSICS_DT, ctrl, this.t);
          this.acc -= PHYSICS_DT;
          n++;
          if (n % 60 === 0) ship.sampleEnvironment();
        }
        if (n >= 2400) this.acc = 0;
        this.system.update(this.t);
        ship.checkSoi(this.system, this.t);
      }
      ship.sampleEnvironment();
      this.science.update(ship, realDt * warp, this.system, this.t);
    }
    this.handleEvents();

    // Camera & floating origin
    this.rig.update(ship, realDt);
    const origin = this.rig.world.clone();
    const f = this.frameContext(origin);
    for (const b of this.system.bodies) b.visual?.update(f);
    const shipPos = ship.worldPos();
    this.model.group.position.subVectors(shipPos, origin);
    this.model.group.quaternion.copy(ship.q);
    this.model.update({
      throttle: ship.destroyed || this.paused ? 0 : ship.thrust / SPEC.thrustVac || 0,
      pitch: ship.rcsActivity.y,
      roll: ship.rcsActivity.x,
      yaw: ship.rcsActivity.z,
      speedBrake: this.speedBrake,
      bodyFlap: -axes.pitch * 0.5,
      gear: this.gear,
      chute: ship.chuteDeployed && !ship.chuteLost,
      hullTemp: ship.hullTemp,
      plasma: ship.plasma,
      flowLocal: ship.airVelLocal,
      atmFactor: ship.atmFactor || 0,
      time: this.realTime,
      plasmaColor:
        ship.ref.def.atmosphere?.heatK > 1.8e-4
          ? new THREE.Color(1.0, 0.62, 0.3)
          : new THREE.Color(1.0, 0.42, 0.55),
    });
    this.updateLighting(f, shipPos, origin);
    this.updateEffects(realDt, origin);

    // Warp jump sequence
    if (this.warpFx) {
      const w = this.warpFx;
      w.t += realDt;
      const I = w.t < 2 ? w.t / 2 : w.t < 3 ? 1 : Math.max(0, 1 - (w.t - 3) / 1.5);
      this.tunnel.update(
        I,
        this.realTime,
        w.dir.clone().transformDirection(this.camera.matrixWorldInverse),
      );
      if (w.t > 2 && !w.swapped) {
        w.swapped = true;
        w.swapping = true;
        this._swapSystem(w.entry).finally(() => {
          w.swapping = false;
          w.t = 3;
        });
      }
      if (w.t > 4.5 && !w.swapping) {
        this.warpFx = null;
        this.tunnel.update(0, 0);
      }
    }

    // HUD
    if (this.running) this.updateHud(realDt, warpNote);
    this.composer.render();
    this.input.endFrame();
  }

  updateLighting(f, shipPos, origin) {
    const star = this.system.star;
    const sunDir = star.pos.clone().sub(shipPos).normalize();
    const shipRender = this.model.group.position;
    this.sunLight.position.copy(shipRender).addScaledVector(sunDir, 400);
    this.sunLight.target.position.copy(shipRender);
    const starColor = star.visual?.starColor ?? new THREE.Color(1, 1, 1);
    this.sunLight.color.copy(starColor);
    const flux = f.fluxScale;
    // Eclipse: is the star hidden by the reference body?
    const ref = this.ship.ref;
    let shadow = 1;
    if (ref !== star) {
      const toRef = ref.pos.clone().sub(shipPos);
      const along = toRef.dot(sunDir);
      if (along > 0) {
        const perp = toRef.clone().addScaledVector(sunDir, -along).length();
        shadow = THREE.MathUtils.smoothstep(perp, ref.radius * 0.995, ref.radius * 1.005);
      }
    }
    // Cloud deck (Venus) attenuation below the clouds: ~2% of sunlight reaches the ground.
    const deck = ref.def.atmosphere?.cloudDeck;
    if (deck && this.ship.altitude < deck.base) shadow *= 0.08;
    this.sunLight.intensity = 2.6 * Math.min(flux, 12) * shadow;
    this.renderer.toneMappingExposure = THREE.MathUtils.clamp(Math.pow(flux, -0.85), 0.45, 40);
    // Sky light inside an atmosphere.
    const atm = ref.atmosphere;
    let daylight = 0;
    if (atm) {
      const camAlt = f.camPos.distanceTo(ref.pos) - ref.radius;
      const up = f.camPos.clone().sub(ref.pos).normalize();
      const elev = up.dot(sunDir);
      daylight =
        THREE.MathUtils.smoothstep(elev, -0.12, 0.2) *
        Math.min(1, (atm.density(Math.max(camAlt, 0)) / atm.rho0) * 3);
      this.hemi.color.setRGB(...atm.def.fog);
      this.hemi.intensity = daylight * 0.9 * Math.min(1.5, flux);
    } else this.hemi.intensity = 0;
    this.ambient.intensity = 0.015 + 0.02 * shadow;
    this.sky.update(this.pixelRatio, 1 - daylight * 0.97);
    this.bloom.strength = 0.6 + 0.3 * (1 - daylight);
    void origin;
  }

  updateEffects(dt, origin) {
    const ship = this.ship;
    const ref = ship.ref;
    const q = ship.q;
    // RCS puffs
    if (this.rcs && !ship.destroyed && !this.paused) {
      const cmd = ship.rcsActivity;
      const tr = ship.rcsTranslate;
      for (const th of this.model.rcsThrusters) {
        const p = new THREE.Vector3(...th.p);
        const F = new THREE.Vector3(...th.d).negate();
        const tq = new THREE.Vector3().crossVectors(p, F).normalize();
        const act = tq.x * cmd.x + tq.y * cmd.y + tq.z * cmd.z + F.dot(tr);
        if (act > 0.3) {
          for (let k = 0; k < 2; k++) {
            this.rcsPuffs.emit(
              p.x,
              p.y,
              p.z,
              th.d[0] * 28 + (Math.random() - 0.5) * 6,
              th.d[1] * 28 + (Math.random() - 0.5) * 6,
              th.d[2] * 28 + (Math.random() - 0.5) * 6,
              0.3,
              0.45,
              [0.8, 0.82, 0.86],
            );
          }
        }
      }
    }
    // Entry sparks streaming off the windward side
    if (ship.plasma > 0.15 && !ship.destroyed) {
      const back = ship.airVelLocal.clone().negate();
      const n = Math.floor(ship.plasma * 12);
      for (let k = 0; k < n; k++) {
        const x = (Math.random() - 0.3) * 30,
          y = (Math.random() - 0.5) * 18,
          z = 2.5 + Math.random();
        this.sparks.emit(
          x,
          y,
          z,
          back.x * 260,
          back.y * 260,
          back.z * 260,
          0.2,
          0.9,
          [1.0, 0.5, 0.2],
        );
      }
    }
    this.rcsPuffs.update(dt);
    this.sparks.update(dt);
    // Exhaust impinging on the ground: ejecta ring
    const fx = ship.onWater ? 'water' : ref.def.surface?.particles;
    if (ref.terrain && fx && fx !== 'gas' && ship.thrust > 0 && ship.groundAltitude < 120) {
      const exhaust = new THREE.Vector3(-1, 0, 0).applyQuaternion(q);
      const down = ship.r.clone().normalize().negate();
      const c = exhaust.dot(down);
      if (c > 0.3) {
        const dist = ship.groundAltitude / c;
        const hitI = ship.r.clone().addScaledVector(exhaust, dist);
        const qi = ref.quat.clone().invert();
        const hit = hitI.clone().applyQuaternion(qi);
        const up = hit.clone().normalize();
        const n = Math.floor(30 * (ship.thrust / SPEC.thrustVac) * (1 - ship.groundAltitude / 120));
        for (let k = 0; k < n; k++) {
          const a = Math.random() * Math.PI * 2;
          const t1 = new THREE.Vector3(-up.y, up.x, 0).normalize();
          const t2 = new THREE.Vector3().crossVectors(up, t1);
          const dir = t1.multiplyScalar(Math.cos(a)).addScaledVector(t2, Math.sin(a));
          const sp = 20 + Math.random() * 45;
          const vel = dir.multiplyScalar(sp).addScaledVector(up, sp * 0.25);
          this.dust.emit(ref, fx, hit, vel, 6, 1, ref.radius + ship.groundHeight);
        }
      }
    }
    // Wheels rolling
    if (ship.contactCount > 0 && ship.surfaceSpeed > 4 && fx) {
      const qi = ref.quat.clone().invert();
      for (const gp of [
        [-3.5, 3.6, 5.2],
        [-3.5, -3.6, 5.2],
      ]) {
        const P = new THREE.Vector3(...gp).applyQuaternion(q).add(ship.r).applyQuaternion(qi);
        const up = P.clone().normalize();
        this.dust.emit(
          ref,
          fx,
          P,
          up.multiplyScalar(2 + ship.surfaceSpeed * 0.05),
          3,
          Math.min(6, ship.surfaceSpeed / 10),
          ref.radius + ship.groundHeight,
        );
      }
    }
    this.dust.update(this.paused ? 0 : dt, origin);
    // Explosion debris hangs where the ship died.
    if (ship.destroyed) {
      this.explosion.mesh.position.copy(this.model.group.position);
      this.explosion.update(dt);
    }
    // Alien flora
    if (ref.def.life && ref.visual) {
      const qi = ref.quat.clone().invert();
      const local = ship.r.clone().applyQuaternion(qi);
      const sunW = this.system.star.pos.clone().sub(ship.worldPos()).normalize();
      const sunL = sunW.clone().applyQuaternion(qi);
      const u = ref.visual.surfaceMaterial?.userData.uniforms;
      this.flora.update(
        ref,
        local,
        ship.groundAltitude,
        this.realTime,
        sunL,
        sunW,
        u ? { color: u.uFogColor.value, density: u.uFogDensity.value } : null,
      );
    } else this.flora.group.visible = false;
  }

  handleEvents() {
    const ship = this.ship;
    const ref = ship.ref;
    for (const e of ship.events) {
      switch (e.type) {
        case 'soi':
          this.hud.toast(`Сфера действия: ${e.body.name}`);
          if (this.warpIndex > 6) this.setWarp(6);
          break;
        case 'touchdown': {
          if (e.gear === 1)
            this.hud.toast(
              `Касание: ${e.speed.toFixed(2)} м/с${e.speed > 3 ? ' — жёстко!' : ''}`,
              e.speed > 3 ? 'warn' : '',
            );
          const fx = ship.onWater ? 'water' : ref.def.surface?.particles;
          if (fx && fx !== 'gas') {
            const qi = ref.quat.clone().invert();
            const P = ship.r
              .clone()
              .addScaledVector(ship.r.clone().normalize(), -5)
              .applyQuaternion(qi);
            const up = P.clone().normalize();
            this.dust.emit(
              ref,
              fx,
              P,
              up.multiplyScalar(e.speed * 2.5 + 3),
              14,
              120 + e.speed * 60,
              ref.radius + ship.groundHeight,
            );
          }
          break;
        }
        case 'splash':
          this.hud.toast('Приводнение! Орбитер не рассчитан на посадку на воду.', 'warn');
          break;
        case 'chuteRupture':
          this.hud.toast('Купола парашютов разорваны: скорость выше 140 м/с', 'warn');
          break;
        case 'destroyed':
          this.onDestroyed(e.reason);
          break;
      }
    }
    ship.events.length = 0;
  }

  onDestroyed(reason) {
    this.model.group.visible = false;
    this.explosion.count = 0;
    for (let k = 0; k < 1200; k++) {
      const d = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5,
      ).normalize();
      const s = 10 + Math.random() * 80;
      const c = Math.random() < 0.5 ? [1, 0.55, 0.2] : [1, 0.85, 0.5];
      this.explosion.emit(
        0,
        0,
        0,
        d.x * s,
        d.y * s,
        d.z * s,
        1.5 + Math.random() * 2.5,
        4 + Math.random() * 6,
        c,
      );
    }
    this.throttle = 0;
    this.setWarp(0);
    const go = document.getElementById('gameover');
    go.querySelector('.reason').textContent = reason;
    setTimeout(() => go.classList.remove('hidden'), 1800);
  }

  updateHud(dt, warpNote) {
    const ship = this.ship;
    const ref = ship.ref;
    const el = ship.equatorialElements();
    const fps = this.frameTimes.length / this.frameTimes.reduce((a, b) => a + b, 0);
    const ll = ref.latLon(ship.r);
    const date = new Date(J2000_UNIX_MS + this.t * 1000);
    const m = ship.mass;
    const dv = SPEC.ispVac * G0 * Math.log(m / (m - ship.fuel));
    const localG = ref.gm / ship.r.lengthSq();
    const twr = SPEC.thrustVac / (m * localG);

    // Navball frame
    const U = ship.r.clone().normalize();
    let N = ref.pole.clone().addScaledVector(U, -ref.pole.dot(U));
    if (N.lengthSq() < 1e-9) N = new THREE.Vector3(1, 0, 0);
    N.normalize();
    const E = new THREE.Vector3().crossVectors(N, U);
    const orbital = ship.altitude > ref.atmosphereTop() + 5000 || !ref.atmosphere;
    const vel = orbital ? ship.v.clone() : ship.surfaceVelocity(new THREE.Vector3());
    let siteDir = null;
    let siteHtml = '';
    const sites = ref.def.sites || [];
    if (this.siteIndex >= 0 && sites[this.siteIndex]) {
      const s = sites[this.siteIndex];
      const d = siteDistance(ship, ref, s);
      const brg = siteBearing(ship, ref, s);
      const P = ref
        .dirFromLatLon(s.lat, s.lon)
        .applyQuaternion(ref.quat)
        .multiplyScalar(ref.radius);
      siteDir = P.sub(ship.r).normalize();
      siteHtml = `<div class="hud-title">МЕСТО ПОСАДКИ</div><div class="row"><span class="k">${s.name}</span></div>
        <div class="row"><span class="k">Дальность</span><span class="v">${formatDistance(d)}</span></div>
        <div class="row"><span class="k">Азимут</span><span class="v">${brg.toFixed(1)}°</span></div>`;
    }
    const att = this.navball.update(ship.q, N, E, U, {
      pro: vel.lengthSq() > 0.01 ? vel.normalize() : null,
      radOut: U,
      nrm: new THREE.Vector3().crossVectors(ship.r, ship.v).normalize(),
      tgt: this.target ? this.target.pos.clone().sub(ship.worldPos()).normalize() : null,
      site: siteDir,
    });

    let targetHtml = siteHtml;
    if (this.target) {
      const tg = this.target;
      const d = tg.pos.distanceTo(ship.worldPos()) - tg.radius;
      const rv = tg.vel.clone().sub(ship.worldVel()).length();
      targetHtml += `<div class="hud-title">ЦЕЛЬ: ${tg.name}</div>
        <div class="row"><span class="k">Расстояние</span><span class="v">${formatDistance(d)}</span></div>
        <div class="row"><span class="k">Отн. скорость</span><span class="v">${formatSpeed(rv)}</span></div>`;
      if (tg.parent === ref) {
        const r1 = ship.r.length(),
          r2 = tg.relPos.length();
        const h = hohmann(ref.gm, r1, r2);
        const nrm = new THREE.Vector3().crossVectors(ship.r, ship.v).normalize();
        let phase = Math.atan2(
          new THREE.Vector3().crossVectors(ship.r, tg.relPos).dot(nrm),
          ship.r.dot(tg.relPos),
        );
        targetHtml += `<div class="row"><span class="k">Гоман: Δv₁ / Δv₂</span><span class="v">${formatSpeed(h.dv1)} / ${formatSpeed(h.dv2)}</span></div>
          <div class="row"><span class="k">Время перелёта</span><span class="v">${formatDuration(h.tof)}</span></div>
          <div class="row"><span class="k">Фазовый угол: нужно / сейчас</span><span class="v">${(h.phase / DEG).toFixed(1)}° / ${(phase / DEG).toFixed(1)}°</span></div>`;
      }
      if (this.map.encounter)
        targetHtml += `<div class="row enc">${this.map.encounter.label}</div>`;
      if (tg.def.surface?.desc) targetHtml += `<div class="row small">${tg.def.surface.desc}</div>`;
    } else if (ref.def.surface?.desc || ref.def.facts) {
      targetHtml += `<div class="hud-title">${ref.name}</div><div class="row small">${ref.def.surface?.desc ?? ref.def.facts}</div>
        <div class="row small">g = ${(ref.surfaceGravity / G0).toFixed(3)} g · сут. ${ref.siderealDay ? formatDuration(ref.siderealDay) : '—'}${ref.atmosphere ? ` · P₀ ${(ref.atmosphere.P0 / 1e5).toFixed(3)} бар` : ''}</div>`;
    }
    const pending = ref.visual?.pendingChunks;
    this.hud.update(
      {
        ship,
        el,
        ref,
        fps,
        date: date.toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
        warp: WARPS[this.warpIndex],
        warpNote,
        systemName: this.system.meta.name,
        science: this.science,
        warpNeed: WARP_REQUIREMENT,
        sandbox: this.sandbox,
        chunks: ref.terrain?.chunkCount ?? 0,
        latlon: `${(ll.lat / DEG).toFixed(3)}° / ${(ll.lon / DEG).toFixed(3)}°`,
        throttle: this.throttle,
        attitude: att,
        sas: this.sas,
        sasMode: this.sasMode,
        rcs: this.rcs,
        gear: this.gearTarget > 0,
        brakes: this.brakes,
        speedBrake: this.speedBrakeTarget > 0,
        dv: isFinite(dv) ? dv : 0,
        twr,
        targetHtml,
        rendering: pending > 150 ? 'ГЕНЕРАЦИЯ РЕЛЬЕФА' : '',
      },
      dt,
    );
    this.map.update(
      this.rig.map,
      ship,
      this.system,
      this.rig.world,
      this.camera,
      this.target,
      this.width,
      this.height,
      this.realTime,
    );
  }

  // ------------------------------------------------------------------ menus
  buildMenus() {
    const list = document.getElementById('missions');
    list.innerHTML = '';
    for (const m of MISSIONS) {
      const b = document.createElement('button');
      b.className = 'mission';
      b.innerHTML = `<b>${m.title}</b><span>${m.brief}</span>`;
      b.onclick = () => {
        this.running = true;
        this.startMission(m).catch((e) => {
          console.error(e);
          this.showLoading('Ошибка: ' + e.message, 1);
        });
      };
      list.appendChild(b);
    }
    const q = document.getElementById('quality');
    q.innerHTML = Object.entries(QUALITY)
      .map(([k, v]) => `<option value="${k}">${v.label}</option>`)
      .join('');
    q.value = this.settings.quality;
    q.onchange = () => {
      this.settings.quality = q.value;
      saveSettings(this.settings);
      this.hud.toast('Качество применится после перезапуска страницы');
    };
    const help = document.getElementById('help-keys');
    help.innerHTML = KEYMAP.map(([k, v]) => `<div><kbd>${k}</kbd><span>${v}</span></div>`).join('');
    document.getElementById('resume').onclick = () => this.togglePause();
    document.getElementById('go-restart').onclick = () =>
      this.mission && this.startMission(this.mission);
    document.getElementById('go-menu').onclick = () => {
      document.getElementById('gameover').classList.add('hidden');
      this.togglePause(true);
    };
    document.getElementById('reset-science').onclick = () => {
      this.science.reset();
      this.hud.toast('Научная программа сброшена');
    };
    document.getElementById('help-close').onclick = () =>
      document.getElementById('help').classList.add('hidden');
    document.getElementById('starmap-close').onclick = () => this.closeStarMap();
  }

  showLoading(text, p) {
    const l = document.getElementById('loading');
    l.classList.remove('hidden');
    l.querySelector('.text').textContent = text;
    l.querySelector('.fill').style.width = `${Math.round(p * 100)}%`;
  }

  hideLoading() {
    document.getElementById('loading').classList.add('hidden');
  }

  hideMenus() {
    document.getElementById('menu').classList.add('hidden');
    this.hideLoading();
    document.getElementById('hud').classList.toggle('hidden', !this.hudVisible);
    document.getElementById('resume').classList.remove('hidden');
  }

  togglePause(forceMenu) {
    const menu = document.getElementById('menu');
    if (!this.running) return;
    const show = forceMenu || menu.classList.contains('hidden');
    menu.classList.toggle('hidden', !show);
    this.paused = show;
  }

  openStarMap() {
    const el = document.getElementById('starmap');
    const body = document.getElementById('starmap-list');
    const ready = this.science.warpReady || this.sandbox;
    document.getElementById('starmap-status').textContent = ready
      ? 'Варп-двигатель откалиброван. Выберите звезду.'
      : `Нужно ${WARP_REQUIREMENT} очков науки для калибровки (сейчас ${this.science.points}). Совершайте посадки, орбитальную съёмку, отбор проб атмосферы.`;
    const rows = [SOL_ENTRY, ...this.neighborhood].map((s, i) => {
      const cur = s.sol ? this.system.meta.sol : this.system.meta.seed === s.seed;
      const hz = s.sol
        ? '0,95–1,67 а.е.'
        : `${Math.sqrt(s.luminosity / SOLAR_LUMINOSITY / 1.1).toFixed(3)}–${Math.sqrt(s.luminosity / SOLAR_LUMINOSITY / 0.36).toFixed(3)} а.е.`;
      return `<div class="star-row ${cur ? 'current' : ''}">
        <span class="dot" style="background:${s.sol ? '#fff4d6' : starCss(s.teff)}"></span>
        <b>${s.name}</b><span>${s.sol ? 'G2V' : s.spectral}</span><span>${s.sol ? '—' : formatDistance(s.distance)}</span>
        <span>${s.sol ? '5772 K' : s.teff.toFixed(0) + ' K'}</span><span>ОЗ ${hz}</span>
        <button data-i="${i}" ${cur || !ready ? 'disabled' : ''}>${cur ? 'здесь' : 'Прыжок'}</button></div>`;
    });
    body.innerHTML = rows.join('');
    body.querySelectorAll('button[data-i]').forEach((b) => {
      b.onclick = () => {
        const i = Number(b.dataset.i);
        this.jumpTo(i === 0 ? SOL_ENTRY : this.neighborhood[i - 1]);
      };
    });
    el.classList.remove('hidden');
  }

  closeStarMap() {
    document.getElementById('starmap').classList.add('hidden');
  }
}

function starCss(T) {
  if (T < 3900) return '#ffb07a';
  if (T < 5300) return '#ffd6a0';
  if (T < 6000) return '#fff4d6';
  if (T < 7300) return '#f6f6ff';
  return '#cfdcff';
}

const game = new Game();
window.__game = game;
game.init().catch((e) => {
  console.error(e);
  const l = document.getElementById('loading');
  l.classList.remove('hidden');
  l.querySelector('.text').textContent = 'Не удалось запустить WebGL2: ' + e.message;
});
void SURFACE_FX;
