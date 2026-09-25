import { Suspense, useEffect, useMemo, useState } from 'react';
import { useLoader, useThree } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { Box3, Mesh, Vector3, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { BRAND } from '@3dsfera/shared';
import { extendGltfLoader } from '../loaders.js';
import { SCENE_FONT } from './fonts.js';
import { farthestWalkable, groundAt, nearestWalkable, type NavigationGrid } from './navigation.js';
import { propUrl, type PropEntry } from '../../features/world/useProps.js';

/**
 * The food counter, at the end of the street.
 *
 * Placed rather than positioned: the street's own map says where its dead end
 * is, which is the one place a kiosk belongs and the one place that stays
 * correct when the location is rebuilt. Clicking it opens the counter's tab —
 * ordering lunch is a different flow from buying a product that ships, and
 * pretending otherwise would put a burger in the shipping cart.
 */

export interface StandPlacement {
  position: [number, number, number];
  yaw: number;
}

/**
 * The dead end, backed off by a couple of metres so the kiosk stands against
 * the end of the street rather than in the middle of the last patch of floor.
 */
export function standPlacement(
  grid: NavigationGrid,
  spawn: { position: [number, number, number] },
): StandPlacement | null {
  const far = farthestWalkable(grid, spawn.position[0], spawn.position[2]);
  if (!far) return null;

  // Facing back the way the buyer came: the counter serves the street.
  const yaw = Math.atan2(spawn.position[0] - far.x, spawn.position[2] - far.z);
  const back = 1.6;
  const x = far.x - Math.sin(yaw) * back;
  const z = far.z - Math.cos(yaw) * back;
  const landing = nearestWalkable(grid, x, z);

  const finalX = landing?.x ?? far.x;
  const finalZ = landing?.z ?? far.z;

  return { position: [finalX, groundAt(grid, finalX, finalZ), finalZ], yaw };
}

function StandModel({ entry, onSized }: { entry: PropEntry; onSized: (height: number) => void }) {
  const renderer = useThree((state) => state.gl);
  const gltf = useLoader(GLTFLoader, propUrl(entry.model), (loader) => {
    extendGltfLoader(loader, renderer);
  });

  const measured = useMemo(() => {
    const box = new Box3().setFromObject(gltf.scene);
    const size = box.getSize(new Vector3());
    const centre = box.getCenter(new Vector3());
    return {
      height: size.y,
      offset: [-centre.x, -box.min.y, -centre.z] as [number, number, number],
    };
  }, [gltf.scene]);

  useEffect(() => {
    onSized(measured.height);
    gltf.scene.traverse((object: Object3D) => {
      if (object instanceof Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
  }, [gltf.scene, measured.height, onSized]);

  return (
    <group position={measured.offset}>
      <primitive object={gltf.scene} />
    </group>
  );
}

export function FoodStand({
  entry,
  placement,
  onOpen,
}: {
  entry: PropEntry;
  placement: StandPlacement;
  onOpen: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [height, setHeight] = useState(3);

  return (
    <group position={placement.position} rotation={[0, placement.yaw, 0]}>
      <Suspense fallback={null}>
        <StandModel entry={entry} onSized={setHeight} />
      </Suspense>

      {/* The hit target is a box in front of the counter rather than the
          counter's own geometry: a kiosk is a hundred separate meshes, and
          raycasting all of them makes the cursor flicker. */}
      <mesh
        position={[0, 1.1, 1.4]}
        visible={false}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = '';
        }}
        onClick={(event) => {
          event.stopPropagation();
          onOpen();
        }}
      >
        <boxGeometry args={[3.4, 2.2, 1.2]} />
      </mesh>

      <group position={[0, height + 0.35, 0]}>
        <Text
          font={SCENE_FONT}
          fontSize={0.34}
          anchorX="center"
          anchorY="middle"
          color={hovered ? '#ffdfa6' : '#e5b25a'}
          outlineWidth={0.012}
          outlineColor="#0b0d10"
        >
          {BRAND.name}
        </Text>
        <Text
          font={SCENE_FONT}
          position={[0, -0.3, 0]}
          fontSize={0.13}
          anchorX="center"
          color="#b9bcc2"
          outlineWidth={0.006}
          outlineColor="#0b0d10"
        >
          {BRAND.tagline.it}
        </Text>
      </group>
    </group>
  );
}
