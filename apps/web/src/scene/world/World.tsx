import { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { AdaptiveDpr, Environment, PerformanceMonitor, Stats } from '@react-three/drei';
import { Bloom, EffectComposer, SMAA, SSAO, ToneMapping } from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode } from 'postprocessing';
import { ACESFilmicToneMapping, PCFSoftShadowMap } from 'three';
import type { WorldProduct, WorldResponse } from '@3dsfera/shared';
import { lowerTier, settingsFor, type QualitySettings, type QualityTier } from '../quality.js';
import { DEFAULT_PAVILION, PAVILION_THEMES, Pavilion } from './Pavilion.js';
import { ProductStand } from './ProductStand.js';
import { standPlacements, worldBounds } from './layout.js';
import { PlayerControls } from './PlayerControls.js';
import { useWorldMaterial } from './materials.js';

/**
 * The world: a row of pavilions on a promenade, with the buyer walking between
 * them.
 *
 * The environment map is a real photographed HDRI, served from our own origin.
 * drei's `Environment preset` would pull one from a public bucket, which fails
 * offline and is refused by the desktop shell's content security policy.
 */

const GALLERY_HDRI = '/world/hdri/gallery.hdr';

/** Depth of the walkway in front of the halls, in metres. */
const PROMENADE_DEPTH = 34;

/** The ground outside the halls. Large enough to reach the horizon. */
function Promenade({ quality, width }: { quality: QualitySettings; width: number }) {
  const floor = useWorldMaterial('floor', [width / 3, 24], quality.anisotropy);

  return (
    // Starts where the halls end. An earlier version was centred so that it
    // overlapped the pavilion floors by nine metres, and two coplanar surfaces
    // two centimetres apart produce a fan of z-fighting stripes across the
    // whole room.
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.015, DEFAULT_PAVILION.depth / 2 + PROMENADE_DEPTH / 2]}
      receiveShadow
    >
      <planeGeometry args={[width + 60, PROMENADE_DEPTH]} />
      <meshStandardMaterial
        map={floor.map}
        normalMap={floor.normalMap}
        roughnessMap={floor.ormMap}
        color="#8b8d92"
        roughness={0.6}
        metalness={0.04}
        envMapIntensity={0.7}
      />
    </mesh>
  );
}

function Effects({ quality }: { quality: QualitySettings }) {
  if (!quality.ambientOcclusion && !quality.bloom && quality.antialiasing !== 'smaa') return null;

  return (
    <EffectComposer enableNormalPass={quality.ambientOcclusion} multisampling={0}>
      {quality.ambientOcclusion ? (
        <SSAO
          blendFunction={BlendFunction.MULTIPLY}
          samples={16}
          radius={0.09}
          intensity={22}
          luminanceInfluence={0.55}
          worldDistanceThreshold={12}
          worldDistanceFalloff={2}
          worldProximityThreshold={0.6}
          worldProximityFalloff={0.2}
        />
      ) : (
        <></>
      )}
      {quality.bloom ? (
        <Bloom intensity={0.42} luminanceThreshold={0.9} luminanceSmoothing={0.25} mipmapBlur />
      ) : (
        <></>
      )}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      {quality.antialiasing === 'smaa' ? <SMAA /> : <></>}
    </EffectComposer>
  );
}

export interface WorldProps {
  world: WorldResponse;
  tier: QualityTier;
  onTierChange: (tier: QualityTier) => void;
  selectedProductId: string | null;
  activeClip: string | null;
  loop: boolean;
  onSelect: (product: WorldProduct | null) => void;
  formatPrice: (cents: number, currency: string) => string;
  /** Movement is suspended while a panel or a menu has the buyer's attention. */
  controlsEnabled: boolean;
}

export function World({
  world,
  tier,
  onTierChange,
  selectedProductId,
  activeClip,
  loop,
  onSelect,
  formatPrice,
  controlsEnabled,
}: WorldProps) {
  const quality = settingsFor(tier);

  const centres = useMemo(
    () => world.pavilions.map((pavilion) => pavilion.worldPosition.x),
    [world.pavilions],
  );

  const bounds = useMemo(() => worldBounds(centres, DEFAULT_PAVILION), [centres]);
  const spread = Math.max(1, centres.length) * world.pavilionSpacing;

  return (
    <Canvas
      camera={{ position: [0, 1.65, DEFAULT_PAVILION.depth / 2 + 8], fov: 62, near: 0.1, far: 160 }}
      dpr={[1, quality.maxPixelRatio]}
      shadows={quality.shadows ? (quality.shadows.soft ? 'soft' : true) : false}
      gl={{ antialias: quality.antialiasing === 'msaa', powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMapping = ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.15;
        if (quality.shadows) {
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = PCFSoftShadowMap;
        }
      }}
    >
      <color attach="background" args={['#0b0c0e']} />
      <fog attach="fog" args={['#0b0c0e', 30, 120]} />

      <hemisphereLight args={['#cdd6e2', '#2c2f34', 0.6]} />

      <Suspense fallback={null}>
        {/* Image-based lighting from a photographed interior: this is what puts
            believable reflections on metal and glass. `background` stays off —
            the halls are what the buyer should see, not a photo sphere. */}
        <Environment files={GALLERY_HDRI} environmentIntensity={0.55} />

        <Promenade quality={quality} width={spread} />

        {world.pavilions.map((pavilion) => {
          const theme = PAVILION_THEMES[pavilion.theme] ?? PAVILION_THEMES['GRAPHITE'];
          if (!theme) return null;

          const placements = standPlacements(pavilion.products.length, DEFAULT_PAVILION);

          return (
            <group
              key={pavilion.id}
              position={[
                pavilion.worldPosition.x,
                pavilion.worldPosition.y,
                pavilion.worldPosition.z,
              ]}
              rotation={[0, pavilion.worldPosition.rotationY, 0]}
            >
              <Pavilion theme={theme} title={pavilion.supplierName} quality={quality} />

              {pavilion.products.map((product, index) => {
                const placement = placements[index];
                if (!placement) return null;

                return (
                  <group key={product.id} rotation={[0, placement.rotationY, 0]}>
                    <ProductStand
                      product={product}
                      position={placement.position}
                      quality={quality}
                      selected={selectedProductId === product.id}
                      activeClip={activeClip}
                      loop={loop}
                      onSelect={onSelect}
                      formatPrice={formatPrice}
                    />
                  </group>
                );
              })}
            </group>
          );
        })}
      </Suspense>

      <PlayerControls
        bounds={bounds}
        enabled={controlsEnabled}
        startPosition={[centres[0] ?? 0, 1.65, DEFAULT_PAVILION.depth / 2 + 7]}
      />

      <Effects quality={quality} />

      {/* Two safety nets. AdaptiveDpr drops the resolution during movement,
          which recovers a stutter within a frame; the monitor drops a whole
          tier when the frame rate stays low, which fixes the cause. */}
      <AdaptiveDpr pixelated={false} />
      <PerformanceMonitor
        onDecline={() => {
          const next = lowerTier(tier);
          if (next) onTierChange(next);
        }}
      />

      {import.meta.env.DEV ? <Stats /> : null}
    </Canvas>
  );
}
