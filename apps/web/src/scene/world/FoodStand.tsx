import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { Box3, Mesh, Vector3, type Group, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useTranslation } from 'react-i18next';
import { BRAND } from '@3dsfera/shared';
import { extendGltfLoader } from '../loaders.js';
import { SCENE_FONT } from './fonts.js';
import { groundAt, nearestWalkable, walkableAt, type NavigationGrid } from './navigation.js';
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

/** Metres at which the counter tells you it can be opened. */
const PROMPT_DISTANCE = 9;
/** Scratch, reused every frame. */
const WORLD_POSITION = new Vector3();

/**
 * Metres of walking from the door.
 *
 * Not the dead end any more. On the street the far end is forty metres away
 * and reads as one; in the grove the clearing runs a hundred, and putting the
 * counter at the end of it meant a two-minute hike across a field to reach a
 * menu. A walk of this length is a walk; twice it is an errand.
 */
const WALK = 38;

/**
 * A spot about a minute's walk in, backed off by a couple of metres so the
 * kiosk stands against something rather than in the middle of the floor.
 */
export function standPlacement(
  grid: NavigationGrid,
  spawn: { position: [number, number, number] },
): StandPlacement | null {
  const far = walkableAt(grid, spawn.position[0], spawn.position[2], WALK);
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
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(false);
  const [height, setHeight] = useState(3);
  // Whether the buyer is close enough to be told the counter is clickable.
  const [near, setNear] = useState(false);
  const mark = useRef<Group>(null);

  /**
   * The prompt appears when you are close, and that is the whole fix.
   *
   * The kiosk was clickable from the day it was built and nothing said so:
   * you walked up to five metres of restaurant, the cursor changed shape if
   * you happened to be pointing at the right patch of air, and there was no
   * other clue. A sign that says "press to open the menu" once you are near
   * enough to press it is what every shop door in the world does.
   */
  useFrame(({ camera }) => {
    const node = mark.current;
    if (!node) return;

    const from = camera.position.distanceTo(node.getWorldPosition(WORLD_POSITION));
    const wanted = from <= PROMPT_DISTANCE;
    if (wanted !== near) setNear(wanted);
  });

  return (
    <group ref={mark} position={placement.position} rotation={[0, placement.yaw, 0]}>
      <Suspense fallback={null}>
        <StandModel entry={entry} onSized={setHeight} />
      </Suspense>

      {/* A lit ring on the ground in front of the counter: the thing you can
          see from down the street and walk onto. */}
      <mesh position={[0, 0.012, 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.1, 1.3, 48]} />
        <meshStandardMaterial
          color="#e5b25a"
          emissive="#e5b25a"
          emissiveIntensity={near ? 2.4 : 1}
          toneMapped={false}
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-2}
        />
      </mesh>

      {/* The hit target: the whole front of the kiosk rather than the
          counter's own geometry. A kiosk is a hundred separate meshes, and
          raycasting all of them makes the cursor flicker — but the box it was
          replaced with was small enough to miss. */}
      <mesh
        position={[0, 1.4, 1.6]}
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
        <boxGeometry args={[5, 2.8, 3.2]} />
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

      {near ? (
        <Text
          font={SCENE_FONT}
          position={[0, 1.75, 2.1]}
          fontSize={0.19}
          anchorX="center"
          anchorY="middle"
          color={hovered ? '#ffdfa6' : '#f1e6d4'}
          outlineWidth={0.01}
          outlineColor="#0b0d10"
        >
          {t('world.openMenu')}
        </Text>
      ) : null}
    </group>
  );
}
