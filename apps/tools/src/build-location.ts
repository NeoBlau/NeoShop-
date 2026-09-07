/**
 * Builds the walkable location from its source scene.
 *
 *   pnpm --filter @3dsfera/tools run build:location
 *
 * The location is the Amazon Lumberyard Bistro from the Open Research Content
 * Archive — a street of shops modelled by a professional art team for GDC 2017
 * and released under CC BY 4.0. It is used here for the same reason the
 * materials are scanned rather than painted: a hand-built street of boxes does
 * not read as a place, and no amount of lighting fixes that.
 *
 * What arrives is a research asset: two point eight million triangles, four
 * hundred textures with no mipmaps, and centimetres for units. What leaves is
 * four levels of detail, a mipped texture set at two budgets, and metres. None
 * of it is committed — `make assets` rebuilds it from the manifest.
 */
import { execFile } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { Logger, NodeIO, PropertyType, type Document, type Transform } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRDracoMeshCompression } from '@gltf-transform/extensions';
import { dedup, instance, join, prune, simplify, weld } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { MeshoptSimplifier } from 'meshoptimizer';
import { convertTextures, HIGH_BUDGETS, LOW_BUDGETS } from './location-textures.js';
import { buildWalkableGrid, countWalkable, type WalkableGrid } from './location-walkable.js';
import { findAnchors, findSpawn, type LocationAnchor } from './location-anchors.js';

const run = promisify(execFile);
const HERE = path.dirname(fileURLToPath(import.meta.url));

/**
 * The source, and its licence.
 *
 * CC BY 4.0 means attribution, not silence: the credit below is rendered in
 * the application and written into the location's manifest, and it travels
 * with any build that ships the geometry.
 */
export const SOURCE = {
  repository: 'https://github.com/qian-o/GLTF-Assets',
  scene: 'Bistro/BistroExterior.gltf',
  origin: 'https://developer.nvidia.com/orca/amazon-lumberyard-bistro',
  title: 'Amazon Lumberyard Bistro',
  author: 'Amazon Lumberyard',
  licence: 'CC BY 4.0',
  licenceUrl: 'https://creativecommons.org/licenses/by/4.0/',
} as const;

const CACHE = path.resolve(HERE, '../.cache/location');
const OUT = path.resolve(HERE, '../../web/public/world/location');
const SCRATCH = path.resolve(HERE, '../.cache/location-scratch');

/** Detail levels, coarsest last. Ratio is of the original triangle count. */
const LEVELS = [
  { level: 0, ratio: 1, error: 0, join: false },
  { level: 1, ratio: 0.5, error: 0.004, join: true },
  { level: 2, ratio: 0.2, error: 0.012, join: true },
  { level: 3, ratio: 0.07, error: 0.03, join: true },
] as const;

function directoryBytes(dir: string): number {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).reduce((total, file) => total + statSync(path.join(dir, file)).size, 0);
}

async function download(url: string, target: string): Promise<void> {
  mkdirSync(path.dirname(target), { recursive: true });
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`${response.status} ${response.statusText} for ${url}`);
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(target));
}

/**
 * Fetches the source scene.
 *
 * The geometry buffers are held in Git LFS, and this container has no lfs
 * client, so they are pulled from GitHub's media host directly. The textures
 * are ordinary blobs and come with a sparse checkout.
 */
export async function fetchSource(): Promise<string> {
  const dir = path.join(CACHE, 'Bistro');
  if (existsSync(path.join(dir, 'BistroExterior.bin'))) {
    const size = statSync(path.join(dir, 'BistroExterior.bin')).size;
    if (size > 1_000_000) return dir;
  }

  mkdirSync(CACHE, { recursive: true });

  if (!existsSync(path.join(CACHE, '.git'))) {
    await run('git', [
      'clone',
      '--depth',
      '1',
      '--filter=blob:none',
      '--no-checkout',
      `${SOURCE.repository}.git`,
      CACHE,
    ]);
    await run('git', ['-C', CACHE, 'sparse-checkout', 'init', '--cone']);
    await run('git', ['-C', CACHE, 'sparse-checkout', 'set', 'Bistro']);
  }

  await run('git', ['-C', CACHE, 'checkout', 'main'], {
    env: { ...process.env, GIT_LFS_SKIP_SMUDGE: '1' },
  });

  const media = 'https://media.githubusercontent.com/media/qian-o/GLTF-Assets/main/Bistro';
  await download(`${media}/BistroExterior.bin`, path.join(dir, 'BistroExterior.bin'));

  return dir;
}

interface SourceJson {
  images: { uri: string }[];
  [key: string]: unknown;
}

/**
 * Reads the scene with one-byte stand-ins for every texture.
 *
 * The geometry pipeline never looks at a texel, and loading the real set would
 * put three hundred and sixty megabytes into memory only to write it back out
 * once per detail level. The URIs are preserved, so the output still names the
 * right file — it is repointed at the re-encoded set on the way out.
 */
async function readWithoutTextures(sourceDir: string, io: NodeIO): Promise<Document> {
  const stub = path.join(SCRATCH, 'stub');
  const json = JSON.parse(
    readFileSync(path.join(sourceDir, 'BistroExterior.gltf'), 'utf8'),
  ) as SourceJson;

  mkdirSync(path.join(stub, 'Textures'), { recursive: true });
  for (const image of json.images) {
    writeFileSync(path.join(stub, decodeURIComponent(image.uri)), Buffer.alloc(1));
  }

  writeFileSync(path.join(stub, 'scene.gltf'), JSON.stringify(json));
  copyFileSync(path.join(sourceDir, 'BistroExterior.bin'), path.join(stub, 'BistroExterior.bin'));

  return io.read(path.join(stub, 'scene.gltf'));
}

function applyDraco(document: Document): void {
  document.createExtension(KHRDracoMeshCompression).setRequired(true).setEncoderOptions({
    method: KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER,
    encodeSpeed: 5,
    decodeSpeed: 5,
  });
}

function triangleCount(document: Document): number {
  let total = 0;
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const indices = primitive.getIndices();
      const count = indices
        ? indices.getCount()
        : (primitive.getAttribute('POSITION')?.getCount() ?? 0);
      total += count / 3;
    }
  }
  return Math.round(total);
}

/**
 * Writes one detail level.
 *
 * Image payloads are dropped and their URIs pointed at the shared texture
 * directory: four levels of the same street share one set of textures, and
 * writing them four times would be a gigabyte of duplicates.
 */
async function writeLevel(
  io: NodeIO,
  document: Document,
  target: string,
  textureDir: string,
): Promise<number> {
  const { json, resources } = await io.writeJSON(document);
  const stem = path.basename(target, '.gltf');

  for (const image of json.images ?? []) {
    if (!image.uri) continue;
    delete resources[image.uri];
    image.uri = `${textureDir}/${path.basename(decodeURIComponent(image.uri))}`;
  }

  // Every level inherits the source's buffer name, so without this all four
  // write to `BistroExterior.bin` and the last one wins — which looks like a
  // build that worked right up until the top level renders as the bottom one.
  for (const buffer of json.buffers ?? []) {
    if (!buffer.uri) continue;
    const data = resources[buffer.uri];
    delete resources[buffer.uri];
    buffer.uri = `${stem}.bin`;
    if (data) resources[buffer.uri] = data;
  }

  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, JSON.stringify(json));

  let bytes = statSync(target).size;
  for (const [uri, data] of Object.entries(resources)) {
    const file = path.join(path.dirname(target), uri);
    writeFileSync(file, Buffer.from(data));
    bytes += data.byteLength;
  }

  return bytes;
}

export interface LocationLevel {
  level: number;
  file: string;
  triangles: number;
  bytes: number;
}

/**
 * Which levels to build. The full set takes the best part of an hour, and
 * while the scene is being wired up one coarse level is all anyone needs:
 * `LOCATION_LEVELS=3 pnpm run build:location`.
 */
function wantedLevels(): (typeof LEVELS)[number][] {
  const requested = process.env['LOCATION_LEVELS'];
  if (!requested) return [...LEVELS];

  const wanted = new Set(requested.split(',').map((value) => Number(value.trim())));
  return LEVELS.filter((level) => wanted.has(level.level));
}

export async function buildGeometry(sourceDir: string): Promise<LocationLevel[]> {
  const [decoder, encoder] = await Promise.all([
    draco3d.createDecoderModule(),
    draco3d.createEncoderModule(),
  ]);

  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'draco3d.decoder': decoder, 'draco3d.encoder': encoder })
    .setLogger(new Logger(Logger.Verbosity.WARN));

  const levels: LocationLevel[] = [];

  for (const level of wantedLevels()) {
    const document = await readWithoutTextures(sourceDir, io);

    // No rescaling. The source vertices are in centimetres but its root node
    // already carries the 0.016 scale that takes them to metres — a street
    // 174 metres end to end. Applying a conversion on top of that was the
    // first thing tried here, and it produced a city the size of a shoebox.

    // Order matters: dedup and prune first so the later steps do less work,
    // weld before simplify because the simplifier needs shared vertices to
    // collapse, and instance last so it sees the final meshes. The street has
    // ninety hedges and forty chairs that are the same object moved around;
    // as instances they cost one draw call each instead of ninety.
    // Textures are deliberately out of scope for both passes. They are
    // one-byte stand-ins here, and a deduplicator that compares images would
    // either fail to read them or — worse — decide all four hundred are the
    // same picture and collapse the street onto a single texture.
    const scope = [PropertyType.ACCESSOR, PropertyType.MESH];

    const transforms: Transform[] = [
      dedup({ propertyTypes: scope }),
      prune({ propertyTypes: [...scope, PropertyType.NODE], keepAttributes: false }),
      weld(),
    ];

    if (level.join) {
      // Merging by material before simplifying is what makes the coarse levels
      // actually coarse. The scene arrives as thirteen hundred small meshes,
      // and a simplifier working on one shutter at a time cannot remove much
      // from it without destroying the shutter: the first attempt asked for a
      // ninety percent reduction and delivered nine.
      transforms.push(join());
    }

    if (level.ratio < 1) {
      transforms.push(
        simplify({ simplifier: MeshoptSimplifier, ratio: level.ratio, error: level.error }),
      );
    }

    // The street has ninety hedges and forty chairs that are the same object
    // moved around; as instances they cost one draw call each instead of
    // ninety. Only worth doing where the meshes were left separate.
    if (!level.join) transforms.push(instance({ min: 3 }));

    await document.transform(...transforms);
    applyDraco(document);

    // The coarse levels are for devices that cannot afford the big texture
    // set either, so they are written against the half-resolution one. Two
    // files rather than a switch at runtime: the alternative is rewriting
    // texture URLs inside the loader, which is a trap laid for whoever next
    // wonders why one tier looks blurry.
    const textureDir = level.level <= 1 ? 'textures' : 'textures-low';
    const file = `street-lod${level.level}.gltf`;
    const bytes = await writeLevel(io, document, path.join(OUT, file), textureDir);
    const triangles = triangleCount(document);

    levels.push({ level: level.level, file, triangles, bytes });
    console.log(
      `  lod${level.level}: ${triangles.toLocaleString('en')} tris, ${(bytes / 1e6).toFixed(1)} MB`,
    );
  }

  return levels;
}

/**
 * Reads the scene once more, at full detail, to work out where a person can
 * walk and where the shops are.
 *
 * Deliberately not folded into the geometry loop: the answer must come from
 * the original geometry, not from whichever level happened to be built last.
 * A buyer on a phone and a buyer on a desktop walk the same street.
 */
export async function buildNavigation(sourceDir: string): Promise<{
  grid: WalkableGrid;
  anchors: LocationAnchor[];
  spawn: { position: [number, number, number]; yaw: number };
}> {
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .setLogger(new Logger(Logger.Verbosity.WARN));
  const document = await readWithoutTextures(sourceDir, io);

  // Ten metres up is above every doorway and below every roof. The floor band
  // is measured from the lowest point in the scene, which is a foundation
  // several metres under the pavement — the street itself sits near the top of
  // that range.
  const grid = buildWalkableGrid(document, { ceiling: 10, floorBand: [6.5, 11] });
  const anchors = findAnchors(document, grid);
  const spawn = findSpawn(grid, anchors);

  // Nearest shop first. The scene hands anchors out in order, and a demo with
  // two suppliers should put them where the buyer is standing rather than at
  // the far end of a street they have not been told to walk down.
  anchors.sort(
    (a, b) =>
      Math.hypot(a.stand[0] - spawn.position[0], a.stand[2] - spawn.position[2]) -
      Math.hypot(b.stand[0] - spawn.position[0], b.stand[2] - spawn.position[2]),
  );

  console.log(
    `  walkable: ${countWalkable(grid)} cells of ${grid.width}x${grid.height}, ` +
      `${anchors.length} shop fronts`,
  );

  return { grid, anchors, spawn };
}

/** Packs the walkable mask one bit to a cell. */
function packMask(grid: WalkableGrid): Buffer {
  const packed = Buffer.alloc(Math.ceil(grid.mask.length / 8));
  for (let cell = 0; cell < grid.mask.length; cell += 1) {
    if (grid.mask[cell]) {
      const byte = cell >> 3;
      packed[byte] = (packed[byte] ?? 0) | (1 << (cell & 7));
    }
  }
  return packed;
}

export async function buildTextures(sourceDir: string): Promise<{ high: number; low: number }> {
  const json = JSON.parse(
    readFileSync(path.join(sourceDir, 'BistroExterior.gltf'), 'utf8'),
  ) as SourceJson;

  const sources = [
    ...new Set(json.images.map((image) => path.join(sourceDir, decodeURIComponent(image.uri)))),
  ];

  const totals = { high: 0, low: 0 };

  for (const [key, dir, budgets] of [
    ['high', 'textures', HIGH_BUDGETS],
    ['low', 'textures-low', LOW_BUDGETS],
  ] as const) {
    const results = await convertTextures({
      sources,
      targetDir: path.join(OUT, dir),
      scratchDir: path.join(SCRATCH, 'ktx'),
      budgets,
      concurrency: 3,
      onProgress: (done, total) => {
        if (done % 50 === 0 || done === total) console.log(`  ${dir}: ${done}/${total}`);
      },
    });

    totals[key] = results.reduce((sum, result) => sum + result.bytes, 0);
  }

  return totals;
}

/** The levels already built, read back off disk. */
function readExistingLevels(): LocationLevel[] {
  const existing = JSON.parse(readFileSync(path.join(OUT, 'location.json'), 'utf8')) as {
    levels: LocationLevel[];
  };
  return existing.levels;
}

async function main(): Promise<void> {
  console.log('fetching the source scene…');
  const sourceDir = await fetchSource();

  // Re-encoding four hundred textures takes twenty minutes and only has to
  // happen when the source or the budgets change, so a rebuild of the geometry
  // alone can skip it: LOCATION_SKIP_TEXTURES=1.
  const skipTextures = process.env['LOCATION_SKIP_TEXTURES'] === '1';

  if (!skipTextures) {
    console.log('re-encoding textures…');
    await buildTextures(sourceDir);
  }

  // Measured from what is on disk rather than from what the encoder returned,
  // so the figure is right whether or not this run did the encoding.
  const textures = {
    high: directoryBytes(path.join(OUT, 'textures')),
    low: directoryBytes(path.join(OUT, 'textures-low')),
  };

  console.log('mapping the street…');
  const { grid, anchors, spawn } = await buildNavigation(sourceDir);

  writeFileSync(path.join(OUT, 'walkable.bin'), packMask(grid));
  writeFileSync(path.join(OUT, 'ground.bin'), Buffer.from(grid.ground));

  // Re-deriving the map is seconds; rebuilding four levels of geometry is
  // minutes. Tuning where the shops face should not cost the second one:
  // LOCATION_SKIP_GEOMETRY=1 keeps whatever is already on disk.
  const levels =
    process.env['LOCATION_SKIP_GEOMETRY'] === '1'
      ? readExistingLevels()
      : await (async () => {
          console.log('building geometry…');
          return buildGeometry(sourceDir);
        })();

  const manifest = {
    source: SOURCE,
    levels,
    textures: {
      high: { dir: 'textures', bytes: textures.high },
      low: { dir: 'textures-low', bytes: textures.low },
    },
    navigation: {
      origin: grid.origin,
      cell: grid.cell,
      width: grid.width,
      height: grid.height,
      groundBase: grid.groundBase,
      mask: 'walkable.bin',
      ground: 'ground.bin',
    },
    spawn,
    anchors,
    builtAt: new Date().toISOString(),
  };

  writeFileSync(path.join(OUT, 'location.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  rmSync(SCRATCH, { recursive: true, force: true });

  console.log(
    `\nlocation built: ${(textures.high / 1e6).toFixed(0)} MB textures, ` +
      `${levels.map((l) => `${(l.bytes / 1e6).toFixed(0)}`).join('/')} MB geometry`,
  );
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  await main();
}
