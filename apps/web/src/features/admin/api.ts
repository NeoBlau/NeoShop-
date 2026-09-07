import type {
  AdminMetrics,
  AdminPavilion,
  AdminSupplier,
  AuditPage,
  ModerationItem,
  ModerationStatus,
  PavilionUpdateInput,
  SupplierStatus,
} from '@3dsfera/shared';
import { api } from '../../api/client.js';

/**
 * The administration endpoints.
 *
 * Every one of them is behind the admin role on the server; nothing here
 * checks that again, because a check in the browser is a suggestion.
 */
export const adminApi = {
  metrics: () => api.get<AdminMetrics>('/api/admin/metrics'),

  moderation: (status: ModerationStatus) =>
    api.get<{ items: ModerationItem[] }>(`/api/admin/moderation?status=${status}`),
  approveProduct: (id: string) =>
    api.post<{ status: 'PUBLISHED' }>(`/api/admin/products/${id}/approve`),
  rejectProduct: (id: string, reason: string) =>
    api.post<{ status: 'REJECTED' }>(`/api/admin/products/${id}/reject`, { reason }),

  suppliers: (status?: SupplierStatus) =>
    api.get<{ suppliers: AdminSupplier[] }>(
      status ? `/api/admin/suppliers?status=${status}` : '/api/admin/suppliers',
    ),
  approveSupplier: (id: string) =>
    api.post<{ status: 'APPROVED' }>(`/api/admin/suppliers/${id}/approve`),
  rejectSupplier: (id: string, reason: string) =>
    api.post<{ status: 'REJECTED' }>(`/api/admin/suppliers/${id}/reject`, { reason }),
  blockSupplier: (id: string, reason: string) =>
    api.post<{ status: 'BLOCKED' }>(`/api/admin/suppliers/${id}/block`, { reason }),

  pavilions: () => api.get<{ pavilions: AdminPavilion[] }>('/api/admin/pavilions'),
  updatePavilion: (id: string, input: PavilionUpdateInput) =>
    api.put<{ pavilion: AdminPavilion }>(`/api/admin/pavilions/${id}`, input),

  audit: (cursor?: string) =>
    api.get<AuditPage>(cursor ? `/api/admin/audit?cursor=${cursor}` : '/api/admin/audit'),
};
