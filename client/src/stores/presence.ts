import { create } from 'zustand';
import type { PublicUser, Status } from '@/lib/types';

interface PresenceEntry {
  status: Status;
  statusMessage: string | null;
}

interface PresenceState {
  byUser: Record<string, PresenceEntry>;
  setFromUsers: (users: Pick<PublicUser, 'id' | 'status' | 'statusMessage'>[]) => void;
  update: (userId: string, entry: PresenceEntry) => void;
}

/** Live status of every user we know about; updated from API payloads and socket events. */
export const usePresenceStore = create<PresenceState>((set) => ({
  byUser: {},
  setFromUsers: (users) =>
    set((s) => {
      const byUser = { ...s.byUser };
      for (const u of users) byUser[u.id] = { status: u.status, statusMessage: u.statusMessage };
      return { byUser };
    }),
  update: (userId, entry) => set((s) => ({ byUser: { ...s.byUser, [userId]: entry } })),
}));

/** Current status of a user, falling back to the value from the payload that rendered them. */
export function useStatus(userId: string, fallback: Status = 'offline'): Status {
  return usePresenceStore((s) => s.byUser[userId]?.status ?? fallback);
}
