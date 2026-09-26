// Thermal protection system textures, painted at 4K from the vehicle's own
// geometry. Buran carried ~38 600 individually shaped tiles: black borosilicate
// glazed HRSI tiles on the belly and lower flanks, white LRSI tiles on the
// upper flanks, felt (FRSI) blankets on the payload bay doors and carbon-carbon
// (RCC) on the nose cap and wing leading edges. Tile-to-tile tone variation is
// what gave the real orbiter its patchwork look, and it is reproduced here.
// Each texture set comes with a normal map (grout gaps) and a roughness map
// (the black glaze is glossy, felt is matte), plus an emissive mask used to
// show the hot belly glowing during entry.

import * as THREE from 'three';
import { Random } from '../core/rng.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Height canvas (grout = dark) -> tangent-space normal map canvas.
function normalFromHeight(hc, strength = 2.5) {
  const w = hc.width,
    h = hc.height;
  const src = hc.getContext('2d').getImageData(0, 0, w, h).data;
  const out = canvas(w, h);
  const ctx = out.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const H = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
      const l = Math.hypot(dx, dy, 1);
      const k = (y * w + x) * 4;
      d[k] = (-dx / l) * 127.5 + 127.5;
      d[k + 1] = (dy / l) * 127.5 + 127.5;
      d[k + 2] = (1 / l) * 127.5 + 127.5;
      d[k + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  return out;
}

function tex(c, srgb, anisotropy) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = anisotropy;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

const TILE_BLACK = [26, 27, 29];
const TILE_WHITE = [226, 224, 216];
const FELT = [206, 203, 190];
const RCC = [58, 60, 63];

// zoneFn(u, v) -> 'black' | 'white' | 'felt' | 'rcc'; tile sizes in pixels.
export function paintTPS({ width, height, tileU, tileV, zoneFn, seed, decals, anisotropy = 8 }) {
  const rnd = new Random(seed);
  const color = canvas(width, height);
  const hgt = canvas(width, height);
  const rough = canvas(width, height);
  const glow = canvas(width, height);
  const c = color.getContext('2d');
  const hctx = hgt.getContext('2d');
  const r = rough.getContext('2d');
  const g = glow.getContext('2d');
  hctx.fillStyle = '#000';
  hctx.fillRect(0, 0, width, height);
  g.fillStyle = '#000';
  g.fillRect(0, 0, width, height);
  const gap = Math.max(1, Math.round(tileU * 0.07));
  for (let ty = 0; ty < height; ty += tileV) {
    // Stagger alternate rows like the real tile layout.
    const off = (Math.floor(ty / tileV) % 2) * Math.round(tileU * 0.5);
    for (let tx = -off; tx < width; tx += tileU) {
      const cu = (tx + tileU / 2) / width;
      const cv = 1 - (ty + tileV / 2) / height;
      const zone = zoneFn(((cu % 1) + 1) % 1, cv);
      let base, rg, hot;
      let w = tileU,
        h = tileV;
      if (zone === 'black') {
        base = TILE_BLACK;
        rg = 70 + rnd.range(-15, 15);
        hot = 255;
      } else if (zone === 'rcc') {
        base = RCC;
        rg = 120;
        hot = 255;
        w = tileU * 3;
      } else if (zone === 'felt') {
        base = FELT;
        rg = 235;
        hot = 30;
        w = tileU * 4;
        h = tileV * 2;
      } else {
        base = TILE_WHITE;
        rg = 150 + rnd.range(-20, 20);
        hot = 90;
      }
      const shade = zone === 'black' ? rnd.range(-6, 10) : rnd.range(-16, 8);
      const tint = zone === 'white' && rnd.chance(0.12) ? -22 : 0; // replaced / weathered tiles
      c.fillStyle = `rgb(${base[0] + shade + tint},${base[1] + shade + tint},${base[2] + shade + tint * 0.6})`;
      c.fillRect(tx, ty, w, h);
      hctx.fillStyle = '#fff';
      hctx.fillRect(tx + gap, ty + gap, w - gap * 2, h - gap * 2);
      r.fillStyle = `rgb(${rg},${rg},${rg})`;
      r.fillRect(tx, ty, w, h);
      g.fillStyle = `rgb(${hot},${hot},${hot})`;
      g.fillRect(tx, ty, w, h);
      if (w > tileU) tx += w - tileU;
    }
  }
  // Grout lines in the colour map.
  c.globalAlpha = 0.55;
  c.strokeStyle = '#0c0c0c';
  c.lineWidth = gap;
  for (let ty = 0; ty < height; ty += tileV) {
    c.beginPath();
    c.moveTo(0, ty);
    c.lineTo(width, ty);
    c.stroke();
  }
  c.globalAlpha = 1;
  if (decals) decals(c, hctx, r);
  const normal = normalFromHeight(hgt, 3.0);
  return {
    map: tex(color, true, anisotropy),
    normalMap: tex(normal, false, anisotropy),
    roughnessMap: tex(rough, false, anisotropy),
    emissiveMap: tex(glow, true, anisotropy),
  };
}

export function drawText(ctx, text, x, y, size, rotation, color = '#111', font = 'bold') {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.fillStyle = color;
  ctx.font = `${font} ${size}px "Arial Narrow", "Roboto Condensed", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

export function drawFlag(ctx, x, y, w, h, rotation) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  const s = h / 3;
  ctx.fillStyle = '#f4f4f4';
  ctx.fillRect(-w / 2, -h / 2, w, s);
  ctx.fillStyle = '#1c3f94';
  ctx.fillRect(-w / 2, -h / 2 + s, w, s);
  ctx.fillStyle = '#d52b1e';
  ctx.fillRect(-w / 2, -h / 2 + 2 * s, w, s);
  ctx.restore();
}

// Heat-tinted titanium / niobium nozzle texture.
export function paintNozzle(anisotropy = 8) {
  const c = canvas(512, 1024);
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 1024);
  grd.addColorStop(0, '#6c6f74');
  grd.addColorStop(0.35, '#5a4c63');
  grd.addColorStop(0.55, '#3b4a78');
  grd.addColorStop(0.8, '#8c6a3c');
  grd.addColorStop(1, '#2a2a2c');
  g.fillStyle = grd;
  g.fillRect(0, 0, 512, 1024);
  // Regenerative cooling tubes
  g.globalAlpha = 0.35;
  for (let x = 0; x < 512; x += 6) {
    g.fillStyle = x % 12 ? '#000' : '#fff';
    g.fillRect(x, 0, 2, 1024);
  }
  g.globalAlpha = 1;
  return tex(c, true, anisotropy);
}

export function paintChute() {
  const c = canvas(1024, 512);
  const g = c.getContext('2d');
  for (let i = 0; i < 16; i++) {
    g.fillStyle = i % 2 ? '#f2f0ea' : '#e0561b';
    g.fillRect((i * 1024) / 16, 0, 1024 / 16 + 1, 512);
  }
  g.globalAlpha = 0.25;
  g.strokeStyle = '#333';
  for (let y = 0; y < 512; y += 32) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(1024, y);
    g.stroke();
  }
  return tex(c, true, 4);
}
