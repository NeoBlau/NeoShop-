/**
 * What this checkout has, what it is missing, and the command that fixes it.
 *
 *   pnpm --filter @3dsfera/tools run doctor
 *
 * Every asset in this project is optional by design: a missing demo room, a
 * missing kiosk or a missing photograph must not stop the shop from selling,
 * so each one degrades quietly. That is right for the application and awful
 * for whoever is setting it up — five things fail to appear and none of them
 * says why. The street comes up empty and the reason is one warning that
 * scrolled past twenty minutes ago.
 *
 * So this is the one place that answers it. It reads the disk, says what is
 * there, and for anything missing gives the exact command and — where the
 * files are not ours to download — the exact filename that has to be put in
 * place by hand.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');

interface Check {
  /** What a person would call it. */
  name: string;
  /** One file whose presence means the whole thing is built. */
  marker: string;
  /** What is lost without it. Written as a consequence, not as a warning. */
  without: string;
  fix: string;
  /** Files that must be put in assets/incoming by hand first. */
  needs?: readonly string[];
  /** Counts something inside, when a number is more use than a tick. */
  count?: { dir: string; suffix: string; label: string };
}

const CHECKS: readonly Check[] = [
  {
    name: 'Typefaces',
    marker: 'apps/web/public/fonts/fonts.css',
    without: 'the interface renders in the system font',
    fix: 'make fonts',
  },
  {
    name: 'Street location',
    marker: 'apps/web/public/world/locations/street/location.json',
    without: 'no street to walk; the catalogue still works',
    fix: 'make location',
  },
  {
    name: 'Mountain grove',
    marker: 'apps/web/public/world/locations/grove/location.json',
    without: 'no choice of location at the door — only the street',
    fix: 'make nature',
  },
  {
    name: 'Street sound',
    marker: 'apps/web/public/world/audio/street.wav',
    without: 'the street is silent',
    fix: 'make ambience',
  },
  {
    name: 'Menu photography',
    marker: 'apps/web/public/food/credits.json',
    without: 'the fast-food menu shows names without pictures',
    fix: 'make food',
    count: { dir: 'apps/web/public/food', suffix: '.webp', label: 'photos' },
  },
  {
    name: 'Demo product models',
    marker: 'apps/api/prisma/seed-assets/robot-vacuum.glb',
    without: 'the seed cannot attach a model, and every pavilion comes up empty',
    fix: 'make assets',
    count: { dir: 'apps/api/prisma/seed-assets', suffix: '.glb', label: 'models' },
  },
  {
    name: 'Product photographs',
    marker: 'apps/api/prisma/seed-assets/previews/robot-vacuum.png',
    without: 'product cards fall back to a placeholder frame',
    fix: 'make previews',
    count: { dir: 'apps/api/prisma/seed-assets/previews', suffix: '.png', label: 'photos' },
  },
  {
    name: 'Fast-food kiosk',
    marker: 'apps/web/public/world/props/props.json',
    without: 'nothing stands at the end of the street; the menu tab still opens',
    fix: 'make props',
    needs: ['mcdonalds-stand.glb'],
  },
  {
    name: 'Demo rooms for missions',
    marker: 'apps/web/public/world/zones/zones.json',
    without: 'no room for a mission to run in, so no mission is offered on a product card',
    fix: 'make zones',
    needs: ['loft-city.glb', 'art-gallery.glb', 'billiards-room.glb', 'neon-bedroom.glb'],
  },
];

/** The third-party models that are not ours to redistribute. */
const INCOMING = path.join(ROOT, 'assets/incoming');

function countIn(check: Check): string {
  if (!check.count) return '';
  const dir = path.join(ROOT, check.count.dir);
  if (!existsSync(dir)) return '';

  const found = readdirSync(dir).filter((file) => file.endsWith(check.count?.suffix ?? '')).length;
  return `${found} ${check.count.label}`;
}

function listMissing(names: readonly string[]): string[] {
  return names.filter((name) => !existsSync(path.join(INCOMING, name)));
}

function zones(): string[] {
  const file = path.join(ROOT, 'apps/web/public/world/zones/zones.json');
  if (!existsSync(file)) return [];
  try {
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function locations(): string[] {
  const file = path.join(ROOT, 'apps/web/public/world/locations/locations.json');
  if (!existsSync(file)) return [];
  try {
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * A location and the weight of the level most machines are served.
 *
 * Read from the manifest rather than from a filename: the street ships .gltf
 * with a sidecar .bin and the grove ships .glb, and guessing which is which
 * is how a diagnostic ends up lying about what is on disk.
 */
function describeLocation(id: string): string {
  const file = path.join(ROOT, `apps/web/public/world/locations/${id}/location.json`);
  if (!existsSync(file)) return `${id} (manifest missing)`;

  try {
    const manifest = JSON.parse(readFileSync(file, 'utf8')) as {
      levels?: { level: number; bytes?: number }[];
    };
    const served = manifest.levels?.find((entry) => entry.level === 1) ?? manifest.levels?.[0];
    if (!served?.bytes) return id;
    return `${id} (${(served.bytes / 1e6).toFixed(0)} MB)`;
  } catch {
    return `${id} (manifest unreadable)`;
  }
}

function main(): void {
  console.log('\n3DSFERA — what this checkout has\n');

  const missing: Check[] = [];
  const handwork = new Set<string>();

  for (const check of CHECKS) {
    const marker = path.join(ROOT, check.marker);
    const there = existsSync(marker);
    const detail = there ? countIn(check) : '';

    console.log(`  ${there ? '✓' : '·'}  ${check.name.padEnd(24)} ${detail}`);

    if (!there) {
      missing.push(check);
      for (const name of listMissing(check.needs ?? [])) handwork.add(name);
    }
  }

  const built = locations();
  if (built.length > 0) {
    console.log(`\n  locations: ${built.map(describeLocation).join(', ')}`);
  }

  const rooms = zones();
  if (rooms.length > 0) console.log(`  rooms:     ${rooms.join(', ')}`);

  if (missing.length === 0) {
    console.log('\nEverything is in place. `make dev` will not rebuild any of it.\n');
    return;
  }

  console.log(`\n${missing.length} thing${missing.length === 1 ? '' : 's'} missing:\n`);
  for (const check of missing) {
    console.log(`  ${check.name}`);
    console.log(`    without it:  ${check.without}`);
    console.log(`    to build it: ${check.fix}`);

    const needed = listMissing(check.needs ?? []);
    if (needed.length > 0) {
      console.log(`    first put in assets/incoming/: ${needed.join(', ')}`);
    }
    console.log('');
  }

  if (handwork.size > 0) {
    console.log(
      'Those are third-party models we cannot redistribute, so nothing downloads\n' +
        'them for you. Drop them into assets/incoming/ under exactly those names\n' +
        'and `make dev` will build what they are for.\n',
    );
  }

  console.log('Or just run `make dev`: it builds everything above that it can.\n');
}

main();
