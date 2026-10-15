import { create } from 'zustand';
import { api } from '@/lib/api';
import type { ChatSummary, MessageDto } from '@/lib/types';
import { usePresenceStore } from './presence';

type MemberFlags = Partial<Pick<ChatSummary, 'pinned' | 'muted' | 'hidden' | 'markedUnread'>>;

interface ChatsState {
  chats: ChatSummary[];
  loaded: boolean;
  error: boolean;
  /** Chat currently open in the main area */
  activeChatId: string | null;
  load: () => Promise<void>;
  setActive: (chatId: string | null) => void;
  upsertChat: (chat: ChatSummary) => void;
  removeChat: (chatId: string) => void;
  applyMessage: (message: MessageDto, meId: string | undefined, isNew: boolean) => void;
  applyRead: (chatId: string, userId: string, meId: string | undefined) => void;
  applyFlags: (chatId: string, flags: MemberFlags) => void;
  updateFlags: (chatId: string, flags: MemberFlags) => Promise<void>;
  markRead: (chatId: string) => Promise<void>;
  create: (input: { memberIds: string[]; name?: string; message?: string }) => Promise<ChatSummary>;
  rename: (chatId: string, name: string) => Promise<void>;
  addMembers: (chatId: string, userIds: string[]) => Promise<void>;
  leave: (chatId: string) => Promise<void>;
  reset: () => void;
}

const byRecency = (a: ChatSummary, b: ChatSummary) => b.lastMessageAt.localeCompare(a.lastMessageAt);
const pendingReads = new Set<string>();

export const useChatsStore = create<ChatsState>((set, get) => {
  const patch = (chatId: string, fn: (c: ChatSummary) => ChatSummary) =>
    set((s) => ({ chats: s.chats.map((c) => (c.id === chatId ? fn(c) : c)).sort(byRecency) }));

  return {
    chats: [],
    loaded: false,
    error: false,
    activeChatId: null,

    load: async () => {
      try {
        const { chats } = await api.get<{ chats: ChatSummary[] }>('/chats');
        usePresenceStore.getState().setFromUsers(chats.flatMap((c) => c.members));
        set({ chats, loaded: true, error: false });
      } catch {
        set({ loaded: true, error: true });
      }
    },

    setActive: (chatId) => set({ activeChatId: chatId }),

    upsertChat: (chat) => {
      usePresenceStore.getState().setFromUsers(chat.members);
      set((s) => ({
        chats: (s.chats.some((c) => c.id === chat.id) ? s.chats.map((c) => (c.id === chat.id ? chat : c)) : [...s.chats, chat]).sort(byRecency),
      }));
    },

    removeChat: (chatId) => set((s) => ({ chats: s.chats.filter((c) => c.id !== chatId) })),

    applyMessage: (message, meId, isNew) => {
      const chat = get().chats.find((c) => c.id === message.chatId);
      if (!chat) {
        // A chat we don't know yet (e.g. created elsewhere): fetch its summary.
        if (isNew) void api.get<{ chat: ChatSummary }>(`/chats/${message.chatId}`).then(({ chat: c }) => get().upsertChat(c));
        return;
      }
      if (!isNew && chat.lastMessage?.id !== message.id) return;

      const fromOther = message.author.id !== meId;
      const viewing = get().activeChatId === message.chatId && document.visibilityState === 'visible';
      patch(message.chatId, (c) => ({
        ...c,
        hidden: isNew ? false : c.hidden,
        lastMessageAt: isNew ? message.createdAt : c.lastMessageAt,
        lastMessage: {
          id: message.id,
          type: message.type,
          content: message.deleted ? null : message.content,
          fileName: message.deleted ? null : (message.files[0]?.name ?? null),
          deleted: message.deleted,
          author: { id: message.author.id, name: message.author.name },
          createdAt: message.createdAt,
        },
        unreadCount: isNew && fromOther && !viewing && message.type !== 'system' ? c.unreadCount + 1 : c.unreadCount,
      }));
      if (isNew && fromOther && viewing) void get().markRead(message.chatId);
    },

    applyRead: (chatId, userId, meId) => {
      if (userId === meId) patch(chatId, (c) => ({ ...c, unreadCount: 0, markedUnread: false }));
    },

    applyFlags: (chatId, flags) => patch(chatId, (c) => ({ ...c, ...flags })),

    updateFlags: async (chatId, flags) => {
      get().applyFlags(chatId, flags);
      const { chat } = await api.patch<{ chat: ChatSummary }>(`/chats/${chatId}/member`, flags);
      get().upsertChat(chat);
    },

    markRead: async (chatId) => {
      if (pendingReads.has(chatId)) return;
      pendingReads.add(chatId);
      try {
        get().applyFlags(chatId, { markedUnread: false });
        patch(chatId, (c) => ({ ...c, unreadCount: 0 }));
        await api.post(`/chats/${chatId}/read`);
      } finally {
        pendingReads.delete(chatId);
      }
    },

    create: async (input) => {
      const { chat } = await api.post<{ chat: ChatSummary }>('/chats', input);
      get().upsertChat(chat);
      return chat;
    },

    rename: async (chatId, name) => {
      const { chat } = await api.patch<{ chat: ChatSummary }>(`/chats/${chatId}`, { name });
      get().upsertChat(chat);
    },

    addMembers: async (chatId, userIds) => {
      const { chat } = await api.post<{ chat: ChatSummary }>(`/chats/${chatId}/members`, { userIds });
      get().upsertChat(chat);
    },

    leave: async (chatId) => {
      await api.delete(`/chats/${chatId}/member`);
      get().removeChat(chatId);
    },

    reset: () => set({ chats: [], loaded: false, error: false, activeChatId: null }),
  };
});

export function isUnread(chat: ChatSummary): boolean {
  return chat.unreadCount > 0 || chat.markedUnread;
}

/** Display name: group name, or the other members' names. */
export function chatTitle(chat: ChatSummary, meId: string | undefined): string {
  if (chat.name) return chat.name;
  const others = chat.members.filter((m) => m.id !== meId);
  return (others.length ? others : chat.members).map((m) => m.name).join(', ');
}

/** The other person in a 1:1 chat. */
export function directPartner(chat: ChatSummary, meId: string | undefined) {
  return chat.type === 'direct' ? chat.members.find((m) => m.id !== meId) : undefined;
}
