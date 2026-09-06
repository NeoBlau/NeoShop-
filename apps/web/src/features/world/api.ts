import type { WorldResponse } from '@3dsfera/shared';
import { api } from '../../api/client.js';

export const worldApi = {
  load: () => api.get<WorldResponse>('/api/world'),
  /** Fire-and-forget: a failed counter must never interrupt a walkthrough. */
  recordView: (productId: string) =>
    api.post<void>(`/api/world/products/${productId}/view`).catch(() => undefined),
};
