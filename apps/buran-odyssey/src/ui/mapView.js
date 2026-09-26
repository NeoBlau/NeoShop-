// Map view: conic sections of the ship and of every body, apsis markers,
// labels, and the predicted SOI encounter with the selected target.

import * as THREE from 'three';
import { sampleOrbit, stateToElements, propagateUniversal } from '../physics/kepler.js';
import { formatDistance, formatDuration } from '../core/constants.js';

function lineMaterial(color, opacity = 0.8, dashed = false) {
  const m = dashed
    ? new THREE.LineDashedMaterial({
        color,
        transparent: true,
        opacity,
        dashSize: 1,
        gapSize: 1,
        depthWrite: false,
      })
    : new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
  return m;
}

export class MapView {
  constructor(scene, labelLayer) {
    this.scene = scene;
    this.labels = labelLayer;
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);
    this.shipLine = new THREE.Line(new THREE.BufferGeometry(), lineMaterial(0x49f2ff, 1));
    this.shipLine.frustumCulled = false;
    this.group.add(this.shipLine);
    this.encLine = new THREE.Line(new THREE.BufferGeometry(), lineMaterial(0xff9d2e, 0.9));
    this.encLine.frustumCulled = false;
    this.group.add(this.encLine);
    this.bodyLines = new Map();
    this.labelEls = new Map();
    this.apEl = this._label('Ап', 'apsis');
    this.peEl = this._label('Пе', 'apsis');
    this.shipEl = this._label('▲ БУРАН-М', 'ship');
    this.encounter = null;
    this._encT = 0;
  }

  _label(text, cls) {
    const el = document.createElement('div');
    el.className = 'map-label ' + cls;
    el.textContent = text;
    this.labels.appendChild(el);
    return el;
  }

  setSystem(system) {
    for (const l of this.bodyLines.values()) {
      this.group.remove(l);
      l.geometry.dispose();
    }
    this.bodyLines.clear();
    for (const el of this.labelEls.values()) el.remove();
    this.labelEls.clear();
    for (const b of system.bodies) {
      const el = this._label(b.name, 'body ' + b.kind);
      el.dataset.id = b.id;
      this.labelEls.set(b.id, el);
      if (!b.parent) continue;
      const line = new THREE.Line(
        new THREE.BufferGeometry(),
        lineMaterial(b.kind === 'moon' ? 0x8899aa : 0x6f8fb0, 0.55),
      );
      line.frustumCulled = false;
      this.group.add(line);
      this.bodyLines.set(b.id, line);
    }
    this.system = system;
    this._bodyRefresh = 0;
  }

  _setLine(line, pts) {
    const arr = new Float32Array(pts.length * 3);
    pts.forEach((p, i) => arr.set([p.x, p.y, p.z], i * 3));
    line.geometry.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    line.geometry.computeBoundingSphere();
  }

  update(active, ship, system, origin, camera, target, width, height, t) {
    this.group.visible = active;
    const showLabels = active;
    // Ship conic (relative to its reference body)
    const el = ship.elements();
    const maxR = isFinite(ship.ref.soi) ? ship.ref.soi : 1e13;
    if (active) {
      const pts = sampleOrbit(el, ship.ref.gm, 512, maxR);
      this._setLine(this.shipLine, pts);
      this.shipLine.position.subVectors(ship.ref.pos, origin);
      // Planet/moon orbits are refreshed at a lower rate.
      if (this._bodyRefresh-- <= 0) {
        this._bodyRefresh = 30;
        for (const b of system.bodies) {
          if (!b.parent) continue;
          const e = stateToElements(b.relPos, b.relVel, b.parent.gm + b.gm);
          const line = this.bodyLines.get(b.id);
          if (line) this._setLine(line, sampleOrbit(e, b.parent.gm, 360, Infinity));
        }
      }
      for (const b of system.bodies) {
        if (!b.parent) continue;
        const l = this.bodyLines.get(b.id);
        if (!l) continue;
        l.position.subVectors(b.parent.pos, origin);
        l.material.color.set(target === b ? 0xffb347 : b.kind === 'moon' ? 0x8899aa : 0x6f8fb0);
        l.material.opacity = target === b ? 0.95 : 0.5;
      }
      // Encounter prediction twice a second
      if (t - this._encT > 0.5 || !isFinite(this._encT)) {
        this._encT = t;
        this.encounter = target ? predictEncounter(ship, target) : null;
      }
      if (this.encounter?.pts) {
        this._setLine(this.encLine, this.encounter.pts);
        this.encLine.visible = true;
        this.encLine.position.subVectors(this.encounter.frame.pos, origin);
      } else this.encLine.visible = false;
    }

    const project = (worldPos, elx, offsetY = 0) => {
      const v = worldPos.clone().sub(origin).project(camera);
      if (v.z > 1 || v.z < -1 || Math.abs(v.x) > 1.2 || Math.abs(v.y) > 1.2) {
        elx.style.display = 'none';
        return;
      }
      elx.style.display = 'block';
      elx.style.transform = `translate(${((v.x + 1) / 2) * width}px, ${((1 - v.y) / 2) * height + offsetY}px)`;
    };
    for (const b of system.bodies) {
      const lab = this.labelEls.get(b.id);
      if (!lab) continue;
      if (!showLabels) {
        lab.style.display = 'none';
        continue;
      }
      lab.classList.toggle('target', target === b);
      project(b.pos, lab, -14);
    }
    if (showLabels) {
      project(ship.worldPos(), this.shipEl, 10);
      if (el.e < 1) {
        const ap = apsisPoint(el, true);
        this.apEl.textContent = `Ап ${formatDistance(el.apoapsis - ship.ref.radius)} · ${formatDuration(el.timeToAp)}`;
        project(ap.add(ship.ref.pos), this.apEl);
      } else this.apEl.style.display = 'none';
      const pe = apsisPoint(el, false);
      this.peEl.textContent = `Пе ${formatDistance(el.periapsis - ship.ref.radius)}${isFinite(el.timeToPe) ? ' · ' + formatDuration(el.timeToPe) : ''}`;
      project(pe.add(ship.ref.pos), this.peEl);
    } else {
      this.shipEl.style.display = 'none';
      this.apEl.style.display = 'none';
      this.peEl.style.display = 'none';
    }
  }
}

function apsisPoint(el, apo) {
  const r = apo ? el.apoapsis : el.periapsis;
  const dir = el.eVec.lengthSq() > 1e-20 ? el.eVec.clone().normalize() : new THREE.Vector3(1, 0, 0);
  return dir.multiplyScalar(apo ? -r : r);
}

// Propagate ship and target conics forward over one period (or a hyperbolic
// leg) and report the closest approach, and whether it enters the target SOI.
function predictEncounter(ship, target) {
  const frame = ship.ref;
  if (target === frame) return null;
  if (target.parent !== frame) return null; // only encounters within the current frame
  const el = ship.elements();
  const span = isFinite(el.period) ? Math.min(el.period, 3.2e7 * 2) : 3.2e7;
  const steps = 360;
  const r = ship.r.clone(),
    v = ship.v.clone();
  let best = { d: Infinity, t: 0 };
  const dt = span / steps;
  const tp = new THREE.Vector3();
  const tv = new THREE.Vector3();
  for (let i = 1; i <= steps; i++) {
    propagateUniversal(r, v, frame.gm, dt);
    tp.copy(target.relPos);
    tv.copy(target.relVel);
    propagateUniversal(tp, tv, frame.gm + target.gm, dt * i);
    const d = r.distanceTo(tp);
    if (d < best.d) best = { d, t: dt * i, r: r.clone(), tp: tp.clone() };
    if (Math.abs(r.length()) > (isFinite(frame.soi) ? frame.soi : 1e14)) break;
  }
  const inSoi = best.d < target.soi;
  return {
    frame,
    distance: best.d,
    time: best.t,
    inSoi,
    pts: best.r ? [best.r, best.tp] : null,
    label: `${inSoi ? 'Вход в сферу действия' : 'Сближение'}: ${formatDistance(best.d)} через ${formatDuration(best.t)}`,
  };
}
