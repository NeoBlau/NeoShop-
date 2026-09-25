/**
 * Reading a Wavefront OBJ into a glTF document.
 *
 * Here because a supplier sent one and the alternative was telling them it
 * could not be used. `obj2gltf` would do it and would bring a dependency, a
 * CLI and its own opinions about materials; an OBJ is four line types and a
 * face list, and the whole reason to read it by hand is to keep the groups —
 * which is what makes an animation possible. A single merged mesh has no dish
 * to tilt.
 *
 * Deliberately narrow. Triangles and quads, one material for the file, and the
 * texture set named by convention in a folder beside it. It is not a general
 * OBJ importer and should not grow into one: anything more complicated than
 * this arrives as glTF.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { Document, type Material, type Node as GltfNode } from '@gltf-transform/core';

/** Textures are authored at 4K and nothing on a plinth needs that. */
const TEXTURE_SIZE = 2048;

interface Face {
  /** Indices into the file's shared vertex, uv and normal lists. Zero-based. */
  corners: { v: number; t: number; n: number }[];
}

interface Group {
  name: string;
  faces: Face[];
}

/** OBJ indices are one-based and may be negative, counting back from the end. */
function resolve(raw: string, length: number): number {
  const value = Number.parseInt(raw, 10);
  if (Number.isNaN(value)) return -1;
  return value > 0 ? value - 1 : length + value;
}

function parse(text: string): {
  positions: number[][];
  uvs: number[][];
  normals: number[][];
  groups: Group[];
} {
  const positions: number[][] = [];
  const uvs: number[][] = [];
  const normals: number[][] = [];
  const groups: Group[] = [];

  // Faces before any `g` belong to an unnamed group rather than to nothing.
  let current: Group = { name: 'mesh', faces: [] };
  groups.push(current);

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;

    const space = line.indexOf(' ');
    if (space < 0) continue;
    const keyword = line.slice(0, space);
    const rest = line.slice(space + 1).trim();

    switch (keyword) {
      case 'v': {
        const parts = rest.split(/\s+/).map(Number);
        positions.push([parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0]);
        break;
      }
      case 'vt': {
        const parts = rest.split(/\s+/).map(Number);
        // OBJ counts V up from the bottom, glTF down from the top.
        uvs.push([parts[0] ?? 0, 1 - (parts[1] ?? 0)]);
        break;
      }
      case 'vn': {
        const parts = rest.split(/\s+/).map(Number);
        normals.push([parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0]);
        break;
      }
      case 'g':
      case 'o': {
        // An empty group is not worth a node; a repeated name is not worth two.
        const existing = groups.find((group) => group.name === rest);
        if (existing) {
          current = existing;
        } else {
          current = { name: rest || `mesh-${groups.length}`, faces: [] };
          groups.push(current);
        }
        break;
      }
      case 'f': {
        const corners = rest.split(/\s+/).map((token) => {
          const [v = '', t = '', n = ''] = token.split('/');
          return {
            v: resolve(v, positions.length),
            t: t === '' ? -1 : resolve(t, uvs.length),
            n: n === '' ? -1 : resolve(n, normals.length),
          };
        });
        if (corners.length >= 3) current.faces.push({ corners });
        break;
      }
      default:
        break;
    }
  }

  return { positions, uvs, normals, groups: groups.filter((group) => group.faces.length > 0) };
}

/**
 * The material, from the four maps a PBR export ships.
 *
 * glTF wants occlusion, roughness and metalness in one image's red, green and
 * blue. An exporter hands over separate greyscale files, so they are packed
 * here — and metalness is a flat zero because there is no map for it and a
 * missing channel defaults to one, which renders plastic as chrome.
 */
async function buildMaterial(
  document: Document,
  textures: string,
  name: string,
): Promise<Material> {
  const material = document.createMaterial(name).setRoughnessFactor(1).setMetallicFactor(1);

  const load = async (file: string): Promise<Buffer | null> => {
    const full = path.join(textures, file);
    if (!existsSync(full)) return null;
    return sharp(readFileSync(full))
      .resize(TEXTURE_SIZE, TEXTURE_SIZE, { fit: 'inside' })
      .png()
      .toBuffer();
  };

  const attach = async (
    file: string,
    apply: (texture: ReturnType<Document['createTexture']>) => void,
  ): Promise<void> => {
    const bytes = await load(file);
    if (!bytes) return;

    const webp = await sharp(bytes).webp({ quality: 88 }).toBuffer();
    apply(
      document
        .createTexture(`${name}-${path.parse(file).name}`)
        .setMimeType('image/webp')
        .setImage(new Uint8Array(webp)),
    );
  };

  await attach('basecolor.png', (texture) => material.setBaseColorTexture(texture));
  await attach('normal.png', (texture) => material.setNormalTexture(texture));

  const ao = await load('ao.png');
  const roughness = await load('roughness.png');

  if (ao || roughness) {
    const planeBytes = TEXTURE_SIZE * TEXTURE_SIZE;

    /** One channel at the working size, or a flat plane where the map is absent. */
    const plane = async (source: Buffer | null, flat: number): Promise<Buffer> =>
      source
        ? sharp(source)
            .resize(TEXTURE_SIZE, TEXTURE_SIZE, { fit: 'fill' })
            .removeAlpha()
            .greyscale()
            .raw()
            .toBuffer()
        : Buffer.alloc(planeBytes, flat);

    const occlusion = await plane(ao, 255);
    const rough = await plane(roughness, 255);

    // Interleaved by hand: sharp has no "these three planes are my channels"
    // call, and stacking them into one tall image to cut apart again costs two
    // more encodes than the loop does.
    const rgb = Buffer.alloc(planeBytes * 3);
    for (let index = 0; index < planeBytes; index += 1) {
      rgb[index * 3] = occlusion[index] ?? 255;
      rgb[index * 3 + 1] = rough[index] ?? 255;
      rgb[index * 3 + 2] = 0;
    }

    const orm = await sharp(rgb, {
      raw: { width: TEXTURE_SIZE, height: TEXTURE_SIZE, channels: 3 },
    })
      .webp({ quality: 88 })
      .toBuffer();

    const texture = document
      .createTexture(`${name}-orm`)
      .setMimeType('image/webp')
      .setImage(new Uint8Array(orm));

    material.setOcclusionTexture(texture);
    material.setMetallicRoughnessTexture(texture);
  }

  return material;
}

/**
 * Reads `<dir>/<name>.obj` and its `textures/` folder into a new document.
 *
 * One node per OBJ group, named after it, so a clip can name the part it
 * drives. Vertices are de-duplicated per group on the position/uv/normal
 * triple, which is what OBJ's three parallel index lists actually mean.
 *
 * Each group's node is put at the middle of that group's own footprint, at its
 * base, and its vertices moved to match. An OBJ has no hierarchy and no
 * transforms — every coordinate is absolute — so a node built the literal way
 * sits at the file's origin, and rotating it swings the part around a point
 * somewhere near the floor instead of turning it where it stands. The base of
 * the footprint is also, for a dish on a mount or a lid on a box, roughly
 * where the hinge is.
 */
export async function readObj(file: string): Promise<Document> {
  const source = parse(readFileSync(file, 'utf8'));
  const document = new Document();
  const buffer = document.createBuffer();
  const scene = document.createScene(path.parse(file).name);

  const textures = path.join(path.dirname(file), 'textures');
  const material = await buildMaterial(document, textures, path.parse(file).name);

  for (const group of source.groups) {
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const seen = new Map<string, number>();

    const vertex = (corner: { v: number; t: number; n: number }): number => {
      const key = `${corner.v}/${corner.t}/${corner.n}`;
      const already = seen.get(key);
      if (already !== undefined) return already;

      const at = positions.length / 3;
      const position = source.positions[corner.v] ?? [0, 0, 0];
      positions.push(position[0] ?? 0, position[1] ?? 0, position[2] ?? 0);

      const normal = source.normals[corner.n] ?? [0, 1, 0];
      normals.push(normal[0] ?? 0, normal[1] ?? 1, normal[2] ?? 0);

      const uv = source.uvs[corner.t] ?? [0, 0];
      uvs.push(uv[0] ?? 0, uv[1] ?? 0);

      seen.set(key, at);
      return at;
    };

    for (const face of group.faces) {
      // Fan triangulation. Correct for the convex quads an exporter emits, and
      // the only case this reader claims to handle.
      const corners = face.corners.map(vertex);
      const first = corners[0];
      if (first === undefined) continue;

      for (let at = 1; at + 1 < corners.length; at += 1) {
        const second = corners[at];
        const third = corners[at + 1];
        if (second === undefined || third === undefined) continue;
        indices.push(first, second, third);
      }
    }

    if (indices.length === 0) continue;

    const lo = [Infinity, Infinity, Infinity];
    const hi = [-Infinity, -Infinity, -Infinity];
    for (let at = 0; at < positions.length; at += 3) {
      for (let axis = 0; axis < 3; axis += 1) {
        const value = positions[at + axis] ?? 0;
        lo[axis] = Math.min(lo[axis] ?? Infinity, value);
        hi[axis] = Math.max(hi[axis] ?? -Infinity, value);
      }
    }

    const pivot: [number, number, number] = [
      ((lo[0] ?? 0) + (hi[0] ?? 0)) / 2,
      lo[1] ?? 0,
      ((lo[2] ?? 0) + (hi[2] ?? 0)) / 2,
    ];

    for (let at = 0; at < positions.length; at += 3) {
      for (let axis = 0; axis < 3; axis += 1) {
        positions[at + axis] = (positions[at + axis] ?? 0) - (pivot[axis] ?? 0);
      }
    }

    const primitive = document
      .createPrimitive()
      .setAttribute(
        'POSITION',
        document
          .createAccessor(`${group.name}-position`)
          .setType('VEC3')
          .setArray(new Float32Array(positions))
          .setBuffer(buffer),
      )
      .setAttribute(
        'NORMAL',
        document
          .createAccessor(`${group.name}-normal`)
          .setType('VEC3')
          .setArray(new Float32Array(normals))
          .setBuffer(buffer),
      )
      .setAttribute(
        'TEXCOORD_0',
        document
          .createAccessor(`${group.name}-uv`)
          .setType('VEC2')
          .setArray(new Float32Array(uvs))
          .setBuffer(buffer),
      )
      .setIndices(
        document
          .createAccessor(`${group.name}-indices`)
          .setType('SCALAR')
          .setArray(new Uint32Array(indices))
          .setBuffer(buffer),
      )
      .setMaterial(material);

    const mesh = document.createMesh(group.name).addPrimitive(primitive);
    const node: GltfNode = document.createNode(group.name).setMesh(mesh).setTranslation(pivot);
    scene.addChild(node);
  }

  return document;
}
