/**
 * Draws the desktop application icon.
 *
 *   pnpm --filter @3dsfera/tools run gen:icon
 *
 * One 1024-pixel source, from which `tauri icon` derives every size, the .icns
 * for macOS and the .ico for Windows. Drawn in code rather than committed as a
 * binary for the same reason the demo models are: a mark that can be diffed
 * and regenerated beats a PNG nobody can edit.
 *
 * The mark is a sphere on a dark tile — three lines of longitude and an
 * equator, which reads at sixteen pixels as a globe and at a thousand as a
 * wireframe. It is the name: a sphere, in three dimensions.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const SIZE = 1024;
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../desktop/src-tauri');

const INK = '#e8c079';
const TILE_TOP = '#1b1e24';
const TILE_BOTTOM = '#0d0f13';

/** Half-width of an ellipse at the given fraction of the sphere's radius. */
function meridian(radius: number, offset: number): string {
  const width = Math.round(radius * Math.sqrt(Math.max(0, 1 - offset * offset)));
  return `<ellipse cx="0" cy="0" rx="${width}" ry="${radius}" />`;
}

function svg(): string {
  const centre = SIZE / 2;
  const radius = Math.round(SIZE * 0.31);
  const stroke = Math.round(SIZE * 0.022);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <defs>
    <linearGradient id="tile" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${TILE_TOP}"/>
      <stop offset="1" stop-color="${TILE_BOTTOM}"/>
    </linearGradient>
    <radialGradient id="sheen" cx="0.35" cy="0.3" r="0.8">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.16"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${SIZE}" height="${SIZE}" rx="${Math.round(SIZE * 0.22)}" fill="url(#tile)"/>

  <g transform="translate(${centre} ${centre})" fill="none" stroke="${INK}"
     stroke-width="${stroke}" stroke-linecap="round">
    <circle cx="0" cy="0" r="${radius}"/>
    <line x1="${-radius}" y1="0" x2="${radius}" y2="0"/>
    ${meridian(radius, 0)}
    ${meridian(radius, 0.62)}
  </g>

  <rect width="${SIZE}" height="${SIZE}" rx="${Math.round(SIZE * 0.22)}" fill="url(#sheen)"/>
</svg>`;
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const source = path.join(OUT, 'icon.png');

  await sharp(Buffer.from(svg())).png().toFile(source);
  writeFileSync(path.join(OUT, 'icon.svg'), `${svg()}\n`);

  console.log(`icon written to ${source}`);
  console.log('now run: pnpm --filter @3dsfera/desktop exec tauri icon src-tauri/icon.png');
}

await main();
