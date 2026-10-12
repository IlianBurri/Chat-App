import { create } from 'zustand';
import { api } from '@/lib/api';
import type { MessageDto, ReactionSummary, ReadReceipt } from '@/lib/types';

export interface ChatMessages {
  messages: MessageDto[];
  hasMore: boolean;
  loaded: boolean;
  loadingOlder: boolean;
  error: boolean;
  /** Latest read receipt per member */
  receipts: Record<string, ReadReceipt>;
}

interface Page {
  messages: MessageDto[];
  hasMore: boolean;
  receipts: ReadReceipt[];
}

export interface NewPoll {
  question: string;
  options: string[];
  multiple: boolean;
}

interface MessagesState {
  byChat: Record<string, ChatMessages>;
  load: (chatId: string) => Promise<void>;
  loadOlder: (chatId: string) => Promise<void>;
  upsert: (message: MessageDto) => void;
  setReactions: (chatId: string, messageId: string, reactions: ReactionSummary[]) => void;
  setReceipt: (chatId: string, receipt: ReadReceipt) => void;
  send: (chatId: string, input: { content: string; subject?: string; replyToId?: string }) => Promise<void>;
  edit: (messageId: string, content: string, subject?: string | null) => Promise<void>;
  remove: (messageId: string) => Promise<void>;
  react: (messageId: string, emoji: string) => Promise<void>;
  togglePin: (messageId: string) => Promise<void>;
  forward: (messageId: string, chatId: string) => Promise<void>;
  markUnread: (messageId: string) => Promise<void>;
  createPoll: (chatId: string, poll: NewPoll) => Promise<void>;
  vote: (pollId: string, optionIds: string[]) => Promise<void>;
  reset: () => void;
}

const empty: ChatMessages = { messages: [], hasMore: false, loaded: false, loadingOlder: false, error: false, receipts: {} };

function receiptsById(list: ReadReceipt[]): Record<string, ReadReceipt> {
  return Object.fromEntries(list.map((r) => [r.userId, r]));
}

/** Inserts or replaces a message, keeping chronological order. */
export function upsertSorted(list: MessageDto[], message: MessageDto): MessageDto[] {
  const index = list.findIndex((m) => m.id === message.id);
  if (index >= 0) return list.map((m, i) => (i === index ? message : m));
  const next = [...list, message];
  if (list.length > 0 && list[list.length - 1].createdAt > message.createdAt) {
    next.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  return next;
}

export const useMessagesStore = create<MessagesState>((set, get) => {
  const patchChat = (chatId: string, patch: (c: ChatMessages) => Partial<ChatMessages>) =>
    set((s) => {
      const current = s.byChat[chatId] ?? empty;
      return { byChat: { ...s.byChat, [chatId]: { ...current, ...patch(current) } } };
    });

  return {
    byChat: {},

    load: async (chatId) => {
      if (get().byChat[chatId]?.loaded) return;
      try {
        const page = await api.get<Page>(`/chats/${chatId}/messages`);
        patchChat(chatId, () => ({
          messages: page.messages,
          hasMore: page.hasMore,
          receipts: receiptsById(page.receipts),
          loaded: true,
          error: false,
        }));
      } catch {
        patchChat(chatId, () => ({ loaded: true, error: true }));
      }
    },

    loadOlder: async (chatId) => {
      const current = get().byChat[chatId];
      if (!current?.hasMore || current.loadingOlder || current.messages.length === 0) return;
      patchChat(chatId, () => ({ loadingOlder: true }));
      try {
        const page = await api.get<Page>(`/chats/${chatId}/messages?before=${current.messages[0].id}`);
        patchChat(chatId, (c) => ({
          messages: [...page.messages, ...c.messages.filter((m) => !page.messages.some((p) => p.id === m.id))],
          hasMore: page.hasMore,
          loadingOlder: false,
        }));
      } catch {
        patchChat(chatId, () => ({ loadingOlder: false }));
      }
    },

    upsert: (message) => {
      // Chats that were never opened load their history when opened.
      if (!get().byChat[message.chatId]?.loaded) return;
      patchChat(message.chatId, (c) => ({ messages: upsertSorted(c.messages, message) }));
    },

    setReactions: (chatId, messageId, reactions) =>
      patchChat(chatId, (c) => ({ messages: c.messages.map((m) => (m.id === messageId ? { ...m, reactions } : m)) })),

    setReceipt: (chatId, receipt) =>
      patchChat(chatId, (c) => {
        const previous = c.receipts[receipt.userId];
        if (previous && previous.readAt >= receipt.readAt) return {};
        return { receipts: { ...c.receipts, [receipt.userId]: receipt } };
      }),

    send: async (chatId, input) => {
      const { message } = await api.post<{ message: MessageDto }>(`/chats/${chatId}/messages`, input);
      get().upsert(message);
    },

    edit: async (messageId, content, subject) => {
      const { message } = await api.patch<{ message: MessageDto }>(`/messages/${messageId}`, { content, subject });
      get().upsert(message);
    },

    remove: async (messageId) => {
      const { message } = await api.delete<{ message: MessageDto }>(`/messages/${messageId}`);
      get().upsert(message);
    },

    react: async (messageId, emoji) => {
      const r = await api.post<{ chatId: string; messageId: string; reactions: ReactionSummary[] }>(
        `/messages/${messageId}/reactions`,
        { emoji },
      );
      get().setReactions(r.chatId, r.messageId, r.reactions);
    },

    togglePin: async (messageId) => {
      const { message } = await api.post<{ message: MessageDto }>(`/messages/${messageId}/pin`);
      get().upsert(message);
    },

    forward: async (messageId, chatId) => {
      const { message } = await api.post<{ message: MessageDto }>(`/messages/${messageId}/forward`, { chatId });
      get().upsert(message);
    },

    markUnread: async (messageId) => {
      await api.post(`/messages/${messageId}/unread`);
    },

    createPoll: async (chatId, poll) => {
      const { message } = await api.post<{ message: MessageDto }>(`/chats/${chatId}/polls`, poll);
      get().upsert(message);
    },

    vote: async (pollId, optionIds) => {
      const { message } = await api.post<{ message: MessageDto }>(`/polls/${pollId}/vote`, { optionIds });
      get().upsert(message);
    },

    reset: () => set({ byChat: {} }),
  };
});
