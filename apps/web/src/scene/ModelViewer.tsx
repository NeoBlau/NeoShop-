import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bounds, Environment, Grid, Lightformer, OrbitControls, useGLTF } from '@react-three/drei';
import {
  AnimationMixer,
  LoopOnce,
  LoopRepeat,
  type AnimationAction,
  type Group,
  type Object3D,
} from 'three';
import { useTranslation } from 'react-i18next';

/**
 * The viewer the supplier sees in the cabinet and the buyer sees in the world.
 * One component, one code path: what is previewed here is what ships.
 *
 * Stage 3 wraps this in the pavilion scene; the loading, animation and camera
 * behaviour is already the final one.
 */

export type ViewerBackground = 'studio' | 'dark' | 'light';

/**
 * Backgrounds are described by colours only. `Environment preset=...` from drei
 * downloads an HDRI from a public CDN at runtime, which would make the viewer
 * depend on the open internet and would be blocked outright by the desktop
 * shell's content security policy. The reflections below are built in the
 * scene instead; stage 3 can add a self-hosted HDRI file, never a remote one.
 */
const BACKGROUNDS: Record<ViewerBackground, { clear: string; grid: string; envIntensity: number }> =
  {
    studio: { clear: '#131519', grid: '#2a2e35', envIntensity: 0.8 },
    dark: { clear: '#08090b', grid: '#1d2026', envIntensity: 0.45 },
    light: { clear: '#e8e6e1', grid: '#c7c3bb', envIntensity: 1.15 },
  };

/** Softbox rig standing in for an HDRI: three panels and a floor bounce. */
function StudioEnvironment({ intensity }: { intensity: number }) {
  return (
    <Environment resolution={256}>
      <Lightformer
        form="rect"
        intensity={intensity * 2.2}
        position={[0, 3.5, 2]}
        rotation={[-Math.PI / 2.4, 0, 0]}
        scale={[6, 4, 1]}
      />
      <Lightformer
        form="rect"
        intensity={intensity * 1.1}
        position={[-3, 1.5, -1]}
        rotation={[0, Math.PI / 2.6, 0]}
        scale={[4, 3, 1]}
      />
      <Lightformer
        form="rect"
        intensity={intensity * 0.8}
        position={[3, 1, -2]}
        rotation={[0, -Math.PI / 2.6, 0]}
        scale={[4, 3, 1]}
      />
      <Lightformer
        form="circle"
        intensity={intensity * 0.5}
        position={[0, -2, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={6}
      />
    </Environment>
  );
}

interface ModelProps {
  url: string;
  /** Clip to play, or null to hold the rest pose. */
  activeClip: string | null;
  loop: boolean;
  onClips: (names: string[]) => void;
}

/**
 * Decoder location. Served from our own origin by scripts/copy-decoders.mjs —
 * drei would otherwise fetch it from gstatic.com, which fails offline and is
 * refused by the desktop shell's CSP.
 */
const DRACO_DECODER_PATH = '/draco/';

function Model({ url, activeClip, loop, onClips }: ModelProps) {
  const gltf = useGLTF(url, DRACO_DECODER_PATH);
  const group = useRef<Group>(null);
  const mixer = useMemo(() => new AnimationMixer(gltf.scene as unknown as Object3D), [gltf.scene]);
  const actionRef = useRef<AnimationAction | null>(null);

  useEffect(() => {
    onClips(gltf.animations.map((clip) => clip.name));
  }, [gltf.animations, onClips]);

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

  return (
    <group ref={group}>
      <primitive object={gltf.scene} />
    </group>
  );
}

/** Hands the canvas element back so the wizard can grab a preview frame. */
function CanvasHandle({ onReady }: { onReady: (canvas: HTMLCanvasElement) => void }) {
  const gl = useThree((state) => state.gl);

  useEffect(() => {
    onReady(gl.domElement);
  }, [gl, onReady]);

  return null;
}

export interface ModelViewerProps {
  url: string;
  background?: ViewerBackground;
  activeClip?: string | null;
  loop?: boolean;
  onClipsLoaded?: (names: string[]) => void;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
  className?: string;
}

export function ModelViewer({
  url,
  background = 'studio',
  activeClip = null,
  loop = false,
  onClipsLoaded,
  onCanvasReady,
  className = '',
}: ModelViewerProps) {
  const { t } = useTranslation();
  const theme = BACKGROUNDS[background];
  const [failed, setFailed] = useState(false);

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
        camera={{ position: [1.6, 1.2, 2.2], fov: 45, near: 0.05, far: 100 }}
        dpr={[1, 2]}
        // Needed so the wizard can read a still frame out of the canvas.
        gl={{ preserveDrawingBuffer: true, antialias: true }}
        onCreated={({ gl }) => {
          gl.setClearColor(theme.clear);
        }}
        onError={() => setFailed(true)}
      >
        <color attach="background" args={[theme.clear]} />
        <ambientLight intensity={0.35} />
        <directionalLight position={[3, 5, 2]} intensity={1.4} castShadow />
        <directionalLight position={[-3, 2, -2]} intensity={0.4} />

        <Suspense fallback={null}>
          <Bounds fit clip observe margin={1.25}>
            <Model url={url} activeClip={activeClip} loop={loop} onClips={handleClips} />
          </Bounds>
          <StudioEnvironment intensity={theme.envIntensity} />
        </Suspense>

        <Grid
          args={[12, 12]}
          cellColor={theme.grid}
          sectionColor={theme.grid}
          fadeDistance={16}
          fadeStrength={1.5}
          position={[0, -0.001, 0]}
          infiniteGrid
        />

        <OrbitControls makeDefault enablePan minDistance={0.4} maxDistance={12} />
        {onCanvasReady ? <CanvasHandle onReady={onCanvasReady} /> : null}
      </Canvas>
    </div>
  );
}

/** Frees the GPU memory held by a model once the wizard moves on. */
export function disposeModel(url: string): void {
  useGLTF.clear(url);
}

/** Warms the cache for a model the buyer is about to walk up to. */
export function preloadModel(url: string): void {
  useGLTF.preload(url, DRACO_DECODER_PATH);
}
