import clsx from 'clsx';
import { XIcon } from '@phosphor-icons/react';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import type { PublicUser } from '@/lib/types';
import { usePresenceStore } from '@/stores/presence';
import { Avatar } from './Avatar';

interface UserPickerProps {
  label: string;
  selected: PublicUser[];
  onChange: (users: PublicUser[]) => void;
  exclude?: string[];
  autoFocus?: boolean;
  placeholder?: string;
}

/** Search-as-you-type people picker with removable chips (combobox pattern). */
export function UserPicker({ label, selected, onChange, exclude = [], autoFocus, placeholder }: UserPickerProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PublicUser[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const handle = window.setTimeout(async () => {
      try {
        const { users } = await api.get<{ users: PublicUser[] }>(`/users?q=${encodeURIComponent(query.trim())}`);
        usePresenceStore.getState().setFromUsers(users);
        setResults(users.filter((u) => !exclude.includes(u.id) && !selected.some((s) => s.id === u.id)).slice(0, 8));
        setActive(0);
      } catch {
        setResults([]);
      }
    }, 150);
    return () => window.clearTimeout(handle);
    // exclude/selected are compared by content via the join below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open, exclude.join(), selected.map((s) => s.id).join()]);

  const add = (user: PublicUser) => {
    onChange([...selected, user]);
    setQuery('');
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      <div
        className="flex min-h-9 flex-wrap items-center gap-1 rounded-md border border-line bg-input px-1.5 py-1 focus-within:border-accent"
        onClick={() => inputRef.current?.focus()}
      >
        {selected.map((u) => (
          <span key={u.id} className="inline-flex items-center gap-1 rounded-full bg-accent-soft py-0.5 pr-1 pl-0.5 text-xs font-medium text-fg">
            <Avatar user={u} size="xs" />
            {u.name}
            <button
              type="button"
              aria-label={t('picker.remove', { name: u.name })}
              onClick={() => onChange(selected.filter((s) => s.id !== u.id))}
              className="rounded-full p-0.5 hover:bg-hover"
            >
              <XIcon className="size-3" aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          role="combobox"
          aria-label={label}
          aria-expanded={open && results.length > 0}
          aria-controls={listId}
          aria-activedescendant={open && results[active] ? `${listId}-${results[active].id}` : undefined}
          autoFocus={autoFocus}
          value={query}
          placeholder={selected.length ? '' : (placeholder ?? t('picker.placeholder'))}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter' && open && results[active]) {
              e.preventDefault();
              add(results[active]);
            } else if (e.key === 'Backspace' && !query && selected.length) {
              onChange(selected.slice(0, -1));
            } else if (e.key === 'Escape' && open) {
              e.stopPropagation();
              setOpen(false);
            }
          }}
          className="h-7 min-w-24 flex-1 bg-transparent px-1 text-sm outline-none focus-visible:outline-none"
        />
      </div>
      {open && results.length > 0 && (
        <ul id={listId} role="listbox" aria-label={label} className="absolute top-full right-0 left-0 z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border border-line bg-main py-1 shadow-pop">
          {results.map((u, i) => (
            <li
              key={u.id}
              id={`${listId}-${u.id}`}
              role="option"
              aria-selected={i === active}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => add(u)}
              onPointerEnter={() => setActive(i)}
              className={clsx('flex cursor-pointer items-center gap-2.5 px-3 py-1.5', i === active && 'bg-hover')}
            >
              <Avatar user={u} size="sm" showStatus />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{u.name}</span>
                <span className="block truncate text-xs text-muted">{u.jobTitle ?? u.email}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
