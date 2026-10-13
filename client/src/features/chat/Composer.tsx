import clsx from 'clsx';
import { CalendarPlusIcon, ChartBarIcon, PaperPlaneRightIcon, PlusIcon, SmileyIcon, TextAaIcon, XIcon } from '@phosphor-icons/react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { create } from 'zustand';
import { FormatToolbar, MentionSuggestions } from '@/components/editor/EditorParts';
import { AttachButton, AttachmentTray, DropOverlay } from '@/components/files/AttachmentTray';
import { useAttachments } from '@/components/files/useAttachments';
import { useTextEditor } from '@/components/editor/useTextEditor';
import { useComingSoon } from '@/components/ui/ComingSoon';
import { EmojiPicker } from '@/components/ui/EmojiPicker';
import { IconButton } from '@/components/ui/IconButton';
import { Menu, MenuItem } from '@/components/ui/Menu';
import { Popover } from '@/components/ui/Popover';
import { useToast } from '@/components/ui/Toaster';
import { previewText } from '@/lib/format';
import { getSocket } from '@/lib/socket';
import type { MessageDto, PublicUser } from '@/lib/types';
import { useMessagesStore } from '@/stores/messages';
import { PollDialog } from './PollDialog';

interface Draft {
  text: string;
  subject: string;
}

/** Unsent text per chat survives switching between chats. */
const useDrafts = create<{ drafts: Record<string, Draft>; set: (chatId: string, draft: Partial<Draft>) => void }>((set) => ({
  drafts: {},
  set: (chatId, draft) =>
    set((s) => ({ drafts: { ...s.drafts, [chatId]: { ...(s.drafts[chatId] ?? { text: '', subject: '' }), ...draft } } })),
}));

/** How often a "still typing" signal is re-sent while typing. */
const TYPING_REFRESH_MS = 2500;

interface ComposerProps {
  chatId: string;
  /** People that can be @mentioned (the other chat members) */
  people: PublicUser[];
  replyTo: MessageDto | null;
  onCancelReply: () => void;
  onEditLast: () => void;
}

export function Composer({ chatId, people, replyTo, onCancelReply, onEditLast }: ComposerProps) {
  const { t } = useTranslation();
  const send = useMessagesStore((s) => s.send);
  const showToast = useToast((s) => s.show);
  const showComingSoon = useComingSoon((s) => s.show);
  const draft = useDrafts((s) => s.drafts[chatId]);
  const setDraft = useDrafts((s) => s.set);
  const text = draft?.text ?? '';
  const subject = draft?.subject ?? '';

  const [expanded, setExpanded] = useState(false);
  const [sending, setSending] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastTypingSent = useRef(0);

  // --- typing indicator ------------------------------------------------------
  const signalTyping = useCallback(
    (typing: boolean) => {
      const socket = getSocket();
      if (!socket) return;
      const now = Date.now();
      if (typing && now - lastTypingSent.current > TYPING_REFRESH_MS) {
        socket.emit('typing', { chatId, typing: true });
        lastTypingSent.current = now;
      } else if (!typing && lastTypingSent.current) {
        socket.emit('typing', { chatId, typing: false });
        lastTypingSent.current = 0;
      }
    },
    [chatId],
  );

  useEffect(
    () => () => {
      if (lastTypingSent.current) getSocket()?.emit('typing', { chatId, typing: false });
      lastTypingSent.current = 0;
    },
    [chatId],
  );

  useEffect(() => {
    textareaRef.current?.focus();
  }, [chatId, replyTo]);

  // Auto-grow up to a maximum height.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, expanded ? 320 : 200)}px`;
  }, [text, expanded]);

  // --- editing ---------------------------------------------------------------
  const setText = (value: string) => {
    setDraft(chatId, { text: value });
    signalTyping(value.trim().length > 0);
  };
  const candidates = useMemo(() => people.map((p) => ({ id: p.id, name: p.name, user: p })), [people]);
  const editor = useTextEditor({ text, onTextChange: setText, candidates, textareaRef });
  const attachments = useAttachments({ chatId });
  const canSend = (text.trim().length > 0 || attachments.hasFiles) && !attachments.uploading;

  // --- sending ---------------------------------------------------------------
  const submit = async () => {
    const content = text.trim();
    if (attachments.uploading) {
      showToast(t('files.waitForUpload'), 'error');
      return;
    }
    if (!canSend || sending) return;
    setSending(true);
    // Clear right away so the user can keep typing (or press ArrowUp to edit)
    // while the request is in flight; the draft comes back if sending fails.
    const previous = { text, subject, expanded };
    const files = attachments.take();
    setDraft(chatId, { text: '', subject: '' });
    signalTyping(false);
    setExpanded(false);
    try {
      await send(chatId, {
        content,
        subject: previous.expanded && subject.trim() ? subject.trim() : undefined,
        replyToId: replyTo?.id,
        fileIds: files.fileIds.length ? files.fileIds : undefined,
      });
      files.release();
      onCancelReply();
    } catch {
      files.restore();
      setDraft(chatId, { text: previous.text, subject: previous.subject });
      setExpanded(previous.expanded);
      showToast(t('composer.sendFailed'), 'error');
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (editor.handleKeyDown(e)) return;
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      const sendNow = expanded ? e.ctrlKey || e.metaKey : !e.shiftKey;
      if (sendNow) {
        e.preventDefault();
        void submit();
      }
      return;
    }
    if (e.key === 'ArrowUp' && text === '') {
      e.preventDefault();
      onEditLast();
      return;
    }
    if (e.key === 'Escape' && replyTo) {
      e.preventDefault();
      onCancelReply();
    }
  };

  return (
    <div className="relative px-5 pb-4">
      <MentionSuggestions mentions={editor.mentions} className="left-5" />

      <div
        {...attachments.dropProps}
        className="relative rounded-lg border border-line bg-input shadow-card focus-within:border-b-accent focus-within:shadow-[inset_0_-2px_0_var(--ui-accent)]"
      >
        <DropOverlay visible={attachments.dragging} />
        {replyTo && (
          <div className="mx-2 mt-2 flex items-start gap-2 rounded-md border-l-[3px] border-accent bg-bubble px-2.5 py-1.5 text-xs">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{t('composer.replyingTo', { name: replyTo.author.name })}</p>
              <p className="truncate text-muted">{previewText(replyTo.content)}</p>
            </div>
            <IconButton label={t('composer.cancelReply')} icon={XIcon} size="sm" onClick={onCancelReply} />
          </div>
        )}

        {expanded && (
          <div className="border-b border-line px-3 pt-2">
            <input
              aria-label={t('composer.subject')}
              placeholder={t('composer.subject')}
              value={subject}
              maxLength={200}
              onChange={(e) => setDraft(chatId, { subject: e.target.value })}
              className="h-9 w-full bg-transparent text-base font-semibold outline-none placeholder:font-normal placeholder:text-subtle focus-visible:outline-none"
            />
            <FormatToolbar onFormat={editor.format} hint={t('composer.ctrlEnterHint')} />
          </div>
        )}

        <textarea
          ref={textareaRef}
          rows={1}
          aria-label={t('composer.placeholder')}
          placeholder={t('composer.placeholder')}
          {...editor.textareaProps}
          onKeyDown={onKeyDown}
          onPaste={attachments.onPaste}
          onBlur={() => signalTyping(false)}
          className={clsx(
            'block w-full resize-none bg-transparent px-3 py-2.5 text-sm leading-relaxed outline-none placeholder:text-subtle focus-visible:outline-none',
            expanded && 'min-h-24',
          )}
        />

        <AttachmentTray attachments={attachments} />

        <div className="flex items-center gap-0.5 px-2 pb-1.5">
          <IconButton label={expanded ? t('composer.collapse') : t('composer.format')} icon={TextAaIcon} size="sm" active={expanded} aria-pressed={expanded} onClick={() => setExpanded((v) => !v)} />
          <Popover
            label={t('composer.emoji')}
            placement="top-start"
            trigger={({ ref, ...props }) => <IconButton ref={ref} label={t('composer.emoji')} icon={SmileyIcon} size="sm" {...props} />}
          >
            <EmojiPicker onSelect={editor.insertText} />
          </Popover>
          <AttachButton attachments={attachments} />
          <Menu
            label={t('composer.more')}
            align="start"
            placement="top"
            width={220}
            trigger={({ ref, ...props }) => <IconButton ref={ref} label={t('composer.more')} icon={PlusIcon} size="sm" {...props} />}
          >
            <MenuItem icon={ChartBarIcon} onSelect={() => setPollOpen(true)}>
              {t('poll.create')}
            </MenuItem>
            <MenuItem icon={CalendarPlusIcon} onSelect={() => showComingSoon(t('composer.scheduleMeeting'))}>
              {t('composer.scheduleMeeting')}
            </MenuItem>
          </Menu>
          <IconButton
            label={t('composer.send')}
            icon={PaperPlaneRightIcon}
            size="sm"
            className={clsx('ml-auto', canSend && 'text-accent hover:text-accent')}
            disabled={!canSend || sending}
            onClick={() => void submit()}
          />
        </div>
      </div>
      <PollDialog chatId={chatId} open={pollOpen} onClose={() => setPollOpen(false)} />
    </div>
  );
}
