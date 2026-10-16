import type { Socket } from 'socket.io-client';
import { useToast } from '@/components/ui/Toaster';
import { handleSignal, onCallEndedForMe, onMemberJoined, onMemberLeft, onMemberUpdated, rejoinAfterReconnect } from '@/features/calls/session';
import type { ActiveCallDto, CallChatLine, CallMemberDto, IncomingCall } from '@/features/calls/types';
import i18n from '@/i18n';
import { api } from '@/lib/api';
import { useActivityStore } from '@/stores/activity';
import { useAuthStore } from '@/stores/auth';
import { callKey, useCallStore } from '@/stores/call';
import { useChatsStore } from '@/stores/chats';
import { useMeetingsStore } from '@/stores/meetings';
import { useMessagesStore } from '@/stores/messages';
import { usePostsStore } from '@/stores/posts';
import { usePresenceStore } from '@/stores/presence';
import { useTypingStore } from '@/stores/typing';
import { useWorkspacesStore } from '@/stores/workspaces';
import { alertForIncomingCall, alertForMessage, alertForNotification, alertForPost } from './alerts';
import type { ChatSummary, MeetingDto, MessageDto, NotificationDto, PostDto, ReactionSummary, Status } from './types';

interface PresenceEvent {
  userId: string;
  status: Status;
  statusMessage: string | null;
}

/** Running calls the user could join (after connecting or reconnecting). */
async function loadActiveCalls() {
  try {
    const { calls } = await api.get<{ calls: ActiveCallDto[] }>('/calls/active');
    useCallStore.getState().set({ active: Object.fromEntries(calls.map((c) => [c.key, c])) });
  } catch {
    // Banners just stay hidden until the next call event.
  }
}

/** Routes server events into the stores. Returns a function that removes the handlers. */
export function bindRealtime(socket: Socket): () => void {
  const meId = () => useAuthStore.getState().user?.id;
  const chats = () => useChatsStore.getState();
  const messages = () => useMessagesStore.getState();
  const applyPresence = (e: PresenceEvent) =>
    usePresenceStore.getState().update(e.userId, { status: e.status, statusMessage: e.statusMessage });

  // Payload types are declared per handler; socket.io itself is untyped here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handlers: Record<string, (payload: any) => void> = {
    connect: () => {
      void loadActiveCalls();
      void rejoinAfterReconnect();
    },
    'presence:snapshot': (events: PresenceEvent[]) => events.forEach(applyPresence),
    'presence:update': applyPresence,

    'message:new': (message: MessageDto) => {
      messages().upsert(message);
      chats().applyMessage(message, meId(), true);
      useTypingStore.getState().clearUser(message.chatId, message.author.id);
      alertForMessage(message);
    },
    'message:updated': (message: MessageDto) => {
      messages().upsert(message);
      chats().applyMessage(message, meId(), false);
    },
    'reaction:updated': (e: { chatId: string; messageId: string; reactions: ReactionSummary[] }) =>
      messages().setReactions(e.chatId, e.messageId, e.reactions),
    'read:updated': (e: { chatId: string; userId: string; readAt: string }) => {
      messages().setReceipt(e.chatId, { userId: e.userId, readAt: e.readAt });
      chats().applyRead(e.chatId, e.userId, meId());
    },
    typing: (e: { chatId: string; userId: string; name: string; typing: boolean }) =>
      useTypingStore.getState().set(e.chatId, e.userId, e.name, e.typing),

    'chat:new': (chat: ChatSummary) => chats().upsertChat(chat),
    'chat:updated': (chat: ChatSummary) => chats().upsertChat(chat),
    'chat:removed': (e: { chatId: string }) => chats().removeChat(e.chatId),
    'chat:flags': (e: { chatId: string; markedUnread: boolean }) => chats().applyFlags(e.chatId, { markedUnread: e.markedUnread }),

    'post:changed': (e: { post: PostDto; kind: 'post' | 'reply' | 'edit'; actorId: string }) => {
      usePostsStore.getState().upsert(e.post);
      const workspaces = useWorkspacesStore.getState();
      // New content from someone else marks the channel unread, unless it is open right now.
      if (e.kind !== 'edit' && e.actorId !== meId() && workspaces.activeChannelId !== e.post.channelId) {
        workspaces.setUnread(e.post.channelId, true);
      }
      if (e.kind !== 'edit') alertForPost(e.post, e.kind, e.actorId);
    },
    'workspaces:changed': () => void useWorkspacesStore.getState().load(),
    'channel:read': (e: { channelId: string }) => useWorkspacesStore.getState().setUnread(e.channelId, false),
    'channel:notes': (e: { channelId: string; notes: string }) => usePostsStore.getState().setNotes(e.channelId, e.notes),
    'channel:removed': (e: { channelId: string }) => usePostsStore.getState().forget(e.channelId),

    'meeting:upsert': (meeting: MeetingDto) => useMeetingsStore.getState().upsert(meeting),
    'meeting:removed': (e: { id: string }) => useMeetingsStore.getState().remove(e.id),

    'call:incoming': (call: IncomingCall) => {
      const current = useCallStore.getState();
      if (current.phase === 'in-call' && current.target && callKey(current.target) === call.key) return;
      current.addIncoming(call);
      alertForIncomingCall(call);
    },
    'call:ring-stopped': (e: { key: string }) => useCallStore.getState().removeIncoming(e.key),
    'call:active': (call: ActiveCallDto) => useCallStore.getState().setActive(call),
    'call:inactive': (e: { key: string }) => {
      useCallStore.getState().removeActive(e.key);
      useCallStore.getState().removeIncoming(e.key);
    },
    'call:signal': (e: { from: string; data: Parameters<typeof handleSignal>[0]['data'] }) => void handleSignal(e),
    'call:member-joined': (member: CallMemberDto) => onMemberJoined(member),
    'call:member-left': (e: { socketId: string }) => onMemberLeft(e),
    'call:member-updated': (member: CallMemberDto) => onMemberUpdated(member),
    'call:chat': (line: CallChatLine) => useCallStore.getState().addChat(line),
    'call:reaction': (e: { socketId: string; emoji: string }) => useCallStore.getState().addReaction(e.socketId, e.emoji),
    'call:moved': () => onCallEndedForMe('moved'),
    'call:unanswered': () => onCallEndedForMe('unanswered'),
    'call:declined': (e: { name: string; direct: boolean }) => {
      if (e.direct) onCallEndedForMe('declined', e.name);
      else useToast.getState().show(i18n.t('calls.declinedBy', { name: e.name }), 'error');
    },

    'notification:new': (e: { notification: NotificationDto; unreadCount: number }) => {
      useActivityStore.getState().added(e.notification, e.unreadCount);
      alertForNotification(e.notification);
    },
    'notification:removed': (e: { ids: string[]; unreadCount: number }) => useActivityStore.getState().removed(e.ids, e.unreadCount),
    'notification:read': (e: { ids: string[] | 'all'; unreadCount: number }) =>
      useActivityStore.getState().readChanged(e.ids, true, e.unreadCount),
    'notification:unread': (e: { id: string; unreadCount: number }) => useActivityStore.getState().readChanged([e.id], false, e.unreadCount),
  };

  for (const [event, handler] of Object.entries(handlers)) socket.on(event, handler);
  return () => {
    for (const [event, handler] of Object.entries(handlers)) socket.off(event, handler);
  };
}
