/**
 * Props: things that stand on the street but are not for sale.
 *
 *   pnpm --filter @3dsfera/tools run build:props
 *
 * The food counter is the first of them. It goes through the same normalising
 * as a zone — floor to zero, footprint centred, textures capped, geometry
 * compressed — because a model from an asset library never arrives ready, and
 * then it is placed by the scene rather than by a coordinate written here: the
 * street decides where its own dead end is.
 */
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import draco3d from 'draco3dgltf';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { Logger, NodeIO, type Transform } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRDracoMeshCompression } from '@gltf-transform/extensions';
import { dedup, prune, simplify, textureCompress, weld } from '@gltf-transform/functions';
import { findFloorLevel, sceneBounds, triangleCount } from './gltf-space.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SOURCES = path.resolve(HERE, '../../../assets/incoming');
const OUT = path.resolve(HERE, '../../web/public/world/props');

const TRIANGLE_BUDGET = 120_000;
const TEXTURE_MAX = 2048;

interface PropRecipe {
  id: string;
  source: string;
  /** Metres across the widest horizontal axis. Null keeps the model's own size. */
  width: number | null;
  /**
   * Metres tall, when height is the measurement that matters.
   *
   * A kiosk is defined by how wide it is; a person is defined by how tall.
   * Scaling a character by her horizontal span is how you get a shop
   * assistant a metre high — the span of a standing figure is her shoulders,
   * which is not a number anybody has an intuition about. Takes precedence
   * over `width`.
   */
  height?: number;
  credit: { title: string; author: string; licence: string; url: string };
}

const PROPS: PropRecipe[] = [
  // The people on the frontages. Two of them, so a street of six shops is not
  // six copies of the same person; which one stands where is decided from the
  // pavilion's own id, the same way her name is.
  //
  // Neither is animated — the clip one of them carries is a third of a second
  // long — so they stand. A standing person is still a person; the alternative
  // on the frontage was a post with a label on it.
  {
    id: 'vendor-1',
    source: 'npc-b.glb',
    width: null,
    height: 1.66,
    credit: {
      title: 'Shop assistant',
      author: 'NEO_ASSETS',
      licence: 'CC BY 4.0',
      url: 'https://creativecommons.org/licenses/by/4.0/',
    },
  },
  {
    id: 'vendor-2',
    source: 'npc-a.glb',
    width: null,
    height: 1.7,
    credit: {
      title: 'Shop assistant',
      author: 'NEO_ASSETS',
      licence: 'CC BY 4.0',
      url: 'https://creativecommons.org/licenses/by/4.0/',
    },
  },
  {
    id: 'food-stand',
    source: 'mcdonalds-stand.glb',
    // A street food kiosk is about five metres across. The source measures
    // whatever its author felt like, so this is the one number that matters.
    width: 5.2,
    credit: {
      title: 'Street food stand',
      author: 'NEO_ASSETS',
      licence: 'CC BY 4.0',
      url: 'https://creativecommons.org/licenses/by/4.0/',
    },
  },
];

async function buildProp(recipe: PropRecipe): Promise<string | null> {
  const source = path.join(SOURCES, recipe.source);
  if (!existsSync(source)) {
    console.log(`skipped ${recipe.id}: ${recipe.source} is not in assets/incoming`);
    return null;
  }

  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule(),
  });

  console.log(`\n${recipe.id}  ←  ${recipe.source}`);
  const document = await io.read(source);
  document.setLogger(new Logger(Logger.Verbosity.ERROR));

  const scene = document.getRoot().listScenes()[0];
  if (!scene) throw new Error(`${recipe.source} has no scene`);

  const root = document.createNode(`prop-${recipe.id}`);
  for (const child of scene.listChildren()) {
    scene.removeChild(child);
    root.addChild(child);
  }
  scene.addChild(root);

  const raw = sceneBounds(document);
  const floor = findFloorLevel(document);
  const span = Math.max(raw.hi[0] - raw.lo[0], raw.hi[2] - raw.lo[2]);
  const tall = raw.hi[1] - raw.lo[1];

  const scale =
    recipe.height !== undefined && tall > 0
      ? recipe.height / tall
      : recipe.width === null || span === 0
        ? 1
        : recipe.width / span;

  root.setScale([scale, scale, scale]);
  root.setTranslation([
    -((raw.lo[0] + raw.hi[0]) / 2) * scale,
    // A figure stands on her lowest point. The area-weighted floor detection
    // is for rooms and kiosks; on a person the biggest flat up-facing surface
    // is the top of a shoe, and seating her by it sinks her to the ankles.
    -(recipe.height !== undefined ? raw.lo[1] : floor) * scale,
    -((raw.lo[2] + raw.hi[2]) / 2) * scale,
  ]);

  const before = triangleCount(document);
  const transforms: Transform[] = [dedup(), prune(), weld()];

  if (before > TRIANGLE_BUDGET) {
    transforms.push(
      simplify({ simplifier: MeshoptSimplifier, ratio: TRIANGLE_BUDGET / before, error: 0.005 }),
    );
  }

  transforms.push(
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [TEXTURE_MAX, TEXTURE_MAX] }),
  );

  await document.transform(...transforms);
  document.createExtension(KHRDracoMeshCompression).setRequired(true).setEncoderOptions({
    method: KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER,
  });

  mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, `${recipe.id}.glb`);
  writeFileSync(file, await io.writeBinary(document));

  const after = sceneBounds(document);
  console.log(
    `  ${before.toLocaleString('en')} → ${triangleCount(document).toLocaleString('en')} tris, ` +
      `${[0, 1, 2].map((a) => ((after.hi[a] ?? 0) - (after.lo[a] ?? 0)).toFixed(1)).join(' x ')} m, ` +
      `${(statSync(file).size / 1e6).toFixed(1)} MB`,
  );

  return recipe.id;
}

async function main(): Promise<void> {
  const built: Record<string, PropRecipe['credit'] & { model: string; width: number | null }> = {};

  for (const recipe of PROPS) {
    const id = await buildProp(recipe);
    if (id) built[id] = { ...recipe.credit, model: `${id}.glb`, width: recipe.width };
  }

  if (Object.keys(built).length === 0) {
    console.log('\nno props built');
    return;
  }

  mkdirSync(OUT, { recursive: true });
  writeFileSync(path.join(OUT, 'props.json'), `${JSON.stringify(built, null, 2)}\n`);
  console.log(`\nprops: ${Object.keys(built).join(', ')}`);
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  await main();
}
