import type { Server } from 'socket.io';
import { prisma } from '../db';
import { presence } from '../services/presence';

let io: Server | null = null;

export function setIo(server: Server) {
  io = server;
}

export function getIo(): Server {
  if (!io) throw new Error('Socket server not initialised');
  return io;
}

export const rooms = {
  user: (id: string) => `user:${id}`,
  chat: (id: string) => `chat:${id}`,
  channel: (id: string) => `channel:${id}`,
};

/** Current status of every online user, sent to a client right after it connects. */
export async function presenceSnapshot() {
  const users = await prisma.user.findMany({
    where: { id: { in: presence.onlineUserIds() } },
    select: { id: true, manualStatus: true, statusMessage: true },
  });
  return users.map((u) => ({
    userId: u.id,
    status: presence.statusOf(u.id, u.manualStatus),
    statusMessage: u.statusMessage,
  }));
}

/** Broadcasts a user's current effective status to every connected client. */
export async function broadcastPresence(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { manualStatus: true, statusMessage: true },
  });
  if (!user || !io) return;
  io.emit('presence:update', {
    userId,
    status: presence.statusOf(userId, user.manualStatus),
    statusMessage: user.statusMessage,
  });
}
