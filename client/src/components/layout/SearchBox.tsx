import clsx from 'clsx';
import { ChatsCircleIcon, HashIcon, LockSimpleIcon, MagnifyingGlassIcon, SpinnerGapIcon } from '@phosphor-icons/react';
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { FileIcon } from '@/components/files/FileIcon';
import { Avatar } from '@/components/ui/Avatar';
import { useToast } from '@/components/ui/Toaster';
import { fileContextPath } from '@/features/files/FilesTable';
import { highlightParts } from '@/features/search/Highlight';
import { useGlobalSearch } from '@/features/search/useGlobalSearch';
import { WorkspaceTile } from '@/features/teams/WorkspaceTile';
import { formatListTimestamp } from '@/lib/format';
import { channelPath, chatPath } from '@/lib/links';
import type { SearchResults } from '@/lib/types';
import { useAuthStore } from '@/stores/auth';
import { chatTitle, useChatsStore } from '@/stores/chats';
import { useWorkspacesStore } from '@/stores/workspaces';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

interface Option {
  id: string;
  /** Where the option leads, or an async action (opening a 1:1 chat) */
  open: () => string | Promise<string>;
  content: ReactNode;
}

interface Section {
  key: 'people' | 'groups' | 'messages' | 'files';
  options: Option[];
}

/** Global search field in the title bar; Ctrl/Cmd+K focuses it from anywhere. */
export function SearchBox() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const showToast = useToast((s) => s.show);
  const inputRef = useRef<HTMLInputElement>(null);
  const baseId = useId();
  const listId = `${baseId}-results`;
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const { results, loading, error } = useGlobalSearch(query);
  const sections = useSections(results, query);
  const options = sections.flatMap((s) => s.options);
  const activeIndex = Math.min(active, options.length - 1);
  const open = focused && query.trim().length > 0;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const choose = async (option: Option) => {
    try {
      const path = await option.open();
      setQuery('');
      inputRef.current?.blur();
      navigate(path);
    } catch {
      showToast(t('auth.errors.generic'), 'error');
    }
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (query) setQuery('');
      else inputRef.current?.blur();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (options.length === 0) return;
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((Math.max(activeIndex, 0) + step + options.length) % options.length);
    } else if (e.key === 'Enter' && options[Math.max(activeIndex, 0)]) {
      e.preventDefault();
      void choose(options[Math.max(activeIndex, 0)]);
    } else return;
  };

  let index = -1;
  const optionId = (i: number) => `${baseId}-option-${i}`;

  return (
    <div className="relative w-full max-w-[560px]">
      <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && options.length > 0 ? optionId(Math.max(activeIndex, 0)) : undefined}
        aria-label={t('search.label')}
        placeholder={t('search.placeholder')}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={onKeyDown}
        className="h-8 w-full rounded-md border border-transparent bg-input pr-16 pl-8 text-sm text-fg shadow-card outline-none placeholder:text-subtle focus:border-accent focus-visible:outline-none"
      />
      <kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded border border-line px-1.5 text-[11px] text-subtle">
        {isMac ? '⌘ K' : 'Ctrl K'}
      </kbd>
      {open && (
        <div
          id={listId}
          role="listbox"
          aria-label={t('search.results')}
          aria-busy={loading}
          // Keep the input focused while clicking into the list.
          onMouseDown={(e) => e.preventDefault()}
          className="absolute top-full right-0 left-0 z-40 mt-1 max-h-[70vh] overflow-y-auto rounded-lg border border-line bg-main py-1.5 text-sm shadow-pop"
        >
          {sections.map((section) => (
            <div key={section.key} role="group" aria-labelledby={`${baseId}-${section.key}`} className="py-1">
              <div id={`${baseId}-${section.key}`} role="presentation" className="px-3 pb-1 text-xs font-semibold text-muted">
                {t(`search.sections.${section.key}`)}
              </div>
              {section.options.map((option) => {
                const i = ++index;
                return (
                  <div
                    key={option.id}
                    id={optionId(i)}
                    role="option"
                    aria-selected={i === activeIndex}
                    onClick={() => void choose(option)}
                    onPointerMove={() => i !== activeIndex && setActive(i)}
                    className={clsx('mx-1.5 flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5', i === activeIndex && 'bg-hover')}
                  >
                    {option.content}
                  </div>
                );
              })}
            </div>
          ))}
          <SearchStatus loading={loading} error={error} empty={!loading && !error && options.length === 0} query={query.trim()} />
        </div>
      )}
    </div>
  );
}

function SearchStatus({ loading, error, empty, query }: { loading: boolean; error: boolean; empty: boolean; query: string }) {
  const { t } = useTranslation();
  if (loading) {
    return (
      <p className="flex items-center gap-2 px-3 py-2 text-muted" role="status">
        <SpinnerGapIcon className="size-4 animate-spin" aria-hidden="true" />
        {t('search.searching')}
      </p>
    );
  }
  if (error) return <p className="px-3 py-2 text-muted" role="status">{t('auth.errors.generic')}</p>;
  if (empty) return <p className="px-3 py-2 text-muted" role="status">{t('search.noResults', { query })}</p>;
  return null;
}

/** Turns the API results into keyboard-navigable options, grouped in sections. */
function useSections(results: SearchResults | null, query: string): Section[] {
  const { t, i18n } = useTranslation();
  const me = useAuthStore((s) => s.user);
  const chats = useChatsStore((s) => s.chats);
  const workspaces = useWorkspacesStore((s) => s.workspaces);
  if (!results) return [];

  const mark = (text: string) => highlightParts(text, query);
  const now = new Date();
  const when = (date: string) => formatListTimestamp(new Date(date), now, i18n.resolvedLanguage, { yesterday: t('chat.yesterday') });
  const channelName = (c: { name: string; isDefault: boolean }) => (c.isDefault ? t('teams.general') : c.name);
  const whereLabel = (hit: { chatId?: string | null; workspaceId?: string | null; channelId?: string | null }) => {
    if (hit.chatId) {
      const chat = chats.find((c) => c.id === hit.chatId);
      return chat ? chatTitle(chat, me?.id) : t('activity.chat');
    }
    const workspace = workspaces.find((w) => w.id === hit.workspaceId);
    const channel = workspace?.channels.find((c) => c.id === hit.channelId);
    return workspace && channel ? `${workspace.name} › ${channelName(channel)}` : t('activity.channel');
  };

  const people: Option[] = results.people
    .filter((p) => p.id !== me?.id)
    .map((p) => ({
      id: `person-${p.id}`,
      open: async () => chatPath((await useChatsStore.getState().create({ memberIds: [p.id] })).id),
      content: (
        <>
          <Avatar user={p} size="sm" showStatus />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{mark(p.name)}</span>
            <span className="block truncate text-xs text-muted">{p.jobTitle ? mark(p.jobTitle) : mark(p.email)}</span>
          </span>
        </>
      ),
    }));

  const groups: Option[] = results.groups.map((g) => {
    if (g.kind === 'workspace') {
      return {
        id: `workspace-${g.id}`,
        open: () => `/teams/${g.id}`,
        content: (
          <>
            <WorkspaceTile workspace={g} size={28} />
            <span className="min-w-0 flex-1 truncate font-medium">{mark(g.name)}</span>
            <span className="text-xs text-muted">{t('search.workgroup')}</span>
          </>
        ),
      };
    }
    if (g.kind === 'channel') {
      return {
        id: `channel-${g.id}`,
        open: () => channelPath(g.workspace.id, g.id),
        content: (
          <>
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-hover text-muted">
              {g.type === 'private' ? <LockSimpleIcon className="size-4" aria-label={t('teams.privateChannel')} /> : <HashIcon className="size-4" aria-hidden="true" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{mark(channelName(g))}</span>
              <span className="block truncate text-xs text-muted">{g.workspace.name}</span>
            </span>
          </>
        ),
      };
    }
    return {
      id: `chat-${g.id}`,
      open: () => chatPath(g.id),
      content: (
        <>
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-hover text-muted">
            <ChatsCircleIcon className="size-4" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1 truncate font-medium">{mark(g.name)}</span>
          <span className="text-xs text-muted">{t('search.groupChat')}</span>
        </>
      ),
    };
  });

  const messages: Option[] = results.messages.map((m) => ({
    id: `${m.kind}-${m.id}`,
    open: () =>
      m.kind === 'message'
        ? chatPath(m.chatId!, m.id)
        : channelPath(m.workspaceId!, m.channelId!, m.postId, m.kind === 'reply' ? m.id : null),
    content: (
      <>
        <Avatar user={m.author} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate text-xs text-muted">
              <span className="font-medium text-fg">{m.author.name}</span> · {whereLabel(m)}
            </span>
            <span className="shrink-0 text-xs text-subtle">{when(m.createdAt)}</span>
          </span>
          {m.subject && <span className="block truncate text-xs font-semibold">{mark(m.subject)}</span>}
          <span className="line-clamp-2 text-sm">{mark(m.excerpt)}</span>
        </span>
      </>
    ),
  }));

  const files: Option[] = results.files.map((f) => ({
    id: `file-${f.id}`,
    open: () => fileContextPath(f) ?? '/files',
    content: (
      <>
        <FileIcon mimeType={f.mimeType} name={f.name} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{mark(f.name)}</span>
          <span className="block truncate text-xs text-muted">
            {f.uploader.name} · {whereLabel(f)}
          </span>
        </span>
      </>
    ),
  }));

  const sections: Section[] = [
    { key: 'people', options: people },
    { key: 'groups', options: groups },
    { key: 'messages', options: messages },
    { key: 'files', options: files },
  ];
  return sections.filter((s) => s.options.length > 0);
}
