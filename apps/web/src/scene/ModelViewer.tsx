import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import {
  Bounds,
  ContactShadows,
  Environment,
  Lightformer,
  OrbitControls,
  PerformanceMonitor,
  Stats,
} from '@react-three/drei';
import { Bloom, EffectComposer, SMAA, SSAO, ToneMapping } from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode } from 'postprocessing';
import {
  ACESFilmicToneMapping,
  AnimationMixer,
  LoopOnce,
  LoopRepeat,
  Mesh,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  type AnimationAction,
  type Object3D,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { useTranslation } from 'react-i18next';
import {
  detectCapabilities,
  lowerTier,
  pickQualityTier,
  settingsFor,
  type QualitySettings,
  type QualityTier,
} from './quality.js';

/**
 * The viewer the supplier previews in and the buyer walks up to. One component,
 * one code path: what is previewed here is what ships.
 *
 * Both decoders are served from our own origin. drei would fetch the Draco
 * decoder from gstatic and HDRIs from a public bucket by default, which fails
 * offline and is refused outright by the desktop shell's content security
 * policy — see scripts/copy-decoders.mjs.
 */
const DRACO_DECODER_PATH = '/draco/';
const BASIS_TRANSCODER_PATH = '/basis/';

export type ViewerBackground = 'studio' | 'dark' | 'light';

interface BackgroundTheme {
  clear: string;
  grid: string;
  /** Multiplies the whole lighting rig; a light room needs more of it. */
  envIntensity: number;
  /** ACES exposure. Lower for the dark theme so highlights keep their shape. */
  exposure: number;
  shadowOpacity: number;
}

const BACKGROUNDS: Record<ViewerBackground, BackgroundTheme> = {
  studio: {
    clear: '#131519',
    grid: '#2a2e35',
    envIntensity: 0.9,
    exposure: 1.15,
    shadowOpacity: 0.5,
  },
  dark: {
    clear: '#08090b',
    grid: '#1d2026',
    envIntensity: 0.5,
    exposure: 0.95,
    shadowOpacity: 0.65,
  },
  light: {
    clear: '#e9e7e2',
    grid: '#c7c3bb',
    envIntensity: 1.3,
    exposure: 1.0,
    shadowOpacity: 0.35,
  },
};

/**
 * A softbox rig standing in for an HDRI. Four emitters — key, two rims and a
 * floor bounce — give metals something to reflect, which is most of what makes
 * a physically based material look like a material rather than a coloured
 * shape.
 */
function StudioEnvironment({ intensity, resolution }: { intensity: number; resolution: number }) {
  return (
    <Environment resolution={resolution}>
      <Lightformer
        form="rect"
        intensity={intensity * 2.6}
        position={[0, 4, 2.5]}
        rotation={[-Math.PI / 2.3, 0, 0]}
        scale={[8, 5, 1]}
      />
      <Lightformer
        form="rect"
        intensity={intensity * 1.3}
        position={[-3.5, 1.8, -1]}
        rotation={[0, Math.PI / 2.4, 0]}
        scale={[5, 4, 1]}
      />
      <Lightformer
        form="rect"
        intensity={intensity * 0.9}
        position={[3.5, 1.2, -2]}
        rotation={[0, -Math.PI / 2.4, 0]}
        scale={[5, 4, 1]}
      />
      <Lightformer
        form="circle"
        intensity={intensity * 0.55}
        position={[0, -2.5, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={8}
      />
    </Environment>
  );
}

/** Builds a loader that reads Draco geometry and KTX2 textures from our origin. */
function extendLoader(loader: GLTFLoader, renderer: WebGLRenderer): void {
  const draco = new DRACOLoader().setDecoderPath(DRACO_DECODER_PATH);
  loader.setDRACOLoader(draco);

  const ktx2 = new KTX2Loader().setTranscoderPath(BASIS_TRANSCODER_PATH).detectSupport(renderer);
  loader.setKTX2Loader(ktx2);
}

interface ModelProps {
  url: string;
  activeClip: string | null;
  loop: boolean;
  settings: QualitySettings;
  onClips: (names: string[]) => void;
}

function Model({ url, activeClip, loop, settings, onClips }: ModelProps) {
  const renderer = useThree((state) => state.gl);
  const gltf = useLoader(GLTFLoader, url, (loader) => {
    extendLoader(loader, renderer);
  });

  const mixer = useMemo(() => new AnimationMixer(gltf.scene as unknown as Object3D), [gltf.scene]);
  const actionRef = useRef<AnimationAction | null>(null);

  useEffect(() => {
    onClips(gltf.animations.map((clip) => clip.name));
  }, [gltf.animations, onClips]);

  // Anisotropic filtering costs almost nothing and is the difference between a
  // crisp floor at a grazing angle and a smeared one. Shadow flags have to be
  // set per mesh; three does not inherit them.
  useEffect(() => {
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    const anisotropy = Math.min(settings.anisotropy, maxAnisotropy);

    gltf.scene.traverse((object: Object3D) => {
      if (!(object instanceof Mesh)) return;

      object.castShadow = settings.shadows !== false;
      object.receiveShadow = settings.shadows !== false;

      const material = object.material;
      if (material instanceof MeshStandardMaterial) {
        for (const map of [
          material.map,
          material.normalMap,
          material.roughnessMap,
          material.metalnessMap,
          material.aoMap,
        ] as (Texture | null)[]) {
          if (map && map.anisotropy !== anisotropy) {
            map.anisotropy = anisotropy;
            map.needsUpdate = true;
          }
        }
      }
    });
  }, [gltf.scene, renderer, settings.anisotropy, settings.shadows]);

  useEffect(() => {
    actionRef.current?.stop();
    actionRef.current = null;

    if (!activeClip) return;
    const clip = gltf.animations.find((candidate) => candidate.name === activeClip);
    if (!clip) return;

    const action = mixer.clipAction(clip);
    // Without clampWhenFinished a one-shot clip snaps back the moment it ends,
    // and the antenna the buyer just deployed folds itself again.
    action.setLoop(loop ? LoopRepeat : LoopOnce, loop ? Infinity : 1);
    action.clampWhenFinished = !loop;
    action.reset().play();
    actionRef.current = action;

    return () => {
      action.stop();
    };
  }, [activeClip, gltf.animations, loop, mixer]);

  useFrame((_state, delta) => {
    mixer.update(delta);
  });

  useEffect(
    () => () => {
      mixer.stopAllAction();
    },
    [mixer],
  );

  return <primitive object={gltf.scene} />;
}

/** Hands the canvas back so the wizard can grab a still frame for the catalogue. */
function CanvasHandle({ onReady }: { onReady: (canvas: HTMLCanvasElement) => void }) {
  const gl = useThree((state) => state.gl);

  useEffect(() => {
    onReady(gl.domElement);
  }, [gl, onReady]);

  return null;
}

function Effects({ settings }: { settings: QualitySettings }) {
  const enabled = settings.ambientOcclusion || settings.bloom || settings.antialiasing === 'smaa';

  if (!enabled) return null;

  return (
    <EffectComposer enableNormalPass={settings.ambientOcclusion} multisampling={0}>
      {settings.ambientOcclusion ? (
        <SSAO
          blendFunction={BlendFunction.MULTIPLY}
          samples={16}
          radius={0.06}
          intensity={18}
          luminanceInfluence={0.6}
          worldDistanceThreshold={2}
          worldDistanceFalloff={0.5}
          worldProximityThreshold={0.4}
          worldProximityFalloff={0.1}
        />
      ) : (
        <></>
      )}
      {settings.bloom ? (
        <Bloom intensity={0.35} luminanceThreshold={0.85} luminanceSmoothing={0.2} mipmapBlur />
      ) : (
        <></>
      )}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      {settings.antialiasing === 'smaa' ? <SMAA /> : <></>}
    </EffectComposer>
  );
}

export interface ModelViewerProps {
  url: string;
  background?: ViewerBackground;
  activeClip?: string | null;
  loop?: boolean;
  /** Overrides the automatic tier; the wizard uses it to preview quality. */
  quality?: QualityTier;
  onClipsLoaded?: (names: string[]) => void;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
  onQualityChange?: (tier: QualityTier) => void;
  className?: string;
}

export function ModelViewer({
  url,
  background = 'studio',
  activeClip = null,
  loop = false,
  quality,
  onClipsLoaded,
  onCanvasReady,
  onQualityChange,
  className = '',
}: ModelViewerProps) {
  const { t } = useTranslation();
  const theme = BACKGROUNDS[background];
  const [failed, setFailed] = useState(false);

  // Detected once: probing WebGL allocates a context, and doing it on every
  // render would exhaust the browser's context budget.
  const [tier, setTier] = useState<QualityTier>(
    () => quality ?? pickQualityTier(detectCapabilities()),
  );

  useEffect(() => {
    if (quality) setTier(quality);
  }, [quality]);

  useEffect(() => {
    onQualityChange?.(tier);
  }, [tier, onQualityChange]);

  const settings = settingsFor(tier);

  const handleClips = useMemo(() => (names: string[]) => onClipsLoaded?.(names), [onClipsLoaded]);

  if (failed) {
    return (
      <div
        className={`panel text-ink-muted flex items-center justify-center p-6 text-sm ${className}`}
      >
        {t('wizard.viewerFailed')}
      </div>
    );
  }

  return (
    <div
      className={`bg-panel border-edge overflow-hidden rounded-[var(--radius-panel)] border ${className}`}
    >
      <Canvas
        camera={{ position: [1.6, 1.2, 2.2], fov: 40, near: 0.05, far: 100 }}
        dpr={[1, settings.maxPixelRatio]}
        shadows={settings.shadows ? (settings.shadows.soft ? 'soft' : true) : false}
        gl={{
          // The wizard reads a still frame out of this canvas for the catalogue.
          preserveDrawingBuffer: true,
          antialias: settings.antialiasing === 'msaa',
          powerPreference: 'high-performance',
        }}
        onCreated={({ gl }) => {
          gl.setClearColor(theme.clear);
          gl.toneMapping = ACESFilmicToneMapping;
          gl.toneMappingExposure = theme.exposure;
          if (settings.shadows) {
            gl.shadowMap.enabled = true;
            gl.shadowMap.type = PCFSoftShadowMap;
          }
        }}
        onError={() => setFailed(true)}
      >
        <color attach="background" args={[theme.clear]} />

        <ambientLight intensity={0.22} />
        <directionalLight
          position={[3.5, 6, 3]}
          intensity={2.1}
          castShadow={settings.shadows !== false}
          shadow-mapSize-width={settings.shadows ? settings.shadows.mapSize : 512}
          shadow-mapSize-height={settings.shadows ? settings.shadows.mapSize : 512}
          shadow-camera-near={0.5}
          shadow-camera-far={20}
          shadow-camera-left={-3}
          shadow-camera-right={3}
          shadow-camera-top={3}
          shadow-camera-bottom={-3}
          shadow-bias={-0.0008}
          shadow-normalBias={0.02}
        />

        <Suspense fallback={null}>
          <Bounds fit clip observe margin={1.3}>
            <Model
              url={url}
              activeClip={activeClip}
              loop={loop}
              settings={settings}
              onClips={handleClips}
            />
          </Bounds>
          <StudioEnvironment
            intensity={theme.envIntensity}
            resolution={settings.environmentResolution}
          />
        </Suspense>

        {settings.shadows ? (
          <ContactShadows
            position={[0, -0.0005, 0]}
            opacity={theme.shadowOpacity}
            scale={8}
            blur={2.4}
            far={4}
            resolution={settings.shadows.mapSize}
            color="#000000"
          />
        ) : null}

        <OrbitControls makeDefault enablePan minDistance={0.3} maxDistance={14} />

        <Effects settings={settings} />

        {/* A scene that cannot hold its frame rate drops a tier rather than
            stuttering. Only downwards: oscillating between tiers looks worse
            than staying at the lower one. */}
        <PerformanceMonitor
          onDecline={() => {
            const next = lowerTier(tier);
            if (next && !quality) setTier(next);
          }}
        />

        {import.meta.env.DEV ? <Stats className="sfera-stats" /> : null}
        {onCanvasReady ? <CanvasHandle onReady={onCanvasReady} /> : null}
      </Canvas>
    </div>
  );
}

/** Frees the GPU memory held by a model once the wizard moves on. */
export function disposeModel(url: string): void {
  useLoader.clear(GLTFLoader, url);
}

/** Warms the cache for a model the buyer is about to walk up to. */
export function preloadModel(url: string): void {
  useLoader.preload(GLTFLoader, url, (loader: GLTFLoader) => {
    loader.setDRACOLoader(new DRACOLoader().setDecoderPath(DRACO_DECODER_PATH));
  });
}
