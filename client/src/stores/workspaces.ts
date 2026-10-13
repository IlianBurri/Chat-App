import { create } from 'zustand';
import { api } from '@/lib/api';
import type { ChannelSummary, WorkspaceRole, WorkspaceSummary } from '@/lib/types';

type ChannelFlags = Partial<Pick<ChannelSummary, 'muted' | 'hidden'>>;

export interface WorkspaceInput {
  name: string;
  description?: string;
  visibility: 'public' | 'private';
  color?: string;
}

export interface ChannelInput {
  name: string;
  description?: string;
  type: 'standard' | 'private';
  memberIds?: string[];
}

interface WorkspacesState {
  workspaces: WorkspaceSummary[];
  loaded: boolean;
  error: boolean;
  /** Channel currently open in the main area */
  activeChannelId: string | null;
  load: () => Promise<void>;
  setActive: (channelId: string | null) => void;
  /** Marks a channel unread locally when new content arrives elsewhere. */
  setUnread: (channelId: string, unread: boolean) => void;
  markRead: (channelId: string) => Promise<void>;
  updateFlags: (channelId: string, flags: ChannelFlags) => Promise<void>;
  create: (input: WorkspaceInput) => Promise<{ id: string; defaultChannelId: string }>;
  update: (workspaceId: string, input: Partial<WorkspaceInput>) => Promise<void>;
  remove: (workspaceId: string) => Promise<void>;
  join: (workspaceId: string) => Promise<void>;
  leave: (workspaceId: string) => Promise<void>;
  addMembers: (workspaceId: string, userIds: string[], role: Exclude<WorkspaceRole, 'owner'>) => Promise<void>;
  setRole: (workspaceId: string, userId: string, role: WorkspaceRole) => Promise<void>;
  removeMember: (workspaceId: string, userId: string) => Promise<void>;
  createChannel: (workspaceId: string, input: ChannelInput) => Promise<string>;
  updateChannel: (channelId: string, input: { name?: string; description?: string | null }) => Promise<void>;
  deleteChannel: (channelId: string) => Promise<void>;
  reset: () => void;
}

/** Finds the workgroup that contains a channel. */
export function findChannel(workspaces: WorkspaceSummary[], channelId: string) {
  for (const workspace of workspaces) {
    const channel = workspace.channels.find((c) => c.id === channelId);
    if (channel) return { workspace, channel };
  }
  return null;
}

export const useWorkspacesStore = create<WorkspacesState>((set, get) => {
  const patchChannel = (channelId: string, patch: Partial<ChannelSummary>) =>
    set((s) => ({
      workspaces: s.workspaces.map((w) => ({
        ...w,
        channels: w.channels.map((c) => (c.id === channelId ? { ...c, ...patch } : c)),
      })),
    }));

  // Every change is confirmed by a "workspaces:changed" event, but reloading
  // right away keeps the UI snappy for the person who made it.
  const reloadAfter = async (request: Promise<unknown>) => {
    await request;
    await get().load();
  };

  return {
    workspaces: [],
    loaded: false,
    error: false,
    activeChannelId: null,

    load: async () => {
      try {
        const { workspaces } = await api.get<{ workspaces: WorkspaceSummary[] }>('/workspaces');
        const active = get().activeChannelId;
        // The open channel is being read right now, whatever the server says.
        set({
          workspaces: workspaces.map((w) => ({ ...w, channels: w.channels.map((c) => (c.id === active ? { ...c, unread: false } : c)) })),
          loaded: true,
          error: false,
        });
      } catch {
        set({ loaded: true, error: true });
      }
    },

    setActive: (channelId) => set({ activeChannelId: channelId }),

    setUnread: (channelId, unread) => patchChannel(channelId, { unread }),

    markRead: async (channelId) => {
      patchChannel(channelId, { unread: false });
      await api.post(`/channels/${channelId}/read`).catch(() => {});
    },

    updateFlags: async (channelId, flags) => {
      patchChannel(channelId, flags);
      try {
        await api.patch(`/channels/${channelId}/member`, flags);
      } catch (e) {
        await get().load();
        throw e;
      }
    },

    create: async (input) => {
      const { workspace } = await api.post<{ workspace: { id: string; defaultChannelId: string } }>('/workspaces', input);
      await get().load();
      return workspace;
    },
    update: (workspaceId, input) => reloadAfter(api.patch(`/workspaces/${workspaceId}`, input)),
    remove: (workspaceId) => reloadAfter(api.delete(`/workspaces/${workspaceId}`)),
    join: (workspaceId) => reloadAfter(api.post(`/workspaces/${workspaceId}/join`)),
    leave: (workspaceId) => reloadAfter(api.delete(`/workspaces/${workspaceId}/members/me`)),
    addMembers: (workspaceId, userIds, role) => reloadAfter(api.post(`/workspaces/${workspaceId}/members`, { userIds, role })),
    setRole: (workspaceId, userId, role) => reloadAfter(api.patch(`/workspaces/${workspaceId}/members/${userId}`, { role })),
    removeMember: (workspaceId, userId) => reloadAfter(api.delete(`/workspaces/${workspaceId}/members/${userId}`)),

    createChannel: async (workspaceId, input) => {
      const { channel } = await api.post<{ channel: { id: string } }>(`/workspaces/${workspaceId}/channels`, input);
      await get().load();
      return channel.id;
    },
    updateChannel: (channelId, input) => reloadAfter(api.patch(`/channels/${channelId}`, input)),
    deleteChannel: (channelId) => reloadAfter(api.delete(`/channels/${channelId}`)),

    reset: () => set({ workspaces: [], loaded: false, error: false, activeChannelId: null }),
  };
});
