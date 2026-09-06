import { useMemo } from 'react';
import { Text } from '@react-three/drei';
import { BackSide, DoubleSide, type ColorRepresentation } from 'three';
import { useWorldMaterial } from './materials.js';
import { SCENE_FONT } from './fonts.js';
import type { QualitySettings } from '../quality.js';

/**
 * The gallery a pavilion occupies.
 *
 * Built from primitives rather than imported as a model, for three reasons:
 * the geometry is a few hundred triangles instead of a few hundred thousand,
 * the materials are shared with every other pavilion so the GPU uploads them
 * once, and the dimensions can follow the number of products a supplier
 * actually has.
 *
 * Engine-store environments (Unreal, Unity) were considered and rejected: they
 * are licensed for use inside those engines, and a Nanite city is not something
 * a browser can be talked into rendering.
 */

export interface PavilionDimensions {
  width: number;
  depth: number;
  height: number;
}

export const DEFAULT_PAVILION: PavilionDimensions = { width: 26, depth: 18, height: 6 };

/** Width of the opening in the storefront the buyer walks through. */
export const ENTRANCE_WIDTH = 5;

/** How far the wall shell extends past the floor and ceiling, in metres. */
const WALL_OVERSHOOT = 0.25;

export interface PavilionTheme {
  /** Tints the plaster; each supplier's hall reads slightly differently. */
  wallTint: ColorRepresentation;
  accent: ColorRepresentation;
  /** Colour temperature of the ceiling strips. */
  lightColor: ColorRepresentation;
}

export const PAVILION_THEMES: Record<string, PavilionTheme> = {
  GRAPHITE: { wallTint: '#3c3f45', accent: '#d8a244', lightColor: '#fff4e2' },
  DEEP_BLUE: { wallTint: '#2f3946', accent: '#7fb0d8', lightColor: '#eef4ff' },
  SAND: { wallTint: '#4a453c', accent: '#d8b177', lightColor: '#fff0d8' },
  MONO: { wallTint: '#3a3a3c', accent: '#c8c8cc', lightColor: '#ffffff' },
};

/** Recessed ceiling strips: the light source and the visual signature. */
function CeilingLights({
  dimensions,
  theme,
  quality,
}: {
  dimensions: PavilionDimensions;
  theme: PavilionTheme;
  quality: QualitySettings;
}) {
  const strips = useMemo(() => {
    const count = 4;
    const spacing = dimensions.depth / (count + 1);
    return Array.from(
      { length: count },
      (_, index) => (index + 1) * spacing - dimensions.depth / 2,
    );
  }, [dimensions.depth]);

  return (
    <group>
      {strips.map((z) => (
        <group key={z} position={[0, dimensions.height - 0.12, z]}>
          {/* The visible strip: emissive, so it survives tone mapping as a
              light source rather than a grey rectangle. */}
          <mesh>
            <boxGeometry args={[dimensions.width - 3, 0.09, 0.34]} />
            <meshStandardMaterial
              color={theme.lightColor}
              emissive={theme.lightColor}
              emissiveIntensity={3.2}
              toneMapped={false}
            />
          </mesh>

          {/* Fill only. None of the ceiling lights cast a shadow: a point
              light's shadow is a cube map, six renders of the hall, and at the
              resolution a browser can afford it produces stripes across the
              floor rather than shading. The shadows that matter — the ones
              under the products — come from the tight spotlight on each
              plinth, where a small map covers a small area precisely. */}
          {([-0.26, 0.26] as const).map((offset) => (
            <pointLight
              key={offset}
              position={[dimensions.width * offset, -0.3, 0]}
              intensity={quality.tier === 'low' ? 14 : 20}
              distance={dimensions.height * 3.2}
              decay={2}
              color={theme.lightColor}
            />
          ))}
        </group>
      ))}
    </group>
  );
}

export function Pavilion({
  dimensions = DEFAULT_PAVILION,
  theme,
  title,
  quality,
}: {
  dimensions?: PavilionDimensions;
  theme: PavilionTheme;
  title: string;
  quality: QualitySettings;
}) {
  const { width, depth, height } = dimensions;

  // Tiling is expressed in metres so the material keeps its physical scale
  // whatever the hall's dimensions.
  const floor = useWorldMaterial('floor', [width / 4, depth / 4], quality.anisotropy);
  const wall = useWorldMaterial('wall', [width / 6, height / 6], quality.anisotropy);
  const trim = useWorldMaterial('trim', [width / 2, 1], quality.anisotropy);

  // Refraction is a second render of the scene behind the glass; only the top
  // tiers can afford it.
  const expensiveGlass = quality.tier === 'ultra' || quality.tier === 'high';

  return (
    <group>
      {/* Floor. Polished concrete: the roughness map is scaled down so it
          holds a reflection of the ceiling strips, which is most of what makes
          an interior read as expensive. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial
          map={floor.map}
          normalMap={floor.normalMap}
          roughnessMap={floor.ormMap}
          aoMap={floor.ormMap}
          roughness={0.42}
          metalness={0.06}
          envMapIntensity={1.1}
        />
      </mesh>

      {/* Walls, as one inverted box: four draw calls become one, and the
          player can never see the outside of it.
          
          The box is sunk a little below the floor and raised as much above the
          ceiling. Left flush, its bottom face would be exactly coplanar with
          the floor plane, and two coplanar surfaces produce a wedge of
          z-fighting stripes that widens with distance — which is precisely
          what a lit floor makes obvious. */}
      <mesh position={[0, height / 2, 0]} receiveShadow>
        <boxGeometry args={[width, height + WALL_OVERSHOOT * 2, depth]} />
        <meshStandardMaterial
          side={BackSide}
          map={wall.map}
          normalMap={wall.normalMap}
          roughnessMap={wall.ormMap}
          color={theme.wallTint}
          roughness={0.95}
          metalness={0}
          envMapIntensity={0.7}
        />
      </mesh>

      {/* Skirting: a 12 cm band that stops the wall and floor meeting in a
          bare seam. Cheap, and its absence is the first thing that reads as
          "untextured box". */}
      {(
        [
          { z: -depth / 2 + 0.02, rotation: 0 },
          { z: depth / 2 - 0.02, rotation: Math.PI },
        ] as const
      ).map((skirting) => (
        <mesh
          key={skirting.rotation}
          position={[0, 0.06, skirting.z]}
          rotation={[0, skirting.rotation, 0]}
          receiveShadow
        >
          <boxGeometry args={[width, 0.12, 0.04]} />
          <meshStandardMaterial
            map={trim.map}
            normalMap={trim.normalMap}
            roughnessMap={trim.ormMap}
            // The scan is a warm oak; desaturated here so the skirting reads as
            // trim rather than a stripe of orange across the hall.
            color="#6b6259"
            roughness={0.6}
          />
        </mesh>
      ))}

      <CeilingLights dimensions={dimensions} theme={theme} quality={quality} />

      {/* Supplier sign above the entrance wall. */}
      <Text
        font={SCENE_FONT}
        position={[0, height - 1.4, -depth / 2 + 0.12]}
        fontSize={0.52}
        maxWidth={width - 6}
        textAlign="center"
        anchorX="center"
        anchorY="middle"
        color={theme.accent}
        outlineWidth={0}
      >
        {title}
      </Text>

      {/* A soft accent wash behind the sign, so the far wall is not flat. */}
      <pointLight
        position={[0, height - 1.6, -depth / 2 + 1.2]}
        intensity={6}
        distance={9}
        color={theme.accent}
      />

      {/* Storefront glazing, in two panels with an opening between them. The
          buyer walks out through the gap and sees the neighbouring hall
          through the glass, which is what makes this a place rather than a
          room. Transmission is a real refraction pass and costs accordingly,
          so the lower tiers get a plain translucent panel instead. */}
      {(
        [
          { key: 'left', x: -(width / 4 + ENTRANCE_WIDTH / 4) },
          { key: 'right', x: width / 4 + ENTRANCE_WIDTH / 4 },
        ] as const
      ).map((panel) => (
        <mesh key={panel.key} position={[panel.x, height / 2, depth / 2 - 0.05]}>
          <planeGeometry args={[width / 2 - ENTRANCE_WIDTH / 2, height - 0.4]} />
          <meshPhysicalMaterial
            side={DoubleSide}
            transmission={expensiveGlass ? 0.92 : 0}
            opacity={expensiveGlass ? 1 : 0.14}
            transparent
            thickness={0.02}
            roughness={0.05}
            metalness={0}
            ior={1.5}
            color="#dfe6ee"
          />
        </mesh>
      ))}

      {/* Door frame, so the opening reads as an entrance and not a hole. */}
      {([-1, 1] as const).map((side) => (
        <mesh
          key={side}
          position={[(side * ENTRANCE_WIDTH) / 2, (height - 0.4) / 2, depth / 2 - 0.05]}
          castShadow
        >
          <boxGeometry args={[0.09, height - 0.4, 0.12]} />
          <meshStandardMaterial color="#23262b" roughness={0.4} metalness={0.7} />
        </mesh>
      ))}
    </group>
  );
}
