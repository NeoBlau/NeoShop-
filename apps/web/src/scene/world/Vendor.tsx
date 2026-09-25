import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { MathUtils, Vector3, type Mesh } from 'three';
import { useTranslation } from 'react-i18next';
import { SCENE_FONT } from './fonts.js';

/**
 * The person on the supplier's frontage.
 *
 * A counter with a name on it rather than a figure, and that is a decision
 * rather than a gap. There is no CC0 photoscanned human: every realistic
 * character model that could stand here is behind a marketplace licence that
 * does not cover redistributing the geometry in a web build, and the two
 * alternatives are both worse than furniture. A human built out of primitives
 * reads as a mannequin, and a stylised low-poly figure standing on a
 * photographed pavement next to a photogrammetry armchair reads as a bug. So
 * the vendor is a staffed counter: the voice, the name and the conversation
 * are real, and the body is honestly absent.
 *
 * If a licence-clear character arrives, it takes this spot and nothing else
 * changes — the placement, the proximity glow and the click target are all
 * local to the supplier's frontage group, not to the model.
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

export function Vendor({
  placement,
  name,
  supplierName,
  speaking,
  onOpen,
}: {
  placement: { position: [number, number, number]; yaw: number };
  name: string;
  supplierName: string;
  /** True while the browser is reading one of this vendor's answers aloud. */
  speaking: boolean;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(false);
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
        <mesh position={[0, TOP_HEIGHT, 0]} castShadow receiveShadow>
          <boxGeometry args={[TOP_WIDTH, 0.07, TOP_DEPTH]} />
          <meshStandardMaterial color="#3b3226" roughness={0.55} metalness={0.15} />
        </mesh>

        {/* The body of the counter, set back so the top reads as a top. */}
        <mesh position={[0, TOP_HEIGHT / 2, -0.03]} castShadow receiveShadow>
          <boxGeometry args={[TOP_WIDTH - 0.16, TOP_HEIGHT, TOP_DEPTH - 0.12]} />
          <meshStandardMaterial color="#24282e" roughness={0.4} metalness={0.7} />
        </mesh>

        {/* The lit strip is the affordance and the mouth: it is what tells a
            buyer across the street that this is something to walk up to, and
            what shows which counter a voice is coming from. */}
        <mesh ref={strip} position={[0, TOP_HEIGHT - 0.11, TOP_DEPTH / 2 - 0.01]}>
          <boxGeometry args={[TOP_WIDTH - 0.3, 0.025, 0.012]} />
          <meshStandardMaterial
            color="#e5b25a"
            emissive="#e5b25a"
            emissiveIntensity={1}
            toneMapped={false}
          />
        </mesh>
      </group>

      {/* A standing sign, because the counter alone was invisible.
          A metre-high box in a dim street, behind a row of plinths, from
          thirty metres away: there was nothing to see and nothing to walk
          towards. The post carries the name at eye level and the lit band up
          where it clears the products — which is the whole job of a shop
          sign. */}
      <mesh position={[0, SIGN_HEIGHT / 2, -0.16]} castShadow>
        <boxGeometry args={[0.07, SIGN_HEIGHT, 0.07]} />
        <meshStandardMaterial color="#20242a" roughness={0.42} metalness={0.75} />
      </mesh>

      <mesh position={[0, SIGN_HEIGHT - 0.02, -0.16]}>
        <boxGeometry args={[0.52, 0.03, 0.03]} />
        <meshStandardMaterial
          color="#e5b25a"
          emissive="#e5b25a"
          emissiveIntensity={2.2}
          toneMapped={false}
        />
      </mesh>

      <group position={[0, SIGN_HEIGHT - 0.24, -0.14]}>
        <Text
          font={SCENE_FONT}
          fontSize={0.135}
          anchorX="center"
          anchorY="middle"
          color={hovered ? '#f7ecdb' : '#dfe2e7'}
          outlineWidth={0.006}
          outlineColor="#0b0d10"
        >
          {name}
        </Text>
        <Text
          font={SCENE_FONT}
          position={[0, -0.16, 0]}
          fontSize={0.078}
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
