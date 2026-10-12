import { useId, useState, type ChangeEvent, type KeyboardEvent, type RefObject, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { codeFormat, insertMention, linkFormat, mentionQuery, prefixLines, wrapSelection, type Edit } from '@/lib/textFormat';
import type { PublicUser } from '@/lib/types';

export type FormatKind = 'bold' | 'italic' | 'strike' | 'bullets' | 'numbers' | 'code' | 'link';

/** Someone (or something, like the whole channel) that can be @mentioned. */
export interface MentionCandidate {
  id: string;
  name: string;
  user?: PublicUser;
}

interface Options {
  text: string;
  onTextChange: (text: string) => void;
  candidates: MentionCandidate[];
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}

const MAX_SUGGESTIONS = 6;

function matches(candidate: MentionCandidate, query: string) {
  const name = candidate.name.toLowerCase();
  const q = query.toLowerCase();
  return name.startsWith(q) || name.split(/\s+/).some((part) => part.startsWith(q));
}

/**
 * Shared text editing for the chat composer and channel posts: markdown
 * formatting, inserting text at the caret and @-mention autocomplete.
 */
export function useTextEditor({ text, onTextChange, candidates, textareaRef }: Options) {
  const { t } = useTranslation();
  const listId = useId();
  const [caret, setCaret] = useState(0);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionDismissed, setMentionDismissed] = useState<string | null>(null);

  const mention = mentionQuery(text, caret);
  const mentionKey = mention ? `${mention.start}:${mention.query}` : null;
  const suggestions =
    mention && mentionKey !== mentionDismissed ? candidates.filter((c) => matches(c, mention.query)).slice(0, MAX_SUGGESTIONS) : [];
  const mentionOpen = suggestions.length > 0;
  const activeIndex = Math.min(mentionIndex, suggestions.length - 1);

  const apply = (edit: Edit) => {
    onTextChange(edit.text);
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

  const format = (kind: FormatKind) => {
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

  const pickMention = (candidate: MentionCandidate) => {
    if (!mention) return;
    apply(insertMention(text, mention.start, caret, candidate.name));
  };

  /**
   * Handles mention navigation and formatting shortcuts.
   * Returns true when the key was consumed and the caller should ignore it.
   */
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): boolean => {
    if (mentionOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const delta = e.key === 'ArrowDown' ? 1 : -1;
        setMentionIndex((i) => (i + delta + suggestions.length) % suggestions.length);
        return true;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        pickMention(suggestions[activeIndex]);
        return true;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setMentionDismissed(mentionKey);
        return true;
      }
    }
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'b' || e.key === 'i')) {
      e.preventDefault();
      format(e.key === 'b' ? 'bold' : 'italic');
      return true;
    }
    return false;
  };

  /** Props for the textarea: value, change/selection tracking and combobox ARIA. */
  const textareaProps = {
    value: text,
    'aria-autocomplete': 'list' as const,
    'aria-controls': mentionOpen ? listId : undefined,
    'aria-activedescendant': mentionOpen ? `${listId}-${suggestions[activeIndex].id}` : undefined,
    onChange: (e: ChangeEvent<HTMLTextAreaElement>) => {
      onTextChange(e.target.value);
      setCaret(e.target.selectionStart);
      setMentionIndex(0);
    },
    onSelect: (e: SyntheticEvent<HTMLTextAreaElement>) => setCaret(e.currentTarget.selectionStart),
  };

  return {
    format,
    insertText,
    handleKeyDown,
    textareaProps,
    mentions: {
      listId,
      open: mentionOpen,
      suggestions,
      activeIndex,
      pick: pickMention,
      setActive: setMentionIndex,
    },
  };
}
