/**
 * The scanned parts a natural location is built from.
 *
 *   pnpm --filter @3dsfera/tools run fetch:nature
 *
 * No large natural scene is downloadable without an account — the good ones sit
 * behind Sketchfab, Fab or a marketplace login, and engine-store content is
 * licensed for that engine rather than for a web page. What *is* downloadable,
 * from the same place this project already takes its HDRIs and materials, is
 * the raw material: Poly Haven's photogrammetry collections. `verdant_trail`
 * is a coastal trail — cliffs, rock faces, boulders, island trees, shrubs — all
 * CC0 and scanned at up to 8K.
 *
 * So the location is assembled from real scans rather than modelled. Every
 * rock and every tree in it is a photograph of a rock and a tree; the terrain
 * they stand on is ours. That is how these assets are meant to be used.
 *
 * Nothing here is committed: a hundred and sixty megabytes of scans do not
 * belong in git, and this file plus build-nature.ts reproduce them exactly.
 */
import { createWriteStream, existsSync, mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../assets/nature');

type Resolution = '1k' | '2k' | '4k';

interface ModelAsset {
  kind: 'model';
  id: string;
  resolution: Resolution;
  note: string;
}

interface TextureAsset {
  kind: 'texture';
  id: string;
  resolution: Resolution;
  note: string;
}

interface HdriAsset {
  kind: 'hdri';
  id: string;
  resolution: '2k' | '4k';
  target: string;
  note: string;
}

type NatureAsset = ModelAsset | TextureAsset | HdriAsset;

/**
 * Resolution is a judgement per asset, not a global setting: a cliff fills the
 * screen and a shrub is half a metre of it.
 */
export const NATURE_ASSETS: NatureAsset[] = [
  // ── The land ──────────────────────────────────────────────────────────────
  { kind: 'model', id: 'mountainside', resolution: '4k', note: 'The ridge across the bay.' },
  { kind: 'model', id: 'coastal_cliff_02', resolution: '2k', note: 'Cliff wall behind the trail.' },
  { kind: 'model', id: 'coastal_cliff_04', resolution: '2k', note: 'Cliff wall, second variant.' },
  { kind: 'model', id: 'rock_face_01', resolution: '2k', note: 'Outcrop beside the path.' },
  { kind: 'model', id: 'boulder_01', resolution: '2k', note: 'Large scattered boulder.' },
  { kind: 'model', id: 'rock_07', resolution: '2k', note: 'Medium rock.' },
  { kind: 'model', id: 'rock_09', resolution: '2k', note: 'Medium rock, second variant.' },
  { kind: 'model', id: 'stone_01', resolution: '2k', note: 'Small stone for the path edges.' },
  { kind: 'model', id: 'sand_rocks_small_01', resolution: '2k', note: 'Pebble cluster.' },

  // ── What grows on it ──────────────────────────────────────────────────────
  { kind: 'model', id: 'island_tree_01', resolution: '2k', note: 'The canopy tree.' },
  { kind: 'model', id: 'jacaranda_tree', resolution: '2k', note: 'Second canopy species.' },
  { kind: 'model', id: 'tree_small_02', resolution: '2k', note: 'Understorey tree.' },
  { kind: 'model', id: 'dead_tree_trunk_02', resolution: '2k', note: 'Fallen trunk, for variety.' },
  { kind: 'model', id: 'shrub_01', resolution: '1k', note: 'Ground shrub.' },
  { kind: 'model', id: 'shrub_02', resolution: '1k', note: 'Ground shrub.' },
  { kind: 'model', id: 'shrub_03', resolution: '1k', note: 'Ground shrub.' },
  { kind: 'model', id: 'grass_medium_02', resolution: '1k', note: 'Grass tuft.' },
  { kind: 'model', id: 'root_cluster_01', resolution: '2k', note: 'Roots at the path edge.' },

  // ── The ground itself ─────────────────────────────────────────────────────
  {
    kind: 'texture',
    id: 'dirt_floor',
    resolution: '2k',
    note: 'The trail surface. From the same collection as the rocks, so it matches them.',
  },
  {
    kind: 'texture',
    id: 'aerial_grass_rock',
    resolution: '2k',
    note: 'Away from the trail: grass over rock.',
  },

  // ── The sky ───────────────────────────────────────────────────────────────
  {
    kind: 'hdri',
    id: 'drakensberg_solitary_mountain_puresky',
    resolution: '4k',
    target: 'sky.hdr',
    note: 'Mountain sky, both the backdrop and the light. 4K because it is visible.',
  },
];

interface PolyHavenFile {
  url: string;
  size: number;
  include?: Record<string, PolyHavenFile>;
}

async function download(url: string, target: string): Promise<number> {
  if (existsSync(target)) return statSync(target).size;

  mkdirSync(path.dirname(target), { recursive: true });
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`${response.status} ${response.statusText} for ${url}`);
  }

  await pipeline(Readable.fromWeb(response.body), createWriteStream(target));
  return statSync(target).size;
}

async function files(id: string): Promise<Record<string, unknown>> {
  const response = await fetch(`https://api.polyhaven.com/files/${id}`);
  if (!response.ok) throw new Error(`Poly Haven: ${response.status} for ${id}`);
  return (await response.json()) as Record<string, unknown>;
}

/**
 * A Poly Haven model is a .gltf, a .bin and its textures. The API lists the
 * companions under `include`, keyed by the path the .gltf refers to them by —
 * so they have to land at exactly those paths, or the loader cannot find them.
 */
async function fetchModel(asset: ModelAsset): Promise<number> {
  const listing = await files(asset.id);
  const gltf = (listing['gltf'] as Record<string, Record<string, PolyHavenFile>> | undefined)?.[
    asset.resolution
  ]?.['gltf'];

  if (!gltf) throw new Error(`No ${asset.resolution} gltf for ${asset.id}`);

  const dir = path.join(OUT, 'models', asset.id);
  let total = await download(gltf.url, path.join(dir, `${asset.id}.gltf`));

  for (const [relative, file] of Object.entries(gltf.include ?? {})) {
    total += await download(file.url, path.join(dir, relative));
  }

  return total;
}

/** A texture asset: the three maps the renderer wants, and nothing else. */
async function fetchTexture(asset: TextureAsset): Promise<number> {
  const listing = await files(asset.id);
  const dir = path.join(OUT, 'textures', asset.id);
  let total = 0;

  for (const [map, target] of [
    ['Diffuse', 'diffuse.jpg'],
    ['nor_gl', 'normal.jpg'],
    ['arm', 'arm.jpg'],
    ['Rough', 'rough.jpg'],
  ] as const) {
    const entry = (listing[map] as Record<string, Record<string, PolyHavenFile>> | undefined)?.[
      asset.resolution
    ];
    const file = entry?.['jpg'] ?? entry?.['png'];
    if (!file) continue;
    total += await download(file.url, path.join(dir, target));
  }

  if (total === 0) throw new Error(`No usable maps for texture ${asset.id}`);
  return total;
}

async function fetchHdri(asset: HdriAsset): Promise<number> {
  const listing = await files(asset.id);
  const file = (listing['hdri'] as Record<string, Record<string, PolyHavenFile>> | undefined)?.[
    asset.resolution
  ]?.['hdr'];

  if (!file) throw new Error(`No ${asset.resolution} hdr for ${asset.id}`);
  return download(file.url, path.join(OUT, asset.target));
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  let total = 0;

  for (const asset of NATURE_ASSETS) {
    try {
      const bytes =
        asset.kind === 'model'
          ? await fetchModel(asset)
          : asset.kind === 'texture'
            ? await fetchTexture(asset)
            : await fetchHdri(asset);

      total += bytes;
      console.log(`  ${asset.id.padEnd(38)} ${(bytes / 1e6).toFixed(1).padStart(6)} MB`);
    } catch (error) {
      console.warn(`  ! ${asset.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log(`\n${(total / 1e6).toFixed(0)} MB in ${OUT}`);
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  await main();
}
