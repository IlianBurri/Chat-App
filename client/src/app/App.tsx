import { BellIcon, UsersThreeIcon } from '@phosphor-icons/react';
import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { createBrowserRouter, Navigate, Outlet, RouterProvider, useMatch, useParams } from 'react-router';
import { AppShell } from '@/components/layout/AppShell';
import { ListPane } from '@/components/layout/ListPane';
import { EmptyState } from '@/components/layout/PlaceholderView';
import { ActivityList } from '@/features/activity/ActivityList';
import { CalendarView } from '@/features/calendar/CalendarView';
import { CallsList, CallsView } from '@/features/calls/CallsApp';
import { AuthPage } from '@/features/auth/AuthPage';
import { ChatList } from '@/features/chat/ChatList';
import { ChatEmpty, ChatView } from '@/features/chat/ChatView';
import { NewChatView } from '@/features/chat/NewChatView';
import { FilesNav, FilesView } from '@/features/files/FilesApp';
import { ChannelView } from '@/features/teams/ChannelView';
import { DiscoverView } from '@/features/teams/DiscoverView';
import { TeamsDialogs } from '@/features/teams/TeamsDialogs';
import { TeamsList } from '@/features/teams/TeamsList';
import { setNavigator } from '@/lib/links';
import { useIsMobile } from '@/lib/useMobile';
import { useAuthStore } from '@/stores/auth';
import { useWorkspacesStore } from '@/stores/workspaces';
import { useTheme } from './useTheme';

function RequireAuth() {
  const state = useAuthStore((s) => s.state);
  if (state === 'loading') return null;
  if (state === 'anonymous') return <Navigate to="/login" replace />;
  return <AppShell />;
}

function GuestOnly() {
  const state = useAuthStore((s) => s.state);
  if (state === 'loading') return null;
  if (state === 'authenticated') return <Navigate to="/chat" replace />;
  return <Outlet />;
}

/**
 * List pane next to the detail view. Below 768px only one of them: the list on the section's start
 * route, the detail once something is open (it has its own back button).
 */
function SplitSection({ label, list, detailOpen, children }: { label: string; list: ReactNode; detailOpen: boolean; children: ReactNode }) {
  const mobile = useIsMobile();
  return (
    <>
      {(!mobile || !detailOpen) && <ListPane label={label}>{list}</ListPane>}
      {(!mobile || detailOpen) && children}
    </>
  );
}

function ChatSection() {
  const { t } = useTranslation();
  const detailOpen = useMatch('/chat/:chatId') !== null;
  return (
    <SplitSection label={t('chat.title')} list={<ChatList />} detailOpen={detailOpen}>
      <Outlet />
    </SplitSection>
  );
}

function TeamsSection() {
  const { t } = useTranslation();
  const detailOpen = useMatch('/teams/:workspaceId/*') !== null;
  return (
    <>
      <SplitSection label={t('teams.title')} list={<TeamsList />} detailOpen={detailOpen}>
        <Outlet />
      </SplitSection>
      <TeamsDialogs />
    </>
  );
}

/** Opens the default channel of the first workgroup (desktop; on mobile /teams shows the list). */
function TeamsIndex() {
  const { t } = useTranslation();
  const first = useWorkspacesStore((s) => s.workspaces[0]);
  const channel = first?.channels.find((c) => c.isDefault) ?? first?.channels[0];
  if (first && channel) return <Navigate to={`/teams/${first.id}/${channel.id}`} replace />;
  return (
    <main className="flex flex-1 bg-main">
      <EmptyState icon={UsersThreeIcon} title={t('teams.selectChannel')} text={t('teams.empty')} />
    </main>
  );
}

/** /teams/:workspaceId opens the workgroup's default channel. */
function WorkspaceIndex() {
  const { workspaceId } = useParams();
  const { workspaces, loaded } = useWorkspacesStore();
  if (!loaded) return <main className="flex-1 bg-main" />;
  const workspace = workspaces.find((w) => w.id === workspaceId);
  const channel = workspace?.channels.find((c) => c.isDefault) ?? workspace?.channels[0];
  return <Navigate to={workspace && channel ? `/teams/${workspace.id}/${channel.id}` : '/teams'} replace />;
}

function ActivitySection() {
  const { t } = useTranslation();
  // Clicking an entry opens the chat or channel, so on mobile the feed is all there is.
  return (
    <SplitSection label={t('activity.title')} list={<ActivityList />} detailOpen={false}>
      <main className="flex flex-1 bg-main">
        <EmptyState icon={BellIcon} title={t('activity.emptyTitle')} text={t('activity.emptyText')} />
      </main>
    </SplitSection>
  );
}

function FilesSection() {
  const { t } = useTranslation();
  // On mobile the file list itself switches views with chips.
  return (
    <SplitSection label={t('files.title')} list={<FilesNav />} detailOpen>
      <FilesView />
    </SplitSection>
  );
}

function CallsSection() {
  const { t } = useTranslation();
  const mobile = useIsMobile();
  if (mobile) {
    return (
      <div className="flex min-w-0 flex-1 flex-col bg-main">
        <CallsView />
        <div className="flex min-h-0 flex-1 flex-col border-t border-line bg-pane">
          <CallsList />
        </div>
      </div>
    );
  }
  return (
    <>
      <ListPane label={t('calls.title')}>
        <CallsList />
      </ListPane>
      <CallsView />
    </>
  );
}

const router = createBrowserRouter([
  {
    element: <GuestOnly />,
    children: [
      { path: '/login', element: <AuthPage mode="login" /> },
      { path: '/register', element: <AuthPage mode="register" /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      { index: true, element: <Navigate to="/chat" replace /> },
      {
        path: 'chat',
        element: <ChatSection />,
        children: [
          { index: true, element: <ChatEmpty /> },
          { path: 'new', element: <NewChatView /> },
          { path: ':chatId', element: <ChatView /> },
        ],
      },
      {
        path: 'teams',
        element: <TeamsSection />,
        children: [
          { index: true, element: <TeamsIndex /> },
          { path: 'discover', element: <DiscoverView /> },
          { path: ':workspaceId', element: <WorkspaceIndex /> },
          { path: ':workspaceId/:channelId', element: <ChannelView /> },
        ],
      },
      { path: 'activity', element: <ActivitySection /> },
      { path: 'calendar', element: <CalendarView /> },
      { path: 'calls', element: <CallsSection /> },
      { path: 'files', element: <FilesSection /> },
      { path: '*', element: <Navigate to="/chat" replace /> },
    ],
  },
]);

setNavigator((path) => void router.navigate(path));

export function App() {
  useTheme();
  useEffect(() => {
    void useAuthStore.getState().load();
  }, []);
  return <RouterProvider router={router} />;
}
