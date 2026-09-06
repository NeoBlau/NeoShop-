import type {
  LoginInput,
  OkResponse,
  RegisterInput,
  SessionResponse,
  Locale,
} from '@3dsfera/shared';
import { api } from './client.js';

export const authApi = {
  session: () => api.get<SessionResponse>('/api/auth/session'),
  register: (input: RegisterInput) => api.post<SessionResponse>('/api/auth/register', input),
  login: (input: LoginInput) => api.post<SessionResponse>('/api/auth/login', input),
  logout: () => api.post<OkResponse>('/api/auth/logout'),
  setLocale: (locale: Locale) => api.patch<SessionResponse>('/api/auth/locale', { locale }),
};
