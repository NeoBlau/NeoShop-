import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { MathUtils, type Mesh } from 'three';
import { useTranslation } from 'react-i18next';
import { SCENE_FONT } from './fonts.js';
import { groundAt, nearestWalkable, type NavigationGrid } from './navigation.js';

/**
 * The concierge's place on the street.
 *
 * An information post rather than a figure, and deliberately so: a stand-in
 * human built out of primitives is worse than no human at all, and this has to
 * look like it belongs on a photographed Parisian pavement. When a character
 * model arrives it takes this spot and the post becomes their desk — the
 * dialogue, the placement and the proximity test do not change.
 */

const HEIGHT = 1.45;
const RADIUS = 0.13;
/** Metres from the post at which it starts inviting a conversation. */
const NOTICE_DISTANCE = 6;

export interface ConciergePlacement {
  position: [number, number, number];
  yaw: number;
}

/**
 * Puts the post a couple of metres to the side of where the buyer arrives, on
 * ground they can actually stand on, facing the same way they do — so it is in
 * view on arrival without standing in the road.
 */
export function conciergePlacement(
  grid: NavigationGrid,
  spawn: { position: [number, number, number]; yaw: number },
): ConciergePlacement {
  const offset = 2.4;
  // Yaw zero looks down -Z, so the buyer's right is +X rotated by the yaw.
  const rightX = Math.cos(spawn.yaw);
  const rightZ = -Math.sin(spawn.yaw);

  const wantedX = spawn.position[0] + rightX * offset;
  const wantedZ = spawn.position[2] + rightZ * offset;
  const landing = nearestWalkable(grid, wantedX, wantedZ);

  const x = landing?.x ?? wantedX;
  const z = landing?.z ?? wantedZ;

  return {
    position: [x, groundAt(grid, x, z), z],
    // Turned to face the arrival point rather than the street.
    yaw: Math.atan2(spawn.position[0] - x, spawn.position[2] - z),
  };
}

export function Concierge({
  placement,
  onOpen,
}: {
  placement: ConciergePlacement;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(false);
  const ring = useRef<Mesh>(null);
  const glow = useRef(0);

  // A slow breath rather than a blink: something that pulses at the rate of a
  // notification badge reads as an error on a street.
  useFrame((state, delta) => {
    const mesh = ring.current;
    if (!mesh) return;

    const distance = state.camera.position.distanceTo(mesh.getWorldPosition(mesh.position.clone()));
    const wanted = hovered ? 1 : distance < NOTICE_DISTANCE ? 0.55 : 0.2;
    glow.current = MathUtils.lerp(glow.current, wanted, Math.min(1, delta * 4));

    const breath = 0.85 + 0.15 * Math.sin(state.clock.elapsedTime * 1.1);
    const material = mesh.material;
    if (!Array.isArray(material) && 'emissiveIntensity' in material) {
      material.emissiveIntensity = (0.6 + glow.current * 3.4) * breath;
    }
  });

  return (
    <group position={placement.position} rotation={[0, placement.yaw, 0]}>
      <mesh
        position={[0, HEIGHT / 2, 0]}
        castShadow
        receiveShadow
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
        <cylinderGeometry args={[RADIUS * 0.8, RADIUS, HEIGHT, 24]} />
        <meshStandardMaterial color="#2b2f36" roughness={0.36} metalness={0.85} />
      </mesh>

      {/* The lit band is the affordance: it is what tells a buyer twenty metres
          away that this object is meant to be walked up to. */}
      <mesh ref={ring} position={[0, HEIGHT + 0.04, 0]}>
        <torusGeometry args={[RADIUS * 1.5, 0.022, 12, 32]} />
        <meshStandardMaterial
          color="#e5b25a"
          emissive="#e5b25a"
          emissiveIntensity={1}
          toneMapped={false}
        />
      </mesh>

      <group position={[0, HEIGHT + 0.34, 0]}>
        <Text
          font={SCENE_FONT}
          fontSize={0.1}
          anchorX="center"
          anchorY="middle"
          color={hovered ? '#f3e8d5' : '#c7cad0'}
          outlineWidth={0.004}
          outlineColor="#0b0d10"
        >
          {t('concierge.name')}
        </Text>
        <Text
          font={SCENE_FONT}
          position={[0, -0.13, 0]}
          fontSize={0.07}
          anchorX="center"
          color="#8f949c"
          outlineWidth={0.003}
          outlineColor="#0b0d10"
        >
          {t('concierge.role')}
        </Text>
      </group>
    </group>
  );
}
