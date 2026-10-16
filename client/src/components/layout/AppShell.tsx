import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';
import { ComingSoonDialog } from '@/components/ui/ComingSoon';
import { Toaster } from '@/components/ui/Toaster';
import { MeetingDetails } from '@/features/calendar/MeetingDetails';
import { MeetingEditor } from '@/features/calendar/MeetingEditor';
import { watchIdle } from '@/lib/idle';
import { bindRealtime } from '@/lib/realtime';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import { useActivityStore } from '@/stores/activity';
import { useAuthStore } from '@/stores/auth';
import { useBadgeCounts } from '@/stores/badges';
import { useChatsStore } from '@/stores/chats';
import { useMeetingsStore } from '@/stores/meetings';
import { useMessagesStore } from '@/stores/messages';
import { usePostsStore } from '@/stores/posts';
import { useWorkspacesStore } from '@/stores/workspaces';
import { AppBar } from './AppBar';
import { TitleBar } from './TitleBar';

/** Signed-in layout: title bar on top, app bar left, section content right. */
export function AppShell() {
  const user = useAuthStore((s) => s.user);
  useTitleBadge();

  useEffect(() => {
    void useChatsStore.getState().load();
    void useWorkspacesStore.getState().load();
    void useActivityStore.getState().load();

    const socket = connectSocket();
    const unbind = bindRealtime(socket);

    // "Away" after a few minutes without input; the server combines all open tabs.
    let idle = false;
    const stopIdle = watchIdle((value) => {
      idle = value;
      socket.emit('presence:idle', value);
    });

    // After a reconnect we may have missed events: refresh the chat list and
    // drop cached histories (open chats reload theirs automatically).
    const onReconnect = () => {
      useMessagesStore.getState().reset();
      usePostsStore.getState().reset();
      void useChatsStore.getState().load();
      void useWorkspacesStore.getState().load();
      void useActivityStore.getState().load();
      if (idle) socket.emit('presence:idle', true);
    };
    socket.io.on('reconnect', onReconnect);

    return () => {
      stopIdle();
      unbind();
      socket.io.off('reconnect', onReconnect);
      disconnectSocket();
      useChatsStore.getState().reset();
      useMessagesStore.getState().reset();
      useWorkspacesStore.getState().reset();
      usePostsStore.getState().reset();
      useActivityStore.getState().reset();
      useMeetingsStore.getState().reset();
    };
  }, []);

  if (!user) return null;

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <TitleBar user={user} />
      <div className="flex min-h-0 flex-1">
        <AppBar />
        <div className="flex min-w-0 flex-1 overflow-hidden rounded-tl-lg shadow-card">
          <Outlet />
        </div>
      </div>
      <MeetingEditor />
      <MeetingDetails />
      <ComingSoonDialog />
      <Toaster />
    </div>
  );
}

/** "(3) Hallo" in the browser tab while there is something unread. */
function useTitleBadge() {
  const { t } = useTranslation();
  const { activity, chat, teams } = useBadgeCounts();
  const total = activity + chat + teams;
  const name = t('app.name');
  useEffect(() => {
    document.title = total > 0 ? `(${total}) ${name}` : name;
  }, [total, name]);
  useEffect(() => () => void (document.title = name), [name]);
}
