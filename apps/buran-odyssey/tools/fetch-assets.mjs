// Downloads every texture and three.js into the project so the game runs
// offline (or from a packaged install). Afterwards `assets/manifest.json`
// tells the loader to prefer local files.
// Usage: node tools/fetch-assets.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { dirname, join, resolve } from 'node:path';
import { ASSETS, localName, remoteUrls, THREE_VERSION } from '../src/data/assets.js';

const root = resolve(new URL('..', import.meta.url).pathname);

async function download(urls) {
  let last;
  for (const url of urls) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      return Buffer.from(await r.arrayBuffer());
    } catch (e) {
      last = e;
    }
  }
  throw last;
}

// Minimal ustar reader for the npm tarball.
function untar(buf, onFile) {
  let off = 0;
  while (off + 512 <= buf.length) {
    const name = buf.toString('utf8', off, off + 100).replace(/\0.*$/, '');
    if (!name) break;
    const prefix = buf.toString('utf8', off + 345, off + 500).replace(/\0.*$/, '');
    const size = parseInt(
      buf
        .toString('utf8', off + 124, off + 136)
        .replace(/\0.*$/, '')
        .trim() || '0',
      8,
    );
    const type = buf[off + 156];
    const full = prefix ? `${prefix}/${name}` : name;
    if (type === 48 || type === 0) onFile(full, buf.subarray(off + 512, off + 512 + size));
    off += 512 + Math.ceil(size / 512) * 512;
  }
}

const manifest = { three: THREE_VERSION, assets: {} };
await mkdir(join(root, 'assets'), { recursive: true });
for (const key of Object.keys(ASSETS)) {
  process.stdout.write(`  ${key} … `);
  const data = await download(remoteUrls(key));
  await writeFile(join(root, 'assets', localName(key)), data);
  manifest.assets[key] = localName(key);
  console.log(`${(data.length / 1e6).toFixed(2)} MB`);
}

process.stdout.write(`  three@${THREE_VERSION} … `);
const tgz = await download([`https://registry.npmjs.org/three/-/three-${THREE_VERSION}.tgz`]);
let count = 0;
const writes = [];
untar(gunzipSync(tgz), (path, data) => {
  const rel = path.replace(/^package\//, '');
  if (!(rel.startsWith('build/') || rel.startsWith('examples/jsm/'))) return;
  const out = join(root, 'vendor/three', rel);
  writes.push(mkdir(dirname(out), { recursive: true }).then(() => writeFile(out, data)));
  count++;
});
await Promise.all(writes);
console.log(`${count} файлов`);

await writeFile(join(root, 'assets/manifest.json'), JSON.stringify(manifest, null, 2));
console.log('Готово: игра будет работать без сети. Запуск: node tools/serve.mjs');
