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
