/**
 * Copies the Draco and Basis decoders out of the installed `three` package and
 * into public/, so the viewer never reaches for a CDN.
 *
 * drei's `useGLTF` defaults to fetching the Draco decoder from gstatic.com and
 * `Environment preset` pulls HDRIs from a public bucket. Both would make the 3D
 * scene depend on the open internet, and both are blocked outright by the
 * desktop shell's content security policy. Everything the renderer needs is
 * served from our own origin instead, and it stays version-locked to the three
 * release in the lockfile.
 */
import { cp, mkdir, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);

// three does not export its package.json, so the package root is derived from
// the resolved entry point instead: .../three/build/three.module.js -> .../three
const entry = require.resolve('three');
const threeRoot = path.resolve(path.dirname(entry), '..');
const libs = path.join(threeRoot, 'examples/jsm/libs');
const publicDir = path.resolve(import.meta.dirname, '../public');

const copies = [
  { from: path.join(libs, 'draco/gltf'), to: path.join(publicDir, 'draco') },
  { from: path.join(libs, 'basis'), to: path.join(publicDir, 'basis') },
];

for (const { from, to } of copies) {
  await mkdir(to, { recursive: true });
  await cp(from, to, { recursive: true });
  const files = await readdir(to);
  console.log(`decoders: ${path.relative(publicDir, to)} <- ${files.length} files`);
}
