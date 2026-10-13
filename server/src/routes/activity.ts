import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '../generated/prisma/client';
import { prisma } from '../db';
import { listNotifications, NOTIFICATION_TYPES, unreadCount } from '../lib/notifications';
import { currentUserId } from '../middleware/auth';
import { getIo, rooms } from '../socket/realtime';

export const activityRouter = Router();

const PAGE_SIZE = 30;
const id = z.string().min(1).max(40);

const listQuery = z.object({
  filter: z.enum(['all', 'unread', ...NOTIFICATION_TYPES]).default('all'),
  before: id.optional(),
});

/** The activity feed, newest first; `before` pages backwards. */
activityRouter.get('/', async (req, res) => {
  const userId = currentUserId(req);
  const { filter, before } = listQuery.parse(req.query);
  const cursor = before ? await prisma.notification.findFirst({ where: { id: before, userId } }) : null;

  const where: Prisma.NotificationWhereInput = {
    userId,
    ...(filter === 'unread' ? { readAt: null } : filter !== 'all' ? { type: filter } : {}),
    ...(cursor
      ? { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] }
      : {}),
  };
  const [notifications, unread] = await Promise.all([listNotifications(where, PAGE_SIZE + 1), unreadCount(userId)]);
  res.json({ notifications: notifications.slice(0, PAGE_SIZE), hasMore: notifications.length > PAGE_SIZE, unreadCount: unread });
});

const readBody = z.object({ ids: z.array(id).max(200).optional() });

/** Marks the given notifications (or all of them) as read in every open tab. */
activityRouter.post('/read', async (req, res) => {
  const userId = currentUserId(req);
  const { ids } = readBody.parse(req.body);
  await prisma.notification.updateMany({
    where: { userId, readAt: null, ...(ids ? { id: { in: ids } } : {}) },
    data: { readAt: new Date() },
  });
  getIo()
    .to(rooms.user(userId))
    .emit('notification:read', { ids: ids ?? 'all', unreadCount: await unreadCount(userId) });
  res.status(204).end();
});

/** "Mark as unread" for a single notification. */
activityRouter.post('/:notificationId/unread', async (req, res) => {
  const userId = currentUserId(req);
  const { count } = await prisma.notification.updateMany({
    where: { id: req.params.notificationId, userId },
    data: { readAt: null },
  });
  if (count > 0) {
    getIo()
      .to(rooms.user(userId))
      .emit('notification:unread', { id: req.params.notificationId, unreadCount: await unreadCount(userId) });
  }
  res.status(204).end();
});
