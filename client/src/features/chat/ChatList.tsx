import clsx from 'clsx';
import { ChevronDown, Filter, Lock, SquarePen, X } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';
import { Button } from '@/components/ui/Button';
import { useComingSoon } from '@/components/ui/ComingSoon';
import { IconButton } from '@/components/ui/IconButton';
import { WorkspaceTile } from '@/features/teams/WorkspaceTile';
import { useAuthStore } from '@/stores/auth';
import { useChatsStore } from '@/stores/chats';
import { useWorkspacesStore } from '@/stores/workspaces';
import { ChatListItem } from './ChatListItem';
import { groupChats, type ChatFilter } from './chatFilters';

const FILTERS: Exclude<ChatFilter, 'all'>[] = ['unread', 'chats', 'channels', 'meetings'];

export function ChatList() {
  const { t } = useTranslation();
  const meId = useAuthStore((s) => s.user?.id);
  const { chats, loaded, error, load } = useChatsStore();
  const [filter, setFilter] = useState<ChatFilter>('all');
  const [showQuery, setShowQuery] = useState(false);
  const [query, setQuery] = useState('');
  const showComingSoon = useComingSoon((s) => s.show);

  const groups = useMemo(() => groupChats(chats, filter, query, meId), [chats, filter, query, meId]);
  const now = new Date();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center gap-1 px-4">
        <h1 className="flex-1 text-lg font-semibold">{t('chat.title')}</h1>
        <IconButton
          label={t('chat.filterByName')}
          icon={showQuery ? X : Filter}
          active={showQuery}
          aria-pressed={showQuery}
          onClick={() => {
            setShowQuery((v) => !v);
            setQuery('');
          }}
        />
        <IconButton label={t('chat.newChat')} icon={SquarePen} onClick={() => showComingSoon(t('chat.newChat'))} />
      </header>

      {showQuery && (
        <div className="px-4 pb-2">
          <input
            autoFocus
            type="search"
            aria-label={t('chat.filterByName')}
            placeholder={t('chat.filterByName')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setShowQuery(false)}
            className="h-8 w-full rounded-md border border-line bg-input px-2.5 text-sm outline-none focus:border-accent"
          />
        </div>
      )}

      <div role="group" aria-label={t('chat.filter')} className="flex flex-wrap gap-1.5 px-4 pb-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(filter === f ? 'all' : f)}
            className={clsx(
              'h-7 rounded-full border px-3 text-xs font-medium transition-colors',
              filter === f ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-main text-fg hover:bg-hover',
            )}
          >
            {t(`chat.filters.${f}`)}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-3">
        {!loaded ? (
          <p className="px-4 py-6 text-sm text-muted">{t('common.loading')}</p>
        ) : error ? (
          <div className="px-4 py-6 text-sm">
            <p className="mb-2 text-muted">{t('auth.errors.generic')}</p>
            <Button size="sm" onClick={() => void load()}>
              {t('common.retry')}
            </Button>
          </div>
        ) : filter === 'channels' ? (
          <ChannelList />
        ) : filter === 'meetings' ? (
          <p className="px-4 py-6 text-sm text-muted">{t('chat.noMeetings')}</p>
        ) : groups.pinned.length + groups.recent.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">{t('chat.empty')}</p>
        ) : (
          <>
            {groups.pinned.length > 0 && (
              <Section title={t('chat.pinned')}>
                {groups.pinned.map((c) => (
                  <ChatListItem key={c.id} chat={c} meId={meId} now={now} />
                ))}
              </Section>
            )}
            <Section title={t('chat.recent')}>
              {groups.recent.map((c) => (
                <ChatListItem key={c.id} chat={c} meId={meId} now={now} />
              ))}
            </Section>
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="mb-1">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="mx-2 flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-muted hover:text-fg"
        >
          <ChevronDown className={clsx('size-3.5 transition-transform', !open && '-rotate-90')} aria-hidden="true" />
          {title}
        </button>
      </h2>
      {open && <ul className="space-y-px">{Array.isArray(children) ? children.map((c, i) => <li key={i}>{c}</li>) : <li>{children}</li>}</ul>}
    </section>
  );
}

/** "Channels" filter: channels of all workgroups, linking into the groups app. */
function ChannelList() {
  const { t } = useTranslation();
  const workspaces = useWorkspacesStore((s) => s.workspaces);
  const channels = workspaces.flatMap((w) => w.channels.filter((c) => !c.hidden).map((c) => ({ ...c, workspace: w })));
  if (channels.length === 0) return <p className="px-4 py-6 text-sm text-muted">{t('chat.empty')}</p>;

  return (
    <ul className="space-y-px">
      {channels.map((c) => (
        <li key={c.id}>
          <NavLink
            to={`/teams/${c.workspace.id}/${c.id}`}
            className="mx-2 flex items-center gap-3 rounded-md px-2 py-2 hover:bg-hover"
          >
            <WorkspaceTile workspace={c.workspace} size={32} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 truncate font-medium">
                {c.isDefault ? t('teams.general') : c.name}
                {c.type === 'private' && <Lock className="size-3 text-subtle" aria-label={t('teams.privateChannel')} />}
              </span>
              <span className="block truncate text-xs text-muted">{c.workspace.name}</span>
            </span>
          </NavLink>
        </li>
      ))}
    </ul>
  );
}
