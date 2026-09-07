import { useEffect } from 'react';
import { useLoader, useThree } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Mesh, MeshStandardMaterial } from 'three';
import { extendGltfLoader } from '../loaders.js';
import type { QualitySettings, QualityTier } from '../quality.js';

/**
 * The place the showroom happens in.
 *
 * This is the Amazon Lumberyard Bistro from the Open Research Content Archive
 * — a Parisian street corner modelled by a professional art team and released
 * under CC BY 4.0. It replaced a street built here out of primitives, which
 * was legible and cheap and looked exactly like what it was.
 *
 * `apps/tools/src/build-location.ts` turns the research asset into something a
 * browser can hold: four levels of detail down from 2.8 million triangles, and
 * two texture budgets with the mip chains the original never had.
 */

const LEVEL_BY_TIER: Record<QualityTier, number> = { ultra: 0, high: 1, medium: 2, low: 3 };

export function locationUrl(tier: QualityTier): string {
  return `/world/location/street-lod${LEVEL_BY_TIER[tier]}.gltf`;
}

/** Every level is one file; preloading the next tier up is not worth the bytes. */
export function Location({ quality }: { quality: QualitySettings }) {
  const renderer = useThree((state) => state.gl);
  const url = locationUrl(quality.tier);

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
