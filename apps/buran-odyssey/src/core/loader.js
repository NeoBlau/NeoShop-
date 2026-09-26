// Asset streaming with fallbacks: local copy → jsDelivr → raw GitHub.
// Images are decoded once and shared between the GPU texture and, for
// elevation / ocean masks, the CPU-side height sampler.

import * as THREE from 'three';
import { ASSETS, localName, remoteUrls } from '../data/assets.js';

export class AssetLoader {
  constructor() {
    this.local = false;
    this.images = new Map();
    this.progress = { total: 0, done: 0, failed: [] };
    this.maxTextureSize = 8192;
    this.anisotropy = 8;
    this.onProgress = null;
  }

  async init() {
    try {
      const r = await fetch('assets/manifest.json', { cache: 'no-store' });
      this.local = r.ok;
    } catch {
      this.local = false;
    }
  }

  urls(key) {
    const list = [];
    if (this.local) list.push('assets/' + localName(key));
    return list.concat(remoteUrls(key));
  }

  image(key) {
    if (!ASSETS[key]) return Promise.reject(new Error('unknown asset ' + key));
    if (this.images.has(key)) return this.images.get(key);
    this.progress.total++;
    const p = (async () => {
      let lastErr = null;
      for (const url of this.urls(key)) {
        try {
          const img = await loadImage(url);
          this.progress.done++;
          this.onProgress?.(this.progress);
          return img;
        } catch (e) {
          lastErr = e;
        }
      }
      this.progress.done++;
      this.progress.failed.push(key);
      this.onProgress?.(this.progress);
      throw lastErr ?? new Error('asset failed ' + key);
    })();
    this.images.set(key, p);
    return p;
  }

  async texture(key, { srgb = true, repeat = true } = {}) {
    const img = await this.image(key);
    let source = img;
    if (img.width > this.maxTextureSize) {
      const w = this.maxTextureSize;
      const h = Math.round((img.height * w) / img.width);
      source = await createImageBitmap(img, {
        resizeWidth: w,
        resizeHeight: h,
        resizeQuality: 'high',
      });
    }
    const t = new THREE.Texture(source);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = this.anisotropy;
    t.wrapS = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.needsUpdate = true;
    return t;
  }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('failed ' + url));
    img.src = url;
  });
}

// Texture painting off the main thread.
export class TextureWorkerPool {
  constructor(size = Math.min(4, Math.max(1, (navigator.hardwareConcurrency || 4) - 1))) {
    this.workers = [];
    this.queue = [];
    this.pending = new Map();
    this.nextId = 1;
    for (let i = 0; i < size; i++) {
      const w = new Worker(new URL('../workers/texgen.worker.js', import.meta.url), {
        type: 'module',
      });
      w.busy = false;
      w.onmessage = (e) => this._done(w, e.data);
      w.onerror = (e) => {
        console.error('texture worker', e.message);
        this._fail(w, e);
      };
      this.workers.push(w);
    }
  }

  generate(job) {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.queue.push({ id, job, resolve, reject });
      this._pump();
    });
  }

  _pump() {
    for (const w of this.workers) {
      if (w.busy || !this.queue.length) continue;
      const task = this.queue.shift();
      w.busy = true;
      w.task = task;
      w.postMessage({ id: task.id, ...task.job });
    }
  }

  _done(w, data) {
    const task = w.task;
    w.busy = false;
    w.task = null;
    if (task) {
      const tex = new THREE.DataTexture(
        new Uint8Array(data.buffer),
        data.width,
        data.height,
        THREE.RGBAFormat,
      );
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.generateMipmaps = true;
      tex.anisotropy = 8;
      tex.needsUpdate = true;
      task.resolve(tex);
    }
    this._pump();
  }

  _fail(w, e) {
    const task = w.task;
    w.busy = false;
    w.task = null;
    task?.reject(e);
    this._pump();
  }
}

// Terrain chunk generation pool. Jobs go to the least-loaded worker; body
// initialisation and elevation rasters are broadcast to all of them.
export class TerrainWorkerPool {
  constructor(size = Math.min(6, Math.max(2, (navigator.hardwareConcurrency || 4) - 1))) {
    this.workers = [];
    this.pending = new Map();
    this.nextId = 1;
    for (let i = 0; i < size; i++) {
      const w = new Worker(new URL('../workers/terrain.worker.js', import.meta.url), {
        type: 'module',
      });
      w.load = 0;
      w.onmessage = (e) => {
        const p = this.pending.get(e.data.id);
        this.pending.delete(e.data.id);
        w.load--;
        if (!p) return;
        if (e.data.error) p.reject(new Error(e.data.error));
        else p.resolve(e.data.a);
      };
      w.onerror = (e) => console.error('terrain worker', e.message);
      this.workers.push(w);
    }
    this.capacity = size * 3;
  }

  busy(inflight) {
    return inflight >= this.capacity;
  }

  register(key, desc) {
    for (const w of this.workers) w.postMessage({ type: 'init', key, desc });
  }

  raster(key, which, map) {
    for (const w of this.workers)
      w.postMessage({ type: 'raster', key, which, data: map.data, w: map.w, h: map.h });
  }

  drop(key) {
    for (const w of this.workers) w.postMessage({ type: 'drop', key });
  }

  build(key, job) {
    let best = this.workers[0];
    for (const w of this.workers) if (w.load < best.load) best = w;
    best.load++;
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      best.postMessage({ type: 'build', id, key, job });
    });
  }
}
