/**
 * The scanned parts a natural location is built from.
 *
 *   pnpm --filter @3dsfera/tools run fetch:nature
 *
 * No large natural scene is downloadable without an account — the good ones sit
 * behind Sketchfab, Fab or a marketplace login, and engine-store content is
 * licensed for that engine rather than for a web page. What *is* downloadable,
 * from the same place this project already takes its HDRIs and materials, is
 * the raw material: Poly Haven's photogrammetry, from the `verdant_trail`,
 * `pine_forest` and `smugglers_cove` collections, all CC0 and scanned at up
 * to 8K.
 *
 * So the location is assembled from real scans rather than modelled. Every
 * rock and every tree in it is a photograph of a rock and a tree; the terrain
 * they stand on is ours. That is how these assets are meant to be used.
 *
 * What is deliberately *not* here: `pine_tree_01` and `fir_tree_01`, the two
 * full-size conifer scans. Their buffers are 949 and 487 megabytes — twenty
 * million triangles of tree — and getting one of those down to the sixty
 * thousand a browser can hold means throwing away 99.7 per cent of it, which
 * turns needles into confetti. The canopy comes from `jacaranda_tree` instead:
 * twenty-four metres across, 3.9 million triangles, and it survives being
 * simplified because its leaves are bigger than its triangles.
 *
 * Nothing here is committed: a gigabyte of scans does not belong in git, and
 * this file plus build-nature.ts reproduce them exactly.
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
  { kind: 'model', id: 'mountainside', resolution: '4k', note: 'The peaks above the treeline.' },
  { kind: 'model', id: 'coastal_cliff_02', resolution: '2k', note: 'Rock wall on the rim.' },
  { kind: 'model', id: 'coastal_cliff_04', resolution: '2k', note: 'Rock wall, second variant.' },
  { kind: 'model', id: 'rock_face_01', resolution: '2k', note: 'Outcrop in the treeline.' },
  { kind: 'model', id: 'rock_face_02', resolution: '2k', note: 'Outcrop, second variant.' },
  { kind: 'model', id: 'boulder_01', resolution: '2k', note: 'Large boulder in the clearing.' },
  { kind: 'model', id: 'rock_moss_set_01', resolution: '2k', note: 'Mossy rocks, forest floor.' },
  { kind: 'model', id: 'rock_moss_set_02', resolution: '2k', note: 'Mossy rocks, second set.' },
  { kind: 'model', id: 'rock_07', resolution: '2k', note: 'Medium rock.' },
  { kind: 'model', id: 'rock_09', resolution: '2k', note: 'Medium rock, second variant.' },
  { kind: 'model', id: 'stone_01', resolution: '2k', note: 'Small stone for the path edges.' },

  // ── The canopy ────────────────────────────────────────────────────────────
  {
    kind: 'model',
    id: 'jacaranda_tree',
    resolution: '2k',
    note: 'The canopy: twenty-four metres of real tree. The one the grove is made of.',
  },
  { kind: 'model', id: 'island_tree_01', resolution: '2k', note: 'Understorey tree, five metres.' },
  { kind: 'model', id: 'tree_small_02', resolution: '2k', note: 'Understorey tree, four metres.' },
  {
    kind: 'model',
    id: 'fir_sapling_medium',
    resolution: '2k',
    note: 'A conifer among the broadleaves, so the grove is not one species.',
  },
  { kind: 'model', id: 'fir_sapling', resolution: '2k', note: 'Small conifer.' },

  // ── The forest floor ──────────────────────────────────────────────────────
  { kind: 'model', id: 'dead_tree_trunk', resolution: '2k', note: 'Fallen trunk.' },
  { kind: 'model', id: 'dead_tree_trunk_02', resolution: '2k', note: 'Fallen trunk, variant.' },
  { kind: 'model', id: 'tree_stump_01', resolution: '2k', note: 'Cut stump.' },
  { kind: 'model', id: 'tree_stump_02', resolution: '2k', note: 'Cut stump, variant.' },
  { kind: 'model', id: 'pine_roots', resolution: '2k', note: 'Exposed roots across the path.' },
  { kind: 'model', id: 'root_cluster_01', resolution: '2k', note: 'Roots at the path edge.' },
  { kind: 'model', id: 'dry_branches_medium_01', resolution: '2k', note: 'Deadfall.' },
  { kind: 'model', id: 'fern_02', resolution: '2k', note: 'Fern. The understorey of a glade.' },
  { kind: 'model', id: 'shrub_01', resolution: '1k', note: 'Ground shrub.' },
  { kind: 'model', id: 'shrub_02', resolution: '1k', note: 'Ground shrub.' },
  { kind: 'model', id: 'shrub_03', resolution: '1k', note: 'Ground shrub.' },
  { kind: 'model', id: 'moss_01', resolution: '2k', note: 'Moss patch, low enough to walk over.' },
  { kind: 'model', id: 'grass_medium_01', resolution: '1k', note: 'Grass tuft.' },
  { kind: 'model', id: 'grass_medium_02', resolution: '1k', note: 'Grass tuft, second variant.' },

  // ── The ground itself ─────────────────────────────────────────────────────
  {
    kind: 'texture',
    id: 'forest_ground_04',
    resolution: '2k',
    note: 'The clearing floor. From the pine_forest collection, so it matches the scans.',
  },
  {
    kind: 'texture',
    id: 'rocky_trail',
    resolution: '2k',
    note: 'The path and the pavilion pads: trodden ground rather than grass.',
  },
  {
    kind: 'texture',
    id: 'aerial_rocks_02',
    resolution: '2k',
    note: 'Anything too steep to hold soil. Without it the slopes read as smeared sand.',
  },

  // ── The sky ───────────────────────────────────────────────────────────────
  {
    kind: 'hdri',
    id: 'rustig_koppie_puresky',
    resolution: '4k',
    target: 'sky.hdr',
    note:
      'The backdrop and the light. A partly clouded afternoon with the sun still ' +
      'in it: a forest is made of the shadows under its canopy, and an overcast ' +
      'or misty sky — tried, and rejected — has none to give. 4K because it is visible.',
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
