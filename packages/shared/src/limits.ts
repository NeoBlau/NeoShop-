/**
 * Hard limits enforced on both sides. The client checks them to fail fast with
 * a useful message; the server re-checks every one of them because client-side
 * validation is a UX feature, not a security boundary.
 */

export const UPLOAD_LIMITS = {
  /** 50 MB, per the product brief. */
  modelMaxBytes: 50 * 1024 * 1024,
  imageMaxBytes: 8 * 1024 * 1024,
  /** Above this the model is accepted but the supplier is warned. */
  triangleWarn: 150_000,
  /** Above this the model is rejected outright. */
  triangleMax: 500_000,
  materialWarn: 12,
  materialMax: 40,
  modelExtensions: ['.glb', '.gltf'] as const,
  imageExtensions: ['.png', '.jpg', '.jpeg', '.webp'] as const,
} as const;

export const TEXT_LIMITS = {
  emailMax: 254,
  passwordMin: 10,
  passwordMax: 200,
  titleMin: 3,
  titleMax: 120,
  descriptionMax: 4000,
  companyNameMax: 160,
} as const;

export const PRICE_LIMITS = {
  minMinorUnits: 1,
  maxMinorUnits: 100_000_000,
} as const;

export const SHIPPING_LIMITS = {
  maxWeightGrams: 200_000,
  maxDimensionMm: 3000,
} as const;
