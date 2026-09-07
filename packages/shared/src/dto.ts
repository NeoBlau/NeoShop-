import type {
  AssetKind,
  Currency,
  OrderStatus,
  PavilionTheme,
  ShipmentStatus,
  InteractionType,
  Locale,
  ModerationStatus,
  ProcessingStatus,
  ProductCategory,
  PublicationStatus,
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

export interface ShippingQuote {
  /** Total billable weight in grams, including a packaging allowance. */
  weightGrams: number;
  country: string;
  /** Named tier the quote fell into, e.g. `domestic` or `international`. */
  zone: string;
  priceCents: number;
  currency: Currency;
  /** Working days, as a range. */
  estimatedDays: { min: number; max: number };
}

export interface OrderItemDto {
  id: string;
  productId: string;
  slug: string;
  title: string;
  unitPriceCents: number;
  quantity: number;
  previewUrl: string | null;
  supplierName: string;
}

export interface ShipmentDto {
  id: string;
  carrier: string;
  trackingNumber: string | null;
  status: ShipmentStatus;
  supplierName: string;
  shippedAt: string | null;
  deliveredAt: string | null;
}

export interface OrderSummary {
  id: string;
  number: string;
  status: OrderStatus;
  currency: Currency;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  itemCount: number;
  createdAt: string;
  paidAt: string | null;
}

export interface OrderDetail extends OrderSummary {
  items: OrderItemDto[];
  shipments: ShipmentDto[];
  /** Present only for the buyer who owns the order, and for admins. */
  address: {
    recipient: string;
    phone: string;
    country: string;
    region: string | null;
    city: string;
    postalCode: string;
    line1: string;
    line2: string | null;
    comment: string | null;
  } | null;
}

/** What the client needs to finish paying, whichever provider is configured. */
export interface PaymentIntentDto {
  provider: 'mock' | 'stripe';
  /** Opaque handle the client sends back when confirming. */
  reference: string;
  /** Stripe's client secret; absent for the mock provider. */
  clientSecret?: string;
  /** Hosted page to redirect to, when the provider uses one. */
  redirectUrl?: string;
}

export interface CheckoutResult {
  order: OrderDetail;
  payment: PaymentIntentDto;
}

/** One incoming order line as a supplier sees it. */
export interface SupplierOrderDto {
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  createdAt: string;
  paidAt: string | null;
  currency: Currency;
  items: { title: string; quantity: number; unitPriceCents: number }[];
  totalCents: number;
  /** City and country only: the supplier ships, they do not need the doorstep
   * until the label is printed. */
  destination: { country: string; city: string };
  shipment: ShipmentDto | null;
}

/**
 * Administration read models.
 *
 * The admin sees more than anyone else and therefore needs the most care about
 * what is actually put on the wire: a moderation queue carries the model to
 * preview and the reason it is queued, and nothing about the buyer.
 */
export interface ModerationItem {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: ProductCategory;
  priceCents: number;
  currency: Currency;
  status: ModerationStatus;
  submittedAt: string | null;
  supplier: { id: string; companyName: string; status: SupplierStatus };
  /** Ordered from full detail down; empty while the model is still processing. */
  levels: WorldModelLevel[];
  previewUrl: string | null;
  interactions: { id: string; label: string; clipName: string | null }[];
  /** What the upload pipeline measured, so a decision needs no second opinion. */
  stats: { triangles: number; materials: number; textures: number; bytes: number } | null;
}

export interface AdminSupplier {
  id: string;
  companyName: string;
  legalName: string | null;
  taxId: string | null;
  contactEmail: string | null;
  status: SupplierStatus;
  rejectionReason: string | null;
  createdAt: string;
  productCount: number;
  pavilionCount: number;
}

export interface AdminPavilion {
  id: string;
  slot: number;
  title: string;
  theme: PavilionTheme;
  status: PublicationStatus;
  supplier: { id: string; companyName: string; status: SupplierStatus };
  productCount: number;
}

export interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actor: { id: string; email: string; role: UserRole } | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface AuditPage {
  entries: AuditEntry[];
  /** Pass back as `cursor` for the next page; absent at the end. */
  nextCursor?: string;
}

export interface AdminMetrics {
  counts: {
    users: number;
    suppliersPending: number;
    suppliersApproved: number;
    suppliersBlocked: number;
    productsPending: number;
    productsPublished: number;
    pavilions: number;
    orders: number;
  };
  /** Money is in minor units, like everywhere else. */
  revenue: { currency: Currency; paidCents: number; orders: number }[];
  /** Views and orders per product, best first. */
  topProducts: {
    id: string;
    title: string;
    supplierName: string;
    viewCount: number;
    orderCount: number;
    /** Orders per hundred views, rounded to one decimal. */
    conversion: number;
  }[];
  /** Orders per day for the last fortnight, oldest first. */
  ordersByDay: { day: string; orders: number; paidCents: number }[];
}
