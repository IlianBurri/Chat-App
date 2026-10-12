import type { Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth';
import { useChatsStore } from '@/stores/chats';
import { useMessagesStore } from '@/stores/messages';
import { usePresenceStore } from '@/stores/presence';
import { useTypingStore } from '@/stores/typing';
import type { ChatSummary, MessageDto, ReactionSummary, Status } from './types';

interface PresenceEvent {
  userId: string;
  status: Status;
  statusMessage: string | null;
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
    'presence:snapshot': (events: PresenceEvent[]) => events.forEach(applyPresence),
    'presence:update': applyPresence,

    'message:new': (message: MessageDto) => {
      messages().upsert(message);
      chats().applyMessage(message, meId(), true);
      useTypingStore.getState().clearUser(message.chatId, message.author.id);
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
  };

  for (const [event, handler] of Object.entries(handlers)) socket.on(event, handler);
  return () => {
    for (const [event, handler] of Object.entries(handlers)) socket.off(event, handler);
  };
}
