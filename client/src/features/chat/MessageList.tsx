import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toaster';
import type { MentionTarget } from '@/lib/markdown';
import { buildTimeline, dateSeparatorLabel, isSeen } from '@/lib/timeline';
import type { ChatSummary, MessageDto } from '@/lib/types';
import { useMessagesStore, type ChatMessages } from '@/stores/messages';
import { ForwardDialog } from './ForwardDialog';
import { MessageItem } from './MessageItem';
import type { MessageActions } from './MessageToolbar';

interface MessageListProps {
  chat: ChatSummary;
  state: ChatMessages;
  meId: string;
  editingId: string | null;
  onEdit: (messageId: string | null) => void;
  onReply: (message: MessageDto) => void;
  /** Message to scroll to and highlight (from a copied link) */
  focusMessageId: string | null;
}

/** Store actions are stable; reading them directly avoids re-rendering on every store change. */
const messageActions = () => useMessagesStore.getState();

function scrollToMessage(messageId: string) {
  document.getElementById(`message-${messageId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

/** Pixels from the bottom within which new messages keep the view pinned to the end. */
const STICK_THRESHOLD = 120;

export function MessageList({ chat, state, meId, editingId, onEdit, onReply, focusMessageId }: MessageListProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const showToast = useToast((s) => s.show);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [deleteTarget, setDeleteTarget] = useState<MessageDto | null>(null);
  const [forwardTarget, setForwardTarget] = useState<MessageDto | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const { messages } = state;
  const items = useMemo(() => buildTimeline(messages), [messages]);
  const members: MentionTarget[] = useMemo(() => chat.members.map((m) => ({ id: m.id, name: m.name })), [chat.members]);
  const memberIds = useMemo(() => chat.members.map((m) => m.id), [chat.members]);
  const now = new Date();

  // --- scrolling -----------------------------------------------------------
  const firstId = messages[0]?.id;
  const lastId = messages[messages.length - 1]?.id;
  const snapshot = useRef({ firstId, lastId, scrollHeight: 0, nearBottom: true, initialised: false });

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    snapshot.current.nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD;
    if (el.scrollTop < 80 && state.hasMore && !state.loadingOlder) {
      snapshot.current.scrollHeight = el.scrollHeight;
      void messageActions().loadOlder(chat.id);
    }
  };

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const prev = snapshot.current;
    if (!prev.initialised && messages.length > 0) {
      el.scrollTop = el.scrollHeight;
      prev.initialised = true;
    } else if (firstId !== prev.firstId && lastId === prev.lastId && prev.scrollHeight) {
      // Older messages were prepended: keep the visible message in place.
      el.scrollTop += el.scrollHeight - prev.scrollHeight;
      prev.scrollHeight = 0;
    } else if (lastId !== prev.lastId) {
      const mine = messages[messages.length - 1]?.author.id === meId;
      if (prev.nearBottom || mine) el.scrollTo({ top: el.scrollHeight, behavior: prev.initialised ? 'smooth' : 'auto' });
    }
    prev.firstId = firstId;
    prev.lastId = lastId;
  }, [firstId, lastId, messages, meId]);

  // Keep the end in view when reactions or edits change the height near the bottom.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      if (snapshot.current.nearBottom) el.scrollTop = el.scrollHeight;
    });
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, []);

  const jumpTo = useCallback((messageId: string) => {
    scrollToMessage(messageId);
    setHighlightId(messageId);
  }, []);

  // A copied link (?message=…) scrolls to its message once it is loaded.
  const focusLoaded = focusMessageId !== null && messages.some((m) => m.id === focusMessageId);
  useEffect(() => {
    if (focusLoaded && focusMessageId) scrollToMessage(focusMessageId);
  }, [focusLoaded, focusMessageId]);

  // --- actions -------------------------------------------------------------
  const run = useCallback(
    async (action: () => Promise<unknown>, success?: string) => {
      try {
        await action();
        if (success) showToast(success);
      } catch {
        showToast(t('auth.errors.generic'), 'error');
      }
    },
    [showToast, t],
  );

  const actions: MessageActions = useMemo(
    () => ({
      react: (m, emoji) => void run(() => messageActions().react(m.id, emoji)),
      reply: onReply,
      edit: (m) => onEdit(m.id),
      remove: (m) => setDeleteTarget(m),
      togglePin: (m) => void run(() => messageActions().togglePin(m.id), m.pinned ? t('message.unpinned') : t('message.pinnedToast')),
      forward: (m) => setForwardTarget(m),
      markUnread: (m) =>
        void run(async () => {
          await messageActions().markUnread(m.id);
          navigate('/chat');
        }),
      copyLink: (m) =>
        void run(
          () => navigator.clipboard.writeText(`${window.location.origin}/chat/${m.chatId}?message=${m.id}`),
          t('message.linkCopied'),
        ),
    }),
    [run, onReply, onEdit, navigate, t],
  );

  return (
    <>
      <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto" aria-busy={state.loadingOlder}>
        <div role="log" aria-label={t('chat.history')} aria-live="polite" className="pt-4 pb-6">
          {state.loadingOlder && (
            <div className="flex justify-center py-2 text-muted">
              <Loader2 className="size-5 animate-spin" aria-label={t('common.loading')} />
            </div>
          )}
          {!state.hasMore && messages.length > 0 && <p className="py-4 text-center text-xs text-subtle">{t('chat.beginning')}</p>}
          {state.loaded && messages.length === 0 && <p className="py-10 text-center text-sm text-muted">{t('chat.noMessages')}</p>}
          {items.map((item) =>
            item.kind === 'date' ? (
              <div key={item.key} role="separator" className="my-4 flex items-center gap-3 px-5 text-xs font-medium text-muted">
                <span className="h-px flex-1 bg-line" />
                {dateSeparatorLabel(item.date, now, i18n.resolvedLanguage, { today: t('chat.today'), yesterday: t('chat.yesterday') })}
                <span className="h-px flex-1 bg-line" />
              </div>
            ) : (
              <MessageItem
                key={item.key}
                message={item.message}
                groupStart={item.groupStart}
                groupEnd={item.groupEnd}
                meId={meId}
                members={members}
                seen={item.message.author.id === meId ? isSeen(item.message, state.receipts, memberIds, meId) : undefined}
                editing={editingId === item.message.id}
                highlighted={highlightId === item.message.id || focusMessageId === item.message.id}
                actions={actions}
                onEditDone={() => onEdit(null)}
                onJumpTo={jumpTo}
              />
            ),
          )}
        </div>
      </div>

      <Dialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t('message.deleteTitle')}
        width={400}
        footer={
          <>
            <Button onClick={() => setDeleteTarget(null)}>{t('common.cancel')}</Button>
            <Button
              variant="danger"
              onClick={() => {
                const target = deleteTarget;
                setDeleteTarget(null);
                if (target) void run(() => messageActions().remove(target.id));
              }}
            >
              {t('message.delete')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">{t('message.deleteText')}</p>
      </Dialog>

      <ForwardDialog message={forwardTarget} onClose={() => setForwardTarget(null)} />
    </>
  );
}
