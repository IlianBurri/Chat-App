import { create } from 'zustand';
import { api } from '@/lib/api';
import type { WorkspaceSummary } from '@/lib/types';

interface WorkspacesState {
  workspaces: WorkspaceSummary[];
  loaded: boolean;
  error: boolean;
  load: () => Promise<void>;
}

export const useWorkspacesStore = create<WorkspacesState>((set) => ({
  workspaces: [],
  loaded: false,
  error: false,
  load: async () => {
    try {
      const { workspaces } = await api.get<{ workspaces: WorkspaceSummary[] }>('/workspaces');
      set({ workspaces, loaded: true, error: false });
    } catch {
      set({ loaded: true, error: true });
    }
  },
}));
