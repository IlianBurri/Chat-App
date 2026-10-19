import clsx from 'clsx';
import { ChatsCircleIcon, ClockIcon, CloudIcon, UserIcon, UsersThreeIcon, type Icon as PhosphorIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useSearchParams } from 'react-router';
import { EmptyState } from '@/components/layout/PlaceholderView';
import { Button } from '@/components/ui/Button';
import { useWorkspacesStore } from '@/stores/workspaces';
import { FilesTable } from './FilesTable';
import { useFileList } from './useFileList';

const VIEWS = [
  { id: 'all', icon: ClockIcon },
  { id: 'mine', icon: UserIcon },
  { id: 'chats', icon: ChatsCircleIcon },
  { id: 'channels', icon: UsersThreeIcon },
] as const satisfies readonly { id: string; icon: PhosphorIcon }[];

type View = (typeof VIEWS)[number]['id'];

function useView(): View {
  const [params] = useSearchParams();
  const view = params.get('view');
  return VIEWS.some((v) => v.id === view) ? (view as View) : 'all';
}

/** List pane of the Files app: which files to show. */
export function FilesNav() {
  const { t } = useTranslation();
  const view = useView();
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center px-4">
        <h1 className="text-lg font-semibold">{t('files.title')}</h1>
      </header>
      <nav aria-label={t('files.views')}>
        <ul className="space-y-px">
          {VIEWS.map(({ id, icon: Icon }) => (
            <li key={id}>
              <NavLink
                to={id === 'all' ? '/files' : `/files?view=${id}`}
                aria-current={view === id ? 'page' : undefined}
                className={clsx('mx-2 flex items-center gap-3 rounded-md px-3 py-2 text-sm', view === id ? 'bg-selected font-semibold shadow-card' : 'hover:bg-hover')}
              >
                <Icon className="size-5 text-muted" weight={view === id ? 'fill' : 'regular'} aria-hidden="true" />
                {t(`files.view.${id}`)}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

/** Main area of the Files app: every file the user can see, filterable by name. */
export function FilesView() {
  const { t } = useTranslation();
  const view = useView();
  const [filter, setFilter] = useState('');
  const workspaces = useWorkspacesStore((s) => s.workspaces);
  const { files, loaded, error, reload } = useFileList(`view=${view}`, null);
  const needle = filter.trim().toLocaleLowerCase();
  const shown = needle ? files.filter((f) => f.name.toLocaleLowerCase().includes(needle)) : files;
  const title = t(`files.view.${view}`);

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-main">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-4 md:px-5">
        <h2 className="flex-1 truncate text-base font-semibold">{title}</h2>
        <input
          type="search"
          aria-label={t('files.filter')}
          placeholder={t('files.filter')}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-8 w-40 rounded-md border border-line bg-input px-2.5 text-sm outline-none focus:border-accent md:w-64"
        />
      </header>
      {/* Below 768px there is no list pane: the views become chips. */}
      <nav aria-label={t('files.views')} className="flex shrink-0 gap-2 overflow-x-auto border-b border-line px-4 py-2 md:hidden">
        {VIEWS.map(({ id }) => (
          <NavLink
            key={id}
            to={id === 'all' ? '/files' : `/files?view=${id}`}
            aria-current={view === id ? 'page' : undefined}
            className={clsx(
              'shrink-0 rounded-full border px-3 py-1 text-sm',
              view === id ? 'border-accent bg-accent-soft font-semibold text-accent' : 'border-line text-muted',
            )}
          >
            {t(`files.view.${id}`)}
          </NavLink>
        ))}
      </nav>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {!loaded ? (
          <p className="px-5 py-4 text-sm text-muted">{t('common.loading')}</p>
        ) : error ? (
          <div className="px-5 py-4 text-sm">
            <p className="mb-2 text-muted">{t('auth.errors.generic')}</p>
            <Button size="sm" onClick={reload}>
              {t('common.retry')}
            </Button>
          </div>
        ) : shown.length === 0 ? (
          <EmptyState icon={CloudIcon} title={t('files.emptyTitle')} text={needle ? t('files.noMatch') : t('files.emptyApp')} />
        ) : (
          <FilesTable
            files={shown}
            label={title}
            showLocation
            canModerate={(file) => workspaces.some((w) => w.id === file.workspaceId && w.permissions.moderate)}
          />
        )}
      </div>
    </main>
  );
}
