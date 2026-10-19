import { MagnifyingGlassIcon, PlusIcon, UsersThreeIcon } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { MobileBack } from '@/components/layout/MobileBack';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toaster';
import { api } from '@/lib/api';
import type { DiscoverWorkspace } from '@/lib/types';
import { useWorkspacesStore } from '@/stores/workspaces';
import { useTeamsDialogs } from './dialogStore';
import { WorkspaceTile } from './WorkspaceTile';

/** "Join or create": create a workgroup or join a public one. */
export function DiscoverView() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const showToast = useToast((s) => s.show);
  const openDialog = useTeamsDialogs((s) => s.open);
  const memberOf = useWorkspacesStore((s) => s.workspaces.length);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DiscoverWorkspace[] | null>(null);
  const [joining, setJoining] = useState<string | null>(null);

  useEffect(() => {
    const handle = window.setTimeout(async () => {
      try {
        const q = query.trim();
        const { workspaces } = await api.get<{ workspaces: DiscoverWorkspace[] }>(`/workspaces/discover${q ? `?q=${encodeURIComponent(q)}` : ''}`);
        setResults(workspaces);
      } catch {
        setResults([]);
      }
    }, 200);
    return () => window.clearTimeout(handle);
  }, [query, memberOf]);

  const join = async (workspace: DiscoverWorkspace) => {
    setJoining(workspace.id);
    try {
      await useWorkspacesStore.getState().join(workspace.id);
      const joined = useWorkspacesStore.getState().workspaces.find((w) => w.id === workspace.id);
      const channel = joined?.channels.find((c) => c.isDefault) ?? joined?.channels[0];
      showToast(t('teams.joined', { name: workspace.name }));
      if (channel) navigate(`/teams/${workspace.id}/${channel.id}`);
    } catch {
      showToast(t('auth.errors.generic'), 'error');
    } finally {
      setJoining(null);
    }
  };

  return (
    <main className="min-w-0 flex-1 overflow-y-auto bg-app">
      <div className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8">
        <div className="mb-1 flex items-center gap-2">
          <MobileBack to="/teams" />
          <h1 className="text-xl font-semibold">{t('teams.joinOrCreate')}</h1>
        </div>
        <p className="mb-6 text-sm text-muted">{t('teams.discoverHint')}</p>

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="relative min-w-64 flex-1">
            <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              type="search"
              aria-label={t('teams.searchWorkspaces')}
              placeholder={t('teams.searchWorkspaces')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 w-full rounded-md border border-line bg-input pr-3 pl-8 text-sm outline-none focus:border-accent"
            />
          </div>
        </div>

        <ul className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
          <li>
            <button
              type="button"
              onClick={() => openDialog({ kind: 'createWorkspace' })}
              className="flex h-full min-h-48 w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-line bg-main p-5 text-center hover:border-accent hover:bg-hover"
            >
              <span className="flex size-14 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <PlusIcon className="size-7" aria-hidden="true" />
              </span>
              <span className="font-semibold">{t('teams.createWorkspace')}</span>
              <span className="text-xs text-muted">{t('teams.createHint')}</span>
            </button>
          </li>
          {results?.map((w) => (
            <li key={w.id} className="flex min-h-48 flex-col items-center gap-2 rounded-lg border border-line bg-main p-5 text-center shadow-card">
              <WorkspaceTile workspace={w} size={56} />
              <h2 className="mt-1 line-clamp-1 font-semibold">{w.name}</h2>
              <p className="line-clamp-2 flex-1 text-xs text-muted">{w.description}</p>
              <p className="flex items-center gap-1 text-xs text-subtle">
                <UsersThreeIcon className="size-3.5" aria-hidden="true" />
                {t('teams.members', { count: w.memberCount })}
              </p>
              <Button
                variant="primary"
                size="sm"
                className="w-full"
                aria-label={t('teams.joinNamed', { name: w.name })}
                disabled={joining === w.id}
                onClick={() => void join(w)}
              >
                {t('teams.join')}
              </Button>
            </li>
          ))}
        </ul>
        {results?.length === 0 && <p className="mt-6 text-sm text-muted">{query.trim() ? t('teams.noResults') : t('teams.nothingToJoin')}</p>}
      </div>
    </main>
  );
}
