import {
  UPLOAD_LIMITS,
  inspectModel,
  productCardSchema,
  validateModel,
  GlbParseError,
  type AnimationClipInfo,
  type InteractionInput,
  type ModelInspection,
  type ModelVerdict,
  type ProductDetail,
} from '@3dsfera/shared';

/**
 * Wizard logic, with no React in sight. Which step the supplier may leave,
 * what a file looks like before it is uploaded, and what a sensible default
 * set of interactions is — all decidable from plain values, so all testable.
 */

export const WIZARD_STEPS = [
  'model',
  'processing',
  'preview',
  'interactions',
  'card',
  'submit',
] as const;

export type WizardStep = (typeof WIZARD_STEPS)[number];

export function stepIndex(step: WizardStep): number {
  return WIZARD_STEPS.indexOf(step);
}

export interface FileCheck {
  ok: boolean;
  /** Dictionary key describing why the file was rejected outright. */
  errorCode: string | null;
  inspection: ModelInspection | null;
  verdict: ModelVerdict | null;
}

/**
 * Reads the file in the browser and applies the published budget, so the
 * supplier hears about a broken export before spending a minute uploading it.
 * The server repeats every one of these checks on the bytes it receives.
 */
export async function checkModelFile(file: File): Promise<FileCheck> {
  if (file.size > UPLOAD_LIMITS.modelMaxBytes) {
    return { ok: false, errorCode: 'model_too_large', inspection: null, verdict: null };
  }

  let inspection: ModelInspection;
  try {
    inspection = inspectModel(new Uint8Array(await file.arrayBuffer()));
  } catch (error) {
    return {
      ok: false,
      errorCode: error instanceof GlbParseError ? error.code : 'not_a_model',
      inspection: null,
      verdict: null,
    };
  }

  const verdict = validateModel(inspection);
  return {
    ok: verdict.errors.length === 0,
    errorCode: verdict.errors[0]?.code ?? null,
    inspection,
    verdict,
  };
}

/**
 * Suggested Russian and English captions for clip names that follow the naming
 * convention in the supplier guide. A supplier who named their clips well gets
 * the buttons filled in; everyone else edits two fields.
 */
const CLIP_LABELS: Record<string, { ru: string; en: string }> = {
  deploy: { ru: 'Развернуть', en: 'Deploy' },
  fold: { ru: 'Сложить', en: 'Fold' },
  open: { ru: 'Открыть', en: 'Open' },
  open_lid: { ru: 'Открыть крышку', en: 'Open the lid' },
  close: { ru: 'Закрыть', en: 'Close' },
  recline: { ru: 'Разложить', en: 'Recline' },
  footrest_up: { ru: 'Поднять подножку', en: 'Raise the footrest' },
  sit_upright: { ru: 'Вернуть в исходное', en: 'Sit upright' },
  clean_pattern: { ru: 'Запустить уборку', en: 'Start cleaning' },
  undock: { ru: 'Съехать с базы', en: 'Leave the dock' },
  track_signal: { ru: 'Поймать сигнал', en: 'Track the signal' },
  takeoff: { ru: 'Взлететь', en: 'Take off' },
  rotors_spin: { ru: 'Раскрутить винты', en: 'Spin the rotors' },
  camera_scan: { ru: 'Осмотреть', en: 'Scan around' },
  fold_open: { ru: 'Разложить', en: 'Unfold' },
  head_tilt: { ru: 'Наклонить плафон', en: 'Tilt the head' },
};

function humanize(clipName: string): string {
  return clipName
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
    .trim();
}

export function suggestInteractions(clips: AnimationClipInfo[]): InteractionInput[] {
  return clips.map((clip, index) => {
    const known = CLIP_LABELS[clip.name.toLowerCase()];
    return {
      type: 'GLTF_ANIMATION',
      clipName: clip.name,
      label: known?.ru ?? humanize(clip.name),
      ...(known ? { labelEn: known.en } : {}),
      order: index,
      // Continuous motion (spinning rotors, a cleaning pass) reads better on a
      // loop; a one-shot mechanism should stop where it lands.
      loop: /spin|rotate|loop|clean/i.test(clip.name),
    };
  });
}

/** Fallback set for models that ship without any animation at all. */
export function presetInteractions(): InteractionInput[] {
  return [
    {
      type: 'PRESET_SPIN',
      label: 'Осмотреть со всех сторон',
      labelEn: 'Turn around',
      order: 0,
      loop: true,
      config: { axis: 'y', speed: 0.35 },
    },
    {
      type: 'PRESET_EXPLODE',
      label: 'Разобрать на части',
      labelEn: 'Take apart',
      order: 1,
      loop: false,
      config: { distance: 0.35 },
    },
    {
      type: 'PRESET_HIGHLIGHT',
      label: 'Подсветить узлы',
      labelEn: 'Highlight the parts',
      order: 2,
      loop: false,
      config: { color: '#d8a244' },
    },
  ];
}

export interface StepAvailability {
  /** True when the supplier may move on from this step. */
  canAdvance: boolean;
  /** Dictionary key explaining what is missing. */
  blockedBy: string | null;
}

export function evaluateStep(step: WizardStep, product: ProductDetail | null): StepAvailability {
  if (!product) return { canAdvance: false, blockedBy: 'wizard.blockedNoProduct' };

  switch (step) {
    case 'model':
      return product.assets.some((asset) => asset.kind === 'GLB_ORIGINAL')
        ? { canAdvance: true, blockedBy: null }
        : { canAdvance: false, blockedBy: 'wizard.blockedNoModel' };

    case 'processing':
      if (product.job?.status === 'READY') return { canAdvance: true, blockedBy: null };
      if (product.job?.status === 'FAILED') {
        return { canAdvance: false, blockedBy: 'wizard.blockedProcessingFailed' };
      }
      return { canAdvance: false, blockedBy: 'wizard.blockedProcessing' };

    case 'preview':
      return { canAdvance: true, blockedBy: null };

    case 'interactions':
      // A model with clips and no buttons is the single most common way to
      // publish a product that looks dead in the world.
      return product.availableClips.length > 0 && product.interactions.length === 0
        ? { canAdvance: false, blockedBy: 'wizard.blockedNoInteractions' }
        : { canAdvance: true, blockedBy: null };

    case 'card': {
      const result = productCardSchema.safeParse({
        title: product.title,
        description: product.description,
        category: product.category,
        priceCents: product.priceCents,
        currency: product.currency,
        stock: product.stock,
        weightGrams: product.weightGrams,
        lengthMm: product.lengthMm,
        widthMm: product.widthMm,
        heightMm: product.heightMm,
      });
      return result.success
        ? { canAdvance: true, blockedBy: null }
        : { canAdvance: false, blockedBy: 'wizard.blockedCardIncomplete' };
    }

    case 'submit':
      return { canAdvance: product.status !== 'DRAFT', blockedBy: null };
  }
}

/** Formats a byte count the way the wizard shows it: "23.1 КБ", "4.2 МБ". */
export function formatBytes(bytes: number, locale: string): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = locale.startsWith('ru') ? ['КБ', 'МБ'] : ['KB', 'MB'];
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) return `${kilobytes.toFixed(1)} ${units[0]}`;
  return `${(kilobytes / 1024).toFixed(1)} ${units[1]}`;
}

/** Major-unit price string for an input field, from stored minor units. */
export function centsToInput(cents: number): string {
  return cents === 0 ? '' : (cents / 100).toFixed(2).replace(/\.00$/, '');
}

export function inputToCents(value: string): number {
  const parsed = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}
