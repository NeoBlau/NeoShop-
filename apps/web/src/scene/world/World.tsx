import { Suspense, useCallback, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { AdaptiveDpr, Environment, PerformanceMonitor, Stats, Text } from '@react-three/drei';
import { Bloom, EffectComposer, SMAA, SSAO, ToneMapping } from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode } from 'postprocessing';
import { ACESFilmicToneMapping, PCFSoftShadowMap, type DirectionalLight } from 'three';
import {
  dominantCategory,
  vendorFigureKey,
  vendorName,
  type ProductCategory,
  type WorldProduct,
  type WorldResponse,
} from '@3dsfera/shared';
import { lowerTier, settingsFor, type QualitySettings, type QualityTier } from '../quality.js';
import { Concierge, conciergePlacement } from './Concierge.js';
import { Vendor, vendorPlacement } from './Vendor.js';
import { QuestSensors, type QuestLandmark } from './QuestSensors.js';
import { FoodStand, standPlacement } from './FoodStand.js';
import { Location } from './Location.js';
import { ProductStand } from './ProductStand.js';
import { standPlacements } from './layout.js';
import { EYE_HEIGHT, PlayerControls } from './PlayerControls.js';
import { SCENE_FONT } from './fonts.js';
import { groundAt } from './navigation.js';
import type { LocationData } from '../../features/world/useLocationData.js';
import type { PropEntry } from '../../features/world/useProps.js';

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

/** What a location gets when its build had no opinion: the street's own light. */
const STREET_LIGHT = { exposure: 1.05, environment: 1, sun: 2.6, hemisphere: 0.35 } as const;

/**
 * A sun that follows the buyer.
 *
 * One shadow map has to cover whatever is on screen. Stretched over a hundred
 * and seventy metres of street its texels are the size of a dinner plate and
 * every shadow turns to mush; kept to a forty-metre box around the camera it
 * is four centimetres a texel, which is enough to see the legs of a chair.
 */
function Sun({ quality, intensity }: { quality: QualitySettings; intensity: number }) {
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
      intensity={intensity}
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
  /** The buyer walked up to the concierge and asked for help. */
  onConciergeOpen: () => void;
  /** Street props this build has. Empty is normal: `make props` is optional. */
  props: Record<string, PropEntry>;
  /** The buyer walked up to the food counter. */
  onFoodOpen: () => void;
  /** The buyer walked up to a supplier's counter and spoke to whoever is on it. */
  onVendorOpen: (vendor: OpenVendor) => void;
  /** Which counter is reading an answer aloud, so the right strip pulses. */
  speakingVendorId: string | null;
  /** What a street quest needs to know, and only the world can tell it. */
  onWalked: (metres: number) => void;
  onNearFrontage: (pavilionId: string) => void;
  onLandmark: (name: string) => void;
}

/** Everything the dialogue panel needs about the person being spoken to. */
export interface OpenVendor {
  pavilionId: string;
  supplierName: string;
  name: string;
  /** Null when the frontage has nothing on it, which has its own opening line. */
  category: ProductCategory | null;
}

/** One supplier's frontage: their name over their products. */
function SupplierFront({
  pavilionId,
  name,
  products,
  anchor,
  quality,
  selectedProductId,
  activeClip,
  loop,
  onSelect,
  formatPrice,
  onVendorOpen,
  vendorSpeaking,
  figure,
}: {
  pavilionId: string;
  name: string;
  products: WorldProduct[];
  anchor: LocationData['manifest']['anchors'][number];
  quality: QualitySettings;
  selectedProductId: string | null;
  activeClip: string | null;
  loop: boolean;
  onSelect: (product: WorldProduct | null) => void;
  formatPrice: (cents: number, currency: string) => string;
  onVendorOpen: (vendor: OpenVendor) => void;
  vendorSpeaking: boolean;
  /** The character model for whoever stands here, when this build has one. */
  figure: PropEntry | undefined;
}) {
  const placements = useMemo(() => standPlacements(products.length), [products.length]);
  const counter = useMemo(() => vendorPlacement(products.length), [products.length]);

  // Who is on this frontage, and what they know about. The name is derived
  // from the pavilion's own id so it survives a reload without being stored,
  // and the shelf they talk about is whatever the supplier actually sells.
  const vendor = useMemo<OpenVendor>(
    () => ({
      pavilionId,
      supplierName: name,
      name: vendorName(pavilionId).ru,
      category:
        products.length === 0
          ? null
          : dominantCategory(products.map((product) => product.category)),
    }),
    [pavilionId, name, products],
  );

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

      {/* Staffed. Placed from the length of the row rather than from a
          coordinate, so it stays at the end of the frontage whatever the
          supplier put out. */}
      <Vendor
        placement={counter}
        name={vendor.name}
        supplierName={name}
        speaking={vendorSpeaking}
        figure={figure}
        onOpen={() => onVendorOpen(vendor)}
      />
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
  onConciergeOpen,
  props,
  onFoodOpen,
  onVendorOpen,
  speakingVendorId,
  onWalked,
  onNearFrontage,
  onLandmark,
  quality,
}: WorldProps & { quality: QualitySettings }) {
  const { grid, manifest } = location;
  const renderer = useThree((state) => state.gl);
  const concierge = useMemo(() => conciergePlacement(grid, manifest.spawn), [grid, manifest.spawn]);

  // The counter goes at the end of the street, which the map knows and this
  // file does not. Computed once: a breadth-first walk over twenty thousand
  // cells is cheap, and doing it per frame would not be.
  const stand = useMemo(() => standPlacement(grid, manifest.spawn), [grid, manifest.spawn]);
  const foodStand = props['food-stand'];

  /**
   * Which character model stands on a given frontage.
   *
   * Whatever `make props` produced, in a stable order, chosen by the
   * pavilion's own id — so a street of six shops is not six copies of one
   * person, and adding a supplier does not reshuffle the others. No figures
   * in the build means the counter-and-sign fallback.
   */
  const figures = useMemo(
    () =>
      Object.keys(props)
        .filter((key) => key.startsWith('vendor-'))
        .sort(),
    [props],
  );

  const figureFor = useCallback(
    (pavilionId: string) => {
      const key = vendorFigureKey(pavilionId, figures);
      return key === null ? undefined : props[key];
    },
    [figures, props],
  );

  // The places a quest can ask somebody to reach. Derived from the placements
  // the scene has already worked out, so a quest never names a coordinate.
  const landmarks = useMemo<QuestLandmark[]>(() => {
    const found: QuestLandmark[] = [{ name: 'concierge', position: concierge.position }];
    if (stand) found.push({ name: 'counter', position: stand.position });
    return found;
  }, [concierge.position, stand]);

  // Lighting belongs to the location, not to this file. The street is a
  // Parisian noon; the grove is a hazy morning under a pure sky, and the
  // street's numbers applied to it blow the canopy out to white. A location
  // whose build had no opinion gets the street's values, which is what every
  // location was lit with before the manifest carried this.
  const light = manifest.light ?? STREET_LIGHT;

  useEffect(() => {
    // The street was authored for a renderer with a physical sky. Ours is
    // close enough that the exposure, not the lighting, is what needs saying.
    renderer.toneMappingExposure = light.exposure;
  }, [renderer, light.exposure]);

  return (
    <>
      <Suspense fallback={null}>
        {/* The sky is the backdrop as well as the light: this is an outdoors
            scene, and a flat colour above the rooflines gives it away. */}
        <Environment
          files={location.skyUrl}
          environmentIntensity={light.environment}
          background
          backgroundBlurriness={0}
        />

        <Location quality={quality} base={location.base} levels={manifest.levels} />

        {world.pavilions.map((pavilion, index) => {
          const anchor = manifest.anchors[index % Math.max(1, manifest.anchors.length)];
          // An empty frontage is still a frontage: the supplier exists, their
          // name goes over the shop and somebody stands at the counter. It used
          // to render nothing at all, which made a street with a processing
          // problem behind it look like a street with no shops in it.
          if (!anchor) return null;

          return (
            <SupplierFront
              key={pavilion.id}
              pavilionId={pavilion.id}
              name={pavilion.supplierName}
              products={pavilion.products}
              anchor={anchor}
              quality={quality}
              selectedProductId={selectedProductId}
              activeClip={activeClip}
              loop={loop}
              onSelect={onSelect}
              formatPrice={formatPrice}
              onVendorOpen={onVendorOpen}
              vendorSpeaking={speakingVendorId === pavilion.id}
              figure={figureFor(pavilion.id)}
            />
          );
        })}
      </Suspense>

      {/* Staff. Placed from the arrival point rather than from a coordinate
          typed into the source, so it stays right if the spawn moves. */}
      <Concierge placement={concierge} onOpen={onConciergeOpen} />

      {foodStand && stand ? (
        <FoodStand entry={foodStand} placement={stand} onOpen={onFoodOpen} />
      ) : null}

      {/* The quest's eyes. Placed here rather than in the page because the
          camera lives inside the canvas, and everything it measures is a
          distance from it. */}
      <QuestSensors
        anchors={manifest.anchors}
        pavilionIds={world.pavilions.map((pavilion) => pavilion.id)}
        landmarks={landmarks}
        onWalked={onWalked}
        onNearFrontage={onNearFrontage}
        onLandmark={onLandmark}
      />

      <Sun quality={quality} intensity={light.sun} />
      {/* A little sky bounce into the shaded side of the street. The HDRI does
          most of it; this keeps the north-facing walls from going flat. */}
      <hemisphereLight args={['#cfe0f5', '#6d6455', light.hemisphere]} />

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
