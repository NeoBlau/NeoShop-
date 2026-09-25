import type { PromoCodeView } from '@3dsfera/shared';
import { api } from '../../api/client.js';

/**
 * The four calls a mission makes.
 *
 * Everything else about a mission — which step is on screen, what the camera
 * is doing, whether a clip has finished — is local. These are the moments the
 * server has to agree with, because a discount comes out of the last one.
 */

export interface MissionRunView {
  missionId: string;
  step: number;
  startedAt: string;
  completedAt: string | null;
}

export interface CompletionView {
  missionId: string;
  promo: PromoCodeView;
}

export const missionsApi = {
  mine: () => api.get<{ runs: MissionRunView[]; promos: PromoCodeView[] }>('/api/missions/mine'),
  start: (id: string) => api.post<MissionRunView>(`/api/missions/${id}/start`),
  step: (id: string, stepId: string) =>
    api.post<MissionRunView>(`/api/missions/${id}/steps/${stepId}`),
  complete: (id: string) => api.post<CompletionView>(`/api/missions/${id}/complete`),
};
