import type { Locale, SupplierStatus, UserRole } from './domain.js';

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
