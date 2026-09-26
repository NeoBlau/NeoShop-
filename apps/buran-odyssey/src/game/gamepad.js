// Gamepad support in the spirit of Microsoft Flight Simulator's Xbox layout:
// left stick flies (pitch/roll), triggers are the rudder (yaw), bumpers are
// the throttle, the right stick looks around, and a held modifier (Y) opens a
// second layer of functions. Every action can be rebound; bindings, dead
// zone, response curve and inversion persist per browser. The pad also drives
// the menus (D-pad / left stick to move, A to press, B to go back) and gives
// haptic feedback through the Gamepad vibration actuator where supported.
//
// Button indices follow the W3C "standard" mapping (Xbox names):
//  0 A  1 B  2 X  3 Y  4 LB  5 RB  6 LT  7 RT  8 View  9 Menu
//  10 LS  11 RS  12 ↑  13 ↓  14 ←  15 →

export const BUTTON_NAMES = [
  'A',
  'B',
  'X',
  'Y',
  'LB',
  'RB',
  'LT',
  'RT',
  'View',
  'Menu',
  'L-стик',
  'R-стик',
  'D↑',
  'D↓',
  'D←',
  'D→',
  'Xbox',
];
export const AXIS_NAMES = ['L-стик X', 'L-стик Y', 'R-стик X', 'R-стик Y'];

// kind: 'axis' (signed -1..1), 'analog' (0..1, button or half-axis), 'button'
export const PAD_ACTIONS = [
  { id: 'roll', label: 'Крен (элероны)', kind: 'axis', group: 'Полёт' },
  { id: 'pitch', label: 'Тангаж (руль высоты)', kind: 'axis', group: 'Полёт' },
  { id: 'yawLeft', label: 'Рыскание влево (педаль)', kind: 'analog', group: 'Полёт' },
  { id: 'yawRight', label: 'Рыскание вправо (педаль)', kind: 'analog', group: 'Полёт' },
  { id: 'throttleUp', label: 'Тяга +', kind: 'analog', group: 'Полёт' },
  { id: 'throttleDown', label: 'Тяга −', kind: 'analog', group: 'Полёт' },
  { id: 'camX', label: 'Обзор по горизонтали', kind: 'axis', group: 'Камера' },
  { id: 'camY', label: 'Обзор по вертикали', kind: 'axis', group: 'Камера' },
  { id: 'camReset', label: 'Сброс обзора', kind: 'button', group: 'Камера' },
  { id: 'camera', label: 'Смена камеры', kind: 'button', group: 'Камера' },
  { id: 'map', label: 'Карта', kind: 'button', group: 'Камера' },
  { id: 'sas', label: 'SAS вкл/выкл', kind: 'button', group: 'Системы' },
  { id: 'sasPrev', label: 'Режим SAS ←', kind: 'button', group: 'Системы' },
  { id: 'sasNext', label: 'Режим SAS →', kind: 'button', group: 'Системы' },
  { id: 'gear', label: 'Шасси', kind: 'button', group: 'Системы' },
  { id: 'brakes', label: 'Тормоза колёс (удерживать)', kind: 'button', group: 'Системы' },
  { id: 'warpUp', label: 'Ускорение времени +', kind: 'button', group: 'Время' },
  { id: 'warpDown', label: 'Ускорение времени −', kind: 'button', group: 'Время' },
  { id: 'pause', label: 'Пауза / меню', kind: 'button', group: 'Время' },
  { id: 'modifier', label: 'Модификатор (второй слой)', kind: 'button', group: 'Модификатор' },
  { id: 'rcs', label: 'RCS вкл/выкл', kind: 'button', group: 'Модификатор', mod: true },
  { id: 'chute', label: 'Парашюты', kind: 'button', group: 'Модификатор', mod: true },
  { id: 'speedBrake', label: 'Воздушный тормоз', kind: 'button', group: 'Модификатор', mod: true },
  { id: 'fullThrottle', label: 'Полная тяга', kind: 'button', group: 'Модификатор', mod: true },
  { id: 'cutThrottle', label: 'Отсечка тяги', kind: 'button', group: 'Модификатор', mod: true },
  { id: 'target', label: 'Следующая цель', kind: 'button', group: 'Модификатор', mod: true },
  { id: 'site', label: 'Место посадки', kind: 'button', group: 'Модификатор', mod: true },
  { id: 'warpReset', label: 'Реальное время', kind: 'button', group: 'Модификатор', mod: true },
  { id: 'starMap', label: 'Звёздная карта', kind: 'button', group: 'Модификатор', mod: true },
  { id: 'hud', label: 'Скрыть интерфейс', kind: 'button', group: 'Модификатор', mod: true },
  { id: 'help', label: 'Справка', kind: 'button', group: 'Модификатор', mod: true },
  { id: 'refuel', label: 'Дозаправка', kind: 'button', group: 'Модификатор', mod: true },
];

export const DEFAULT_BINDINGS = {
  roll: { axis: 0 },
  pitch: { axis: 1 },
  yawLeft: { button: 6 },
  yawRight: { button: 7 },
  throttleUp: { button: 5 },
  throttleDown: { button: 4 },
  camX: { axis: 2 },
  camY: { axis: 3 },
  camReset: { button: 11 },
  camera: { button: 8 },
  map: { button: 10 },
  sas: { button: 0 },
  sasPrev: { button: 14 },
  sasNext: { button: 15 },
  gear: { button: 2 },
  brakes: { button: 1 },
  warpUp: { button: 12 },
  warpDown: { button: 13 },
  pause: { button: 9 },
  modifier: { button: 3 },
  rcs: { button: 0 },
  chute: { button: 1 },
  speedBrake: { button: 2 },
  fullThrottle: { button: 5 },
  cutThrottle: { button: 4 },
  target: { button: 12 },
  site: { button: 13 },
  warpReset: { button: 14 },
  starMap: { button: 15 },
  hud: { button: 8 },
  help: { button: 9 },
  refuel: { button: 10 },
};

const DEFAULT_SETTINGS = {
  deadzone: 0.12,
  curve: 0.45,
  invertPitch: false,
  invertCamY: false,
  rumble: true,
};

function load(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || 'null');
    return v ? { ...fallback, ...v } : { ...fallback };
  } catch {
    return { ...fallback };
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked: settings last for this session */
    return;
  }
}

export class GamepadInput {
  constructor() {
    this.bindings = load('buran.pad.bindings', DEFAULT_BINDINGS);
    this.settings = load('buran.pad.settings', DEFAULT_SETTINGS);
    this.pad = null;
    this.prev = [];
    this.now = [];
    this.fired = new Set();
    this.held = new Set();
    this.values = {};
    this.capture = null; // rebinding in progress
    this.navCooldown = 0;
    this.connected = false;
    this.onChange = null;
    window.addEventListener('gamepadconnected', (e) => {
      this.connected = true;
      this.onChange?.(`Геймпад подключён: ${e.gamepad.id}`);
    });
    window.addEventListener('gamepaddisconnected', () => {
      this.connected = false;
      this.onChange?.('Геймпад отключён');
    });
  }

  saveAll() {
    save('buran.pad.bindings', this.bindings);
    save('buran.pad.settings', this.settings);
  }

  resetDefaults() {
    this.bindings = { ...DEFAULT_BINDINGS };
    this.settings = { ...DEFAULT_SETTINGS };
    this.saveAll();
  }

  _pickPad() {
    const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
    return pads.find((p) => p.mapping === 'standard') ?? pads[0] ?? null;
  }

  _button(i) {
    const b = this.pad?.buttons[i];
    return b ? (typeof b === 'object' ? b.value || (b.pressed ? 1 : 0) : b) : 0;
  }

  _shape(v) {
    const dz = this.settings.deadzone;
    const a = Math.abs(v);
    if (a < dz) return 0;
    const t = (a - dz) / (1 - dz);
    // Response curve: blend of linear and cubic, like the "sensitivity" sliders in MSFS.
    const c = this.settings.curve;
    return Math.sign(v) * ((1 - c) * t + c * t * t * t);
  }

  _value(action) {
    const b = this.bindings[action];
    if (!b) return 0;
    if (b.axis !== undefined) {
      const raw = this.pad.axes[b.axis] ?? 0;
      return (b.invert ? -1 : 1) * raw;
    }
    return this._button(b.button);
  }

  // Poll once per frame. Returns the continuous control state.
  poll(dt) {
    this.pad = this._pickPad();
    this.fired.clear();
    this.navCooldown = Math.max(0, this.navCooldown - dt);
    if (!this.pad) {
      this.values = {};
      return null;
    }
    this.prev = this.now;
    this.now = this.pad.buttons.map((b) => (typeof b === 'object' ? b.pressed : b > 0.5));
    if (this.capture) {
      this._pollCapture();
      return null;
    }
    const modHeld = this.now[this.bindings.modifier?.button] === true;
    // Edge-triggered actions, respecting the modifier layer.
    for (const a of PAD_ACTIONS) {
      if (a.kind !== 'button' || a.id === 'modifier') continue;
      const b = this.bindings[a.id];
      if (!b || b.button === undefined) continue;
      if (!!a.mod !== modHeld) continue;
      if (this.now[b.button] && !this.prev[b.button]) this.fired.add(a.id);
    }
    this.held.clear();
    if (!modHeld && this.now[this.bindings.brakes?.button]) this.held.add('brakes');

    const v = (id) => this._shape(this._value(id));
    const out = {
      modifier: modHeld,
      roll: 0,
      pitch: 0,
      yaw: 0,
      throttle: 0,
      camX: v('camX'),
      camY: v('camY') * (this.settings.invertCamY ? -1 : 1),
      tx: 0,
      ty: 0,
      tz: 0,
    };
    if (modHeld) {
      // Second layer: sticks translate with RCS (docking-style).
      out.tx = -this._shape(this.pad.axes[1] ?? 0);
      out.ty = this._shape(this.pad.axes[0] ?? 0);
      out.tz = this._shape(this.pad.axes[3] ?? 0);
      out.camX = 0;
      out.camY = 0;
    } else {
      out.roll = v('roll');
      out.pitch = v('pitch') * (this.settings.invertPitch ? -1 : 1);
      out.yaw = this._shape(this._value('yawRight')) - this._shape(this._value('yawLeft'));
      out.throttle = this._value('throttleUp') - this._value('throttleDown');
    }
    this.values = out;
    return out;
  }

  hit(action) {
    return this.fired.has(action);
  }

  down(action) {
    return this.held.has(action);
  }

  // Rebinding: the next button press (or a decisive stick movement for axes)
  // becomes the binding for `action`.
  startCapture(action, done) {
    const def = PAD_ACTIONS.find((a) => a.id === action);
    this.capture = { action, kind: def.kind, done, base: this.pad ? [...this.pad.axes] : [] };
  }

  cancelCapture() {
    this.capture = null;
  }

  _pollCapture() {
    const c = this.capture;
    if (c.kind === 'axis') {
      for (let i = 0; i < this.pad.axes.length; i++) {
        const d = this.pad.axes[i] - (c.base[i] ?? 0);
        if (Math.abs(d) > 0.6) {
          this.bindings[c.action] = { axis: i, invert: d < 0 };
          return this._finishCapture();
        }
      }
      return;
    }
    for (let i = 0; i < this.now.length; i++) {
      if (this.now[i] && !this.prev[i]) {
        this.bindings[c.action] = { button: i };
        return this._finishCapture();
      }
    }
  }

  _finishCapture() {
    const c = this.capture;
    this.capture = null;
    this.saveAll();
    // Swallow the press so it does not also trigger the action.
    this.prev = this.now.map(() => true);
    c.done?.(this.describe(c.action));
  }

  describe(action) {
    const b = this.bindings[action];
    const def = PAD_ACTIONS.find((a) => a.id === action);
    if (!b) return '—';
    const prefix = def?.mod ? `${BUTTON_NAMES[this.bindings.modifier?.button] ?? '?'} + ` : '';
    if (b.axis !== undefined)
      return `${AXIS_NAMES[b.axis] ?? 'ось ' + b.axis}${b.invert ? ' (инв.)' : ''}`;
    return prefix + (BUTTON_NAMES[b.button] ?? 'кнопка ' + b.button);
  }

  rumble(strong, weak, ms = 120) {
    if (!this.settings.rumble || !this.pad?.vibrationActuator) return;
    const now = performance.now();
    if (this._rumbleUntil && now < this._rumbleUntil - 30 && strong < (this._lastStrong ?? 0))
      return;
    this._rumbleUntil = now + ms;
    this._lastStrong = strong;
    this.pad.vibrationActuator
      .playEffect('dual-rumble', {
        duration: ms,
        strongMagnitude: Math.min(1, strong),
        weakMagnitude: Math.min(1, weak),
      })
      .catch(() => {});
  }

  // Menu navigation: D-pad / left stick moves focus between the visible
  // controls of `root`, A presses, B calls `back`.
  navigate(root, back) {
    if (!this.pad || this.capture) return;
    const pressed = (i) => this.now[i] && !this.prev[i];
    if (pressed(1)) {
      back?.();
      return;
    }
    const items = [...root.querySelectorAll('button:not([disabled]), select, input')].filter(
      (e) => e.offsetParent !== null,
    );
    if (!items.length) return;
    let cur = document.activeElement;
    if (!items.includes(cur)) cur = null;
    if (pressed(0)) {
      if (cur) cur.click();
      else items[0].focus();
      return;
    }
    const ax = this.pad.axes[0] ?? 0,
      ay = this.pad.axes[1] ?? 0;
    let dx =
      (this.now[15] ? 1 : 0) - (this.now[14] ? 1 : 0) + (Math.abs(ax) > 0.6 ? Math.sign(ax) : 0);
    let dy =
      (this.now[13] ? 1 : 0) - (this.now[12] ? 1 : 0) + (Math.abs(ay) > 0.6 ? Math.sign(ay) : 0);
    if ((!dx && !dy) || this.navCooldown > 0) return;
    this.navCooldown = 0.18;
    // Sliders and selects take left/right themselves.
    if (cur && dx && !dy && (cur.type === 'range' || cur.tagName === 'SELECT')) {
      if (cur.type === 'range') {
        cur.value = String(Number(cur.value) + dx * Number(cur.step || 1));
      } else {
        cur.selectedIndex = Math.max(0, Math.min(cur.options.length - 1, cur.selectedIndex + dx));
      }
      cur.dispatchEvent(new Event('input', { bubbles: true }));
      cur.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    dx = Math.sign(dx);
    dy = Math.sign(dy);
    if (!cur) {
      items[0].focus();
      return;
    }
    const r0 = cur.getBoundingClientRect();
    const c0 = { x: r0.left + r0.width / 2, y: r0.top + r0.height / 2 };
    let best = null,
      bestScore = Infinity;
    for (const e of items) {
      if (e === cur) continue;
      const r = e.getBoundingClientRect();
      const vx = r.left + r.width / 2 - c0.x,
        vy = r.top + r.height / 2 - c0.y;
      const along = vx * dx + vy * dy;
      if (along <= 4) continue;
      const across = Math.abs(vx * dy - vy * dx);
      const score = along + across * 2.5;
      if (score < bestScore) {
        bestScore = score;
        best = e;
      }
    }
    if (best) {
      best.focus();
      best.scrollIntoView({ block: 'nearest' });
    }
  }
}
