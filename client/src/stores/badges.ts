import { useActivityStore } from './activity';
import { isUnread, useChatsStore } from './chats';
import { useWorkspacesStore } from './workspaces';

/** Counters shown as red badges in the app bar; muted chats and channels don't count. */
export function useBadgeCounts() {
  const activity = useActivityStore((s) => s.unreadCount);
  const chat = useChatsStore((s) => s.chats.filter((c) => !c.muted && isUnread(c)).length);
  const teams = useWorkspacesStore((s) =>
    s.workspaces.reduce((n, w) => n + w.channels.filter((c) => c.unread && !c.muted && !c.hidden).length, 0),
  );
  return { activity, chat, teams };
}
