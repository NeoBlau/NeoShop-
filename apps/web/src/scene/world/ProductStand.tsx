import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import { Html, Text } from '@react-three/drei';
import {
  AnimationMixer,
  Box3,
  LoopOnce,
  LoopRepeat,
  Mesh,
  MeshStandardMaterial,
  Vector3,
  type AnimationAction,
  type Group,
  type Object3D,
  type WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import type { WorldProduct } from '@3dsfera/shared';
import { useWorldMaterial } from './materials.js';
import { SCENE_FONT } from './fonts.js';
import type { QualitySettings } from '../quality.js';

/**
 * One product on its plinth.
 *
 * Three things keep a hall of these affordable: the model is not fetched until
 * the buyer is close enough to see it, the level of detail follows distance,
 * and the plinth material is shared with every other stand in the world.
 */

const DRACO_DECODER_PATH = '/draco/';
const BASIS_TRANSCODER_PATH = '/basis/';

/** Metres. Beyond this the model is not loaded at all. */
const LOAD_DISTANCE = 22;
/** Hysteresis, so a buyer standing on the boundary does not thrash the loader. */
const UNLOAD_DISTANCE = 28;

const LOD_DISTANCES = [6, 13] as const;

function extendLoader(loader: GLTFLoader, renderer: WebGLRenderer): void {
  loader.setDRACOLoader(new DRACOLoader().setDecoderPath(DRACO_DECODER_PATH));
  loader.setKTX2Loader(
    new KTX2Loader().setTranscoderPath(BASIS_TRANSCODER_PATH).detectSupport(renderer),
  );
}

/** Picks the detail level for a distance, floored by the quality tier. */
export function lodForDistance(distance: number, minimumLevel: number, levels: number): number {
  const byDistance = LOD_DISTANCES.findIndex((threshold) => distance < threshold);
  const wanted = byDistance === -1 ? LOD_DISTANCES.length : byDistance;
  return Math.min(levels - 1, Math.max(minimumLevel, wanted));
}

interface ProductModelProps {
  url: string;
  activeClip: string | null;
  loop: boolean;
  castShadows: boolean;
  onSized: (size: { height: number; radius: number }) => void;
}

function ProductModel({ url, activeClip, loop, castShadows, onSized }: ProductModelProps) {
  const renderer = useThree((state) => state.gl);
  const gltf = useLoader(GLTFLoader, url, (loader) => {
    extendLoader(loader, renderer);
  });

  const mixer = useMemo(() => new AnimationMixer(gltf.scene as unknown as Object3D), [gltf.scene]);
  const actionRef = useRef<AnimationAction | null>(null);

  // Measured after mount, not during render: reporting up while React is
  // rendering the parent is exactly the "setState during render" warning, and
  // in a scene it shows up as a frame of wrong layout.
  useEffect(() => {
    const size = new Box3().setFromObject(gltf.scene).getSize(new Vector3());
    onSized({ height: size.y, radius: Math.max(size.x, size.z) / 2 });
  }, [gltf.scene, onSized]);

  useEffect(() => {
    gltf.scene.traverse((object: Object3D) => {
      if (object instanceof Mesh) {
        object.castShadow = castShadows;
        object.receiveShadow = castShadows;
        if (object.material instanceof MeshStandardMaterial) {
          object.material.envMapIntensity = 1.1;
        }
      }
    });
  }, [gltf.scene, castShadows]);

  useEffect(() => {
    actionRef.current?.stop();
    actionRef.current = null;
    if (!activeClip) return;

    const clip = gltf.animations.find((candidate) => candidate.name === activeClip);
    if (!clip) return;

    const action = mixer.clipAction(clip);
    action.setLoop(loop ? LoopRepeat : LoopOnce, loop ? Infinity : 1);
    action.clampWhenFinished = !loop;
    action.reset().play();
    actionRef.current = action;
  }, [activeClip, gltf.animations, loop, mixer]);

  useFrame((_state, delta) => mixer.update(delta));

  return <primitive object={gltf.scene} />;
}

export interface ProductStandProps {
  product: WorldProduct;
  position: [number, number, number];
  quality: QualitySettings;
  selected: boolean;
  activeClip: string | null;
  loop: boolean;
  onSelect: (product: WorldProduct) => void;
  formatPrice: (cents: number, currency: string) => string;
}

const PLINTH_HEIGHT = 0.85;
/** Bounds for the plinth radius, in metres. */
const PLINTH_MIN_RADIUS = 0.34;
const PLINTH_MAX_RADIUS = 0.75;
/** How much plinth shows around the product. */
const PLINTH_MARGIN = 0.16;

export function ProductStand({
  product,
  position,
  quality,
  selected,
  activeClip,
  loop,
  onSelect,
  formatPrice,
}: ProductStandProps) {
  const group = useRef<Group>(null);
  const [visible, setVisible] = useState(false);
  const [level, setLevel] = useState(quality.startLodLevel);
  const [hovered, setHovered] = useState(false);
  const [modelSize, setModelSize] = useState({ height: 0.6, radius: 0.3 });
  // Stable identity: the model reports its bounds through this, and a new
  // function each render would re-measure on every frame.
  const handleSized = useCallback(
    (size: { height: number; radius: number }) => setModelSize(size),
    [],
  );

  // The plinth follows the product. A fixed one leaves a drone marooned in the
  // middle of a metre of marble and a chair hanging over the edge of it.
  const plinthRadius = Math.min(
    PLINTH_MAX_RADIUS,
    Math.max(PLINTH_MIN_RADIUS, modelSize.radius + PLINTH_MARGIN),
  );
  const modelHeight = modelSize.height;

  const marble = useWorldMaterial('plinth', [2, 1], quality.anisotropy);

  // Distance work runs on the render loop rather than in React state on every
  // frame: only crossing a threshold causes a re-render.
  useFrame((state) => {
    const node = group.current;
    if (!node) return;

    const distance = state.camera.position.distanceTo(node.position);

    if (!visible && distance < LOAD_DISTANCE) setVisible(true);
    else if (visible && distance > UNLOAD_DISTANCE) setVisible(false);

    const wanted = lodForDistance(distance, quality.startLodLevel, product.levels.length);
    if (wanted !== level) setLevel(wanted);
  });

  const url = product.levels[Math.min(level, product.levels.length - 1)]?.url;
  const highlight = hovered || selected;

  return (
    <group ref={group} position={position}>
      {/* Plinth */}
      <mesh position={[0, PLINTH_HEIGHT / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[plinthRadius, plinthRadius + 0.03, PLINTH_HEIGHT, 32]} />
        <meshStandardMaterial
          map={marble.map}
          normalMap={marble.normalMap}
          roughnessMap={marble.ormMap}
          aoMap={marble.ormMap}
          roughness={0.35}
          metalness={0.02}
          envMapIntensity={0.9}
        />
      </mesh>

      {/* Hit target. A single invisible cylinder is a far cheaper raycast than
          the product's own geometry, and it keeps the cursor from flickering
          between a model's separate parts. */}
      <mesh
        position={[0, PLINTH_HEIGHT + modelHeight / 2, 0]}
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
          onSelect(product);
        }}
      >
        <cylinderGeometry args={[plinthRadius, plinthRadius, Math.max(modelHeight, 0.5), 12]} />
      </mesh>

      {/* Accent ring inlaid in the plinth top, brighter while hovered.
          It is a decal on a surface, so it needs both the offset and the
          polygon bias: two millimetres of separation is not enough at twenty
          metres, and the depth buffer resolves it as stripes across the hall. */}
      <mesh position={[0, PLINTH_HEIGHT + 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[plinthRadius - 0.055, plinthRadius - 0.02, 48]} />
        <meshStandardMaterial
          color={highlight ? '#e5b25a' : '#6c7178'}
          emissive={highlight ? '#e5b25a' : '#2a2e35'}
          emissiveIntensity={highlight ? 2.2 : 0.4}
          toneMapped={false}
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>

      {/* Product spotlight: what makes a plinth read as a display rather than
          a pedestal. Only the top tiers pay for the shadow. */}
      <spotLight
        position={[0, 3.4, 0.6]}
        target-position={[0, PLINTH_HEIGHT, 0]}
        angle={0.5}
        // A wide penumbra and a falloff that reaches the floor: a hard-edged
        // pool of light reads as a bug, not as a display.
        penumbra={0.95}
        intensity={highlight ? 26 : 17}
        decay={1.6}
        distance={11}
        color="#fff6ea"
        castShadow={quality.shadows !== false && quality.tier !== 'medium'}
        shadow-mapSize-width={quality.shadows ? quality.shadows.mapSize : 512}
        shadow-mapSize-height={quality.shadows ? quality.shadows.mapSize : 512}
        // The shadow camera is fitted to the plinth. Left at the default
        // 0.5–500 range, a 512-pixel map spreads its precision over half a
        // kilometre and the product sits in a puddle of striped acne.
        shadow-camera-near={1.5}
        shadow-camera-far={6}
        shadow-bias={-0.0008}
        shadow-normalBias={0.02}
      />

      {visible && url ? (
        <Suspense fallback={null}>
          <group position={[0, PLINTH_HEIGHT, 0]}>
            <ProductModel
              url={url}
              activeClip={selected ? activeClip : null}
              loop={loop}
              castShadows={quality.shadows !== false}
              onSized={handleSized}
            />
          </group>
        </Suspense>
      ) : null}

      {/* Label. Rendered as 3D text rather than an HTML overlay: it belongs to
          the hall, is occluded correctly, and costs nothing per frame. */}
      <group position={[0, PLINTH_HEIGHT - 0.22, plinthRadius + 0.025]}>
        <Text
          font={SCENE_FONT}
          fontSize={0.085}
          maxWidth={1.1}
          anchorX="center"
          anchorY="middle"
          textAlign="center"
          color={highlight ? '#f0e6d6' : '#b9bcc2'}
        >
          {product.title}
        </Text>
        <Text
          font={SCENE_FONT}
          position={[0, -0.14, 0]}
          fontSize={0.075}
          anchorX="center"
          color="#d8a244"
        >
          {formatPrice(product.priceCents, product.currency)}
        </Text>
      </group>

      {/* The one HTML element per stand, and only while hovered: a hint that
          the product does something. */}
      {hovered && !selected ? (
        <Html position={[0, PLINTH_HEIGHT + modelHeight + 0.35, 0]} center distanceFactor={8}>
          <div className="bg-void/85 border-edge text-ink pointer-events-none rounded-md border px-2 py-1 text-[11px] whitespace-nowrap backdrop-blur">
            {product.interactions.length > 0 ? '▶' : ''} {product.title}
          </div>
        </Html>
      ) : null}
    </group>
  );
}
