/**
 * Downloads the third-party assets the demo world is built from.
 *
 *   pnpm --filter @3dsfera/tools run fetch:assets
 *
 * Everything listed here is CC0 — public domain, no attribution required, no
 * restriction on commercial use. That is a deliberate constraint: an asset with
 * a licence that needs tracking becomes a liability the moment the project has
 * customers, and engine-store content (Unreal, Unity) is licensed for use
 * inside that engine, which a WebGL storefront is not.
 *
 * Sources:
 *   polyhaven.com   HDRI environments and scanned props   (CC0)
 *   ambientcg.com   scanned PBR materials                 (CC0)
 *
 * The downloads are not committed. `make assets` fetches them once; the
 * manifest below is what is under version control, so the world is
 * reproducible without carrying a few hundred megabytes in git.
 */
import { execFile } from 'node:child_process';
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const run = promisify(execFile);

/**
 * These are application assets, not supplier content: the gallery is part of
 * the product, so they are served from the web app's own origin rather than
 * from the object storage that holds uploads.
 */
const OUT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../web/public/world',
);

interface HdriRequest {
  kind: 'hdri';
  id: string;
  /** 1k is plenty for image-based lighting; 2k only if shown as a backdrop. */
  resolution: '1k' | '2k';
  target: string;
  note: string;
}

interface MaterialRequest {
  kind: 'material';
  /** ambientCG asset id, e.g. Concrete034. */
  id: string;
  resolution: '1K' | '2K' | '4K';
  target: string;
  note: string;
}

interface FontRequest {
  kind: 'font';
  url: string;
  target: string;
  licence: string;
  source: string;
  note: string;
}

interface ModelRequest {
  kind: 'model';
  /** Poly Haven model id. */
  id: string;
  resolution: '1k' | '2k';
  target: string;
  note: string;
}

type AssetRequest = HdriRequest | MaterialRequest | ModelRequest | FontRequest;

/**
 * The manifest. Each entry says what the asset is for, because six months from
 * now "Concrete034" tells nobody why it is in the repository.
 */
const MANIFEST: AssetRequest[] = [
  {
    kind: 'font',
    // Variable Inter from Google's font repository. Covers Cyrillic, which the
    // catalogue needs, and is the same family the interface uses.
    url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf',
    target: 'fonts/inter.ttf',
    licence: 'OFL-1.1',
    source: 'https://fonts.google.com/specimen/Inter',
    note:
      'Labels inside the 3D scene. Without an explicit font, troika downloads a ' +
      'Unicode index from a public CDN and the whole scene fails offline.',
  },
  {
    kind: 'hdri',
    id: 'brown_photostudio_02',
    resolution: '1k',
    target: 'hdri/studio.hdr',
    note: 'Product lighting: soft key from above, neutral bounce. Used by the viewer.',
  },
  {
    kind: 'hdri',
    id: 'san_giuseppe_bridge',
    resolution: '2k',
    target: 'hdri/street.hdr',
    note:
      "The location's sky and its light. Two kelvin more than the scene was lit with " +
      'would show; this is the same environment its authors used, and it is the backdrop ' +
      'above the rooflines as well as the light on them.',
  },
  {
    kind: 'material',
    id: 'Marble016',
    resolution: '2K',
    target: 'materials/plinth-marble',
    note: 'Product plinths: marble reads as expensive at a glance, which is the point.',
  },
];

async function download(url: string, target: string): Promise<number> {
  mkdirSync(path.dirname(target), { recursive: true });

  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`${response.status} ${response.statusText} for ${url}`);
  }

  await pipeline(Readable.fromWeb(response.body), createWriteStream(target));
  return statSync(target).size;
}

interface PolyHavenFile {
  url: string;
  size: number;
}

async function fetchHdri(request: HdriRequest): Promise<number> {
  const response = await fetch(`https://api.polyhaven.com/files/${request.id}`);
  const files = (await response.json()) as {
    hdri?: Record<string, Record<string, PolyHavenFile>>;
  };

  const file = files.hdri?.[request.resolution]?.['hdr'];
  if (!file) throw new Error(`Poly Haven has no ${request.resolution} hdr for ${request.id}`);

  return download(file.url, path.join(OUT_DIR, request.target));
}

async function fetchModel(request: ModelRequest): Promise<number> {
  const response = await fetch(`https://api.polyhaven.com/files/${request.id}`);
  const files = (await response.json()) as {
    gltf?: Record<string, Record<string, PolyHavenFile>>;
  };

  const file = files.gltf?.[request.resolution]?.['gltf'];
  if (!file) throw new Error(`Poly Haven has no ${request.resolution} gltf for ${request.id}`);

  return download(file.url, path.join(OUT_DIR, request.target));
}

/** ambientCG ships each material as one zip of the individual maps. */
async function fetchMaterial(request: MaterialRequest): Promise<number> {
  const url = `https://ambientcg.com/get?file=${request.id}_${request.resolution}-JPG.zip`;
  return download(url, path.join(OUT_DIR, `${request.target}.zip`));
}

/**
 * Turns an ambientCG archive into the three maps the renderer wants.
 *
 * Scanned materials ship one file per channel; glTF wants occlusion, roughness
 * and metalness packed into one RGB texture, so that a surface costs one
 * texture fetch instead of three. Missing channels get sensible constants:
 * these are architectural surfaces, so metalness is zero and, when the scan has
 * no occlusion map, the renderer's own SSAO covers it.
 */
async function packMaterial(dir: string): Promise<{ maps: string[]; size: number } | null> {
  const files = readdirSync(dir);
  const find = (suffix: string): string | undefined =>
    files.find((file) => file.toLowerCase().endsWith(suffix.toLowerCase()));

  const color = find('_Color.jpg');
  // GL convention matches glTF; the DX variant has its green channel flipped.
  const normal = find('_NormalGL.jpg') ?? find('_NormalDX.jpg');
  const roughness = find('_Roughness.jpg');
  if (!color || !normal || !roughness) return null;

  await sharp(path.join(dir, color)).toFile(path.join(dir, 'basecolor.jpg'));
  await sharp(path.join(dir, normal)).toFile(path.join(dir, 'normal.jpg'));

  const occlusion = find('_AmbientOcclusion.jpg');
  const metalness = find('_Metalness.jpg');
  const { width = 0, height = 0 } = await sharp(path.join(dir, roughness)).metadata();

  const channels = await Promise.all([
    occlusion
      ? sharp(path.join(dir, occlusion)).greyscale().raw().toBuffer()
      : Promise.resolve(Buffer.alloc(width * height, 255)),
    sharp(path.join(dir, roughness)).greyscale().raw().toBuffer(),
    metalness
      ? sharp(path.join(dir, metalness)).greyscale().raw().toBuffer()
      : Promise.resolve(Buffer.alloc(width * height, 0)),
  ]);

  const orm = Buffer.allocUnsafe(width * height * 3);
  for (let i = 0; i < width * height; i += 1) {
    orm[i * 3] = channels[0][i] ?? 255;
    orm[i * 3 + 1] = channels[1][i] ?? 128;
    orm[i * 3 + 2] = channels[2][i] ?? 0;
  }

  await sharp(orm, { raw: { width, height, channels: 3 } })
    .jpeg({ quality: 95, chromaSubsampling: '4:4:4' })
    .toFile(path.join(dir, 'orm.jpg'));

  // The archive also carries Blender, USD and MaterialX files we never read.
  for (const file of readdirSync(dir)) {
    if (!['basecolor.jpg', 'normal.jpg', 'orm.jpg'].includes(file)) {
      rmSync(path.join(dir, file), { force: true });
    }
  }

  const size = ['basecolor.jpg', 'normal.jpg', 'orm.jpg'].reduce(
    (total, file) => total + statSync(path.join(dir, file)).size,
    0,
  );

  return { maps: ['basecolor.jpg', 'normal.jpg', 'orm.jpg'], size };
}

async function prepareMaterial(request: MaterialRequest): Promise<void> {
  const dir = path.join(OUT_DIR, request.target);
  const archive = `${dir}.zip`;
  if (!existsSync(archive)) return;

  mkdirSync(dir, { recursive: true });

  try {
    await run('unzip', ['-o', '-q', archive, '-d', dir]);
  } catch (error) {
    throw new Error('unzip is required to unpack ambientCG archives', { cause: error });
  }

  const packed = await packMaterial(dir);
  if (!packed) {
    console.warn(`${request.id.padEnd(24)} archive is missing an expected map`);
    return;
  }

  rmSync(archive, { force: true });
  console.log(
    `${request.id.padEnd(24)} packed -> ${request.target}/ ${(packed.size / 1024 / 1024).toFixed(1)} MB`,
  );
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });

  const lines: string[] = [
    '# Third-party assets',
    '',
    'Downloaded by `pnpm --filter @3dsfera/tools run fetch:assets`, not committed.',
    'Everything here is CC0 (public domain) or OFL: commercial use permitted, no',
    'engine restriction, nothing that has to be tracked per release.',
    '',
    '| Asset | Source | Licence | Used for |',
    '| --- | --- | --- | --- |',
  ];

  for (const request of MANIFEST) {
    // A packed material has no archive left, so presence is checked against
    // the maps themselves; otherwise every run would re-download 70 MB.
    const target =
      request.kind === 'material'
        ? path.join(OUT_DIR, request.target, 'basecolor.jpg')
        : path.join(OUT_DIR, request.target);
    const source =
      request.kind === 'font'
        ? `[Inter](${request.source})`
        : request.kind === 'material'
          ? `[ambientCG ${request.id}](https://ambientcg.com/view?id=${request.id})`
          : `[Poly Haven ${request.id}](https://polyhaven.com/a/${request.id})`;

    const licence = request.kind === 'font' ? request.licence : 'CC0';
    lines.push(`| \`${request.target}\` | ${source} | ${licence} | ${request.note} |`);

    const label = request.kind === 'font' ? 'inter' : request.id;

    if (existsSync(target)) {
      console.log(`${label.padEnd(24)} already present`);
      if (request.kind === 'material') await prepareMaterial(request);
      continue;
    }

    try {
      const bytes =
        request.kind === 'hdri'
          ? await fetchHdri(request)
          : request.kind === 'model'
            ? await fetchModel(request)
            : request.kind === 'font'
              ? await download(request.url, path.join(OUT_DIR, request.target))
              : await fetchMaterial(request);

      console.log(
        `${label.padEnd(24)} ${(bytes / 1024 / 1024).toFixed(1)} MB  -> ${request.target}`,
      );

      if (request.kind === 'material') await prepareMaterial(request);
    } catch (error) {
      // One unreachable asset must not stop the rest: the world falls back to
      // the generated materials for anything missing.
      console.warn(`${label.padEnd(24)} FAILED  ${String(error)}`);
    }
  }

  // The location is fetched by its own tool, but its licence belongs in the
  // same file: CC BY 4.0 requires the credit to travel with the work, and a
  // reader looking for "what is in this build and who made it" looks here.
  lines.push(
    '',
    '## Location',
    '',
    '**Amazon Lumberyard Bistro** — Amazon Lumberyard, via the NVIDIA Open Research',
    'Content Archive. Licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).',
    '',
    'Source: <https://developer.nvidia.com/orca/amazon-lumberyard-bistro>',
    '',
    'Built for the web by `pnpm --filter @3dsfera/tools run build:location`: four levels',
    'of detail, mipped and re-encoded textures at two budgets, and a walkability map',
    'derived from the geometry. The geometry itself is unmodified in shape.',
  );

  writeFileSync(path.join(OUT_DIR, 'LICENSES.md'), `${lines.join('\n')}\n`);
  console.log(`\nmanifest written to ${path.join(OUT_DIR, 'LICENSES.md')}`);
}

await main();
