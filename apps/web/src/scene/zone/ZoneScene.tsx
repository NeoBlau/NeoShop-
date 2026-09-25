import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { AdaptiveDpr, Environment, PerformanceMonitor } from '@react-three/drei';
import {
  ACESFilmicToneMapping,
  AnimationMixer,
  Box3,
  LoopOnce,
  LoopRepeat,
  Mesh,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  Vector3,
  type AnimationAction,
  type DirectionalLight,
  type Object3D,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { WorldProduct } from '@3dsfera/shared';
import { lowerTier, settingsFor, type QualitySettings, type QualityTier } from '../quality.js';
import { extendGltfLoader } from '../loaders.js';
import { EYE_HEIGHT, PlayerControls } from '../world/PlayerControls.js';
import { groundAt } from '../world/navigation.js';
import type { ZoneData } from '../../features/zones/useZone.js';

/**
 * A demo zone: one room, one product, and whatever the mission asks it to do.
 *
 * Deliberately thinner than the street. There is no sun to follow, no shop
 * fronts to place and no level of detail to swap — a room is thirty metres
 * across at most, so it loads once and stays loaded. What it shares with the
 * street is the part that matters: the same walkable map and the same
 * movement, so a wall behaves the same way in both.
 */

export interface ZoneSceneProps {
  zone: ZoneData;
  product: WorldProduct;
  tier: QualityTier;
  onTierChange: (tier: QualityTier) => void;
  /** The clip the mission wants playing, or null for none. */
  activeClip: string | null;
  /** Called when that clip reaches its end, or cannot be found at all. */
  onClipEnd: (clip: string) => void;
  /** Metres from the product, reported as the buyer moves. */
  onDistance: (metres: number) => void;
  controlsEnabled: boolean;
}

const ROOM_HDRI = '/world/hdri/street.hdr';
/** Clips that are a running state rather than a one-off movement. */
const LOOPING = new Set(['clean_pattern', 'brushes_spin', 'rotors_spin', 'track_signal']);

function Room({ url }: { url: string }) {
  const renderer = useThree((state) => state.gl);
  const gltf = useLoader(GLTFLoader, url, (loader) => {
    extendGltfLoader(loader, renderer);
  });

  useEffect(() => {
    gltf.scene.traverse((object: Object3D) => {
      if (object instanceof Mesh) {
        // A room receives the product's shadow and casts none of its own: its
        // light is baked into its textures, and a second set of shadows over
        // baked ones reads as dirt.
        object.castShadow = false;
        object.receiveShadow = true;
      }
    });
  }, [gltf.scene]);

  return <primitive object={gltf.scene} />;
}

function Product({
  product,
  position,
  yaw,
  activeClip,
  onClipEnd,
  onDistance,
  castShadows,
}: {
  product: WorldProduct;
  position: [number, number, number];
  yaw: number;
  activeClip: string | null;
  onClipEnd: (clip: string) => void;
  onDistance: (metres: number) => void;
  castShadows: boolean;
}) {
  const renderer = useThree((state) => state.gl);
  const url = product.levels[0]?.url ?? '';
  const gltf = useLoader(GLTFLoader, url, (loader) => {
    extendGltfLoader(loader, renderer);
  });

  const mixer = useMemo(() => new AnimationMixer(gltf.scene as unknown as Object3D), [gltf.scene]);
  const action = useRef<AnimationAction | null>(null);
  const reported = useRef<string | null>(null);
  const probe = useRef(new Vector3());

  // Seated by measurement, not by trust: an uploaded model's origin is
  // wherever its author left it.
  const offset = useMemo(() => {
    const box = new Box3().setFromObject(gltf.scene);
    const centre = box.getCenter(new Vector3());
    return [-centre.x, -box.min.y, -centre.z] as [number, number, number];
  }, [gltf.scene]);

  useEffect(() => {
    gltf.scene.traverse((object: Object3D) => {
      if (object instanceof Mesh) {
        object.castShadow = castShadows;
        object.receiveShadow = castShadows;
        if (object.material instanceof MeshStandardMaterial) object.material.envMapIntensity = 1.1;
      }
    });
  }, [gltf.scene, castShadows]);

  useEffect(() => {
    action.current?.stop();
    action.current = null;
    reported.current = null;
    if (!activeClip) return;

    const clip = gltf.animations.find((candidate) => candidate.name === activeClip);
    if (!clip) {
      // A mission that names a clip the model does not carry would otherwise
      // wait for ever. Report it and let the script move on.
      reported.current = activeClip;
      onClipEnd(activeClip);
      return;
    }

    const loops = LOOPING.has(clip.name);
    const next = mixer.clipAction(clip);
    next.setLoop(loops ? LoopRepeat : LoopOnce, loops ? Infinity : 1);
    next.clampWhenFinished = !loops;
    next.reset().play();
    action.current = next;
  }, [activeClip, gltf.animations, mixer, onClipEnd]);

  useFrame((state, delta) => {
    mixer.update(delta);

    // One lap satisfies a step, even for a clip that loops for ever: a
    // cleaning run that circles the room is the product working.
    const current = action.current;
    if (current && activeClip && reported.current !== activeClip) {
      if (current.time >= current.getClip().duration - 0.05) {
        reported.current = activeClip;
        onClipEnd(activeClip);
      }
    }

    // Distance is polled here rather than pushed from the controls: the
    // mission asks whether the buyer is near the product, and the product is
    // what knows where it is. Horizontal only — standing on a mezzanine above
    // it is not standing next to it, but eye height is not the difference.
    probe.current.set(position[0], state.camera.position.y, position[2]);
    onDistance(state.camera.position.distanceTo(probe.current));
  });

  return (
    <group position={position} rotation={[0, yaw, 0]}>
      <group position={offset}>
        <primitive object={gltf.scene} />
      </group>
    </group>
  );
}

function Lights({ quality, at }: { quality: QualitySettings; at: [number, number, number] }) {
  const light = useRef<DirectionalLight>(null);
  const shadows = quality.shadows;

  return (
    <>
      {/* One light over the product rather than a sun over a city. The room's
          own lighting is baked in; this is here so the product has a shadow
          and does not float. */}
      <directionalLight
        ref={light}
        position={[at[0] + 3, at[1] + 5, at[2] + 3]}
        intensity={1.6}
        color="#fff4e6"
        castShadow={shadows !== false}
        shadow-mapSize-width={shadows ? shadows.mapSize : 1024}
        shadow-mapSize-height={shadows ? shadows.mapSize : 1024}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-camera-near={0.5}
        shadow-camera-far={30}
        shadow-bias={-0.0006}
      />
      <hemisphereLight args={['#cfe0f5', '#6d6455', 0.5]} />
    </>
  );
}

function Scene({
  zone,
  product,
  tier,
  onTierChange,
  activeClip,
  onClipEnd,
  onDistance,
  controlsEnabled,
}: ZoneSceneProps) {
  const quality = settingsFor(tier);
  const renderer = useThree((state) => state.gl);
  const { manifest, grid, modelUrl } = zone;

  useEffect(() => {
    renderer.toneMappingExposure = 1;
  }, [renderer]);

  return (
    <>
      <Suspense fallback={null}>
        {/* Lighting only, no backdrop: a room has walls, and a photographed
            sky behind them shows through every window as a seam. */}
        <Environment files={ROOM_HDRI} environmentIntensity={0.55} />

        <Room url={modelUrl} />

        <Product
          product={product}
          position={manifest.stage.position}
          yaw={manifest.stage.yaw}
          activeClip={activeClip}
          onClipEnd={onClipEnd}
          onDistance={onDistance}
          castShadows={quality.shadows !== false}
        />
      </Suspense>

      <Lights quality={quality} at={manifest.stage.position} />

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

      <AdaptiveDpr pixelated={false} />
      <PerformanceMonitor
        onDecline={() => {
          const next = lowerTier(tier);
          if (next) onTierChange(next);
        }}
      />
    </>
  );
}

export function ZoneScene(props: ZoneSceneProps) {
  const quality = settingsFor(props.tier);
  const { manifest, grid } = props.zone;

  return (
    <Canvas
      camera={{
        position: [
          manifest.spawn.position[0],
          groundAt(grid, manifest.spawn.position[0], manifest.spawn.position[2]) + EYE_HEIGHT,
          manifest.spawn.position[2],
        ],
        fov: 62,
        near: 0.1,
        far: 200,
      }}
      dpr={[1, quality.maxPixelRatio]}
      shadows={quality.shadows ? (quality.shadows.soft ? 'soft' : true) : false}
      gl={{ antialias: quality.antialiasing === 'msaa', powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMapping = ACESFilmicToneMapping;
        if (quality.shadows) gl.shadowMap.type = PCFSoftShadowMap;
      }}
    >
      <Scene {...props} />
    </Canvas>
  );
}
