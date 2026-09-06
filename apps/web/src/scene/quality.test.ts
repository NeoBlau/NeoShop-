import { describe, expect, it } from 'vitest';
import {
  lowerTier,
  pickQualityTier,
  settingsFor,
  shouldDowngrade,
  type DeviceCapabilities,
} from './quality.js';

const desktop: DeviceCapabilities = {
  webgl2: true,
  cores: 8,
  memoryGb: 16,
  devicePixelRatio: 2,
  maxTextureSize: 16384,
  touch: false,
  renderer: 'ANGLE (Apple, Apple M2 Pro, OpenGL 4.1)',
  reducedMotion: false,
};

describe('pickQualityTier', () => {
  it('gives a workstation the top tier', () => {
    expect(pickQualityTier(desktop)).toBe('ultra');
  });

  it('refuses 3D outright when WebGL2 is missing', () => {
    expect(pickQualityTier({ ...desktop, webgl2: false })).toBe('low');
  });

  it('treats a software rasteriser as the weakest device, whatever it claims', () => {
    // SwiftShader reports plenty of cores and then renders at five frames a
    // second; believing it is how a headless test ends up at ultra.
    expect(pickQualityTier({ ...desktop, renderer: 'Google SwiftShader', cores: 16 })).toBe('low');
  });

  it('caps a phone at medium and an older phone at low', () => {
    const phone: DeviceCapabilities = {
      ...desktop,
      touch: true,
      renderer: 'Apple A15 GPU',
      cores: 6,
      maxTextureSize: 16384,
    };

    expect(pickQualityTier(phone)).toBe('medium');
    expect(pickQualityTier({ ...phone, cores: 4, maxTextureSize: 4096 })).toBe('low');
  });

  it('drops to low when the driver cannot hold a 4K texture', () => {
    expect(pickQualityTier({ ...desktop, maxTextureSize: 2048 })).toBe('low');
  });

  it('errs downwards for an unknown desktop GPU', () => {
    expect(pickQualityTier({ ...desktop, renderer: 'Mesa Intel(R) UHD Graphics' })).toBe('high');
    expect(pickQualityTier({ ...desktop, renderer: 'Mesa Intel(R) UHD Graphics', cores: 4 })).toBe(
      'medium',
    );
  });
});

describe('quality presets', () => {
  it('turns off shadows and post-processing at the lowest tier, as the brief requires', () => {
    const low = settingsFor('low');
    expect(low.shadows).toBe(false);
    expect(low.ambientOcclusion).toBe(false);
    expect(low.bloom).toBe(false);
    expect(low.antialiasing).toBe('none');
  });

  it('starts lower tiers on a coarser level of detail', () => {
    expect(settingsFor('ultra').startLodLevel).toBe(0);
    expect(settingsFor('low').startLodLevel).toBe(2);
  });
});

describe('lowerTier', () => {
  it('walks down one step and stops at the bottom', () => {
    expect(lowerTier('ultra')).toBe('high');
    expect(lowerTier('medium')).toBe('low');
    expect(lowerTier('low')).toBeNull();
  });
});

describe('shouldDowngrade', () => {
  it('ignores a short dip while a model streams in', () => {
    expect(
      shouldDowngrade(
        Array.from({ length: 20 }, () => 12),
        45,
      ),
    ).toBe(false);
  });

  it('downgrades when the frame rate stays below target', () => {
    expect(
      shouldDowngrade(
        Array.from({ length: 120 }, () => 28),
        45,
      ),
    ).toBe(true);
  });

  it('leaves a scene alone when it recovers', () => {
    const samples = [
      ...Array.from({ length: 60 }, () => 20),
      ...Array.from({ length: 90 }, () => 60),
    ];
    expect(shouldDowngrade(samples, 45)).toBe(false);
  });
});
