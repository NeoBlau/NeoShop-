import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { AdaptiveDpr, Environment, PerformanceMonitor, Stats, Text } from '@react-three/drei';
import { Bloom, EffectComposer, SMAA, SSAO, ToneMapping } from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode } from 'postprocessing';
import { ACESFilmicToneMapping, PCFSoftShadowMap, type DirectionalLight } from 'three';
import type { WorldProduct, WorldResponse } from '@3dsfera/shared';
import { lowerTier, settingsFor, type QualitySettings, type QualityTier } from '../quality.js';
import { Location } from './Location.js';
import { ProductStand } from './ProductStand.js';
import { standPlacements } from './layout.js';
import { EYE_HEIGHT, PlayerControls } from './PlayerControls.js';
import { SCENE_FONT } from './fonts.js';
import { groundAt } from './navigation.js';
import type { LocationData } from '../../features/world/useLocationData.js';

/**
 * The world: a street, and the suppliers who have a shop on it.
 *
 * The street is the Amazon Lumberyard Bistro from the Open Research Content
 * Archive, under CC BY 4.0. Each supplier is given one of its shop fronts —
 * found by the asset build from the signs the artists painted — and lays their
 * products out on the pavement in front of it.
 *
 * The sky and the light both come from a photographed HDRI served from our own
 * origin. drei's `Environment preset` would pull one from a public bucket,
 * which fails offline and is refused by the desktop shell's content security
 * policy.
 */

const STREET_HDRI = '/world/hdri/street.hdr';

/**
 * A sun that follows the buyer.
 *
 * One shadow map has to cover whatever is on screen. Stretched over a hundred
 * and seventy metres of street its texels are the size of a dinner plate and
 * every shadow turns to mush; kept to a forty-metre box around the camera it
 * is four centimetres a texel, which is enough to see the legs of a chair.
 */
function Sun({ quality }: { quality: QualitySettings }) {
  const light = useRef<DirectionalLight>(null);
  const shadows = quality.shadows;

  useFrame(({ camera }) => {
    const sun = light.current;
    if (!sun) return;

    sun.position.set(camera.position.x + 38, 62, camera.position.z + 26);
    sun.target.position.set(camera.position.x, 0, camera.position.z);
    sun.target.updateMatrixWorld();
  });

  return (
    <directionalLight
      ref={light}
      intensity={2.6}
      color="#fff2df"
      castShadow={shadows !== false}
      shadow-mapSize-width={shadows ? shadows.mapSize : 1024}
      shadow-mapSize-height={shadows ? shadows.mapSize : 1024}
      shadow-camera-near={10}
      shadow-camera-far={140}
      shadow-camera-left={-40}
      shadow-camera-right={40}
      shadow-camera-top={40}
      shadow-camera-bottom={-40}
      shadow-bias={-0.0009}
      shadow-normalBias={0.035}
    />
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
          intensity={18}
          luminanceInfluence={0.6}
          worldDistanceThreshold={20}
          worldDistanceFalloff={4}
          worldProximityThreshold={0.6}
          worldProximityFalloff={0.2}
        />
      ) : (
        <></>
      )}
      {quality.bloom ? (
        <Bloom intensity={0.28} luminanceThreshold={0.95} luminanceSmoothing={0.3} mipmapBlur />
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
  location: LocationData;
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

/** One supplier's frontage: their name over their products. */
function SupplierFront({
  name,
  products,
  anchor,
  quality,
  selectedProductId,
  activeClip,
  loop,
  onSelect,
  formatPrice,
}: {
  name: string;
  products: WorldProduct[];
  anchor: LocationData['manifest']['anchors'][number];
  quality: QualitySettings;
  selectedProductId: string | null;
  activeClip: string | null;
  loop: boolean;
  onSelect: (product: WorldProduct | null) => void;
  formatPrice: (cents: number, currency: string) => string;
}) {
  const placements = useMemo(() => standPlacements(products.length), [products.length]);

  return (
    <group position={anchor.stand} rotation={[0, anchor.facing, 0]}>
      {/* The supplier's name, at the height of the shop sign above them and
          turned to face the same way. The street's own painted signs stay: a
          name board hung under one reads as a tenant, which is what they are. */}
      <Text
        font={SCENE_FONT}
        position={[0, 2.9, -0.4]}
        fontSize={0.34}
        maxWidth={6}
        textAlign="center"
        anchorX="center"
        anchorY="middle"
        color="#f4e2c2"
        outlineWidth={0.012}
        outlineColor="#241a10"
      >
        {name}
      </Text>

      {products.map((product, index) => {
        const stand = placements[index];
        if (!stand) return null;

        return (
          <group key={product.id} rotation={[0, stand.rotationY, 0]}>
            <ProductStand
              product={product}
              position={stand.position}
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
}

/** The part of the scene that lives inside the canvas. */
function Scene({
  world,
  location,
  tier,
  onTierChange,
  selectedProductId,
  activeClip,
  loop,
  onSelect,
  formatPrice,
  controlsEnabled,
  quality,
}: WorldProps & { quality: QualitySettings }) {
  const { grid, manifest } = location;
  const renderer = useThree((state) => state.gl);

  useEffect(() => {
    // The street was authored for a renderer with a physical sky. Ours is
    // close enough that the exposure, not the lighting, is what needs saying.
    renderer.toneMappingExposure = 1.05;
  }, [renderer]);

  return (
    <>
      <Suspense fallback={null}>
        {/* The sky is the backdrop as well as the light: this is an outdoors
            scene, and a flat colour above the rooflines gives it away. */}
        <Environment
          files={STREET_HDRI}
          environmentIntensity={1}
          background
          backgroundBlurriness={0}
        />

        <Location quality={quality} />

        {world.pavilions.map((pavilion, index) => {
          const anchor = manifest.anchors[index % Math.max(1, manifest.anchors.length)];
          if (!anchor || pavilion.products.length === 0) return null;

          return (
            <SupplierFront
              key={pavilion.id}
              name={pavilion.supplierName}
              products={pavilion.products}
              anchor={anchor}
              quality={quality}
              selectedProductId={selectedProductId}
              activeClip={activeClip}
              loop={loop}
              onSelect={onSelect}
              formatPrice={formatPrice}
            />
          );
        })}
      </Suspense>

      <Sun quality={quality} />
      {/* A little sky bounce into the shaded side of the street. The HDRI does
          most of it; this keeps the north-facing walls from going flat. */}
      <hemisphereLight args={['#cfe0f5', '#6d6455', 0.35]} />

      <PlayerControls
        grid={grid}
        enabled={controlsEnabled}
        startPosition={[
          manifest.spawn.position[0],
          groundAt(grid, manifest.spawn.position[0], manifest.spawn.position[2]) + EYE_HEIGHT,
          manifest.spawn.position[2],
        ]}
        startYaw={manifest.spawn.yaw}
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
    </>
  );
}

export function World(props: WorldProps) {
  const quality = settingsFor(props.tier);
  const { grid, manifest } = props.location;
  const spawn = manifest.spawn;

  return (
    <Canvas
      camera={{
        position: [
          spawn.position[0],
          groundAt(grid, spawn.position[0], spawn.position[2]) + EYE_HEIGHT,
          spawn.position[2],
        ],
        fov: 62,
        near: 0.1,
        far: 400,
      }}
      dpr={[1, quality.maxPixelRatio]}
      shadows={quality.shadows ? (quality.shadows.soft ? 'soft' : true) : false}
      gl={{ antialias: quality.antialiasing === 'msaa', powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMapping = ACESFilmicToneMapping;
        if (quality.shadows) {
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = PCFSoftShadowMap;
        }
      }}
    >
      <Scene {...props} quality={quality} />
    </Canvas>
  );
}
