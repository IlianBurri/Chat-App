import { MessageCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useParams, useSearchParams } from 'react-router';
import { EmptyState } from '@/components/layout/PlaceholderView';
import type { MessageDto } from '@/lib/types';
import { useAuthStore } from '@/stores/auth';
import { isUnread, useChatsStore } from '@/stores/chats';
import { useMessagesStore } from '@/stores/messages';
import { useTypingNames } from '@/stores/typing';
import { ChatHeader } from './ChatHeader';
import { Composer } from './Composer';
import { MessageList } from './MessageList';

export function ChatView() {
  const { chatId } = useParams();
  const me = useAuthStore((s) => s.user);
  const chat = useChatsStore((s) => s.chats.find((c) => c.id === chatId));
  const chatsLoaded = useChatsStore((s) => s.loaded);

  if (!chatId || !me) return null;
  if (!chat) return chatsLoaded ? <Navigate to="/chat" replace /> : <main className="flex-1 bg-main" />;
  // key: reset reply/edit state when switching chats
  return <OpenChat key={chat.id} chatId={chat.id} meId={me.id} />;
}

function OpenChat({ chatId, meId }: { chatId: string; meId: string }) {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const chat = useChatsStore((s) => s.chats.find((c) => c.id === chatId))!;
  const state = useMessagesStore((s) => s.byChat[chatId]);
  const [replyTo, setReplyTo] = useState<MessageDto | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const typingNames = useTypingNames(chatId);
  const others = useMemo(() => chat.members.filter((m) => m.id !== meId), [chat.members, meId]);

  // Load history (again after a reconnect reset).
  useEffect(() => {
    if (!state?.loaded) void useMessagesStore.getState().load(chatId);
  }, [chatId, state?.loaded]);

  // This chat is "active": new messages are read immediately while visible.
  useEffect(() => {
    useChatsStore.getState().setActive(chatId);
    return () => useChatsStore.getState().setActive(null);
  }, [chatId]);

  const unread = isUnread(chat);
  useEffect(() => {
    const markIfVisible = () => {
      if (document.visibilityState === 'visible' && isUnread(useChatsStore.getState().chats.find((c) => c.id === chatId) ?? chat)) {
        void useChatsStore.getState().markRead(chatId);
      }
    };
    markIfVisible();
    document.addEventListener('visibilitychange', markIfVisible);
    return () => document.removeEventListener('visibilitychange', markIfVisible);
    // chat is only a fallback for the lookup
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, unread]);

  const editLast = useCallback(() => {
    const own = state?.messages.filter((m) => m.author.id === meId && m.type === 'text' && !m.deleted);
    const last = own?.[own.length - 1];
    if (last) setEditingId(last.id);
  }, [state?.messages, meId]);

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-main">
      <ChatHeader chat={chat} meId={meId} />
      {state?.error ? (
        <EmptyState icon={MessageCircle} title={t('auth.errors.generic')} text={t('chat.loadFailed')} />
      ) : state?.loaded ? (
        <MessageList
          chat={chat}
          state={state}
          meId={meId}
          editingId={editingId}
          onEdit={setEditingId}
          onReply={setReplyTo}
          focusMessageId={searchParams.get('message')}
        />
      ) : (
        <div className="flex-1" aria-busy="true" />
      )}
      <p aria-live="polite" className="h-5 px-6 text-xs text-muted">
        {typingNames.length > 0 && <TypingText names={typingNames} />}
      </p>
      <Composer chatId={chatId} people={others} replyTo={replyTo} onCancelReply={() => setReplyTo(null)} onEditLast={editLast} />
    </main>
  );
}

function TypingText({ names }: { names: string[] }) {
  const { t } = useTranslation();
  const text =
    names.length === 1
      ? t('chat.typingOne', { name: names[0] })
      : names.length === 2
        ? t('chat.typingTwo', { first: names[0], second: names[1] })
        : t('chat.typingMany');
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className="inline-flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-1 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${i * 150}ms` }} />
        ))}
      </span>
      {text}
    </span>
  );
}

export function ChatEmpty() {
  const { t } = useTranslation();
  return (
    <main className="flex flex-1 bg-main">
      <EmptyState icon={MessageCircle} title={t('chat.selectChat')} text={t('chat.selectChatHint')} />
    </main>
  );
}
