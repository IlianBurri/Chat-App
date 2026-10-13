import { useEffect } from 'react';
import { Outlet } from 'react-router';
import { ComingSoonDialog } from '@/components/ui/ComingSoon';
import { Toaster } from '@/components/ui/Toaster';
import { bindRealtime } from '@/lib/realtime';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/auth';
import { useChatsStore } from '@/stores/chats';
import { useMessagesStore } from '@/stores/messages';
import { usePostsStore } from '@/stores/posts';
import { useWorkspacesStore } from '@/stores/workspaces';
import { AppBar } from './AppBar';
import { TitleBar } from './TitleBar';

/** Signed-in layout: title bar on top, app bar left, section content right. */
export function AppShell() {
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    void useChatsStore.getState().load();
    void useWorkspacesStore.getState().load();

    const socket = connectSocket();
    const unbind = bindRealtime(socket);
    // After a reconnect we may have missed events: refresh the chat list and
    // drop cached histories (open chats reload theirs automatically).
    const onReconnect = () => {
      useMessagesStore.getState().reset();
      usePostsStore.getState().reset();
      void useChatsStore.getState().load();
      void useWorkspacesStore.getState().load();
    };
    socket.io.on('reconnect', onReconnect);

    return () => {
      unbind();
      socket.io.off('reconnect', onReconnect);
      disconnectSocket();
      useChatsStore.getState().reset();
      useMessagesStore.getState().reset();
      useWorkspacesStore.getState().reset();
      usePostsStore.getState().reset();
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
      <ComingSoonDialog />
      <Toaster />
    </div>
  );
}
