// Camera modes. The camera's world position is kept in double precision and
// becomes the floating render origin every frame; the THREE camera itself
// always sits at (0,0,0).

import * as THREE from 'three';

export const CAMERA_MODES = ['chase', 'orbit', 'cockpit'];

export class CameraRig {
  constructor(camera, dom) {
    this.camera = camera;
    this.mode = 'chase';
    this.map = false;
    this.yaw = Math.PI;
    this.pitch = 0.25;
    this.dist = 70;
    this.mapYaw = 0.6;
    this.mapPitch = 0.5;
    this.mapDist = 0;
    this.world = new THREE.Vector3();
    this.up = new THREE.Vector3(0, 0, 1);
    this._drag = null;
    dom.addEventListener('pointerdown', (e) => {
      if (e.target !== dom) return;
      this._drag = { x: e.clientX, y: e.clientY };
      dom.setPointerCapture(e.pointerId);
    });
    dom.addEventListener('pointermove', (e) => {
      if (!this._drag) return;
      const dx = e.clientX - this._drag.x,
        dy = e.clientY - this._drag.y;
      this._drag = { x: e.clientX, y: e.clientY };
      if (this.map) {
        this.mapYaw -= dx * 0.005;
        this.mapPitch = THREE.MathUtils.clamp(this.mapPitch + dy * 0.005, -1.5, 1.5);
      } else {
        this.yaw -= dx * 0.005;
        this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.005, -1.5, 1.5);
      }
    });
    dom.addEventListener('pointerup', () => (this._drag = null));
    dom.addEventListener(
      'wheel',
      (e) => {
        const k = Math.exp(e.deltaY * 0.0012);
        if (this.map) this.mapDist *= k;
        else this.dist = THREE.MathUtils.clamp(this.dist * k, 22, 5000);
        e.preventDefault();
      },
      { passive: false },
    );
  }

  cycle() {
    const i = CAMERA_MODES.indexOf(this.mode);
    this.mode = CAMERA_MODES[(i + 1) % CAMERA_MODES.length];
  }

  // Local horizon frame at the ship (or the ecliptic far from any body).
  frame(ship) {
    const ref = ship.ref;
    const U = ship.r.clone().normalize();
    if (ref.kind === 'star' && ship.r.length() > ref.radius * 200) U.set(0, 0, 1);
    let N = ref.pole.clone().addScaledVector(U, -ref.pole.dot(U));
    if (N.lengthSq() < 1e-8) N = new THREE.Vector3(1, 0, 0).addScaledVector(U, -U.x);
    N.normalize();
    const E = new THREE.Vector3().crossVectors(N, U);
    return { U, N, E };
  }

  update(ship, dt) {
    const shipPos = ship.worldPos();
    if (this.map) {
      const ref = ship.ref;
      if (!this.mapDist) this.mapDist = Math.max(ref.radius * 4, ship.r.length() * 3);
      this.mapDist = THREE.MathUtils.clamp(this.mapDist, ref.radius * 1.6, 2e13);
      const cp = Math.cos(this.mapPitch);
      const off = new THREE.Vector3(
        cp * Math.cos(this.mapYaw),
        cp * Math.sin(this.mapYaw),
        Math.sin(this.mapPitch),
      );
      this.world.copy(ref.pos).addScaledVector(off, this.mapDist);
      this.up.set(0, 0, 1);
      this._look(off.clone().negate());
      return;
    }
    const q = ship.q;
    if (this.mode === 'cockpit') {
      this.world.copy(shipPos).add(new THREE.Vector3(14.2, 0, -2.75).applyQuaternion(q));
      const fwd = new THREE.Vector3(1, 0, 0.1).normalize().applyQuaternion(q);
      this.up.set(0, 0, -1).applyQuaternion(q);
      this._look(fwd);
      return;
    }
    let off;
    if (this.mode === 'chase') {
      // Behind and above, in the ship's own axes; the horizon stays level.
      const cp = Math.cos(this.pitch);
      off = new THREE.Vector3(
        Math.cos(this.yaw) * cp,
        Math.sin(this.yaw) * cp,
        -Math.sin(this.pitch),
      ).applyQuaternion(q);
      this.up.set(0, 0, -1).applyQuaternion(q);
      const f = this.frame(ship);
      this.up.lerp(f.U, 0.6).normalize();
    } else {
      const f = this.frame(ship);
      const cp = Math.cos(this.pitch);
      off = f.N.clone()
        .multiplyScalar(Math.cos(this.yaw) * cp)
        .addScaledVector(f.E, Math.sin(this.yaw) * cp)
        .addScaledVector(f.U, Math.sin(this.pitch));
      this.up.copy(f.U);
    }
    this.world.copy(shipPos).addScaledVector(off, this.dist);
    // Never under the terrain.
    const ref = ship.ref;
    if (ref.terrain) {
      const rel = this.world.clone().sub(ref.pos);
      const dir = rel.clone().applyQuaternion(ref.quat.clone().invert()).normalize();
      const minR = ref.radius + ref.terrain.groundHeight(dir.x, dir.y, dir.z) + 3;
      if (rel.length() < minR) this.world.copy(ref.pos).addScaledVector(rel.normalize(), minR);
    }
    // Aim slightly below the orbiter so it sits above the instrument cluster.
    const aim = shipPos.clone().addScaledVector(this.up, -this.dist * 0.16);
    this._look(aim.sub(this.world));
    void dt;
  }

  _look(dir) {
    const cam = this.camera;
    cam.position.set(0, 0, 0);
    cam.up.copy(this.up);
    cam.lookAt(dir.normalize());
    cam.updateMatrixWorld();
  }
}
