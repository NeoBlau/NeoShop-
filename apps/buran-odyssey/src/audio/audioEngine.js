// Sound, synthesised with the Web Audio API (no sample files to stream) and
// driven by the physics rather than by scripted cues:
//
//  * Sound needs a medium. External sounds — wind, sonic booms, dust, the
//    plume heard from outside — scale with air density and lose their high
//    frequencies in thin air (on Mars the Perseverance microphones heard a
//    muffled world, ~20 dB quieter). In vacuum only structure-borne sound
//    reaches the crew: the drive's hum through the hull, RCS thumps, fans.
//  * Aerodynamic noise follows dynamic pressure q = ½ρv²; entry roar and
//    crackle follow the stagnation heat flux; wheel rumble follows ground
//    speed; the gear motor runs while the gear is actually travelling.
//  * One-shots: touchdown thump and tyre chirp scaled by sink rate, gear
//    lock clunk, chute mortar, sonic boom when crossing Mach 1 (heard from
//    outside), explosion, warp spool-up, UI and science chimes.
//  * Master-caution tones for overheat, overload, pressure, terrain, and
//    Russian voice call-outs (speechSynthesis) on the landing approach.

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

function noiseBuffer(ctx, seconds, color) {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    if (color === 'brown') {
      b = (b + 0.02 * w) / 1.02;
      d[i] = b * 3.5;
    } else d[i] = w;
  }
  return buf;
}

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.settings = { master: 0.8, sfx: 0.9, voice: 0.9, callouts: true };
    try {
      Object.assign(this.settings, JSON.parse(localStorage.getItem('buran.audio') || '{}'));
    } catch {
      /* defaults */
    }
    this.lastMach = 0;
    this.lastCallout = Infinity;
    this.cautionT = 0;
    this.rcsT = 0;
    this.voiceBusy = 0;
    this.lastSpoken = new Map();
    this.gearWas = 0;
  }

  saveSettings() {
    try {
      localStorage.setItem('buran.audio', JSON.stringify(this.settings));
    } catch {
      /* storage blocked */
    }
    this._applyVolumes();
  }

  // Browsers only start audio from a user gesture.
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC({ latencyHint: 'interactive' });
      this._build();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  _build() {
    const c = this.ctx;
    this.white = noiseBuffer(c, 2.5, 'white');
    this.brown = noiseBuffer(c, 4, 'brown');
    this.out = c.createGain();
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.out.connect(comp).connect(c.destination);
    this.sfx = c.createGain();
    this.sfx.connect(this.out);
    this.ui = c.createGain();
    this.ui.connect(this.out);
    // External world: level and brightness set by the local air density.
    this.extFilter = c.createBiquadFilter();
    this.extFilter.type = 'lowpass';
    this.extFilter.frequency.value = 12000;
    this.ext = c.createGain();
    this.ext.connect(this.extFilter).connect(this.sfx);
    // Structure-borne path (always present): heavy low-pass.
    this.hull = c.createGain();
    const hullLp = c.createBiquadFilter();
    hullLp.type = 'lowpass';
    hullLp.frequency.value = 420;
    this.hull.connect(hullLp).connect(this.sfx);
    this._applyVolumes();

    // --- Plasma drive: power-electronics whine + field hum + exhaust roar
    this.engHum = this._osc('sawtooth', 48, this.hull, 0);
    this.engHum2 = this._osc('sawtooth', 96.7, this.hull, 0);
    this.engWhine = this._osc('sine', 1180, this.sfx, 0);
    this.engRoar = this._noise(this.brown, 'lowpass', 260, this.ext, 0, 0.7);
    this.engHiss = this._noise(this.white, 'bandpass', 2400, this.ext, 0, 0.9);
    // --- Aerodynamics
    this.wind = this._noise(this.white, 'bandpass', 500, this.ext, 0, 0.6);
    // Low-frequency buffeting reaches the crew through the structure even
    // where the outside air is too thin to carry sound.
    this.windLow = this._noise(this.brown, 'lowpass', 140, this.hull, 0, 0.8);
    this.plasma = this._noise(this.brown, 'lowpass', 180, this.hull, 0, 0.7);
    this.crackle = this._noise(this.white, 'bandpass', 3200, this.ext, 0, 2.5);
    // --- Ground
    this.roll = this._noise(this.brown, 'lowpass', 120, this.hull, 0, 0.9);
    // --- Gear motor
    this.gearMotor = this._osc('square', 170, this.hull, 0);
    // --- Cabin: avionics fans and a faint 400 Hz bus hum
    this.fans = this._noise(this.white, 'lowpass', 900, this.sfx, 0.012, 0.5);
    this.bus = this._osc('sine', 400, this.sfx, 0.0025);
  }

  _applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.out.gain.setTargetAtTime(this.settings.master, t, 0.05);
    this.sfx.gain.setTargetAtTime(this.settings.sfx, t, 0.05);
    this.ui.gain.setTargetAtTime(this.settings.sfx, t, 0.05);
  }

  _osc(type, freq, dest, gain) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    o.connect(g).connect(dest);
    o.start();
    return { o, g };
  }

  _noise(buffer, filterType, freq, dest, gain, q = 0.7) {
    const s = this.ctx.createBufferSource();
    s.buffer = buffer;
    s.loop = true;
    s.playbackRate.value = 0.9 + Math.random() * 0.2;
    const f = this.ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    s.connect(f).connect(g).connect(dest);
    s.start(0, Math.random() * 2);
    return { s, f, g };
  }

  _set(param, value, tc = 0.08) {
    param.setTargetAtTime(value, this.ctx.currentTime, tc);
  }

  // ------------------------------------------------------------ continuous
  // s: { throttle, rho, rhoRef, q, mach, plasma, heatFlux, onGround, groundSpeed,
  //      gearMoving, camera ('chase'|'orbit'|'cockpit'|'map'), paused, destroyed,
  //      rcs (0..1), alerts: Set, radarAlt, vs, gearDown, landed, atmosphere }
  update(s, dt) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const mute = s.paused || s.destroyed ? 0 : 1;
    const inside = s.camera === 'cockpit';
    // Density scaling of the external path (dB ∝ log ρ), brightness from ρ.
    const rel = s.rho > 0 ? s.rho / 1.225 : 0;
    const extLevel = rel > 0 ? clamp(1 + Math.log10(rel) / 3, 0, 1.4) : 0;
    this._set(this.ext.gain, extLevel * (inside ? 0.45 : 1) * mute, 0.15);
    this._set(
      this.extFilter.frequency,
      rel > 0
        ? clamp(900 + 11000 * Math.sqrt(Math.min(rel, 1)), 400, 14000) * (inside ? 0.25 : 1)
        : 400,
      0.2,
    );
    this._set(this.hull.gain, (inside ? 1.2 : 0.55) * mute, 0.1);

    const thr = s.throttle * mute;
    this._set(this.engHum.g.gain, thr * 0.16);
    this._set(this.engHum2.g.gain, thr * 0.09);
    this._set(this.engHum.o.frequency, 44 + thr * 18);
    this._set(this.engHum2.o.frequency, 89 + thr * 35);
    this._set(this.engWhine.g.gain, thr * (inside ? 0.012 : 0.004));
    this._set(this.engWhine.o.frequency, 900 + thr * 700);
    this._set(this.engRoar.g.gain, thr * 0.9);
    this._set(this.engHiss.g.gain, thr * 0.12);

    const q = s.q / 1000; // kPa
    this._set(this.wind.g.gain, clamp(Math.sqrt(q) * 0.09, 0, 0.5) * mute);
    this._set(this.wind.f.frequency, clamp(250 + s.mach * 180, 250, 2400));
    this._set(this.windLow.g.gain, clamp(Math.sqrt(q) * (s.mach > 1 ? 0.22 : 0.12), 0, 0.9) * mute);
    const pl = clamp(s.plasma, 0, 1.5) * mute;
    this._set(this.plasma.g.gain, pl * 0.9);
    this._set(this.crackle.g.gain, pl * 0.18 * (0.6 + 0.4 * Math.random()), 0.03);

    const roll = s.onGround ? clamp(s.groundSpeed / 90, 0, 1.2) : 0;
    this._set(this.roll.g.gain, roll * 0.9 * mute, 0.05);
    this._set(this.roll.f.frequency, 70 + s.groundSpeed * 1.2);

    this._set(this.gearMotor.g.gain, s.gearMoving ? 0.02 * mute : 0, 0.05);
    this._set(this.gearMotor.o.frequency, 150 + 40 * Math.sin(performance.now() / 90));
    this._set(this.fans.g.gain, (inside ? 0.03 : 0.012) * (s.paused ? 0.3 : 1));

    // RCS pulses: short thumps through the hull (and hiss if there is air).
    this.rcsT -= dt;
    if (s.rcs > 0.3 && this.rcsT <= 0 && mute) {
      this.rcsT = 0.07 + Math.random() * 0.05;
      this._burst(this.white, 'highpass', 900, 0.06, 0.1 * s.rcs, inside ? this.hull : this.sfx);
      this._thump(90, 0.08, 0.18 * s.rcs, this.hull);
    }

    // Sonic boom: the N-wave reaches an outside observer when M crosses 1.
    if (
      s.rho > 1e-3 &&
      !inside &&
      ((this.lastMach < 1 && s.mach >= 1) || (this.lastMach >= 1 && s.mach < 1))
    ) {
      this.play('boom', { level: clamp(rel * 2, 0.2, 1) });
    }
    this.lastMach = s.mach;

    // Master caution
    this.cautionT -= dt;
    if (s.alerts.size && this.cautionT <= 0 && mute) {
      this.cautionT = 1.1;
      this._tone(880, 0.12, 0.08, 'square', this.ui);
      this._tone(660, 0.12, 0.08, 'square', this.ui, 0.16);
      if (s.alerts.has('terrain')) this.say('Земля! Земля!', 'terrain', 3);
      else if (s.alerts.has('heat')) this.say('Перегрев теплозащиты', 'heat', 8);
      else if (s.alerts.has('g')) this.say('Перегрузка', 'g', 6);
      else if (s.alerts.has('fuel')) this.say('Нет рабочего тела', 'fuel', 20);
      else if (s.alerts.has('pressure')) this.say('Критическое давление', 'pressure', 8);
    }

    // Radio-altimeter call-outs on the landing approach, as in airliners.
    if (this.settings.callouts && s.gearDown && !s.landed && s.vs < -0.5 && isFinite(s.radarAlt)) {
      for (const h of [1000, 500, 300, 100, 50, 40, 30, 20, 10]) {
        if (this.lastCallout > h && s.radarAlt <= h) {
          this.say(h >= 100 ? `${h}` : `${h}`, 'alt' + h, 1);
          break;
        }
      }
    }
    this.lastCallout = s.radarAlt;
  }

  // ------------------------------------------------------------ one-shots
  play(name, p = {}) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    switch (name) {
      case 'touchdown': {
        const k = clamp(p.speed / 3, 0.15, 1.5);
        this._thump(55, 0.35, 0.8 * k, this.hull);
        this._burst(this.brown, 'lowpass', 300, 0.25, 0.5 * k, this.hull);
        if (p.groundSpeed > 20 && p.air)
          this._burst(this.white, 'bandpass', 2600, 0.18, 0.25 * k, this.ext, 6);
        break;
      }
      case 'gearLock':
        this._thump(120, 0.08, 0.35, this.hull);
        this._burst(this.white, 'bandpass', 1800, 0.05, 0.12, this.hull, 3);
        break;
      case 'chute':
        this._burst(this.white, 'bandpass', 700, 0.15, 0.5, this.ext);
        this._thump(70, 0.4, 0.5, this.hull, 0.05);
        break;
      case 'tear':
        this._burst(this.white, 'highpass', 1500, 0.5, 0.4, this.ext);
        break;
      case 'boom': {
        const l = p.level ?? 1;
        this._thump(38, 0.25, 1.0 * l, this.sfx);
        this._thump(38, 0.25, 0.9 * l, this.sfx, 0.11);
        this._burst(this.brown, 'lowpass', 400, 0.6, 0.5 * l, this.sfx);
        break;
      }
      case 'explosion':
        this._thump(32, 1.4, 1.2, this.sfx);
        this._burst(this.brown, 'lowpass', 900, 3.5, 1.2, this.sfx, 0.7, 120);
        this._burst(this.white, 'lowpass', 3000, 1.2, 0.4, this.sfx, 0.7, 300);
        break;
      case 'warpSpool':
        this._sweep(60, 900, 2.0, 0.18);
        this._burst(this.white, 'bandpass', 1200, 2.2, 0.15, this.sfx, 1.5);
        break;
      case 'warpJump':
        this._thump(45, 1.0, 1.0, this.sfx);
        this._burst(this.white, 'lowpass', 6000, 1.2, 0.5, this.sfx, 0.7, 200);
        break;
      case 'click':
        this._tone(1400, 0.03, 0.05, 'sine', this.ui);
        break;
      case 'toggle':
        this._tone(p.on ? 1250 : 850, 0.06, 0.06, 'triangle', this.ui);
        break;
      case 'chime':
        [880, 1109, 1319, 1760].forEach((f, i) =>
          this._tone(f, 0.35, 0.06, 'sine', this.ui, i * 0.09),
        );
        break;
      case 'warn':
        this._tone(520, 0.18, 0.07, 'square', this.ui);
        break;
      case 'soi':
        this._tone(660, 0.2, 0.05, 'sine', this.ui);
        this._tone(990, 0.3, 0.05, 'sine', this.ui, 0.15);
        break;
    }
  }

  _tone(freq, dur, gain, type, dest, delay = 0) {
    const c = this.ctx;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  _thump(freq, dur, gain, dest, delay = 0) {
    const c = this.ctx;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq * 2.2, t);
    o.frequency.exponentialRampToValueAtTime(freq, t + dur * 0.3);
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  _burst(buffer, type, freq, dur, gain, dest, q = 0.8, sweepTo = 0) {
    const c = this.ctx;
    const t = c.currentTime;
    const s = c.createBufferSource();
    s.buffer = buffer;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(dest);
    s.start(t, Math.random());
    s.stop(t + dur + 0.05);
  }

  _sweep(f0, f1, dur, gain) {
    const c = this.ctx;
    const t = c.currentTime;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1800;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.8);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.2);
    o.connect(f).connect(g).connect(this.sfx);
    o.start(t);
    o.stop(t + dur + 0.3);
  }

  // Russian voice call-outs; silently skipped if the system has no voice.
  say(text, key, minInterval = 4) {
    if (!this.settings.callouts || !('speechSynthesis' in window) || this.settings.voice <= 0)
      return;
    const now = performance.now() / 1000;
    if (now - (this.lastSpoken.get(key) ?? -1e9) < minInterval) return;
    this.lastSpoken.set(key, now);
    const voices = window.speechSynthesis.getVoices();
    const ru = voices.find((v) => v.lang?.toLowerCase().startsWith('ru'));
    if (!ru && voices.length) return;
    const u = new window.SpeechSynthesisUtterance(text);
    u.lang = 'ru-RU';
    if (ru) u.voice = ru;
    u.rate = 1.15;
    u.volume = clamp(this.settings.voice * this.settings.master, 0, 1);
    if (key.startsWith('alt')) window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }
}
