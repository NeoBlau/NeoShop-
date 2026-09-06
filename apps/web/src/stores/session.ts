import { create } from 'zustand';
import type { Locale, LoginInput, RegisterInput, SessionUser } from '@3dsfera/shared';
import { authApi } from '../api/auth.js';
import { ApiError } from '../api/client.js';
import { i18next, persistLocale } from '../i18n/index.js';

/**
 * Session state. Everything that talks to the auth API goes through here, so
 * components never hold a half-updated copy of "who am I".
 */
export type SessionStatus = 'idle' | 'loading' | 'ready';

interface SessionState {
  status: SessionStatus;
  user: SessionUser | null;
  /** Locale of the interface, kept in sync with the account when signed in. */
  locale: Locale;
  bootstrap: () => Promise<void>;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  changeLocale: (locale: Locale) => Promise<void>;
}

async function applyLocale(locale: Locale): Promise<void> {
  persistLocale(locale);
  if (i18next.language !== locale) await i18next.changeLanguage(locale);
}

export const useSession = create<SessionState>((set, get) => ({
  status: 'idle',
  user: null,
  locale: (i18next.language as Locale | undefined) ?? 'ru',

  bootstrap: async () => {
    set({ status: 'loading' });
    try {
      const { user } = await authApi.session();
      set({ user, status: 'ready' });
      // A signed-in account carries its own language preference across devices.
      if (user) await applyLocale(user.locale);
    } catch (error) {
      // A failed bootstrap means "not signed in" for every practical purpose;
      // a network outage shows up on the next action with a real message.
      if (!(error instanceof ApiError)) throw error;
      set({ user: null, status: 'ready' });
    }
  },

  login: async (input) => {
    const { user } = await authApi.login(input);
    set({ user, status: 'ready' });
    if (user) await applyLocale(user.locale);
  },

  register: async (input) => {
    const { user } = await authApi.register(input);
    set({ user, status: 'ready' });
    if (user) await applyLocale(user.locale);
  },

  logout: async () => {
    await authApi.logout();
    set({ user: null, status: 'ready' });
  },

  changeLocale: async (locale) => {
    set({ locale });
    await applyLocale(locale);
    // Signed-in users get the choice persisted server-side; guests keep it
    // in localStorage only.
    if (get().user) {
      try {
        const { user } = await authApi.setLocale(locale);
        set({ user });
      } catch (error) {
        if (!(error instanceof ApiError)) throw error;
      }
    }
  },
}));
