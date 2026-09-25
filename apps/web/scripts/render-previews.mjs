/**
 * Renders a card photograph for every model the seed ships.
 *
 *   node scripts/render-previews.mjs
 *
 * A product card wants a picture, and until this existed there was none: the
 * only way a product ever got a PREVIEW asset was a supplier uploading a PNG
 * by hand, so every seeded product came up with an empty frame. The models are
 * right there and the renderer is right here, so the picture is made rather
 * than asked for.
 *
 * Deliberately not the same thing `preview-model.mjs` produces. That one is a
 * diagnostic — a floor, a metre stick, four angles — for answering "what is
 * this file". This is the shop photograph: one three-quarter view, the object
 * alone, framed with a margin, on the interface's own background so the card
 * does not look like a cut-out.
 */
import { createServer } from 'node:http';
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, '..');
const ROOT = path.resolve(WEB, '../..');
const MODELS = path.resolve(ROOT, 'apps/api/prisma/seed-assets');
const OUT = path.join(MODELS, 'previews');
/** The card is 640×480; rendering at twice that survives a retina screen. */
const SIZE = { width: 1280, height: 960 };

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.wasm': 'application/wasm',
};

function serve(root, extras) {
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    const file = extras.get(url.pathname) ?? path.join(root, decodeURIComponent(url.pathname));

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

const PAGE = `<!doctype html>
<meta charset="utf-8" />
<style>html,body{margin:0;background:#121419;overflow:hidden}canvas{display:block}</style>
<script type="importmap">
{"imports":{"three":"/apps/web/node_modules/three/build/three.module.js",
            "three/":"/apps/web/node_modules/three/"}}
</script>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(${SIZE.width}, ${SIZE.height});
renderer.setPixelRatio(1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.append(renderer.domElement);

const scene = new THREE.Scene();
// The panel colour, so a card reads as a photograph on the surface rather
// than as a cut-out floating on it.
scene.background = new THREE.Color('#121419');
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const key = new THREE.DirectionalLight('#fff4e4', 2.4);
key.position.set(3.5, 5, 4);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
scene.add(key);
scene.add(new THREE.DirectionalLight('#cfe0f5', 0.5).translateX(-4).translateZ(-3));

const camera = new THREE.PerspectiveCamera(35, ${SIZE.width} / ${SIZE.height}, 0.01, 200);

const loader = new GLTFLoader();
loader.setDRACOLoader(new DRACOLoader().setDecoderPath('/apps/web/public/draco/'));
loader.setKTX2Loader(
  new KTX2Loader().setTranscoderPath('/apps/web/public/basis/').detectSupport(renderer),
);

let current = null;

window.__shoot = async (url) => {
  if (current) {
    scene.remove(current);
    current = null;
  }

  const gltf = await loader.loadAsync(url);
  current = gltf.scene;
  current.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
  });
  scene.add(current);

  const box = new THREE.Box3().setFromObject(current);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());

  // A catcher for the contact shadow, at the object's own base. Without one
  // the product floats; with a visible floor it stops being a product shot.
  const catcher = new THREE.Mesh(
    new THREE.PlaneGeometry(Math.max(size.x, size.z) * 6, Math.max(size.x, size.z) * 6),
    new THREE.ShadowMaterial({ opacity: 0.45 }),
  );
  catcher.rotation.x = -Math.PI / 2;
  catcher.position.set(centre.x, box.min.y, centre.z);
  catcher.receiveShadow = true;
  current.add(catcher);

  key.target.position.copy(centre);
  key.target.updateMatrixWorld();
  scene.add(key.target);

  // Framed from the object's bounding sphere, so a lamp and a recliner are
  // both the same size on the card.
  const radius = size.length() / 2 || 1;
  const distance = (radius / Math.sin((35 * Math.PI) / 360)) * 0.95;
  const angle = Math.PI * 0.28;
  camera.position.set(
    centre.x + Math.sin(angle) * distance * 0.82,
    centre.y + radius * 0.55,
    centre.z + Math.cos(angle) * distance * 0.82,
  );
  camera.lookAt(centre);
  renderer.render(scene, camera);
  return true;
};

window.__ready = true;
</script>`;

async function main() {
  if (!existsSync(MODELS)) {
    console.log(`no ${path.relative(ROOT, MODELS)} — run \`make assets\` first`);
    return;
  }

  const models = readdirSync(MODELS).filter((file) => file.endsWith('.glb'));
  if (models.length === 0) {
    console.log('no models to photograph');
    return;
  }

  mkdirSync(OUT, { recursive: true });

  const extras = new Map();
  const pageFile = path.join(OUT, 'page.html');
  writeFileSync(pageFile, PAGE);
  extras.set('/page.html', pageFile);

  for (const model of models) {
    extras.set(`/models/${model}`, path.join(MODELS, model));
  }

  const { server, port } = await serve(ROOT, extras);

  let browser;
  try {
    browser = await chromium.launch({
      executablePath: process.env.E2E_CHROMIUM_PATH,
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });
  } catch (error) {
    // No browser is a reason to skip, not to fail: the cards fall back to the
    // placeholder they have always had, and `make dev` carries on.
    console.log(`skipped: no browser to render with (${error.message.split('\n')[0]})`);
    server.close();
    return;
  }

  try {
    const page = await browser.newPage({ viewport: SIZE });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto(`http://127.0.0.1:${port}/page.html`, { waitUntil: 'load' });
    await page.waitForFunction('window.__ready === true', null, { timeout: 120_000 });

    for (const model of models) {
      const name = model.replace(/\.glb$/i, '');
      try {
        await page.evaluate((url) => window.__shoot(url), `/models/${model}`);
        writeFileSync(path.join(OUT, `${name}.png`), await page.screenshot());
        console.log(`  ${name}.png`);
      } catch (error) {
        console.warn(`  ! ${name}: ${error.message.split('\n')[0]}`);
      }
    }

    if (errors.length > 0) console.warn(`  page errors: ${errors.join('; ')}`);
    await page.close();
  } finally {
    await browser.close();
    server.close();
  }

  console.log(`\nphotographs in ${path.relative(ROOT, OUT)}`);
}

await main();
