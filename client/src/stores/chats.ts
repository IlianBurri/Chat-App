import { create } from 'zustand';
import { api } from '@/lib/api';
import type { ChatSummary } from '@/lib/types';
import { usePresenceStore } from './presence';

interface ChatsState {
  chats: ChatSummary[];
  loaded: boolean;
  error: boolean;
  load: () => Promise<void>;
}

export const useChatsStore = create<ChatsState>((set) => ({
  chats: [],
  loaded: false,
  error: false,
  load: async () => {
    try {
      const { chats } = await api.get<{ chats: ChatSummary[] }>('/chats');
      usePresenceStore.getState().setFromUsers(chats.flatMap((c) => c.members));
      set({ chats, loaded: true, error: false });
    } catch {
      set({ loaded: true, error: true });
    }
  },
}));

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
