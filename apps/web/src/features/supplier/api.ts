import type { PavilionTheme, PublicationStatus, SupplierStatus } from '@3dsfera/shared';
import { api } from '../../api/client.js';

export interface SupplierPavilionSummary {
  id: string;
  slot: number;
  title: string;
  theme: PavilionTheme;
  status: PublicationStatus;
}

export interface SupplierProfile {
  id: string;
  companyName: string;
  legalName: string | null;
  taxId: string | null;
  contactEmail: string | null;
  status: SupplierStatus;
  rejectionReason: string | null;
  createdAt: string;
  pavilions: SupplierPavilionSummary[];
  productCount: number;
}

export const supplierApi = {
  profile: () => api.get<{ supplier: SupplierProfile }>('/api/supplier/me'),
};
