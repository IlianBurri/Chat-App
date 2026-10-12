import { Ellipsis, Info, Lock, PenSquare, Users, Video } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useParams } from 'react-router';
import { EmptyState } from '@/components/layout/PlaceholderView';
import { Button } from '@/components/ui/Button';
import { useComingSoon } from '@/components/ui/ComingSoon';
import { IconButton } from '@/components/ui/IconButton';
import { Tabs } from '@/components/ui/Tabs';
import { useWorkspacesStore } from '@/stores/workspaces';
import { WorkspaceTile } from './WorkspaceTile';

export function ChannelView() {
  const { t } = useTranslation();
  const { workspaceId, channelId } = useParams();
  const { workspaces, loaded } = useWorkspacesStore();
  const showComingSoon = useComingSoon((s) => s.show);
  const [tab, setTab] = useState('posts');

  const workspace = workspaces.find((w) => w.id === workspaceId);
  const channel = workspace?.channels.find((c) => c.id === channelId);
  if (!workspace || !channel) return loaded ? <Navigate to="/teams" replace /> : <main className="flex-1 bg-main" />;

  const name = channel.isDefault ? t('teams.general') : channel.name;

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-main">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-4">
        <WorkspaceTile workspace={workspace} size={32} />
        <div className="min-w-0">
          <h1 className="flex items-center gap-1.5 truncate text-base leading-tight font-semibold">
            {name}
            {channel.type === 'private' && <Lock className="size-3.5 text-subtle" aria-label={t('teams.privateChannel')} />}
          </h1>
          <p className="truncate text-xs text-muted">{workspace.name}</p>
        </div>
        <Tabs
          label={name}
          className="ml-3"
          active={tab}
          onChange={setTab}
          tabs={[
            { id: 'posts', label: t('teams.tabs.posts') },
            { id: 'files', label: t('teams.tabs.files') },
            { id: 'notes', label: t('teams.tabs.notes') },
          ]}
          onAdd={() => showComingSoon(t('teams.tabs.add'))}
          addLabel={t('teams.tabs.add')}
        />
        <div className="ml-auto flex items-center gap-1">
          <Button variant="primary" size="sm" icon={Video} onClick={() => showComingSoon(t('teams.meet'))}>
            {t('teams.meet')}
          </Button>
          <IconButton label={t('chat.participants')} icon={Users} onClick={() => showComingSoon(t('chat.participants'))} />
          <IconButton label={t('common.more')} icon={Ellipsis} onClick={() => showComingSoon(t('common.more'))} />
        </div>
      </header>
      <EmptyState icon={tab === 'posts' ? PenSquare : Info} title={name} text={t('teams.milestonePosts')} />
      <div className="border-t border-line p-4">
        <Button variant="primary" icon={PenSquare} onClick={() => showComingSoon(t('teams.newPost'))}>
          {t('teams.newPost')}
        </Button>
      </div>
    </main>
  );
}
