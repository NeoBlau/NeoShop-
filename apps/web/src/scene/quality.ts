/**
 * Quality tiers.
 *
 * One scene, four budgets. The tier decides what the renderer is allowed to
 * spend — texture resolution, shadow quality, post-processing, pixel ratio —
 * so the same pavilion runs on a workstation and on a three-year-old phone
 * without two codebases. Below the lowest tier there is no 3D at all: the flat
 * catalogue takes over, and buying still works.
 *
 * The decision function is pure, so the thresholds are testable instead of
 * being folded into a component.
 */

export const QUALITY_TIERS = ['ultra', 'high', 'medium', 'low'] as const;
export type QualityTier = (typeof QUALITY_TIERS)[number];

export interface QualitySettings {
  tier: QualityTier;
  /** Upper bound on the device pixel ratio. Retina at 4K is a lot of pixels. */
  maxPixelRatio: number;
  /** Longest edge of a texture the scene will upload. */
  maxTextureSize: number;
  shadows: false | { mapSize: number; soft: boolean };
  /** Screen-space ambient occlusion: the cheapest big win in perceived depth. */
  ambientOcclusion: boolean;
  bloom: boolean;
  antialiasing: 'smaa' | 'msaa' | 'none';
  /** Cube map resolution for reflections. */
  environmentResolution: number;
  anisotropy: number;
  /** Which LOD the scene starts at; higher tiers begin at full detail. */
  startLodLevel: number;
  /** Maximum products loaded around the camera at once. */
  visibleProductBudget: number;
}

export const QUALITY_PRESETS: Record<QualityTier, QualitySettings> = {
  ultra: {
    tier: 'ultra',
    maxPixelRatio: 2,
    maxTextureSize: 4096,
    shadows: { mapSize: 2048, soft: true },
    ambientOcclusion: true,
    bloom: true,
    antialiasing: 'smaa',
    environmentResolution: 512,
    anisotropy: 16,
    startLodLevel: 0,
    visibleProductBudget: 24,
  },
  high: {
    tier: 'high',
    maxPixelRatio: 2,
    maxTextureSize: 4096,
    shadows: { mapSize: 1024, soft: true },
    ambientOcclusion: true,
    bloom: false,
    antialiasing: 'smaa',
    environmentResolution: 256,
    anisotropy: 8,
    startLodLevel: 0,
    visibleProductBudget: 16,
  },
  medium: {
    tier: 'medium',
    maxPixelRatio: 1.5,
    maxTextureSize: 2048,
    shadows: { mapSize: 512, soft: false },
    ambientOcclusion: false,
    bloom: false,
    antialiasing: 'smaa',
    environmentResolution: 128,
    anisotropy: 4,
    startLodLevel: 1,
    visibleProductBudget: 10,
  },
  low: {
    tier: 'low',
    maxPixelRatio: 1,
    maxTextureSize: 1024,
    // The brief is explicit: no shadows and no post-processing on mobile.
    shadows: false,
    ambientOcclusion: false,
    bloom: false,
    antialiasing: 'none',
    environmentResolution: 64,
    anisotropy: 1,
    startLodLevel: 2,
    visibleProductBudget: 6,
  },
};

export interface DeviceCapabilities {
  webgl2: boolean;
  /** Reported logical cores; 0 when the browser refuses to say. */
  cores: number;
  /** Reported memory in GB; 0 when unavailable (Safari never reports it). */
  memoryGb: number;
  devicePixelRatio: number;
  /** Longest texture edge the driver accepts. */
  maxTextureSize: number;
  touch: boolean;
  /** Unmasked renderer string when the browser exposes it. */
  renderer: string;
  /** True when the OS asks for reduced motion; we also spend less on effects. */
  reducedMotion: boolean;
}

const SOFTWARE_RENDERER = /swiftshader|llvmpipe|software|basic render/i;
const MOBILE_GPU = /adreno|mali|powervr|apple a\d/i;
const HIGH_END_GPU = /rtx|radeon rx|apple m[1-9]|arc a\d/i;

/**
 * Picks a tier from what the device admits to.
 *
 * Browsers lie or stay silent about hardware, so this errs low: a machine that
 * could have done better renders one tier down, which nobody notices, rather
 * than a phone stuttering at eight frames a second, which everybody does.
 */
export function pickQualityTier(capabilities: DeviceCapabilities): QualityTier {
  if (!capabilities.webgl2) return 'low';

  // Software rasterisers report plenty of cores and then render at 5 fps.
  if (SOFTWARE_RENDERER.test(capabilities.renderer)) return 'low';

  if (capabilities.maxTextureSize < 4096) return 'low';

  if (capabilities.touch || MOBILE_GPU.test(capabilities.renderer)) {
    // A recent phone handles the medium tier; anything older stays low.
    return capabilities.cores >= 6 && capabilities.maxTextureSize >= 8192 ? 'medium' : 'low';
  }

  if (HIGH_END_GPU.test(capabilities.renderer) && capabilities.cores >= 8) return 'ultra';

  if (capabilities.cores >= 8 && (capabilities.memoryGb === 0 || capabilities.memoryGb >= 8)) {
    return 'high';
  }

  if (capabilities.cores >= 4) return 'medium';

  return 'low';
}

export function settingsFor(tier: QualityTier): QualitySettings {
  return QUALITY_PRESETS[tier];
}

/** One step down, or null when already at the bottom. */
export function lowerTier(tier: QualityTier): QualityTier | null {
  const index = QUALITY_TIERS.indexOf(tier);
  return QUALITY_TIERS[index + 1] ?? null;
}

/**
 * Decides whether a running scene should drop a tier.
 *
 * Two conditions, both required: the average is below target, and it has been
 * for long enough that this is not one slow frame while a model streams in.
 */
export function shouldDowngrade(
  samples: number[],
  targetFps: number,
  minimumSamples = 90,
): boolean {
  if (samples.length < minimumSamples) return false;
  const recent = samples.slice(-minimumSamples);
  const average = recent.reduce((total, fps) => total + fps, 0) / recent.length;
  return average < targetFps;
}

/** Reads what the browser will tell us. Thin on purpose; the logic is above. */
export function detectCapabilities(): DeviceCapabilities {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2');

  let renderer = '';
  let maxTextureSize = 0;

  if (gl) {
    maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      renderer = String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) ?? '');
    }
    // Release the probe context immediately; browsers cap how many exist.
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }

  const navigatorWithMemory = navigator as Navigator & { deviceMemory?: number };

  return {
    webgl2: gl !== null,
    cores: navigator.hardwareConcurrency ?? 0,
    memoryGb: navigatorWithMemory.deviceMemory ?? 0,
    devicePixelRatio: window.devicePixelRatio || 1,
    maxTextureSize,
    touch: window.matchMedia('(pointer: coarse)').matches,
    renderer,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  };
}

/** True when the browser cannot run the 3D scene at all. */
export function webglUnavailable(capabilities: DeviceCapabilities): boolean {
  return !capabilities.webgl2 && !hasWebgl1();
}

function hasWebgl1(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl');
    if (context) {
      (context.getExtension('WEBGL_lose_context') as { loseContext(): void } | null)?.loseContext();
    }
    return context !== null;
  } catch {
    return false;
  }
}
