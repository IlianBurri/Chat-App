import clsx from 'clsx';
import { ChevronRight, Lock, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';
import { Button } from '@/components/ui/Button';
import { useComingSoon } from '@/components/ui/ComingSoon';
import type { WorkspaceSummary } from '@/lib/types';
import { useWorkspacesStore } from '@/stores/workspaces';
import { WorkspaceTile } from './WorkspaceTile';

export function TeamsList() {
  const { t } = useTranslation();
  const { workspaces, loaded, error, load } = useWorkspacesStore();
  const showComingSoon = useComingSoon((s) => s.show);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 px-4">
        <h1 className="flex-1 text-lg font-semibold">{t('teams.title')}</h1>
        <Button size="sm" icon={UserPlus} onClick={() => showComingSoon(t('teams.joinOrCreate'))}>
          {t('teams.joinOrCreate')}
        </Button>
      </header>
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
        ) : workspaces.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">{t('teams.empty')}</p>
        ) : (
          <ul>
            {workspaces.map((w) => (
              <WorkspaceGroup key={w.id} workspace={w} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function WorkspaceGroup({ workspace }: { workspace: WorkspaceSummary }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);
  const channelsId = `ws-${workspace.id}-channels`;

  return (
    <li className="mb-1">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={channelsId}
        aria-label={open ? t('teams.collapse', { name: workspace.name }) : t('teams.expand', { name: workspace.name })}
        onClick={() => setOpen((o) => !o)}
        className="mx-2 flex w-[calc(100%-1rem)] items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-hover"
      >
        <ChevronRight className={clsx('size-3.5 shrink-0 text-muted transition-transform', open && 'rotate-90')} aria-hidden="true" />
        <WorkspaceTile workspace={workspace} size={28} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{workspace.name}</span>
          <span className="block truncate text-xs text-muted">
            {t(`teams.roles.${workspace.role}`)} · {t('teams.members', { count: workspace.memberCount })}
          </span>
        </span>
      </button>
      {open && (
        <ul id={channelsId} className="mt-0.5 space-y-px">
          {workspace.channels
            .filter((c) => !c.hidden)
            .map((c) => (
              <li key={c.id}>
                <NavLink
                  to={`/teams/${workspace.id}/${c.id}`}
                  className={({ isActive }) =>
                    clsx(
                      'mx-2 flex items-center gap-2 rounded-md py-1.5 pr-2 pl-[3.75rem] text-sm outline-offset-[-2px]',
                      isActive ? 'bg-selected font-semibold shadow-card' : 'hover:bg-hover',
                    )
                  }
                >
                  <span className="truncate">{c.isDefault ? t('teams.general') : c.name}</span>
                  {c.type === 'private' && (
                    <Lock className="size-3.5 shrink-0 text-subtle" aria-label={t('teams.privateChannel')} />
                  )}
                </NavLink>
              </li>
            ))}
        </ul>
      )}
    </li>
  );
}
