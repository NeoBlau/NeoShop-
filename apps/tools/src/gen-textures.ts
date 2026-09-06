/**
 * Generates the 4K PBR material library used by the demo catalogue.
 *
 *   pnpm --filter @3dsfera/tools run gen:textures
 *
 * Everything is procedural and seeded: no stock photography, no licences to
 * track, and regenerating produces byte-identical output. Each material ships
 * three maps, which is what a physically based renderer actually needs:
 *
 *   basecolor.jpg  albedo, sRGB
 *   normal.jpg     tangent-space normal, linear
 *   orm.jpg        occlusion in R, roughness in G, metalness in B — the glTF
 *                  packing, so one texture fetch feeds three inputs
 *
 * Normal maps are JPEG rather than PNG. That was measured, not assumed: at
 * quality 96 with no chroma subsampling a 4K normal map goes from 22 MB to
 * 6 MB with no difference visible at 1:1, and the difference decides whether a
 * textured model fits inside the 50 MB upload limit at all. Chroma subsampling
 * stays off everywhere — the three channels of a normal map are geometry, not
 * colour, and averaging them is exactly the wrong thing to do.
 */
import { mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { Noise, heightToNormal, heightToOcclusion } from './noise.js';

const SIZE = Number.parseInt(process.env['TEXTURE_SIZE'] ?? '4096', 10);
const OUT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../api/prisma/seed-assets/textures',
);

type Rgb = [number, number, number];

interface Surface {
  /** Height in [0,1]; drives the normal map and the occlusion map. */
  height: Float32Array;
  /** Linear albedo per pixel. */
  albedo: Float32Array;
  /** Roughness in [0,1]. */
  roughness: Float32Array;
  metalness: number;
  normalStrength: number;
  occlusionRadius: number;
  occlusionStrength: number;
}

interface MaterialDefinition {
  name: string;
  build: (noise: Noise, size: number) => Surface;
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function allocate(size: number): {
  height: Float32Array;
  albedo: Float32Array;
  roughness: Float32Array;
} {
  return {
    height: new Float32Array(size * size),
    albedo: new Float32Array(size * size * 3),
    roughness: new Float32Array(size * size),
  };
}

/**
 * Brushed aluminium. The grain runs horizontally: fine variation across it,
 * almost none along it. That anisotropy is what separates brushed metal from
 * sandpaper, and it has to live in both the height field and the roughness.
 */
function brushedAluminium(noise: Noise, size: number): Surface {
  const { height, albedo, roughness } = allocate(size);
  const light: Rgb = [0.84, 0.85, 0.87];
  const dark: Rgb = [0.66, 0.67, 0.7];

  for (let y = 0; y < size; y += 1) {
    const v = y / size;
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const index = y * size + x;

      // 900 cycles across the grain, 6 along it.
      const streak = noise.fbm(u * 6, v * 900, 900, 2);
      const scratches = noise.ridged(u * 24, v * 300, 300, 2);
      const macro = noise.fbm(u * 5, v * 5, 5, 3);

      height[index] = streak * 0.62 + scratches * 0.2 + macro * 0.18;

      const tint = mix(dark, light, 0.3 + streak * 0.55 + macro * 0.15);
      albedo[index * 3] = tint[0];
      albedo[index * 3 + 1] = tint[1];
      albedo[index * 3 + 2] = tint[2];

      roughness[index] = 0.16 + streak * 0.2 + scratches * 0.06 + macro * 0.05;
    }
  }

  return {
    height,
    albedo,
    roughness,
    metalness: 1,
    // Shallow: brushing leaves microns of relief, not millimetres.
    normalStrength: 0.55,
    occlusionRadius: 2,
    occlusionStrength: 0.7,
  };
}

/** Matte injection-moulded plastic: fine grain, no metalness. */
function mattePlastic(noise: Noise, size: number): Surface {
  const { height, albedo, roughness } = allocate(size);
  const base: Rgb = [0.075, 0.079, 0.088];
  const highlight: Rgb = [0.12, 0.125, 0.135];

  for (let y = 0; y < size; y += 1) {
    const v = y / size;
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const index = y * size + x;
      const grain = noise.fbm(u * 260, v * 260, 260, 3);
      const macro = noise.fbm(u * 7, v * 7, 7, 3);

      height[index] = grain * 0.8 + macro * 0.2;

      const tint = mix(base, highlight, grain * 0.6 + macro * 0.4);
      albedo[index * 3] = tint[0];
      albedo[index * 3 + 1] = tint[1];
      albedo[index * 3 + 2] = tint[2];

      roughness[index] = 0.58 + grain * 0.16 + macro * 0.08;
    }
  }

  return {
    height,
    albedo,
    roughness,
    metalness: 0,
    normalStrength: 0.7,
    occlusionRadius: 2,
    occlusionStrength: 0.8,
  };
}

/** Powder-coated steel: orange peel over metal, the finish on appliances. */
function powderCoated(noise: Noise, size: number): Surface {
  const { height, albedo, roughness } = allocate(size);
  const base: Rgb = [0.16, 0.17, 0.185];
  const peak: Rgb = [0.24, 0.25, 0.27];

  for (let y = 0; y < size; y += 1) {
    const v = y / size;
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const index = y * size + x;
      const peel = noise.fbm(u * 90, v * 90, 90, 3, 0.6);
      const speckle = noise.value(u * 420, v * 420, 420);
      const macro = noise.fbm(u * 6, v * 6, 6, 2);

      height[index] = peel * 0.75 + speckle * 0.15 + macro * 0.1;

      const tint = mix(base, peak, peel * 0.7 + macro * 0.3);
      albedo[index * 3] = tint[0];
      albedo[index * 3 + 1] = tint[1];
      albedo[index * 3 + 2] = tint[2];

      roughness[index] = 0.34 + peel * 0.2 + speckle * 0.05;
    }
  }

  return {
    height,
    albedo,
    roughness,
    metalness: 0.85,
    normalStrength: 1.0,
    occlusionRadius: 3,
    occlusionStrength: 0.9,
  };
}

/** Woven upholstery: a real over-under weave, not noise pretending to be one. */
function fabricWeave(noise: Noise, size: number): Surface {
  const { height, albedo, roughness } = allocate(size);
  const warp: Rgb = [0.3, 0.19, 0.145];
  const weft: Rgb = [0.245, 0.15, 0.115];
  // 64 threads across the map, whatever the resolution.
  const threads = 64;

  for (let y = 0; y < size; y += 1) {
    const v = y / size;
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const index = y * size + x;

      // Two out-of-phase sine ridges give the over-under of a plain weave.
      const threadU = (u * threads) % 1;
      const threadV = (v * threads) % 1;
      const warpRidge = Math.sin(threadU * Math.PI);
      const weftRidge = Math.sin(threadV * Math.PI);
      const overUnder =
        (Math.floor(u * threads) + Math.floor(v * threads)) % 2 === 0 ? warpRidge : weftRidge;

      const fuzz = noise.fbm(u * 380, v * 380, 380, 3);
      const macro = noise.fbm(u * 6, v * 6, 6, 3);

      height[index] = overUnder * 0.7 + fuzz * 0.2 + macro * 0.1;

      const tint = mix(weft, warp, overUnder * 0.6 + fuzz * 0.25 + macro * 0.15);
      albedo[index * 3] = tint[0];
      albedo[index * 3 + 1] = tint[1];
      albedo[index * 3 + 2] = tint[2];

      roughness[index] = 0.78 + fuzz * 0.14;
    }
  }

  return {
    height,
    albedo,
    roughness,
    metalness: 0,
    // Weave relief is real depth, so this one stays pronounced.
    normalStrength: 1.6,
    occlusionRadius: 5,
    occlusionStrength: 1.4,
  };
}

/** Moulded rubber: matte, deep grain, the material of wheels and feet. */
function rubber(noise: Noise, size: number): Surface {
  const { height, albedo, roughness } = allocate(size);
  const base: Rgb = [0.035, 0.036, 0.04];
  const worn: Rgb = [0.06, 0.062, 0.068];

  for (let y = 0; y < size; y += 1) {
    const v = y / size;
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const index = y * size + x;
      const grain = noise.ridged(u * 200, v * 200, 200, 3);
      const macro = noise.fbm(u * 9, v * 9, 9, 3);

      height[index] = grain * 0.7 + macro * 0.3;

      const tint = mix(base, worn, grain * 0.5 + macro * 0.5);
      albedo[index * 3] = tint[0];
      albedo[index * 3 + 1] = tint[1];
      albedo[index * 3 + 2] = tint[2];

      roughness[index] = 0.86 + grain * 0.1;
    }
  }

  return {
    height,
    albedo,
    roughness,
    metalness: 0,
    normalStrength: 1.1,
    occlusionRadius: 3,
    occlusionStrength: 1.1,
  };
}

const MATERIALS: MaterialDefinition[] = [
  { name: 'brushed-aluminium', build: brushedAluminium },
  { name: 'matte-plastic', build: mattePlastic },
  { name: 'powder-coated', build: powderCoated },
  { name: 'fabric-weave', build: fabricWeave },
  { name: 'rubber', build: rubber },
];

/** Linear value to an 8-bit sRGB byte. */
function toSrgbByte(linear: number): number {
  const clamped = Math.max(0, Math.min(1, linear));
  const encoded =
    clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
  return Math.round(encoded * 255);
}

async function writeMaterial(definition: MaterialDefinition, seed: number): Promise<void> {
  const started = Date.now();
  const noise = new Noise(seed);
  const surface = definition.build(noise, SIZE);
  const pixels = SIZE * SIZE;

  const baseColor = Buffer.allocUnsafe(pixels * 3);
  for (let i = 0; i < pixels; i += 1) {
    baseColor[i * 3] = toSrgbByte(surface.albedo[i * 3] ?? 0);
    baseColor[i * 3 + 1] = toSrgbByte(surface.albedo[i * 3 + 1] ?? 0);
    baseColor[i * 3 + 2] = toSrgbByte(surface.albedo[i * 3 + 2] ?? 0);
  }

  // The radius is expressed against a 1K reference so that the same material
  // reads identically at 1K and at 4K.
  const occlusion = heightToOcclusion(
    surface.height,
    SIZE,
    Math.max(1, Math.round((surface.occlusionRadius * SIZE) / 1024)),
    surface.occlusionStrength,
  );

  // ORM is data, not colour: it stays linear, no sRGB encoding.
  const orm = Buffer.allocUnsafe(pixels * 3);
  const metalByte = Math.round(surface.metalness * 255);
  for (let i = 0; i < pixels; i += 1) {
    orm[i * 3] = Math.round(Math.max(0, Math.min(1, occlusion[i] ?? 1)) * 255);
    orm[i * 3 + 1] = Math.round(Math.max(0, Math.min(1, surface.roughness[i] ?? 0.5)) * 255);
    orm[i * 3 + 2] = metalByte;
  }

  // Sobel gradients grow with resolution: without this, the same material
  // would look four times bumpier at 4K than at 1K.
  const normal = heightToNormal(surface.height, SIZE, (surface.normalStrength * 1024) / SIZE);

  const dir = path.join(OUT_DIR, definition.name);
  mkdirSync(dir, { recursive: true });

  const raw = { width: SIZE, height: SIZE, channels: 3 as const };

  await sharp(baseColor, { raw })
    .jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
    .toFile(path.join(dir, 'basecolor.jpg'));

  await sharp(orm, { raw })
    .jpeg({ quality: 95, chromaSubsampling: '4:4:4' })
    .toFile(path.join(dir, 'orm.jpg'));

  await sharp(Buffer.from(normal), { raw })
    .jpeg({ quality: 96, chromaSubsampling: '4:4:4' })
    .toFile(path.join(dir, 'normal.jpg'));

  const sizes = ['basecolor.jpg', 'orm.jpg', 'normal.jpg'].map((file) => {
    const stats = statSync(path.join(dir, file));
    return `${file} ${(stats.size / 1024 / 1024).toFixed(1)}MB`;
  });

  console.log(
    `${definition.name.padEnd(20)} ${SIZE}×${SIZE}  ${sizes.join('  ')}  ` +
      `${((Date.now() - started) / 1000).toFixed(1)}s`,
  );
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });
  console.log(`generating ${MATERIALS.length} materials at ${SIZE}×${SIZE}\n`);

  for (const [index, definition] of MATERIALS.entries()) {
    await writeMaterial(definition, 1000 + index * 137);
  }

  console.log(`\nwritten to ${OUT_DIR}`);
}

await main();
