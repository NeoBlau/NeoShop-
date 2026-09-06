import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ProductDetail } from '@3dsfera/shared';
import {
  centsToInput,
  checkModelFile,
  evaluateStep,
  formatBytes,
  inputToCents,
  presetInteractions,
  stepIndex,
  suggestInteractions,
} from './wizard.js';

const ASSETS = path.resolve(process.cwd(), '../api/prisma/seed-assets');

function fileFrom(name: string): File {
  const bytes = readFileSync(path.join(ASSETS, name));
  return new File([new Uint8Array(bytes)], name, { type: 'model/gltf-binary' });
}

describe('checkModelFile', () => {
  it('accepts a real model and reports what is inside it', async () => {
    const result = await checkModelFile(fileFrom('robot-vacuum.glb'));

    expect(result.ok).toBe(true);
    expect(result.inspection?.animations.map((clip) => clip.name)).toEqual([
      'undock',
      'clean_pattern',
      'open_lid',
    ]);
  });

  it('rejects a file that is not a model, whatever it is called', async () => {
    const fake = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0])], 'chair.glb', {
      type: 'model/gltf-binary',
    });

    const result = await checkModelFile(fake);
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('not_a_model');
  });
});

describe('suggestInteractions', () => {
  it('translates well-named clips into captions in both languages', () => {
    const rows = suggestInteractions([
      { index: 0, name: 'deploy', duration: 2.6, channels: 2 },
      { index: 1, name: 'track_signal', duration: 6, channels: 1 },
    ]);

    expect(rows[0]?.label).toBe('Развернуть');
    expect(rows[0]?.labelEn).toBe('Deploy');
    expect(rows[1]?.clipName).toBe('track_signal');
  });

  it('humanizes a clip name it does not recognise instead of leaving it raw', () => {
    const [row] = suggestInteractions([
      { index: 0, name: 'extend_left_arm', duration: 1, channels: 1 },
    ]);

    expect(row?.label).toBe('Extend Left Arm');
    expect(row?.labelEn).toBeUndefined();
  });

  it('loops continuous motion and plays one-shot mechanisms once', () => {
    const rows = suggestInteractions([
      { index: 0, name: 'rotors_spin', duration: 2, channels: 4 },
      { index: 1, name: 'deploy', duration: 2, channels: 1 },
    ]);

    expect(rows[0]?.loop).toBe(true);
    expect(rows[1]?.loop).toBe(false);
  });
});

describe('presetInteractions', () => {
  it('offers behaviours that need no clip in the model', () => {
    const presets = presetInteractions();
    expect(presets.map((preset) => preset.type)).toEqual([
      'PRESET_SPIN',
      'PRESET_EXPLODE',
      'PRESET_HIGHLIGHT',
    ]);
    expect(presets.every((preset) => preset.clipName === undefined)).toBe(true);
  });
});

const baseProduct: ProductDetail = {
  id: 'p1',
  slug: 'p1',
  title: 'Антенна',
  category: 'ELECTRONICS',
  status: 'DRAFT',
  priceCents: 0,
  currency: 'RUB',
  stock: 0,
  viewCount: 0,
  orderCount: 0,
  updatedAt: '2026-01-01T00:00:00.000Z',
  previewUrl: null,
  hasModel: false,
  interactionCount: 0,
  modelStatus: null,
  description: '',
  weightGrams: 0,
  lengthMm: 0,
  widthMm: 0,
  heightMm: 0,
  rejectionReason: null,
  submittedAt: null,
  publishedAt: null,
  assets: [],
  interactions: [],
  job: null,
  availableClips: [],
};

describe('evaluateStep', () => {
  it('holds the supplier on the upload step until a model exists', () => {
    expect(evaluateStep('model', baseProduct)).toEqual({
      canAdvance: false,
      blockedBy: 'wizard.blockedNoModel',
    });
  });

  it('waits for the pipeline before letting the preview open', () => {
    const uploading: ProductDetail = {
      ...baseProduct,
      assets: [
        {
          id: 'a1',
          kind: 'GLB_ORIGINAL',
          url: 'https://example.test/a.glb',
          byteSize: 1,
          contentType: 'model/gltf-binary',
          lodLevel: null,
        },
      ],
      job: {
        id: 'j1',
        status: 'RUNNING',
        errorCode: null,
        stats: null,
        attempts: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
        finishedAt: null,
      },
    };

    expect(evaluateStep('model', uploading).canAdvance).toBe(true);
    expect(evaluateStep('processing', uploading).blockedBy).toBe('wizard.blockedProcessing');
  });

  it('refuses to move on when a model has clips but no buttons wired up', () => {
    const withClips: ProductDetail = {
      ...baseProduct,
      availableClips: [{ index: 0, name: 'deploy', duration: 2, channels: 1 }],
    };

    expect(evaluateStep('interactions', withClips)).toEqual({
      canAdvance: false,
      blockedBy: 'wizard.blockedNoInteractions',
    });
  });

  it('lets a model without any clips through the interaction step', () => {
    expect(evaluateStep('interactions', baseProduct).canAdvance).toBe(true);
  });

  it('blocks an incomplete card and passes a complete one', () => {
    expect(evaluateStep('card', baseProduct).blockedBy).toBe('wizard.blockedCardIncomplete');

    const complete: ProductDetail = {
      ...baseProduct,
      description: 'Офсетная антенна 120 см с автонаведением на спутник.',
      priceCents: 1_899_000,
      stock: 10,
      weightGrams: 9_400,
      lengthMm: 1_250,
      widthMm: 700,
      heightMm: 340,
    };

    expect(evaluateStep('card', complete).canAdvance).toBe(true);
  });
});

describe('formatting helpers', () => {
  it('orders the steps the way the wizard walks them', () => {
    expect(stepIndex('model')).toBe(0);
    expect(stepIndex('submit')).toBe(5);
  });

  it('formats bytes in the reader language', () => {
    expect(formatBytes(900, 'ru')).toBe('900 B');
    expect(formatBytes(23_636, 'ru')).toBe('23.1 КБ');
    expect(formatBytes(23_636, 'en')).toBe('23.1 KB');
    expect(formatBytes(5 * 1024 * 1024, 'en')).toBe('5.0 MB');
  });

  it('round-trips a price between minor units and the input field', () => {
    expect(centsToInput(1_899_000)).toBe('18990');
    expect(centsToInput(0)).toBe('');
    expect(inputToCents('18990')).toBe(1_899_000);
    expect(inputToCents('129,90')).toBe(12_990);
    expect(inputToCents('nonsense')).toBe(0);
  });
});
