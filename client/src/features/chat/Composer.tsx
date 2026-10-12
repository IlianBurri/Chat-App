import clsx from 'clsx';
import {
  BarChart3,
  Bold,
  CalendarPlus,
  Code,
  Italic,
  Link2,
  List,
  ListOrdered,
  Paperclip,
  Plus,
  SendHorizontal,
  Smile,
  Strikethrough,
  Type,
  X,
} from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { create } from 'zustand';
import { Avatar } from '@/components/ui/Avatar';
import { useComingSoon } from '@/components/ui/ComingSoon';
import { EmojiPicker } from '@/components/ui/EmojiPicker';
import { IconButton } from '@/components/ui/IconButton';
import { Menu, MenuItem } from '@/components/ui/Menu';
import { Popover } from '@/components/ui/Popover';
import { useToast } from '@/components/ui/Toaster';
import { previewText } from '@/lib/format';
import { getSocket } from '@/lib/socket';
import { codeFormat, insertMention, linkFormat, mentionQuery, prefixLines, wrapSelection, type Edit } from '@/lib/textFormat';
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
  const [caret, setCaret] = useState(0);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionDismissed, setMentionDismissed] = useState<string | null>(null);
  const [pollOpen, setPollOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastTypingSent = useRef(0);

  // --- typing indicator ------------------------------------------------------
  const signalTyping = (typing: boolean) => {
    const socket = getSocket();
    if (!socket) return;
    if (typing && Date.now() - lastTypingSent.current > TYPING_REFRESH_MS) {
      socket.emit('typing', { chatId, typing: true });
      lastTypingSent.current = Date.now();
    } else if (!typing && lastTypingSent.current) {
      socket.emit('typing', { chatId, typing: false });
      lastTypingSent.current = 0;
    }
  };

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

  // --- mentions --------------------------------------------------------------
  const mention = mentionQuery(text, caret);
  const mentionKey = mention ? `${mention.start}:${mention.query}` : null;
  const candidates =
    mention && mentionKey !== mentionDismissed
      ? people
          .filter((p) =>
            p.name
              .toLowerCase()
              .split(/\s+/)
              .concat(p.name.toLowerCase())
              .some((part) => part.startsWith(mention.query.toLowerCase())),
          )
          .slice(0, 6)
      : [];
  const mentionOpen = candidates.length > 0;

  // --- editing helpers -------------------------------------------------------
  const setText = (value: string) => {
    setDraft(chatId, { text: value });
    signalTyping(value.trim().length > 0);
  };

  const apply = (edit: Edit) => {
    setText(edit.text);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(edit.selectionStart, edit.selectionEnd);
      setCaret(edit.selectionEnd);
    });
  };

  const selection = () => {
    const el = textareaRef.current;
    return { start: el?.selectionStart ?? text.length, end: el?.selectionEnd ?? text.length };
  };

  const format = (kind: 'bold' | 'italic' | 'strike' | 'bullets' | 'numbers' | 'code' | 'link') => {
    const { start, end } = selection();
    switch (kind) {
      case 'bold':
        return apply(wrapSelection(text, start, end, '**', '**', t('composer.placeholderBold')));
      case 'italic':
        return apply(wrapSelection(text, start, end, '_', '_', t('composer.placeholderItalic')));
      case 'strike':
        return apply(wrapSelection(text, start, end, '~~', '~~', t('composer.placeholderStrike')));
      case 'bullets':
        return apply(prefixLines(text, start, end, () => '- '));
      case 'numbers':
        return apply(prefixLines(text, start, end, (i) => `${i + 1}. `));
      case 'code':
        return apply(codeFormat(text, start, end));
      case 'link':
        return apply(linkFormat(text, start, end, t('composer.placeholderLink')));
    }
  };

  const insertText = (value: string) => {
    const { start, end } = selection();
    apply({ text: text.slice(0, start) + value + text.slice(end), selectionStart: start + value.length, selectionEnd: start + value.length });
  };

  const pickMention = (person: PublicUser) => {
    if (!mention) return;
    apply(insertMention(text, mention.start, caret, person.name));
  };

  // --- sending ---------------------------------------------------------------
  const submit = async () => {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      await send(chatId, {
        content,
        subject: expanded && subject.trim() ? subject.trim() : undefined,
        replyToId: replyTo?.id,
      });
      setDraft(chatId, { text: '', subject: '' });
      signalTyping(false);
      onCancelReply();
      setExpanded(false);
    } catch {
      showToast(t('composer.sendFailed'), 'error');
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const delta = e.key === 'ArrowDown' ? 1 : -1;
        setMentionIndex((i) => (i + delta + candidates.length) % candidates.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        pickMention(candidates[Math.min(mentionIndex, candidates.length - 1)]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionDismissed(mentionKey);
        return;
      }
    }
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'b' || e.key === 'i')) {
      e.preventDefault();
      format(e.key === 'b' ? 'bold' : 'italic');
      return;
    }
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

  const formatButtons = [
    { kind: 'bold', icon: Bold, label: t('composer.bold') },
    { kind: 'italic', icon: Italic, label: t('composer.italic') },
    { kind: 'strike', icon: Strikethrough, label: t('composer.strike') },
    { kind: 'bullets', icon: List, label: t('composer.bullets') },
    { kind: 'numbers', icon: ListOrdered, label: t('composer.numbers') },
    { kind: 'code', icon: Code, label: t('composer.code') },
    { kind: 'link', icon: Link2, label: t('composer.link') },
  ] as const;

  return (
    <div className="relative px-5 pb-4">
      {mentionOpen && (
        <ul
          id="mention-suggestions"
          role="listbox"
          aria-label={t('composer.mentionSuggestions')}
          className="absolute bottom-full left-5 z-30 mb-1 w-72 rounded-lg border border-line bg-main py-1 shadow-pop"
        >
          {candidates.map((p, i) => (
            <li
              key={p.id}
              id={`mention-${p.id}`}
              role="option"
              aria-selected={i === mentionIndex}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => pickMention(p)}
              onPointerEnter={() => setMentionIndex(i)}
              className={clsx('flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm', i === mentionIndex && 'bg-hover')}
            >
              <Avatar user={p} size="xs" showStatus />
              {p.name}
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-lg border border-line bg-input shadow-card focus-within:border-b-accent focus-within:shadow-[inset_0_-2px_0_var(--ui-accent)]">
        {replyTo && (
          <div className="mx-2 mt-2 flex items-start gap-2 rounded-md border-l-[3px] border-accent bg-bubble px-2.5 py-1.5 text-xs">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{t('composer.replyingTo', { name: replyTo.author.name })}</p>
              <p className="truncate text-muted">{previewText(replyTo.content)}</p>
            </div>
            <IconButton label={t('composer.cancelReply')} icon={X} size="sm" onClick={onCancelReply} />
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
            <div role="toolbar" aria-label={t('composer.formatting')} className="flex flex-wrap items-center gap-0.5 pb-1.5">
              {formatButtons.map((b) => (
                <IconButton key={b.kind} label={b.label} icon={b.icon} size="sm" onMouseDown={(e) => e.preventDefault()} onClick={() => format(b.kind)} />
              ))}
              <span className="ml-auto text-xs text-subtle">{t('composer.ctrlEnterHint')}</span>
            </div>
          </div>
        )}

        <textarea
          ref={textareaRef}
          rows={1}
          aria-label={t('composer.placeholder')}
          aria-autocomplete="list"
          aria-controls={mentionOpen ? 'mention-suggestions' : undefined}
          aria-activedescendant={mentionOpen ? `mention-${candidates[Math.min(mentionIndex, candidates.length - 1)].id}` : undefined}
          placeholder={t('composer.placeholder')}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setCaret(e.target.selectionStart);
            setMentionIndex(0);
          }}
          onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
          onKeyDown={onKeyDown}
          onBlur={() => signalTyping(false)}
          className={clsx(
            'block w-full resize-none bg-transparent px-3 py-2.5 text-sm leading-relaxed outline-none placeholder:text-subtle focus-visible:outline-none',
            expanded && 'min-h-24',
          )}
        />

        <div className="flex items-center gap-0.5 px-2 pb-1.5">
          <IconButton label={expanded ? t('composer.collapse') : t('composer.format')} icon={Type} size="sm" active={expanded} aria-pressed={expanded} onClick={() => setExpanded((v) => !v)} />
          <Popover
            label={t('composer.emoji')}
            placement="top-start"
            trigger={({ ref, ...props }) => <IconButton ref={ref} label={t('composer.emoji')} icon={Smile} size="sm" {...props} />}
          >
            {(close) => (
              <EmojiPicker
                onSelect={(emoji) => {
                  close();
                  insertText(emoji);
                }}
              />
            )}
          </Popover>
          <IconButton label={t('composer.attach')} icon={Paperclip} size="sm" onClick={() => showComingSoon(t('composer.attach'))} />
          <Menu
            label={t('composer.more')}
            align="start"
            placement="top"
            width={220}
            trigger={({ ref, ...props }) => <IconButton ref={ref} label={t('composer.more')} icon={Plus} size="sm" {...props} />}
          >
            <MenuItem icon={BarChart3} onSelect={() => setPollOpen(true)}>
              {t('poll.create')}
            </MenuItem>
            <MenuItem icon={CalendarPlus} onSelect={() => showComingSoon(t('composer.scheduleMeeting'))}>
              {t('composer.scheduleMeeting')}
            </MenuItem>
          </Menu>
          <IconButton
            label={t('composer.send')}
            icon={SendHorizontal}
            size="sm"
            className={clsx('ml-auto', text.trim() && 'text-accent hover:text-accent')}
            disabled={!text.trim() || sending}
            onClick={() => void submit()}
          />
        </div>
      </div>
      <PollDialog chatId={chatId} open={pollOpen} onClose={() => setPollOpen(false)} />
    </div>
  );
}
