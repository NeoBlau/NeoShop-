import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { Box3, MathUtils, Mesh, Vector3, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useTranslation } from 'react-i18next';
import { extendGltfLoader } from '../loaders.js';
import { SCENE_FONT } from './fonts.js';
import { propUrl, type PropEntry } from '../../features/world/useProps.js';

/**
 * The person on the supplier's frontage.
 *
 * A person when `make props` has one to give, and a counter with a name on it
 * when it does not.
 *
 * The figure comes from `assets/incoming/npc-a.glb` through the prop build —
 * a rigged 1.70 m character, so she is placed at her own scale rather than
 * fitted to a round number, which is the one prop that must never be
 * rescaled. Her animation is a third of a second long and is not worth
 * playing; she stands.
 *
 * The fallback is not a placeholder for its own sake. A checkout without that
 * file still has suppliers who need naming and a conversation that needs
 * somewhere to be clicked, and a post with a sign does that honestly — where
 * a human built out of primitives would read as a mannequin.
 */

const TOP_HEIGHT = 1.02;
const TOP_WIDTH = 1.5;
const TOP_DEPTH = 0.56;
/** Metres at which the counter starts inviting a conversation. */
const NOTICE_DISTANCE = 7;
/** How high the sign stands. Tall enough to clear the row of plinths. */
const SIGN_HEIGHT = 2.35;

/** Scratch, reused every frame by every counter. */
const WORLD_POSITION = new Vector3();

/**
 * Where the counter stands on a frontage, in the frontage group's own
 * coordinates: +X along the shop front, +Z towards the buyer.
 *
 * At the end of the row of plinths and a step forward of it, so it neither
 * hides a product nor stands in the walking line.
 */
export function vendorPlacement(products: number): {
  position: [number, number, number];
  yaw: number;
} {
  const span = Math.max(0, products - 1) * 2.1;
  return { position: [span / 2 + 1.8, 0, 0.75], yaw: -0.38 };
}

/**
 * The figure, seated on the ground and turned to face the street.
 *
 * Measured rather than trusted: the prop build centres a model and drops it
 * to the floor, but a character exported from a different tool can still
 * arrive with its origin at the hips.
 */
function VendorFigure({ entry, onSized }: { entry: PropEntry; onSized: (height: number) => void }) {
  const renderer = useThree((state) => state.gl);
  const gltf = useLoader(GLTFLoader, propUrl(entry.model), (loader) => {
    extendGltfLoader(loader, renderer);
  });

  const fit = useMemo(() => {
    const box = new Box3().setFromObject(gltf.scene);
    const centre = box.getCenter(new Vector3());
    return {
      offset: [-centre.x, -box.min.y, -centre.z] as [number, number, number],
      height: box.max.y - box.min.y,
    };
  }, [gltf.scene]);

  useEffect(() => {
    onSized(fit.height);
    gltf.scene.traverse((object: Object3D) => {
      if (object instanceof Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
  }, [gltf.scene, fit.height, onSized]);

  return (
    <group position={fit.offset}>
      <primitive object={gltf.scene} />
    </group>
  );
}

export function Vendor({
  placement,
  name,
  supplierName,
  speaking,
  figure,
  onOpen,
}: {
  placement: { position: [number, number, number]; yaw: number };
  name: string;
  supplierName: string;
  /** True while the browser is reading one of this vendor's answers aloud. */
  speaking: boolean;
  /** The character model, when this build has one. */
  figure?: PropEntry | undefined;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(false);
  const [figureHeight, setFigureHeight] = useState(1.7);
  const strip = useRef<Mesh>(null);
  const glow = useRef(0);

  useFrame((state, delta) => {
    const mesh = strip.current;
    if (!mesh) return;

    const distance = state.camera.position.distanceTo(mesh.getWorldPosition(WORLD_POSITION));
    const wanted = hovered ? 1 : distance < NOTICE_DISTANCE ? 0.5 : 0.16;
    glow.current = MathUtils.lerp(glow.current, wanted, Math.min(1, delta * 4));

    // Speaking is a visible thing: without it, a voice comes out of the scene
    // with nothing to attach it to. Faster than the idle breath, and only
    // while an utterance is actually running.
    const pulse = speaking
      ? 1.15 + 0.5 * Math.sin(state.clock.elapsedTime * 7.5)
      : 0.85 + 0.15 * Math.sin(state.clock.elapsedTime * 1.1);

    const material = mesh.material;
    if (!Array.isArray(material) && 'emissiveIntensity' in material) {
      material.emissiveIntensity = (0.5 + glow.current * 3) * pulse;
    }
  });

  /** Where the name hangs: over her head, or over the counter. */
  const labelHeight = figure ? figureHeight + 0.3 : SIGN_HEIGHT - 0.24;

  return (
    <group position={placement.position} rotation={[0, placement.yaw, 0]}>
      <group
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
        {figure ? (
          <>
            <Suspense fallback={null}>
              <VendorFigure entry={figure} onSized={setFigureHeight} />
            </Suspense>

            {/* A hit target around her rather than her own geometry: a
                character is a hundred thousand triangles and raycasting them
                makes the cursor flicker. */}
            <mesh position={[0, figureHeight / 2, 0]} visible={false}>
              <cylinderGeometry args={[0.55, 0.55, figureHeight, 10]} />
            </mesh>

            {/* Underfoot rather than on a post: something has to say which
                figure is talking, and it doubles as the thing you can see from
                down the street. */}
            <mesh ref={strip} position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.46, 0.56, 40]} />
              <meshStandardMaterial
                color="#e5b25a"
                emissive="#e5b25a"
                emissiveIntensity={1}
                toneMapped={false}
                depthWrite={false}
                polygonOffset
                polygonOffsetFactor={-2}
              />
            </mesh>
          </>
        ) : (
          <>
            <mesh position={[0, TOP_HEIGHT, 0]} castShadow receiveShadow>
              <boxGeometry args={[TOP_WIDTH, 0.07, TOP_DEPTH]} />
              <meshStandardMaterial color="#3b3226" roughness={0.55} metalness={0.15} />
            </mesh>

            <mesh position={[0, TOP_HEIGHT / 2, -0.03]} castShadow receiveShadow>
              <boxGeometry args={[TOP_WIDTH - 0.16, TOP_HEIGHT, TOP_DEPTH - 0.12]} />
              <meshStandardMaterial color="#24282e" roughness={0.4} metalness={0.7} />
            </mesh>

            <mesh ref={strip} position={[0, TOP_HEIGHT - 0.11, TOP_DEPTH / 2 - 0.01]}>
              <boxGeometry args={[TOP_WIDTH - 0.3, 0.025, 0.012]} />
              <meshStandardMaterial
                color="#e5b25a"
                emissive="#e5b25a"
                emissiveIntensity={1}
                toneMapped={false}
              />
            </mesh>

            <mesh position={[0, SIGN_HEIGHT / 2, -0.16]} castShadow>
              <boxGeometry args={[0.07, SIGN_HEIGHT, 0.07]} />
              <meshStandardMaterial color="#20242a" roughness={0.42} metalness={0.75} />
            </mesh>
          </>
        )}
      </group>

      <group position={[0, labelHeight, figure ? 0 : -0.14]}>
        <Text
          font={SCENE_FONT}
          fontSize={0.125}
          anchorX="center"
          anchorY="middle"
          color={hovered ? '#f7ecdb' : '#dfe2e7'}
          outlineWidth={0.005}
          outlineColor="#0b0d10"
        >
          {name}
        </Text>
        <Text
          font={SCENE_FONT}
          position={[0, -0.15, 0]}
          fontSize={0.075}
          maxWidth={2.4}
          textAlign="center"
          anchorX="center"
          anchorY="top"
          color="#9aa0a8"
          outlineWidth={0.004}
          outlineColor="#0b0d10"
        >
          {t('npc.vendorRole', { supplier: supplierName })}
        </Text>
      </group>
    </group>
  );
}
