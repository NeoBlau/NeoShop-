// Keyboard (and gamepad) controls. Continuous axes are smoothed so digital
// keys still give proportional RCS/elevon commands.

export const KEYMAP = [
  ['W / S', 'Тангаж (нос вниз / вверх)'],
  ['A / D', 'Рыскание'],
  ['Q / E', 'Крен'],
  ['Shift / Ctrl', 'Тяга + / −'],
  ['Z / X', 'Полная тяга / отсечка'],
  ['T', 'Стабилизация (SAS) вкл/выкл'],
  ['1…8', 'SAS: удерж., прогр., ретрогр., нормаль, антинормаль, радиал+, радиал−, цель'],
  ['R', 'Двигатели ориентации (RCS) вкл/выкл'],
  ['H N / J L / I K', 'RCS-трансляция: вперёд-назад / влево-вправо / вверх-вниз'],
  ['G', 'Шасси'],
  ['B', 'Тормоза колёс (удерживать)'],
  ['F', 'Воздушный тормоз (расщепляемый руль)'],
  ['P', 'Тормозные парашюты'],
  [', / .', 'Ускорение времени − / +'],
  ['/', 'Реальное время'],
  ['M', 'Карта'],
  ['V', 'Камера: сопровождение / орбита / кабина'],
  ['Tab', 'Выбор цели (тело)'],
  ['Y', 'Выбор места посадки'],
  ['U', 'Звёздная карта и варп-прыжок'],
  ['O', 'Дозаправка (после посадки на Земле)'],
  ['F1', 'Справка'],
  ['F2', 'Скрыть интерфейс'],
  ['Esc', 'Пауза / меню'],
  ['Мышь', 'Перетаскивание — обзор, колесо — дистанция'],
];

export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
    this.axes = { pitch: 0, yaw: 0, roll: 0 };
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      if (['Tab', 'F1', 'F2', 'Slash'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  down(code) {
    return this.keys.has(code);
  }

  hit(code) {
    return this.pressed.has(code);
  }

  endFrame() {
    this.pressed.clear();
  }

  // Smoothed control axes (-1..1).
  update(dt) {
    const target = {
      pitch: (this.down('KeyS') ? 1 : 0) - (this.down('KeyW') ? 1 : 0),
      yaw: (this.down('KeyD') ? 1 : 0) - (this.down('KeyA') ? 1 : 0),
      roll: (this.down('KeyE') ? 1 : 0) - (this.down('KeyQ') ? 1 : 0),
    };
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = pads && [...pads].find((p) => p);
    if (gp) {
      const dz = (v) => (Math.abs(v) < 0.12 ? 0 : v);
      target.roll += dz(gp.axes[0] || 0);
      target.pitch += dz(gp.axes[1] || 0);
      target.yaw += dz(gp.axes[2] || 0);
    }
    const k = Math.min(1, dt * 6);
    for (const a of ['pitch', 'yaw', 'roll']) {
      const t = Math.max(-1, Math.min(1, target[a]));
      this.axes[a] += (t - this.axes[a]) * (t === 0 ? Math.min(1, dt * 12) : k);
      if (Math.abs(this.axes[a]) < 0.002) this.axes[a] = 0;
    }
    return this.axes;
  }
}
