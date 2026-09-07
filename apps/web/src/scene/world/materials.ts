import { useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { LinearSRGBColorSpace, RepeatWrapping, SRGBColorSpace, type Texture } from 'three';

/**
 * Scanned PBR materials for the architecture.
 *
 * A CC0 photogrammetry scan from ambientCG, fetched by
 * apps/tools/src/fetch-assets.ts and served from our own origin. A procedural
 * noise texture can pass for a small plastic part; it cannot pass for polished
 * marble at arm's length, which is where a product plinth is.
 */
/**
 * Only the plinth is left.
 *
 * The street used to be built here out of primitives clad in scanned
 * materials — concrete, plaster, brick, paving. It is a real location now, and
 * it brings its own surfaces; the only thing this application still puts on
 * the pavement is the marble a product stands on.
 */
export const WORLD_MATERIALS = {
  plinth: 'plinth-marble',
} as const;

export type WorldMaterialName = keyof typeof WORLD_MATERIALS;

export interface MaterialMaps {
  map: Texture;
  normalMap: Texture;
  /** Occlusion in R, roughness in G, metalness in B. */
  ormMap: Texture;
}

function pathsFor(name: WorldMaterialName): [string, string, string] {
  const dir = `/world/materials/${WORLD_MATERIALS[name]}`;
  return [`${dir}/basecolor.jpg`, `${dir}/normal.jpg`, `${dir}/orm.jpg`];
}

/**
 * Loads one material and tiles it.
 *
 * The textures come back shared from the loader cache, so they are cloned
 * before `repeat` is touched — writing to the cached instance would retile
 * every surface in the scene that uses the same material.
 */
export function useWorldMaterial(
  name: WorldMaterialName,
  repeat: [number, number],
  anisotropy = 8,
): MaterialMaps {
  const loaded = useTexture(pathsFor(name));
  const renderer = useThree((state) => state.gl);

  // `useTexture` returns one texture per path in order. Naming them here keeps
  // the rest of the function honest about which map is which.
  const [baseColor, normal, orm] = loaded;
  if (!baseColor || !normal || !orm) {
    throw new Error(`Material "${name}" is missing one of its three maps`);
  }

  return useMemo(() => {
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    const applied = Math.min(anisotropy, maxAnisotropy);

    const prepare = (texture: Texture, srgb: boolean): Texture => {
      const clone = texture.clone();
      clone.wrapS = RepeatWrapping;
      clone.wrapT = RepeatWrapping;
      clone.repeat.set(repeat[0], repeat[1]);
      clone.anisotropy = applied;
      // Base colour is a photograph; normal and ORM are numbers that must not
      // be gamma-decoded on the way in.
      clone.colorSpace = srgb ? SRGBColorSpace : LinearSRGBColorSpace;
      clone.needsUpdate = true;
      return clone;
    };

    return {
      map: prepare(baseColor, true),
      normalMap: prepare(normal, false),
      ormMap: prepare(orm, false),
    };
  }, [baseColor, normal, orm, repeat, anisotropy, renderer]);
}

/** Preloads every architectural material before the world fades in. */
export function preloadWorldMaterials(): void {
  for (const name of Object.keys(WORLD_MATERIALS) as WorldMaterialName[]) {
    useTexture.preload(pathsFor(name));
  }
}
