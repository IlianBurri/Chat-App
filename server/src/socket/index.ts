import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { config } from '../config';
import { prisma } from '../db';
import { readCookie, verifySession } from '../lib/auth';
import { presence } from '../services/presence';
import { broadcastPresence, presenceSnapshot, rooms, setIo } from './realtime';

export function createSocketServer(httpServer: HttpServer) {
  const io = new Server(httpServer, { serveClient: false });
  setIo(io);

  io.use((socket, next) => {
    const userId = verifySession(readCookie(socket.handshake.headers.cookie, config.cookieName));
    if (!userId) return next(new Error('unauthenticated'));
    socket.data.userId = userId;
    next();
  });

  io.on('connection', async (socket) => {
    const userId = socket.data.userId as string;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        manualStatus: true,
        chatMemberships: { select: { chatId: true } },
        workspaceMemberships: { select: { workspace: { select: { channels: { select: { id: true } } } } } },
      },
    });
    if (!user) {
      socket.disconnect(true);
      return;
    }
    // The client may already have gone away while we were loading.
    if (socket.disconnected) return;

    await socket.join([
      rooms.user(userId),
      ...user.chatMemberships.map((m) => rooms.chat(m.chatId)),
      ...user.workspaceMemberships.flatMap((m) => m.workspace.channels.map((c) => rooms.channel(c.id))),
    ]);

    presence.connect(userId, socket.id, user.manualStatus);
    socket.emit('presence:snapshot', await presenceSnapshot());
    void broadcastPresence(userId);

    // Typing indicator: relayed to the other members of the chat, never stored.
    socket.on('typing', async (payload: unknown) => {
      const { chatId, typing } = (payload ?? {}) as { chatId?: unknown; typing?: unknown };
      if (typeof chatId !== 'string' || !socket.rooms.has(rooms.chat(chatId))) return;
      const me = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
      socket.to(rooms.chat(chatId)).emit('typing', { chatId, userId, name: me?.name ?? '', typing: typing === true });
    });

    socket.on('presence:idle', (idle: unknown) => {
      presence.setIdle(userId, socket.id, idle === true);
      void broadcastPresence(userId);
    });

    socket.on('disconnect', async () => {
      if (presence.disconnect(userId, socket.id)) {
        await prisma.user.update({ where: { id: userId }, data: { lastSeenAt: new Date() } });
      }
      void broadcastPresence(userId);
    });
  });

  return io;
}
