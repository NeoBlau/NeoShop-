// Attitude indicator ("навигационный шар"): the local horizon frame (north,
// east, up at the ship's position over the reference body) drawn on a sphere
// that rotates with the ship, with prograde/retrograde, radial, normal and
// target markers projected onto it.

import * as THREE from 'three';

function navballTexture() {
  const W = 2048,
    H = 1024;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, H / 2);
  sky.addColorStop(0, '#0e3f7a');
  sky.addColorStop(1, '#3f86c7');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H / 2);
  const gnd = g.createLinearGradient(0, H / 2, 0, H);
  gnd.addColorStop(0, '#8a5a2b');
  gnd.addColorStop(1, '#4a2c12');
  g.fillStyle = gnd;
  g.fillRect(0, H / 2, W, H / 2);
  // Latitude (pitch) lines
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.fillStyle = '#fff';
  g.font = 'bold 26px monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let p = -80; p <= 80; p += 10) {
    const y = H / 2 - (p / 180) * H;
    g.lineWidth = p === 0 ? 6 : p % 30 === 0 ? 3 : 1.5;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(W, y);
    g.stroke();
    if (p !== 0)
      for (let h = 0; h < 360; h += 45) {
        const x = ((0.5 - h / 360 + 1) % 1) * W;
        // text is mirrored with the ball; pre-flip it
        g.save();
        g.translate(x + 40, y - 14);
        g.scale(-1, 1);
        g.fillText(String(p), 0, 0);
        g.restore();
      }
  }
  // Heading meridians
  for (let h = 0; h < 360; h += 15) {
    const x = ((0.5 - h / 360 + 1) % 1) * W;
    g.lineWidth = h % 90 === 0 ? 4 : h % 45 === 0 ? 2.5 : 1;
    g.beginPath();
    g.moveTo(x, H * 0.06);
    g.lineTo(x, H * 0.94);
    g.stroke();
    if (h % 30 === 0) {
      const label = { 0: 'С', 90: 'В', 180: 'Ю', 270: 'З' }[h] ?? String(h);
      g.save();
      g.font = h % 90 === 0 ? 'bold 44px sans-serif' : 'bold 28px monospace';
      g.fillStyle = h % 90 === 0 ? '#ffd24a' : '#fff';
      g.translate(x, H / 2 - 30);
      g.scale(-1, 1);
      g.fillText(label, 0, 0);
      g.restore();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export class NavBall {
  constructor(canvas, overlay) {
    this.canvas = canvas;
    this.overlay = overlay;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1.05, 1.05, 1.05, -1.05, 0.1, 10);
    this.camera.position.set(0, 0, 5);
    this.camera.lookAt(0, 0, 0);
    const geo = new THREE.SphereGeometry(1, 96, 64);
    this.ball = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ map: navballTexture(), roughness: 0.55, metalness: 0.05 }),
    );
    this.ball.matrixAutoUpdate = false;
    this.scene.add(this.ball);
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    const d = new THREE.DirectionalLight(0xffffff, 1.6);
    d.position.set(-1, 2, 4);
    this.scene.add(d);
    this.markers = {};
    for (const [key, sym, color] of [
      ['pro', '⊕', '#e8ff4a'],
      ['retro', '⊗', '#e8ff4a'],
      ['radOut', '◉', '#4af0ff'],
      ['radIn', '◎', '#4af0ff'],
      ['nrm', '▲', '#ff5ef0'],
      ['anti', '▼', '#ff5ef0'],
      ['tgt', '◈', '#ff9d2e'],
      ['site', '✚', '#7dff8c'],
    ]) {
      const el = document.createElement('div');
      el.className = 'nb-marker';
      el.textContent = sym;
      el.style.color = color;
      overlay.appendChild(el);
      this.markers[key] = el;
    }
    this.size = 0;
  }

  resize() {
    const s = this.canvas.clientWidth;
    if (s !== this.size) {
      this.size = s;
      this.renderer.setSize(s, s, false);
    }
  }

  // shipQ: body->inertial; N, E, U: local horizon unit vectors (inertial);
  // vectors: { pro, radOut, nrm, tgt, site } inertial directions (may be null).
  update(shipQ, N, E, U, vectors) {
    this.resize();
    const X = new THREE.Vector3(1, 0, 0).applyQuaternion(shipQ);
    const Y = new THREE.Vector3(0, 1, 0).applyQuaternion(shipQ);
    const Z = new THREE.Vector3(0, 0, 1).applyQuaternion(shipQ);
    const view = (d) => new THREE.Vector3(d.dot(Y), -d.dot(Z), d.dot(X));
    this.ball.matrix.makeBasis(view(N), view(U), view(E));
    this.ball.matrixWorldNeedsUpdate = true;
    this.renderer.render(this.scene, this.camera);

    const place = (el, d) => {
      if (!d) {
        el.style.display = 'none';
        return;
      }
      const v = view(d.clone().normalize());
      if (v.z < 0.05) {
        el.style.display = 'none';
        return;
      }
      el.style.display = 'block';
      const r = this.size / 2 / 1.05;
      el.style.transform = `translate(${this.size / 2 + v.x * r}px, ${this.size / 2 - v.y * r}px) translate(-50%, -50%)`;
    };
    const neg = (d) => (d ? d.clone().negate() : null);
    place(this.markers.pro, vectors.pro);
    place(this.markers.retro, neg(vectors.pro));
    place(this.markers.radOut, vectors.radOut);
    place(this.markers.radIn, neg(vectors.radOut));
    place(this.markers.nrm, vectors.nrm);
    place(this.markers.anti, neg(vectors.nrm));
    place(this.markers.tgt, vectors.tgt);
    place(this.markers.site, vectors.site);

    // Heading / pitch / roll readouts
    const fwdH = X.clone().addScaledVector(U, -X.dot(U));
    const heading = (Math.atan2(fwdH.dot(E), fwdH.dot(N)) * 180) / Math.PI;
    const pitch = (Math.asin(THREE.MathUtils.clamp(X.dot(U), -1, 1)) * 180) / Math.PI;
    const upB = Z.clone().negate();
    const rightH = new THREE.Vector3().crossVectors(X, U).normalize();
    const roll = (Math.atan2(upB.dot(rightH), upB.dot(U)) * 180) / Math.PI;
    return { heading: (heading + 360) % 360, pitch, roll };
  }
}
