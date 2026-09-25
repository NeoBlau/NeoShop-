import type { AuthoredMissionInput, ModerationStatus } from '@3dsfera/shared';
import { api } from '../../api/client.js';

/**
 * The supplier's side of a mission: four calls under their own product.
 *
 * Under the product rather than under `/missions`, because that is where the
 * permission lives — every one of these proves the product is theirs before it
 * does anything.
 */

export interface AuthoredMissionView {
  id: string;
  productId: string;
  status: ModerationStatus;
  rejectionReason: string | null;
  submittedAt: string | null;
  publishedAt: string | null;
  script: AuthoredMissionInput;
}

export interface AuthoredMissionState {
  mission: AuthoredMissionView | null;
  /** Clip names the uploaded model actually contains. */
  availableClips: string[];
}

const BASE = '/api/supplier/products';

export const missionAuthoringApi = {
  get: (productId: string) => api.get<AuthoredMissionState>(`${BASE}/${productId}/mission`),
  save: (productId: string, script: AuthoredMissionInput) =>
    api.put<AuthoredMissionView>(`${BASE}/${productId}/mission`, script),
  submit: (productId: string) =>
    api.post<AuthoredMissionView>(`${BASE}/${productId}/mission/submit`),
  remove: (productId: string) => api.delete<void>(`${BASE}/${productId}/mission`),
};
