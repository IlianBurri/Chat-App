import { BellIcon, UsersThreeIcon } from '@phosphor-icons/react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { createBrowserRouter, Navigate, Outlet, RouterProvider, useParams } from 'react-router';
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

function ChatSection() {
  const { t } = useTranslation();
  return (
    <>
      <ListPane label={t('chat.title')}>
        <ChatList />
      </ListPane>
      <Outlet />
    </>
  );
}

function TeamsSection() {
  const { t } = useTranslation();
  return (
    <>
      <ListPane label={t('teams.title')}>
        <TeamsList />
      </ListPane>
      <Outlet />
      <TeamsDialogs />
    </>
  );
}

/** Opens the default channel of the first workgroup. */
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
  return (
    <>
      <ListPane label={t('activity.title')}>
        <ActivityList />
      </ListPane>
      <main className="flex flex-1 bg-main">
        <EmptyState icon={BellIcon} title={t('activity.emptyTitle')} text={t('activity.emptyText')} />
      </main>
    </>
  );
}

function FilesSection() {
  const { t } = useTranslation();
  return (
    <>
      <ListPane label={t('files.title')}>
        <FilesNav />
      </ListPane>
      <FilesView />
    </>
  );
}

function CallsSection() {
  const { t } = useTranslation();
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
