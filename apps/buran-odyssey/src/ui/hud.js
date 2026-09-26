// Cockpit instrument panel. Values are written to the DOM at 12 Hz; the
// navball renders every frame.

import { formatDistance, formatSpeed, formatDuration, DEG } from '../core/constants.js';
import { SPEC } from '../physics/ship.js';

const ROWS_FLIGHT = [
  ['ref', 'Опорное тело'],
  ['alt', 'Высота'],
  ['radar', 'До поверхности'],
  ['vorb', 'Орбитальная скорость'],
  ['vsrf', 'Скорость отн. поверхности'],
  ['vvert', 'Вертикальная скорость'],
  ['ap', 'Апоцентр'],
  ['pe', 'Перицентр'],
  ['inc', 'Наклонение / e'],
  ['period', 'Период'],
  ['tap', 'До Ап / Пе'],
  ['latlon', 'Широта / долгота'],
];
const ROWS_ENV = [
  ['g', 'Перегрузка'],
  ['temp', 'Температура корпуса'],
  ['flux', 'Тепловой поток'],
  ['rho', 'Плотность атмосферы'],
  ['press', 'Давление'],
  ['tair', 'Температура среды'],
  ['mach', 'Число Маха / q'],
  ['aoa', 'Угол атаки / скольжения'],
  ['comp', 'Состав'],
  ['integ', 'Целостность / t° кабины'],
];

export class Hud {
  constructor(root) {
    this.root = root;
    root.innerHTML = `
      <div class="hud-top">
        <div class="hud-chip" id="h-date"></div>
        <div class="hud-chip" id="h-warp"></div>
        <div class="hud-chip" id="h-sys"></div>
        <div class="hud-chip sci" id="h-sci"></div>
        <div class="hud-chip" id="h-fps"></div>
      </div>
      <div class="hud-panel left"><div class="hud-title">ПОЛЁТ</div>${rows(ROWS_FLIGHT)}</div>
      <div class="hud-panel right"><div class="hud-title">СРЕДА И КОРПУС</div>${rows(ROWS_ENV)}
        <div class="bar"><div class="bar-fill" id="h-tempbar"></div><div class="bar-mark" style="left:${(SPEC.tpsLimit / 2400) * 100}%"></div></div>
      </div>
      <div class="hud-panel target" id="h-target"></div>
      <div class="hud-bottom">
        <div class="gauges left-g">
          <div class="vgauge"><div class="vg-fill thr" id="h-thr"></div><span>ТЯГА</span></div>
          <div class="vgauge"><div class="vg-fill fuel" id="h-fuel"></div><span>РТ</span></div>
          <div class="vgauge"><div class="vg-fill rcs" id="h-rcsf"></div><span>ДО</span></div>
        </div>
        <div class="navball-wrap">
          <div class="nb-readout" id="h-hdg"></div>
          <div class="navball-box"><canvas id="navball"></canvas><div id="nb-overlay"></div><div class="nb-reticle"></div></div>
          <div class="nb-modes" id="h-modes"></div>
        </div>
        <div class="gauges right-g">
          <div class="flags" id="h-flags"></div>
          <div class="dv" id="h-dv"></div>
        </div>
      </div>
      <div class="alerts" id="h-alerts"></div>
      <div class="toasts" id="h-toasts"></div>
      <div id="labels"></div>`;
    this.el = {};
    root.querySelectorAll('[id]').forEach((e) => (this.el[e.id] = e));
    this.t = 0;
  }

  set(id, html) {
    const e = this.el['v-' + id] || this.el[id];
    if (e && e._v !== html) {
      e._v = html;
      e.innerHTML = html;
    }
  }

  toast(text, kind = '') {
    const d = document.createElement('div');
    d.className = 'toast ' + kind;
    d.textContent = text;
    this.el['h-toasts'].appendChild(d);
    setTimeout(() => d.classList.add('out'), 5200);
    setTimeout(() => d.remove(), 6000);
  }

  update(s, dt) {
    this.t += dt;
    if (this.t < 1 / 12) return;
    this.t = 0;
    const { ship, el, ref } = s;
    const set = (k, v) => this.set(k, v);
    set('h-date', s.date);
    set('h-warp', `×${s.warp}${s.warpNote ? ' · ' + s.warpNote : ''}`);
    set('h-sys', s.systemName);
    set(
      'h-sci',
      `НАУКА ${s.science.points} · ВАРП ${s.science.warpReady || s.sandbox ? 'ГОТОВ' : `${s.science.points}/${s.warpNeed}`}`,
    );
    set('h-fps', `${s.fps.toFixed(0)} FPS · ${s.chunks} ч.`);
    set('ref', `${ref.name}${ref.atmosphere ? '' : ' (без атм.)'}`);
    set('alt', formatDistance(ship.altitude));
    set('radar', isFinite(ship.groundAltitude) ? formatDistance(ship.groundAltitude) : '—');
    set('vorb', formatSpeed(ship.v.length()));
    set('vsrf', formatSpeed(ship.surfaceSpeed));
    set(
      'vvert',
      `${ship.verticalSpeed >= 0 ? '▲' : '▼'} ${formatSpeed(Math.abs(ship.verticalSpeed))}`,
    );
    set('ap', el.e < 1 ? formatDistance(el.apoapsis - ref.radius) : 'гипербола');
    set('pe', formatDistance(el.periapsis - ref.radius));
    set('inc', `${(el.i / DEG).toFixed(2)}° / ${el.e.toFixed(4)}`);
    set('period', formatDuration(el.period));
    set('tap', `${el.e < 1 ? formatDuration(el.timeToAp) : '—'} / ${formatDuration(el.timeToPe)}`);
    set('latlon', s.latlon);

    set('g', `${ship.gForce.toFixed(2)} g <small>(макс ${ship.maxG.toFixed(1)})</small>`);
    set(
      'temp',
      `${ship.hullTemp.toFixed(0)} K <small>(${(ship.hullTemp - 273.15).toFixed(0)} °C)</small>`,
    );
    set('flux', `${(ship.heatFlux / 1000).toFixed(1)} кВт/м²`);
    set('rho', ship.airDensity > 0 ? `${ship.airDensity.toExponential(3)} кг/м³` : 'вакуум');
    set(
      'press',
      ship.airPressure > 1e5
        ? `${(ship.airPressure / 1e5).toFixed(2)} бар`
        : `${(ship.airPressure / 1000).toFixed(3)} кПа`,
    );
    set('tair', ref.atmosphere ? `${ship.airTemp.toFixed(0)} K` : '—');
    set(
      'mach',
      ship.airDensity > 0
        ? `M ${ship.mach.toFixed(2)} / ${(ship.dynPressure / 1000).toFixed(2)} кПа`
        : '—',
    );
    set(
      'aoa',
      ship.airDensity > 1e-7
        ? `${(ship.alpha / DEG).toFixed(1)}° / ${(ship.beta / DEG).toFixed(1)}°`
        : '—',
    );
    set('comp', ref.atmosphere ? ref.atmosphere.composition : '—');
    set(
      'integ',
      `${(ship.integrity * 100).toFixed(0)}% / ${(ship.cabinTemp - 273.15).toFixed(0)} °C`,
    );
    this.el['h-tempbar'].style.width = `${Math.min(100, (ship.hullTemp / 2400) * 100)}%`;
    this.el['h-tempbar'].classList.toggle('hot', ship.hullTemp > SPEC.tpsLimit * 0.85);
    this.el['h-thr'].style.height = `${s.throttle * 100}%`;
    this.el['h-fuel'].style.height = `${(ship.fuel / SPEC.fuelMax) * 100}%`;
    this.el['h-rcsf'].style.height = `${(ship.rcsFuel / SPEC.rcsFuelMax) * 100}%`;
    const att = s.attitude;
    set(
      'h-hdg',
      `КУРС ${att.heading.toFixed(0).padStart(3, '0')}° · ТАНГ ${att.pitch.toFixed(1)}° · КРЕН ${att.roll.toFixed(1)}°`,
    );
    const modes = [
      ['hold', 'УДЕРЖ'],
      ['prograde', 'ПРОГР'],
      ['retrograde', 'РЕТРО'],
      ['normal', 'НОРМ'],
      ['antiNormal', 'АНТИН'],
      ['radialOut', 'РАД+'],
      ['radialIn', 'РАД−'],
      ['target', 'ЦЕЛЬ'],
    ];
    set(
      'h-modes',
      modes
        .map(
          ([k, l], i) =>
            `<span class="${s.sas && s.sasMode === k ? 'on' : ''}">${i + 1}·${l}</span>`,
        )
        .join(''),
    );
    const flag = (on, text) => `<span class="${on ? 'on' : ''}">${text}</span>`;
    set(
      'h-flags',
      [
        flag(s.sas, 'SAS'),
        flag(s.rcs, 'RCS'),
        flag(s.gear, 'ШАССИ'),
        flag(s.brakes, 'ТОРМОЗ'),
        flag(s.speedBrake, 'ВОЗД.ТОРМ'),
        flag(ship.chuteDeployed && !ship.chuteLost, 'ПАРАШЮТ'),
        flag(ship.landed, 'НА ГРУНТЕ'),
      ].join(''),
    );
    set(
      'h-dv',
      `Δv запас ${formatSpeed(s.dv)}<br>Масса ${(ship.mass / 1000).toFixed(1)} т · ТВР ${s.twr.toFixed(2)}`,
    );
    set('h-target', s.targetHtml);
    const alerts = [];
    if (ship.hullTemp > SPEC.tpsLimit * 0.9) alerts.push('ПЕРЕГРЕВ ТЗП');
    if (ship.gForce > SPEC.gLimit * 0.8) alerts.push('ПЕРЕГРУЗКА');
    if (ship.groundAltitude < 400 && ship.verticalSpeed < -12 && !ship.landed) alerts.push('ЗЕМЛЯ');
    if (ship.fuel <= 0) alerts.push('НЕТ РАБОЧЕГО ТЕЛА');
    if (ship.cabinTemp > SPEC.cabinMaxTemp - 25) alerts.push('ПЕРЕГРЕВ КАБИНЫ');
    if (ship.airPressure > (ref.atmosphere?.crushPressure ?? Infinity) * 0.7)
      alerts.push('ДАВЛЕНИЕ');
    if (s.rendering) alerts.push(s.rendering);
    set('h-alerts', alerts.map((a) => `<div>${a}</div>`).join(''));
  }
}

function rows(list) {
  return list
    .map(
      ([k, l]) =>
        `<div class="row"><span class="k">${l}</span><span class="v" id="v-${k}"></span></div>`,
    )
    .join('');
}
