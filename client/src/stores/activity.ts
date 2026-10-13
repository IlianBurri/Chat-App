import { create } from 'zustand';
import { api } from '@/lib/api';
import type { NotificationDto, NotificationType } from '@/lib/types';

export type ActivityFilter = 'all' | 'unread' | Exclude<NotificationType, 'meeting'>;

interface ActivityPage {
  notifications: NotificationDto[];
  hasMore: boolean;
  unreadCount: number;
}

interface ActivityState {
  /** Feed entries for the current filter, newest first */
  items: NotificationDto[];
  filter: ActivityFilter;
  hasMore: boolean;
  loaded: boolean;
  loadingMore: boolean;
  error: boolean;
  /** Unread entries across all filters (app bar badge); the server sends it with every change */
  unreadCount: number;
  load: (filter?: ActivityFilter) => Promise<void>;
  loadMore: () => Promise<void>;
  markRead: (ids?: string[]) => Promise<void>;
  markUnread: (id: string) => Promise<void>;
  /** Realtime events (also for changes made in another tab) */
  added: (notification: NotificationDto, unreadCount: number) => void;
  removed: (ids: string[], unreadCount: number) => void;
  readChanged: (ids: string[] | 'all', read: boolean, unreadCount?: number) => void;
  reset: () => void;
}

/** Whether a feed entry belongs in the list for a filter. */
export function matchesFilter(n: Pick<NotificationDto, 'type' | 'read'>, filter: ActivityFilter) {
  if (filter === 'all') return true;
  if (filter === 'unread') return !n.read;
  return n.type === filter;
}

const initial = {
  items: [] as NotificationDto[],
  filter: 'all' as ActivityFilter,
  hasMore: false,
  loaded: false,
  loadingMore: false,
  error: false,
  unreadCount: 0,
};
// Answers of an older load (e.g. a filter the user already left) are ignored.
let loadSeq = 0;

export const useActivityStore = create<ActivityState>((set, get) => ({
  ...initial,

  load: async (filter = get().filter) => {
    const seq = ++loadSeq;
    set((s) => ({ filter, loaded: s.filter === filter && s.loaded, error: false }));
    try {
      const page = await api.get<ActivityPage>(`/activity?filter=${filter}`);
      if (seq !== loadSeq) return;
      set({ items: page.notifications, hasMore: page.hasMore, unreadCount: page.unreadCount, loaded: true });
    } catch {
      if (seq === loadSeq) set({ loaded: true, error: true });
    }
  },

  loadMore: async () => {
    const { items, filter, hasMore, loadingMore } = get();
    if (!hasMore || loadingMore || items.length === 0) return;
    const seq = loadSeq;
    set({ loadingMore: true });
    try {
      const page = await api.get<ActivityPage>(`/activity?filter=${filter}&before=${items[items.length - 1].id}`);
      if (seq !== loadSeq) return;
      set((s) => ({
        items: [...s.items, ...page.notifications.filter((n) => !s.items.some((i) => i.id === n.id))],
        hasMore: page.hasMore,
      }));
    } finally {
      set({ loadingMore: false });
    }
  },

  markRead: async (ids) => {
    if (ids && !get().items.some((n) => ids.includes(n.id) && !n.read)) return;
    get().readChanged(ids ?? 'all', true);
    await api.post('/activity/read', ids ? { ids } : {});
  },

  markUnread: async (id) => {
    get().readChanged([id], false);
    await api.post(`/activity/${id}/unread`);
  },

  added: (notification, unreadCount) =>
    set((s) => ({
      items:
        s.items.some((n) => n.id === notification.id) || !matchesFilter(notification, s.filter) ? s.items : [notification, ...s.items],
      unreadCount,
    })),

  removed: (ids, unreadCount) => set((s) => ({ items: s.items.filter((n) => !ids.includes(n.id)), unreadCount })),

  readChanged: (ids, read, unreadCount) =>
    set((s) => {
      const hits = (n: NotificationDto) => n.read !== read && (ids === 'all' || ids.includes(n.id));
      const changed = s.items.filter(hits).length;
      return {
        // Entries stay in the "unread" list after reading, so they don't jump away under the pointer.
        items: s.items.map((n) => (hits(n) ? { ...n, read } : n)),
        unreadCount: unreadCount ?? (ids === 'all' && read ? 0 : Math.max(0, s.unreadCount + (read ? -changed : changed))),
      };
    }),

  reset: () => {
    loadSeq++;
    set(initial);
  },
}));
