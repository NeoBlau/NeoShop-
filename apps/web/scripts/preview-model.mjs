/**
 * Renders a GLB to PNGs without a GPU, a browser window or a dev server.
 *
 *   node scripts/preview-model.mjs <file.glb> [more.glb …]
 *
 * Why this exists: a model arrives as a few megabytes of binary, and the only
 * questions that matter — what is it, how big is it, does it face the right way,
 * do its animations do anything — cannot be answered by reading the header. So
 * it goes into Chromium's software renderer, which is the same one the
 * end-to-end suite draws the street with, and comes back out as pictures.
 *
 * Writes <name>.front.png, .side.png, .top.png beside the output directory, and
 * prints the measured bounds and the clip list.
 */
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, '..');
const OUT = path.resolve(WEB, '../../.preview');
const SIZE = { width: 960, height: 720 };

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.json': 'application/json',
};

/** Static server rooted at the workspace, so node_modules and the model are both reachable. */
function serve(root, extras) {
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    const extra = extras.get(url.pathname);
    const file = extra ?? path.join(root, decodeURIComponent(url.pathname));

    if (!existsSync(file) || !statSync(file).isFile()) {
      response.writeHead(404).end('not found');
      return;
    }

    response.writeHead(200, {
      'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream',
      'content-length': statSync(file).size,
    });
    createReadStream(file).pipe(response);
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

const PAGE = (modelUrl) => `<!doctype html>
<meta charset="utf-8" />
<style>html,body{margin:0;background:#14171c;overflow:hidden}canvas{display:block}</style>
<script type="importmap">
{"imports":{"three":"/apps/web/node_modules/three/build/three.module.js",
            "three/":"/apps/web/node_modules/three/"}}
</script>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(${SIZE.width}, ${SIZE.height});
renderer.setPixelRatio(1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.body.append(renderer.domElement);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.background = new THREE.Color('#14171c');

const sun = new THREE.DirectionalLight('#fff3e2', 2.2);
sun.position.set(4, 7, 5);
scene.add(sun, new THREE.HemisphereLight('#cfe0f5', '#5b5346', 0.5));

const camera = new THREE.PerspectiveCamera(45, ${SIZE.width} / ${SIZE.height}, 0.01, 2000);

const loader = new GLTFLoader();
const gltf = await loader.loadAsync('${modelUrl}');
scene.add(gltf.scene);

const box = new THREE.Box3().setFromObject(gltf.scene);
const size = box.getSize(new THREE.Vector3());
const centre = box.getCenter(new THREE.Vector3());
const radius = Math.max(size.x, size.y, size.z) || 1;

// A floor plane so a model's footprint and its scale read at a glance.
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(radius * 8, radius * 8),
  new THREE.MeshStandardMaterial({ color: '#23272e', roughness: 0.9 }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = box.min.y;
scene.add(floor);

// A one-metre stick beside it: the only honest way to show whether the file
// thinks a chair is a metre tall or a hundred.
const metre = new THREE.Mesh(
  new THREE.BoxGeometry(0.04, 1, 0.04),
  new THREE.MeshStandardMaterial({ color: '#e5b25a', emissive: '#e5b25a', emissiveIntensity: 0.4 }),
);
metre.position.set(box.min.x - radius * 0.25, box.min.y + 0.5, box.max.z);
scene.add(metre);

const mixer = gltf.animations.length ? new THREE.AnimationMixer(gltf.scene) : null;

window.__model = {
  size: size.toArray(),
  min: box.min.toArray(),
  max: box.max.toArray(),
  clips: gltf.animations.map((clip) => ({ name: clip.name, duration: clip.duration })),
};

window.__shoot = (angle, elevation, clip, time) => {
  if (clip !== null && mixer) {
    mixer.stopAllAction();
    const found = gltf.animations[clip];
    if (found) {
      const action = mixer.clipAction(found);
      action.play();
      mixer.setTime(Math.min(time, found.duration));
    }
  }

  const distance = radius * 1.9;
  camera.position.set(
    centre.x + Math.sin(angle) * Math.cos(elevation) * distance,
    centre.y + Math.sin(elevation) * distance,
    centre.z + Math.cos(angle) * Math.cos(elevation) * distance,
  );
  camera.lookAt(centre);
  renderer.render(scene, camera);
  return true;
};

window.__ready = true;
</script>`;

async function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error('usage: node scripts/preview-model.mjs <file.glb> …');
    process.exit(1);
  }

  mkdirSync(OUT, { recursive: true });

  const extras = new Map();
  for (const [index, file] of files.entries()) {
    extras.set(`/model-${index}.glb`, path.resolve(file));
    const page = path.join(OUT, `page-${index}.html`);
    writeFileSync(page, PAGE(`/model-${index}.glb`));
    extras.set(`/page-${index}.html`, page);
  }

  const { server, port } = await serve(path.resolve(WEB, '../..'), extras);
  const browser = await chromium.launch({
    executablePath: process.env.E2E_CHROMIUM_PATH,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });

  try {
    for (const [index, file] of files.entries()) {
      const name = path
        .basename(file)
        .replace(/\.glb$/i, '')
        .slice(0, 48);
      const page = await browser.newPage({ viewport: SIZE });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));

      // Served rather than injected: a page set through setContent has no base
      // URL, and an import map whose entries are absolute paths resolves to
      // null there — the module specifiers then fail to resolve at all.
      await page.goto(`http://127.0.0.1:${port}/page-${index}.html`, { waitUntil: 'load' });

      try {
        await page.waitForFunction('window.__ready === true', null, { timeout: 120_000 });
      } catch {
        console.log(`\n=== ${name}\n  FAILED TO LOAD: ${errors.join('; ') || 'timeout'}`);
        await page.close();
        continue;
      }

      const info = await page.evaluate('window.__model');
      console.log(`\n=== ${name}`);
      console.log(
        `  size ${info.size.map((v) => v.toFixed(2)).join(' x ')} m   ` +
          `floor at y=${info.min[1].toFixed(2)}`,
      );
      console.log(
        `  clips: ${info.clips.map((c) => `${c.name} (${c.duration.toFixed(2)}s)`).join(', ') || 'none'}`,
      );

      const shots = [
        ['front', 0, 0.18, null, 0],
        ['three-quarter', Math.PI * 0.3, 0.32, null, 0],
        ['top', 0.4, 1.0, null, 0],
      ];

      // One frame from the middle of each clip: a still of an animation at rest
      // proves nothing about whether it moves.
      for (const [clipIndex, clip] of info.clips.entries()) {
        shots.push([
          `clip-${clipIndex}-${clip.name.replace(/[^\w.-]+/g, '_').slice(0, 24)}`,
          Math.PI * 0.3,
          0.28,
          clipIndex,
          clip.duration * 0.55,
        ]);
      }

      for (const [label, angle, elevation, clip, time] of shots) {
        await page.evaluate(
          ([a, e, c, t]) => window.__shoot(a, e, c, t),
          [angle, elevation, clip, time],
        );
        const file = path.join(OUT, `${name}.${label}.png`);
        writeFileSync(file, await page.locator('canvas').screenshot());
      }

      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  console.log(`\npreviews in ${OUT}`);
}

await main();
