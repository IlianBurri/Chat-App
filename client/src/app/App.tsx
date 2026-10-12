import { BellIcon, CalendarBlankIcon, CloudIcon, PhoneIcon, UsersThreeIcon } from '@phosphor-icons/react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { createBrowserRouter, Navigate, Outlet, RouterProvider } from 'react-router';
import { AppShell } from '@/components/layout/AppShell';
import { ListPane } from '@/components/layout/ListPane';
import { EmptyState, PlaceholderView } from '@/components/layout/PlaceholderView';
import { AuthPage } from '@/features/auth/AuthPage';
import { ChatList } from '@/features/chat/ChatList';
import { ChatEmpty, ChatView } from '@/features/chat/ChatView';
import { NewChatView } from '@/features/chat/NewChatView';
import { ChannelView } from '@/features/teams/ChannelView';
import { TeamsList } from '@/features/teams/TeamsList';
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

function Placeholder({ section }: { section: 'activity' | 'calendar' | 'calls' | 'files' }) {
  const { t } = useTranslation();
  const icons = { activity: BellIcon, calendar: CalendarBlankIcon, calls: PhoneIcon, files: CloudIcon };
  return <PlaceholderView icon={icons[section]} title={t(`nav.${section}`)} text={t(`placeholder.${section}`)} />;
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
          { path: ':workspaceId/:channelId', element: <ChannelView /> },
        ],
      },
      { path: 'activity', element: <Placeholder section="activity" /> },
      { path: 'calendar', element: <Placeholder section="calendar" /> },
      { path: 'calls', element: <Placeholder section="calls" /> },
      { path: 'files', element: <Placeholder section="files" /> },
      { path: '*', element: <Navigate to="/chat" replace /> },
    ],
  },
]);

export function App() {
  useTheme();
  useEffect(() => {
    void useAuthStore.getState().load();
  }, []);
  return <RouterProvider router={router} />;
}
