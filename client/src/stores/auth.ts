import { create } from 'zustand';
import { api } from '@/lib/api';
import type { Me, Status } from '@/lib/types';
import { usePresenceStore } from './presence';

interface ProfilePatch {
  name?: string;
  jobTitle?: string | null;
  manualStatus?: Status | null;
  statusMessage?: string | null;
}

interface AuthState {
  user: Me | null;
  state: 'loading' | 'authenticated' | 'anonymous';
  load: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (patch: ProfilePatch) => Promise<void>;
}

function signedIn(user: Me) {
  usePresenceStore.getState().setFromUsers([user]);
  return { user, state: 'authenticated' as const };
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  state: 'loading',

  load: async () => {
    try {
      const { user } = await api.get<{ user: Me }>('/auth/me');
      set(signedIn(user));
    } catch {
      set({ user: null, state: 'anonymous' });
    }
  },

  login: async (email, password) => {
    const { user } = await api.post<{ user: Me }>('/auth/login', { email, password });
    set(signedIn(user));
  },

  register: async (name, email, password) => {
    const { user } = await api.post<{ user: Me }>('/auth/register', { name, email, password });
    set(signedIn(user));
  },

  logout: async () => {
    await api.post('/auth/logout');
    set({ user: null, state: 'anonymous' });
  },

  updateProfile: async (patch) => {
    const { user } = await api.patch<{ user: Me }>('/users/me', patch);
    set(signedIn(user));
  },
}));
