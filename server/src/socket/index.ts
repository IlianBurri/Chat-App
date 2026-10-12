import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { config } from '../config';
import { prisma } from '../db';
import { readCookie, verifySession } from '../lib/auth';
import { presence } from '../services/presence';
import { broadcastPresence, rooms, setIo } from './realtime';

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

    await socket.join([
      rooms.user(userId),
      ...user.chatMemberships.map((m) => rooms.chat(m.chatId)),
      ...user.workspaceMemberships.flatMap((m) => m.workspace.channels.map((c) => rooms.channel(c.id))),
    ]);

    presence.connect(userId, socket.id, user.manualStatus);
    void broadcastPresence(userId);

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
