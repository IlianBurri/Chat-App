import clsx from 'clsx';
import { CodeIcon, LinkSimpleIcon, ListBulletsIcon, ListNumbersIcon, TextBIcon, TextItalicIcon, TextStrikethroughIcon, UsersThreeIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/ui/Avatar';
import { IconButton } from '@/components/ui/IconButton';
import type { FormatKind, MentionCandidate, useTextEditor } from './useTextEditor';

type Mentions = ReturnType<typeof useTextEditor>['mentions'];

/** Autocomplete list for @mentions; rendered above the editor. */
export function MentionSuggestions({ mentions, className }: { mentions: Mentions; className?: string }) {
  const { t } = useTranslation();
  if (!mentions.open) return null;
  return (
    <ul
      id={mentions.listId}
      role="listbox"
      aria-label={t('composer.mentionSuggestions')}
      className={clsx('absolute bottom-full z-30 mb-1 w-72 rounded-lg border border-line bg-main py-1 shadow-pop', className)}
    >
      {mentions.suggestions.map((c: MentionCandidate, i: number) => (
        <li
          key={c.id}
          id={`${mentions.listId}-${c.id}`}
          role="option"
          aria-selected={i === mentions.activeIndex}
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => mentions.pick(c)}
          onPointerEnter={() => mentions.setActive(i)}
          className={clsx('flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm', i === mentions.activeIndex && 'bg-hover')}
        >
          {c.user ? (
            <Avatar user={c.user} size="xs" showStatus />
          ) : (
            <span className="flex size-5 items-center justify-center rounded-full bg-accent-soft text-accent">
              <UsersThreeIcon className="size-3.5" aria-hidden="true" />
            </span>
          )}
          <span className="min-w-0 flex-1 truncate">{c.name}</span>
          {!c.user && <span className="text-xs text-subtle">{t('composer.mentionEveryone')}</span>}
        </li>
      ))}
    </ul>
  );
}

const FORMAT_BUTTONS = [
  { kind: 'bold', icon: TextBIcon, label: 'composer.bold' },
  { kind: 'italic', icon: TextItalicIcon, label: 'composer.italic' },
  { kind: 'strike', icon: TextStrikethroughIcon, label: 'composer.strike' },
  { kind: 'bullets', icon: ListBulletsIcon, label: 'composer.bullets' },
  { kind: 'numbers', icon: ListNumbersIcon, label: 'composer.numbers' },
  { kind: 'code', icon: CodeIcon, label: 'composer.code' },
  { kind: 'link', icon: LinkSimpleIcon, label: 'composer.link' },
] as const;

/** Bold, italic, lists, code and link buttons; keeps the textarea focused. */
export function FormatToolbar({ onFormat, hint }: { onFormat: (kind: FormatKind) => void; hint?: string }) {
  const { t } = useTranslation();
  return (
    <div role="toolbar" aria-label={t('composer.formatting')} className="flex flex-wrap items-center gap-0.5 pb-1.5">
      {FORMAT_BUTTONS.map((b) => (
        <IconButton key={b.kind} label={t(b.label)} icon={b.icon} size="sm" onMouseDown={(e) => e.preventDefault()} onClick={() => onFormat(b.kind)} />
      ))}
      {hint && <span className="ml-auto text-xs text-subtle">{hint}</span>}
    </div>
  );
}
