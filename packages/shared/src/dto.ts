import type {
  AssetKind,
  Currency,
  PavilionTheme,
  InteractionType,
  Locale,
  ModerationStatus,
  ProcessingStatus,
  ProductCategory,
  SupplierStatus,
  UserRole,
} from './domain.js';
import type { AnimationClipInfo, ModelIssue } from './glb.js';

/** Supplier context attached to the session when the user owns a company. */
export interface SessionSupplier {
  id: string;
  companyName: string;
  status: SupplierStatus;
  /** Slot number of the pavilion assigned by an admin, null until granted. */
  pavilionSlot: number | null;
}

export interface SessionUser {
  id: string;
  email: string;
  role: UserRole;
  locale: Locale;
  createdAt: string;
  supplier: SessionSupplier | null;
}

export interface SessionResponse {
  user: SessionUser | null;
}

export interface OkResponse {
  ok: true;
}

export interface ProductAssetDto {
  id: string;
  kind: AssetKind;
  /** Ready-to-use URL: public for optimized models, presigned for originals. */
  url: string;
  byteSize: number;
  contentType: string;
  lodLevel: number | null;
}

export interface ProductInteractionDto {
  id: string;
  type: InteractionType;
  clipName: string | null;
  label: string;
  labelEn: string | null;
  order: number;
  loop: boolean;
  config: Record<string, string | number | boolean> | null;
}

export interface LodEntry {
  level: number;
  triangles: number;
  byteSize: number;
}

/** What the wizard shows after processing: how much lighter the model became. */
export interface ModelStats {
  originalBytes: number;
  optimizedBytes: number;
  /** 0-100, rounded. Negative would mean the pipeline made things worse. */
  reductionPercent: number;
  triangles: number;
  drawnTriangles: number;
  materials: number;
  textures: number;
  animations: AnimationClipInfo[];
  lods: LodEntry[];
  dracoApplied: boolean;
  ktx2Applied: boolean;
  /** Steps the pipeline could not run, e.g. missing KTX toolchain. */
  skipped: string[];
  warnings: ModelIssue[];
  durationMs: number;
}

export interface ModelJobDto {
  id: string;
  status: ProcessingStatus;
  errorCode: string | null;
  stats: ModelStats | null;
  attempts: number;
  createdAt: string;
  finishedAt: string | null;
}

export interface ProductSummary {
  id: string;
  slug: string;
  title: string;
  category: ProductCategory;
  status: ModerationStatus;
  priceCents: number;
  currency: Currency;
  stock: number;
  viewCount: number;
  orderCount: number;
  updatedAt: string;
  previewUrl: string | null;
  hasModel: boolean;
  interactionCount: number;
  modelStatus: ProcessingStatus | null;
}

export interface ProductDetail extends ProductSummary {
  description: string;
  weightGrams: number;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  rejectionReason: string | null;
  submittedAt: string | null;
  publishedAt: string | null;
  assets: ProductAssetDto[];
  interactions: ProductInteractionDto[];
  job: ModelJobDto | null;
  /** Clip names read out of the uploaded GLB, for the interaction editor. */
  availableClips: AnimationClipInfo[];
}

export interface ProductListResponse {
  products: ProductSummary[];
  nextCursor: string | null;
  total: number;
}

export interface CsvImportRowResult {
  line: number;
  title: string;
  status: 'created' | 'skipped';
  /** Dictionary key of the reason a row was skipped. */
  issue?: string;
  field?: string;
}

export interface CsvImportResult {
  created: number;
  skipped: number;
  rows: CsvImportRowResult[];
}

export interface SupplierStatsRow {
  productId: string;
  title: string;
  status: ModerationStatus;
  views: number;
  orders: number;
  /** Orders per hundred views, rounded to one decimal. */
  conversion: number;
}

export interface SupplierStatsResponse {
  totals: { views: number; orders: number; published: number; pending: number };
  rows: SupplierStatsRow[];
}

/** One level of the detail ladder, as the scene consumes it. */
export interface WorldModelLevel {
  level: number;
  url: string;
  byteSize: number;
  triangles: number;
}

export interface WorldProduct {
  id: string;
  slug: string;
  title: string;
  description: string;
  priceCents: number;
  currency: Currency;
  stock: number;
  previewUrl: string | null;
  /** Ordered from full detail down; empty when the model is still processing. */
  levels: WorldModelLevel[];
  interactions: ProductInteractionDto[];
  /** Slot along the pavilion wall, assigned by the layout. */
  standIndex: number;
}

export interface WorldPavilion {
  id: string;
  slot: number;
  title: string;
  theme: PavilionTheme;
  supplierName: string;
  /** Where the hall sits in the world; the scene streams by distance from it. */
  worldPosition: { x: number; y: number; z: number; rotationY: number };
  products: WorldProduct[];
}

export interface WorldResponse {
  pavilions: WorldPavilion[];
  /** Spacing between pavilion centres, so the client can lay out corridors. */
  pavilionSpacing: number;
}
