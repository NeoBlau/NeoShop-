import { useEffect } from 'react';
import { useLoader, useThree } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Mesh, MeshStandardMaterial } from 'three';
import { extendGltfLoader } from '../loaders.js';
import type { QualitySettings, QualityTier } from '../quality.js';

/**
 * The place the showroom happens in.
 *
 * Two of them so far, and this component knows about neither: it is handed a
 * directory and a list of levels, both read from the location's own manifest,
 * because the second location is assembled from different parts by a different
 * build and only its manifest can say what it produced.
 *
 * The street is the Amazon Lumberyard Bistro from the Open Research Content
 * Archive, under CC BY 4.0. The trail is composed from Poly Haven scans. Each
 * arrives as four levels of detail; `apps/tools` turns megabytes of research
 * asset into something a browser can hold.
 */

const LEVEL_BY_TIER: Record<QualityTier, number> = { ultra: 0, high: 1, medium: 2, low: 3 };

export interface LocationLevel {
  level: number;
  file: string;
}

/**
 * The file for a tier.
 *
 * Falls back to the coarsest level a location actually has: a build that
 * stopped after two levels should still render, at the price of detail.
 */
export function locationUrl(base: string, levels: LocationLevel[], tier: QualityTier): string {
  const wanted = LEVEL_BY_TIER[tier];
  const exact = levels.find((entry) => entry.level === wanted);
  const coarsest = [...levels].sort((a, b) => b.level - a.level)[0];
  const chosen = exact ?? coarsest;

  return chosen ? `${base}/${chosen.file}` : '';
}

/** Every level is one file; preloading the next tier up is not worth the bytes. */
export function Location({
  quality,
  base,
  levels,
}: {
  quality: QualitySettings;
  base: string;
  levels: LocationLevel[];
}) {
  const renderer = useThree((state) => state.gl);
  const url = locationUrl(base, levels, quality.tier);

  const gltf = useLoader(GLTFLoader, url, (loader) => {
    extendGltfLoader(loader, renderer);
  });

  const shadows = quality.shadows !== false;

  useEffect(() => {
    gltf.scene.traverse((object) => {
      if (!(object instanceof Mesh)) return;

      // The street receives shadows on every tier that has them; it casts only
      // where the shadow map can afford it. A hundred and seventy metres of
      // facade in one cascade is a shadow texel the size of a dinner plate.
      object.receiveShadow = shadows;
      object.castShadow = shadows && quality.tier !== 'medium';

      const material = object.material;
      if (material instanceof MeshStandardMaterial) {
        // The scene was authored for a renderer with its own sky; ours lights
        // it from an HDRI, and the default reflection strength leaves the
        // stone looking like wet plastic.
        material.envMapIntensity = 0.85;
      }
    });
  }, [gltf.scene, shadows, quality.tier]);

  return <primitive object={gltf.scene} />;
}
