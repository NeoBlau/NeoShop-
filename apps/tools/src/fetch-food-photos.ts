/**
 * Photography for the fast-food counter.
 *
 *   pnpm --filter @3dsfera/tools run fetch:food
 *
 * Openverse indexes openly licensed images across a dozen providers and needs
 * no key, which is what makes it usable from a build script. Only CC0 and CC-BY
 * are requested, and the author and licence of every photo that lands are
 * written to credits.json — the interface renders them, the same way the
 * street credits the people who built it.
 *
 * What is deliberately *not* done here: taking a real chain's product
 * photography. The menu is the project's own, so its pictures are too.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { ITEMS } from '@3dsfera/shared';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web/public/food');
const SIZE = 640;
const ENDPOINT = 'https://api.openverse.org/v1/images/';
/** Openverse throttles anonymous callers; a pause is cheaper than a ban. */
const PAUSE_MS = 700;

interface OpenverseResult {
  id: string;
  title?: string;
  url?: string;
  creator?: string;
  creator_url?: string;
  license?: string;
  license_version?: string;
  license_url?: string;
  foreign_landing_url?: string;
  provider?: string;
}

interface Credit {
  item: string;
  title: string;
  creator: string;
  creatorUrl: string;
  licence: string;
  licenceUrl: string;
  source: string;
  provider: string;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function search(query: string): Promise<OpenverseResult[]> {
  const url = new URL(ENDPOINT);
  url.searchParams.set('q', query);
  // CC0 first: nothing to track. CC-BY is accepted because the food categories
  // are thin on CC0, and the credit is rendered either way.
  url.searchParams.set('license', 'cc0,by');
  url.searchParams.set('page_size', '8');
  url.searchParams.set('mature', 'false');

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const response = await fetch(url, { headers: { accept: 'application/json' } });

    if (response.status === 429) {
      await sleep(PAUSE_MS * attempt * 4);
      continue;
    }

    if (!response.ok) {
      throw new Error(
        `Openverse answered ${response.status} ${response.statusText} for "${query}"`,
      );
    }

    const body = (await response.json()) as { results?: OpenverseResult[] };
    return body.results ?? [];
  }

  throw new Error(`Openverse kept throttling the search for "${query}"`);
}

/**
 * Downloads and squares one photo.
 *
 * A menu card is a square tile, and a photo cropped to the middle of its
 * subject beats one letterboxed into grey bars. `cover` does that; `webp` at
 * 82 keeps a 640px tile around forty kilobytes.
 */
async function store(url: string, file: string): Promise<number> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);

  const bytes = new Uint8Array(await response.arrayBuffer());
  const output = await sharp(bytes)
    .rotate()
    .resize(SIZE, SIZE, { fit: 'cover', position: 'centre' })
    .webp({ quality: 82 })
    .toBuffer();

  writeFileSync(file, output);
  return output.byteLength;
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });

  const creditsFile = path.join(OUT, 'credits.json');
  const credits: Credit[] = existsSync(creditsFile)
    ? (JSON.parse(readFileSync(creditsFile, 'utf8')) as Credit[])
    : [];
  const known = new Set(credits.map((credit) => credit.item));

  let fetched = 0;
  let skipped = 0;

  for (const item of ITEMS) {
    const file = path.join(OUT, `${item.id}.webp`);
    if (existsSync(file) && known.has(item.id)) {
      skipped += 1;
      continue;
    }

    try {
      const results = await search(item.photoQuery);
      let stored = false;

      for (const result of results) {
        if (!result.url) continue;

        try {
          const size = await store(result.url, file);
          credits.push({
            item: item.id,
            title: result.title ?? item.photoQuery,
            creator: result.creator ?? 'unknown',
            creatorUrl: result.creator_url ?? '',
            licence: `${result.license ?? '?'} ${result.license_version ?? ''}`.trim(),
            licenceUrl: result.license_url ?? '',
            source: result.foreign_landing_url ?? result.url,
            provider: result.provider ?? '?',
          });
          console.log(
            `  ${item.id.padEnd(18)} ${(size / 1024).toFixed(0).padStart(4)} KB  ` +
              `${result.license ?? '?'}  ${result.creator ?? 'unknown'}`,
          );
          fetched += 1;
          stored = true;
          break;
        } catch {
          // A dead link or an image sharp cannot read: try the next result
          // rather than losing the whole tile.
          continue;
        }
      }

      if (!stored) console.warn(`  ! ${item.id}: nothing usable for "${item.photoQuery}"`);
    } catch (error) {
      console.warn(`  ! ${item.id}: ${error instanceof Error ? error.message : String(error)}`);
    }

    await sleep(PAUSE_MS);
  }

  writeFileSync(creditsFile, `${JSON.stringify(credits, null, 2)}\n`);
  console.log(`\n${fetched} fetched, ${skipped} already there, credits in ${creditsFile}`);
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  await main();
}
