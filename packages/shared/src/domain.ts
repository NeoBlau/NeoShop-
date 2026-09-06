/**
 * Domain vocabulary shared by the API and the web client.
 *
 * These string unions intentionally mirror the Prisma enums one-to-one. Prisma
 * generates its own enums from schema.prisma; because both sides are plain
 * string literals with identical members, values flow between them without
 * casting, and a rename on either side becomes a type error here.
 */

export const USER_ROLES = ['BUYER', 'SUPPLIER', 'ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const SUPPLIER_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'BLOCKED'] as const;
export type SupplierStatus = (typeof SUPPLIER_STATUSES)[number];

export const PUBLICATION_STATUSES = ['DRAFT', 'PUBLISHED'] as const;
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];

export const MODERATION_STATUSES = ['DRAFT', 'PENDING', 'PUBLISHED', 'REJECTED'] as const;
export type ModerationStatus = (typeof MODERATION_STATUSES)[number];

export const ASSET_KINDS = [
  'GLB_ORIGINAL',
  'GLB_OPTIMIZED',
  'KTX2_TEXTURE',
  'PREVIEW',
  'PHOTO',
] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

export const INTERACTION_TYPES = [
  'GLTF_ANIMATION',
  'STATE_TOGGLE',
  'SOUND',
  'PARTICLES',
  'PRESET_SPIN',
  'PRESET_EXPLODE',
  'PRESET_HIGHLIGHT',
] as const;
export type InteractionType = (typeof INTERACTION_TYPES)[number];

export const ORDER_STATUSES = [
  'PENDING',
  'PAID',
  'PACKING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const SHIPMENT_STATUSES = [
  'CREATED',
  'HANDED_OVER',
  'IN_TRANSIT',
  'DELIVERED',
  'LOST',
] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export const PRODUCT_CATEGORIES = [
  'ELECTRONICS',
  'HOME_APPLIANCES',
  'FURNITURE',
  'LIGHTING',
  'OUTDOOR',
  'OTHER',
] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const PAVILION_THEMES = ['GRAPHITE', 'SAND', 'DEEP_BLUE', 'MONO'] as const;
export type PavilionTheme = (typeof PAVILION_THEMES)[number];

/** Where an uploaded model is in the optimization pipeline. */
export const PROCESSING_STATUSES = ['PENDING', 'RUNNING', 'READY', 'FAILED'] as const;
export type ProcessingStatus = (typeof PROCESSING_STATUSES)[number];

export const LOCALES = ['ru', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'ru';

/** Currencies the storefront can quote. Amounts are always integer minor units. */
export const CURRENCIES = ['RUB', 'EUR', 'USD'] as const;
export type Currency = (typeof CURRENCIES)[number];
