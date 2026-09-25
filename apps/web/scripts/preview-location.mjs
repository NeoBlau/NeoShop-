/**
 * Renders a built location from inside it, without a GPU or a dev server.
 *
 *   node scripts/preview-location.mjs trail [street …]
 *
 * `preview-model.mjs` frames a whole model from outside, which answers what an
 * object is. A location is not an object: a hundred and seventy metres of
 * street or a hundred of coast, seen from far enough away to fit in frame, is
 * a postage stamp — and the only question worth asking about a location is
 * what a buyer standing in it sees. So this one reads the location's own
 * manifest, puts the camera at eye height on the arrival point and on each
 * pavilion plot, lights the scene with the location's own HDRI, and writes one
 * picture per viewpoint.
 */
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, '..');
const ROOT = path.resolve(WEB, '../..');
const LOCATIONS = path.join(WEB, 'public/world/locations');
const OUT = path.resolve(ROOT, '.preview');
const SIZE = { width: 1280, height: 720 };
const EYE_HEIGHT = 1.7;
/** Which level of detail to look at: the one a normal machine is served. */
const LEVEL = 1;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.hdr': 'image/vnd.radiance',
  '.json': 'application/json',
};

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

const PAGE = (modelUrl, skyUrl, light) => `<!doctype html>
<meta charset="utf-8" />
<style>html,body{margin:0;background:#14171c;overflow:hidden}canvas{display:block}</style>
<script type="importmap">
{"imports":{"three":"/apps/web/node_modules/three/build/three.module.js",
            "three/":"/apps/web/node_modules/three/"}}
</script>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(${SIZE.width}, ${SIZE.height});
renderer.setPixelRatio(1);
// Shadows, because a location judged without them is judged wrong: flat
// ambient light makes any outdoor scene look like a clay model, and half of
// what a canopy contributes is the shade under it.
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
// The location's own light, read from its manifest exactly as the application
// reads it — otherwise the picture is of a scene nobody will ever see.
renderer.toneMappingExposure = ${light.exposure};
document.body.append(renderer.domElement);

const scene = new THREE.Scene();

// The location's own sky, as background and as light: an outdoors scene lit by
// anything else tells you nothing about how it will look.
const sky = await new RGBELoader().loadAsync('${skyUrl}');
sky.mapping = THREE.EquirectangularReflectionMapping;
scene.environment = sky;
scene.environmentIntensity = ${light.environment};
scene.background = sky;

const sun = new THREE.DirectionalLight('#fff2df', ${light.sun});
sun.position.set(38, 62, 26);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 10;
sun.shadow.camera.far = 140;
sun.shadow.camera.left = -40;
sun.shadow.camera.right = 40;
sun.shadow.camera.top = 40;
sun.shadow.camera.bottom = -40;
sun.shadow.bias = -0.0009;
sun.shadow.normalBias = 0.035;
scene.add(sun, sun.target, new THREE.HemisphereLight('#cfe0f5', '#6d6455', ${light.hemisphere}));

const camera = new THREE.PerspectiveCamera(62, ${SIZE.width} / ${SIZE.height}, 0.1, 400);

const loader = new GLTFLoader();
loader.setDRACOLoader(new DRACOLoader().setDecoderPath('/apps/web/public/draco/'));
loader.setKTX2Loader(
  new KTX2Loader().setTranscoderPath('/apps/web/public/basis/').detectSupport(renderer),
);
const gltf = await loader.loadAsync('${modelUrl}');
gltf.scene.traverse((object) => {
  if (!object.isMesh) return;
  object.castShadow = true;
  object.receiveShadow = true;
  if (object.material && 'envMapIntensity' in object.material) {
    object.material.envMapIntensity = 0.85;
  }
});
scene.add(gltf.scene);

const box = new THREE.Box3().setFromObject(gltf.scene);
window.__scene = { size: box.getSize(new THREE.Vector3()).toArray(), min: box.min.toArray() };

/** Eye height above a given ground level, looking along a yaw. Yaw zero is -Z. */
window.__shoot = (x, y, z, yaw, pitch) => {
  // The shadow box follows the camera, exactly as the application's does: one
  // map stretched over two hundred metres has texels the size of a table.
  sun.position.set(x + 38, y + 62, z + 26);
  sun.target.position.set(x, y, z);
  sun.target.updateMatrixWorld();

  camera.position.set(x, y, z);
  camera.rotation.set(0, 0, 0);
  camera.rotateY(yaw);
  camera.rotateX(pitch);
  renderer.render(scene, camera);
  return true;
};

window.__ready = true;
</script>`;

async function main() {
  const ids = process.argv.slice(2);
  if (ids.length === 0) {
    console.error('usage: node scripts/preview-location.mjs <location id> …');
    process.exit(1);
  }

  mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({
    executablePath: process.env.E2E_CHROMIUM_PATH,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });

  const extras = new Map();
  const { server, port } = await serve(ROOT, extras);

  try {
    for (const id of ids) {
      const dir = path.join(LOCATIONS, id);
      const manifestFile = path.join(dir, 'location.json');
      if (!existsSync(manifestFile)) {
        console.log(`\n=== ${id}\n  not built: no ${path.relative(ROOT, manifestFile)}`);
        continue;
      }

      const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
      const level =
        manifest.levels.find((entry) => entry.level === LEVEL) ?? manifest.levels.at(-1);
      const sky = manifest.sky ?? '/world/hdri/street.hdr';

      extras.set(`/${id}.glb`, path.join(dir, level.file));
      extras.set(
        `/${id}.hdr`,
        sky.startsWith('/') ? path.join(WEB, 'public', sky) : path.join(dir, sky),
      );

      // The same fallback the application uses for a location whose build had
      // no opinion about its light.
      const light = {
        environment: 1,
        ...(manifest.light ?? { exposure: 1.05, sun: 2.6, hemisphere: 0.35 }),
      };

      const pageFile = path.join(OUT, `location-${id}.html`);
      writeFileSync(pageFile, PAGE(`/${id}.glb`, `/${id}.hdr`, light));
      extras.set(`/location-${id}.html`, pageFile);

      const page = await browser.newPage({ viewport: SIZE });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${port}/location-${id}.html`, { waitUntil: 'load' });

      try {
        await page.waitForFunction('window.__ready === true', null, { timeout: 180_000 });
      } catch {
        console.log(`\n=== ${id}\n  FAILED: ${errors.join('; ') || 'timeout'}`);
        await page.close();
        continue;
      }

      const info = await page.evaluate('window.__scene');
      console.log(`\n=== ${id} (${level.file}, ${level.triangles.toLocaleString()} tris)`);
      console.log(`  ${info.size.map((v) => v.toFixed(1)).join(' x ')} m`);

      // The arrival view first: it is the one nobody can avoid seeing.
      const shots = [
        ['arrival', manifest.spawn.position, manifest.spawn.yaw, 0],
        ['arrival-left', manifest.spawn.position, manifest.spawn.yaw + Math.PI / 2, 0],
        ['arrival-back', manifest.spawn.position, manifest.spawn.yaw + Math.PI, 0],
      ];

      // Then each plot, from two metres in front of it looking at the frontage:
      // where a supplier's products will stand, and what is behind them.
      for (const anchor of manifest.anchors) {
        const front = [
          anchor.stand[0] - Math.sin(anchor.facing) * 3.2,
          anchor.stand[1],
          anchor.stand[2] - Math.cos(anchor.facing) * 3.2,
        ];
        shots.push([anchor.name, front, anchor.facing + Math.PI, -0.05]);
      }

      for (const [label, ground, yaw, pitch] of shots) {
        await page.evaluate(
          ([x, y, z, a, p]) => window.__shoot(x, y, z, a, p),
          [ground[0], ground[1] + EYE_HEIGHT, ground[2], yaw, pitch],
        );
        // The whole viewport rather than the canvas element: the canvas fills
        // it, and an element screenshot waits for the element to be "stable",
        // which a software-rendered scene of three hundred thousand triangles
        // never manages inside the default timeout.
        writeFileSync(
          path.join(OUT, `${id}.${label}.png`),
          await page.screenshot({ timeout: 180_000 }),
        );
      }

      console.log(`  ${shots.length} views`);
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  console.log(`\npreviews in ${OUT}`);
}

await main();
