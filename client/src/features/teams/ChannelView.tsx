import { DotsThreeIcon, LockSimpleIcon, NotePencilIcon, UsersThreeIcon, VideoCameraIcon } from '@phosphor-icons/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useParams, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/Button';
import { useComingSoon } from '@/components/ui/ComingSoon';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { IconButton } from '@/components/ui/IconButton';
import { Menu } from '@/components/ui/Menu';
import { Tabs } from '@/components/ui/Tabs';
import { api } from '@/lib/api';
import type { ChannelSummary, PostDto, ReplyDto, WorkspaceMember, WorkspaceSummary } from '@/lib/types';
import { useAuthStore } from '@/stores/auth';
import { usePostsStore } from '@/stores/posts';
import { usePresenceStore } from '@/stores/presence';
import { useWorkspacesStore } from '@/stores/workspaces';
import { FilesTab } from '@/features/files/FilesTab';
import { CHANNEL_MENTION_ID, CHANNEL_MENTION_NAMES, ChannelContext, type ChannelContextValue } from './channelContext';
import { NotesTab } from './NotesTab';
import { PostEditor } from './PostEditor';
import { PostList } from './PostList';
import { ChannelMenuItems } from './TeamsMenus';
import { useTeamsDialogs } from './dialogStore';
import { WorkspaceTile } from './WorkspaceTile';

type Tab = 'posts' | 'files' | 'notes';

export function ChannelView() {
  const { workspaceId, channelId } = useParams();
  const { workspaces, loaded } = useWorkspacesStore();
  const workspace = workspaces.find((w) => w.id === workspaceId);
  const channel = workspace?.channels.find((c) => c.id === channelId);

  if (!workspace || !channel) {
    if (!loaded) return <main className="flex-1 bg-main" />;
    // The channel may have been deleted or we lost access: fall back to the workgroup.
    return <Navigate to={workspace ? `/teams/${workspace.id}` : '/teams'} replace />;
  }
  return <Channel key={channel.id} workspace={workspace} channel={channel} />;
}

/** Members of the channel, refreshed when the workgroup's membership changes. */
function useChannelMembers(channelId: string, memberCount: number) {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  useEffect(() => {
    let cancelled = false;
    api
      .get<{ members: WorkspaceMember[] }>(`/channels/${channelId}/members`)
      .then(({ members: list }) => {
        if (cancelled) return;
        usePresenceStore.getState().setFromUsers(list.map((m) => m.user));
        setMembers(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [channelId, memberCount]);
  return members;
}

function Channel({ workspace, channel }: { workspace: WorkspaceSummary; channel: ChannelSummary }) {
  const { t } = useTranslation();
  const meId = useAuthStore((s) => s.user!.id);
  const state = usePostsStore((s) => s.byChannel[channel.id]);
  const showComingSoon = useComingSoon((s) => s.show);
  const openDialog = useTeamsDialogs((s) => s.open);
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('reply') ?? searchParams.get('post');
  const [tab, setTab] = useState<Tab>('posts');
  const [composing, setComposing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ post: PostDto } | { reply: ReplyDto } | null>(null);
  const members = useChannelMembers(channel.id, workspace.memberCount);
  const name = channel.isDefault ? t('teams.general') : channel.name;

  // Load posts and details when the channel opens.
  useEffect(() => {
    const posts = usePostsStore.getState();
    if (!posts.byChannel[channel.id]?.loaded) void posts.load(channel.id);
    void posts.loadDetail(channel.id).catch(() => {});
  }, [channel.id]);

  // Mark as active so live updates here don't count as unread.
  useEffect(() => {
    useWorkspacesStore.getState().setActive(channel.id);
    return () => useWorkspacesStore.getState().setActive(null);
  }, [channel.id]);

  // Reading: whenever new activity arrives while the window is visible.
  const lastActivity = state?.posts.at(-1)?.lastActivityAt;
  useEffect(() => {
    const markIfVisible = () => {
      if (document.visibilityState === 'visible') void useWorkspacesStore.getState().markRead(channel.id);
    };
    markIfVisible();
    document.addEventListener('visibilitychange', markIfVisible);
    return () => document.removeEventListener('visibilitychange', markIfVisible);
  }, [channel.id, lastActivity]);

  const confirmDelete = useCallback((target: { post: PostDto } | { reply: ReplyDto }) => setDeleteTarget(target), []);

  const context = useMemo<ChannelContextValue>(() => {
    const channelName = t('teams.channelMention');
    return {
      workspace,
      channel,
      meId,
      mentionTargets: [
        ...members.map((m) => ({ id: m.user.id, name: m.user.name })),
        ...CHANNEL_MENTION_NAMES.map((n) => ({ id: CHANNEL_MENTION_ID, name: n })),
      ],
      candidates: [
        { id: CHANNEL_MENTION_ID, name: channelName },
        ...members.filter((m) => m.user.id !== meId).map((m) => ({ id: m.user.id, name: m.user.name, user: m.user })),
      ],
      confirmDelete,
    };
  }, [workspace, channel, meId, members, confirmDelete, t]);

  const posts = usePostsStore.getState();

  return (
    <ChannelContext.Provider value={context}>
      <main className="flex min-w-0 flex-1 flex-col bg-main">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-4">
          <WorkspaceTile workspace={workspace} size={32} />
          <div className="min-w-0">
            <h1 className="flex items-center gap-1.5 truncate text-base leading-tight font-semibold">
              {name}
              {channel.type === 'private' && <LockSimpleIcon className="size-3.5 text-subtle" aria-label={t('teams.privateChannel')} />}
            </h1>
            <p className="truncate text-xs text-muted">{channel.description || workspace.name}</p>
          </div>
          <Tabs
            label={name}
            className="ml-3"
            active={tab}
            onChange={(id) => setTab(id as Tab)}
            tabs={[
              { id: 'posts', label: t('teams.tabs.posts') },
              { id: 'files', label: t('teams.tabs.files') },
              { id: 'notes', label: t('teams.tabs.notes') },
            ]}
            onAdd={() => showComingSoon(t('teams.tabs.add'))}
            addLabel={t('teams.tabs.add')}
          />
          <div className="ml-auto flex items-center gap-1">
            <Button variant="primary" size="sm" icon={VideoCameraIcon} onClick={() => showComingSoon(t('teams.meet'))}>
              {t('teams.meet')}
            </Button>
            <IconButton label={t('chat.participants')} icon={UsersThreeIcon} onClick={() => openDialog({ kind: 'members', workspace, channel })} />
            <Menu
              label={t('teams.channelOptions')}
              width={230}
              trigger={({ ref, ...props }) => <IconButton ref={ref} label={t('teams.channelOptions')} icon={DotsThreeIcon} {...props} />}
            >
              <ChannelMenuItems workspace={workspace} channel={channel} />
            </Menu>
          </div>
        </header>

        {tab === 'posts' && (
          <>
            {state ? (
              <PostList channelId={channel.id} state={state} meId={meId} highlightId={highlightId} />
            ) : (
              <div className="flex-1 bg-app" />
            )}
            <div className="border-t border-line bg-main px-5 py-3">
              <div className="mx-auto max-w-4xl">
                {composing ? (
                  <PostEditor
                    label={t('teams.postPlaceholder')}
                    candidates={context.candidates}
                    withSubject
                    richByDefault
                    submitLabel={t('teams.publish')}
                    onCancel={() => setComposing(false)}
                    uploadTarget={{ channelId: channel.id }}
                    onSubmit={async (content, subject, fileIds) => {
                      await posts.create(channel.id, { content, subject: subject || undefined, fileIds });
                      setComposing(false);
                    }}
                  />
                ) : (
                  <Button variant="primary" icon={NotePencilIcon} onClick={() => setComposing(true)}>
                    {t('teams.newPost')}
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
        {tab === 'files' && (
          <FilesTab target={{ channelId: channel.id }} label={t('teams.tabs.files')} canModerate={() => workspace.permissions.moderate} />
        )}
        {tab === 'notes' && <NotesTab />}
      </main>

      <ConfirmDialog
        open={deleteTarget !== null}
        title={deleteTarget && 'post' in deleteTarget ? t('teams.deletePostTitle') : t('teams.deleteReplyTitle')}
        confirmLabel={t('message.delete')}
        danger
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          if ('post' in deleteTarget) await posts.remove(deleteTarget.post.id);
          else await posts.removeReply(deleteTarget.reply.id);
        }}
      >
        {deleteTarget && 'post' in deleteTarget ? t('teams.deletePostText') : t('teams.deleteReplyText')}
      </ConfirmDialog>
    </ChannelContext.Provider>
  );
}
