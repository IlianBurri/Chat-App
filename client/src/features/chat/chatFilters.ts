import type { ChatSummary } from '@/lib/types';
import { chatTitle, isUnread } from '@/stores/chats';

export type ChatFilter = 'all' | 'unread' | 'chats' | 'channels' | 'meetings';

/** Splits the visible chats into the "Pinned" and "Recent" sections. */
export function groupChats(chats: ChatSummary[], filter: ChatFilter, query: string, meId: string | undefined) {
  const q = query.trim().toLowerCase();
  const visible = chats.filter((chat) => {
    // Hidden chats come back as soon as there is something new.
    if (chat.hidden && !isUnread(chat)) return false;
    if (filter === 'unread' && !isUnread(chat)) return false;
    if (q && !chatTitle(chat, meId).toLowerCase().includes(q)) return false;
    return true;
  });
  return {
    pinned: visible.filter((c) => c.pinned),
    recent: visible.filter((c) => !c.pinned),
  };
}
