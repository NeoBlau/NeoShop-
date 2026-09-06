import { z } from 'zod';
import {
  CURRENCIES,
  INTERACTION_TYPES,
  MODERATION_STATUSES,
  PRODUCT_CATEGORIES,
} from '../domain.js';
import { PRICE_LIMITS, SHIPPING_LIMITS, TEXT_LIMITS } from '../limits.js';

export const productCardSchema = z.object({
  title: z.string().trim().min(TEXT_LIMITS.titleMin).max(TEXT_LIMITS.titleMax),
  description: z.string().trim().min(10).max(TEXT_LIMITS.descriptionMax),
  category: z.enum(PRODUCT_CATEGORIES),
  /** Minor units. The form multiplies by 100; nothing here ever sees a float. */
  priceCents: z.number().int().min(PRICE_LIMITS.minMinorUnits).max(PRICE_LIMITS.maxMinorUnits),
  currency: z.enum(CURRENCIES),
  stock: z.number().int().min(0).max(1_000_000),
  weightGrams: z.number().int().min(1).max(SHIPPING_LIMITS.maxWeightGrams),
  lengthMm: z.number().int().min(1).max(SHIPPING_LIMITS.maxDimensionMm),
  widthMm: z.number().int().min(1).max(SHIPPING_LIMITS.maxDimensionMm),
  heightMm: z.number().int().min(1).max(SHIPPING_LIMITS.maxDimensionMm),
});

export type ProductCardInput = z.infer<typeof productCardSchema>;

/** A draft is created before the model is uploaded, so everything is optional. */
export const productDraftSchema = productCardSchema.partial().extend({
  title: z.string().trim().min(TEXT_LIMITS.titleMin).max(TEXT_LIMITS.titleMax),
});

export type ProductDraftInput = z.infer<typeof productDraftSchema>;

export const productUpdateSchema = productCardSchema.partial();
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;

/**
 * One way a product comes alive. A clip that lives inside the GLB must name
 * itself; a preset must not, because there is no clip to point at.
 */
export const interactionSchema = z
  .object({
    type: z.enum(INTERACTION_TYPES),
    clipName: z.string().trim().min(1).max(120).optional(),
    label: z.string().trim().min(2).max(60),
    labelEn: z.string().trim().min(2).max(60).optional(),
    order: z.number().int().min(0).max(50),
    loop: z.boolean().default(false),
    config: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.type === 'GLTF_ANIMATION' && !value.clipName) {
      ctx.addIssue({
        code: 'custom',
        path: ['clipName'],
        message: 'clip_name_required',
      });
    }
    if (value.type !== 'GLTF_ANIMATION' && value.clipName) {
      ctx.addIssue({
        code: 'custom',
        path: ['clipName'],
        message: 'clip_name_not_allowed',
      });
    }
  });

export type InteractionInput = z.infer<typeof interactionSchema>;

/** The editor always sends the full list; the server replaces it wholesale. */
export const interactionListSchema = z.object({
  interactions: z.array(interactionSchema).max(12),
});

export type InteractionListInput = z.infer<typeof interactionListSchema>;

export const productFilterSchema = z.object({
  status: z.enum(MODERATION_STATUSES).optional(),
  category: z.enum(PRODUCT_CATEGORIES).optional(),
  search: z.string().trim().max(120).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(24),
});

export type ProductFilterInput = z.infer<typeof productFilterSchema>;

export const rejectProductSchema = z.object({
  reason: z.string().trim().min(5).max(500),
});

/**
 * One row of a bulk import. Numbers arrive as strings from a spreadsheet, so
 * they are coerced here and validated with the same bounds as the form.
 */
export const csvProductRowSchema = z.object({
  title: z.string().trim().min(TEXT_LIMITS.titleMin).max(TEXT_LIMITS.titleMax),
  description: z.string().trim().min(10).max(TEXT_LIMITS.descriptionMax),
  category: z.enum(PRODUCT_CATEGORIES),
  /** Major units as written by a human: "12990.50". */
  price: z.coerce
    .number()
    .positive()
    .max(PRICE_LIMITS.maxMinorUnits / 100),
  currency: z.enum(CURRENCIES),
  stock: z.coerce.number().int().min(0).max(1_000_000),
  weight_g: z.coerce.number().int().min(1).max(SHIPPING_LIMITS.maxWeightGrams),
  length_mm: z.coerce.number().int().min(1).max(SHIPPING_LIMITS.maxDimensionMm),
  width_mm: z.coerce.number().int().min(1).max(SHIPPING_LIMITS.maxDimensionMm),
  height_mm: z.coerce.number().int().min(1).max(SHIPPING_LIMITS.maxDimensionMm),
});

export type CsvProductRow = z.infer<typeof csvProductRowSchema>;

export const CSV_COLUMNS = [
  'title',
  'description',
  'category',
  'price',
  'currency',
  'stock',
  'weight_g',
  'length_mm',
  'width_mm',
  'height_mm',
] as const;
