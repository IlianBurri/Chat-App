import { useEffect } from 'react';
import { Outlet } from 'react-router';
import { ComingSoonDialog } from '@/components/ui/ComingSoon';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import type { Status } from '@/lib/types';
import { useAuthStore } from '@/stores/auth';
import { useChatsStore } from '@/stores/chats';
import { usePresenceStore } from '@/stores/presence';
import { useWorkspacesStore } from '@/stores/workspaces';
import { AppBar } from './AppBar';
import { TitleBar } from './TitleBar';

interface PresenceEvent {
  userId: string;
  status: Status;
  statusMessage: string | null;
}

/** Signed-in layout: title bar on top, app bar left, section content right. */
export function AppShell() {
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    void useChatsStore.getState().load();
    void useWorkspacesStore.getState().load();

    const socket = connectSocket();
    const applyPresence = (e: PresenceEvent) =>
      usePresenceStore.getState().update(e.userId, { status: e.status, statusMessage: e.statusMessage });
    socket.on('presence:snapshot', (events: PresenceEvent[]) => events.forEach(applyPresence));
    socket.on('presence:update', applyPresence);
    return () => disconnectSocket();
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
    </div>
  );
}
