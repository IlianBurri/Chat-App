import type { Prisma } from '../generated/prisma/client';
import { prisma } from '../db';
import { getIo, rooms } from '../socket/realtime';

export const NOTIFICATION_TYPES = ['mention', 'reply', 'reaction', 'missed_call', 'meeting'] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface NewNotification {
  userId: string;
  actorId: string;
  type: NotificationType;
  preview?: string | null;
  emoji?: string | null;
  chatId?: string | null;
  channelId?: string | null;
  messageId?: string | null;
  postId?: string | null;
  replyId?: string | null;
  meetingId?: string | null;
}

/** Lower number wins when one event would notify the same person twice. */
const PRIORITY: Record<NotificationType, number> = { mention: 0, reply: 1, reaction: 2, missed_call: 3, meeting: 4 };

/** Nobody is notified about their own actions, and everyone at most once per event (mention beats reply). */
export function pickNotifications(items: NewNotification[]): NewNotification[] {
  const byUser = new Map<string, NewNotification>();
  for (const item of items) {
    if (item.userId === item.actorId) continue;
    const current = byUser.get(item.userId);
    if (!current || PRIORITY[item.type] < PRIORITY[current.type]) byUser.set(item.userId, item);
  }
  return [...byUser.values()];
}

const notificationInclude = { actor: { select: { id: true, name: true, avatarUrl: true } } } satisfies Prisma.NotificationInclude;
type NotificationRow = Prisma.NotificationGetPayload<{ include: typeof notificationInclude }>;

/** Adds the workgroup of channel notifications, which the client needs for links. */
export async function toNotificationDtos(rows: NotificationRow[]) {
  const channelIds = [...new Set(rows.map((r) => r.channelId).filter((id): id is string => id !== null))];
  const channels = channelIds.length
    ? await prisma.channel.findMany({ where: { id: { in: channelIds } }, select: { id: true, workspaceId: true } })
    : [];
  const workspaceOf = new Map(channels.map((c) => [c.id, c.workspaceId]));

  return rows.map((r) => ({
    id: r.id,
    type: r.type as NotificationType,
    actor: r.actor,
    preview: r.preview,
    emoji: r.emoji,
    chatId: r.chatId,
    channelId: r.channelId,
    workspaceId: r.channelId ? (workspaceOf.get(r.channelId) ?? null) : null,
    messageId: r.messageId,
    postId: r.postId,
    replyId: r.replyId,
    meetingId: r.meetingId,
    createdAt: r.createdAt,
    read: r.readAt !== null,
  }));
}

export async function listNotifications(where: Prisma.NotificationWhereInput, take: number) {
  const rows = await prisma.notification.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take,
    include: notificationInclude,
  });
  return toNotificationDtos(rows);
}

export function unreadCount(userId: string) {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

/** Stores notifications and pushes each one (with the new unread count) to its recipient's open tabs. */
export async function notify(items: NewNotification[]) {
  const picked = pickNotifications(items);
  if (picked.length === 0) return;
  const rows = await prisma.$transaction(picked.map((data) => prisma.notification.create({ data, include: notificationInclude })));
  const io = getIo();
  for (const dto of await toNotificationDtos(rows)) {
    const userId = rows.find((r) => r.id === dto.id)!.userId;
    io.to(rooms.user(userId)).emit('notification:new', { notification: dto, unreadCount: await unreadCount(userId) });
  }
}

/** Deletes notifications (e.g. a reaction was taken back) and removes them from the recipients' feeds. */
export async function retractNotifications(where: Prisma.NotificationWhereInput) {
  const rows = await prisma.notification.findMany({ where, select: { id: true, userId: true } });
  if (rows.length === 0) return;
  await prisma.notification.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
  const io = getIo();
  for (const userId of new Set(rows.map((r) => r.userId))) {
    const ids = rows.filter((r) => r.userId === userId).map((r) => r.id);
    io.to(rooms.user(userId)).emit('notification:removed', { ids, unreadCount: await unreadCount(userId) });
  }
}

/** Adds or removes the reaction notification for the author of the reacted-to content. */
export async function syncReactionNotification(input: {
  added: boolean;
  actorId: string;
  authorId: string;
  emoji: string;
  preview: string;
  target: Pick<NewNotification, 'chatId' | 'channelId' | 'messageId' | 'postId' | 'replyId'>;
}) {
  const { added, actorId, authorId, emoji, preview, target } = input;
  if (added) await notify([{ type: 'reaction', userId: authorId, actorId, emoji, preview, ...target }]);
  else
    await retractNotifications({
      type: 'reaction',
      actorId,
      emoji,
      messageId: target.messageId ?? null,
      postId: target.postId ?? null,
      replyId: target.replyId ?? null,
    });
}

/** Reading a chat or channel also settles its activity entries up to that point. */
export async function markNotificationsRead(userId: string, scope: { chatId: string } | { channelId: string }, until: Date) {
  const rows = await prisma.notification.findMany({
    where: { userId, readAt: null, createdAt: { lte: until }, ...scope },
    select: { id: true },
  });
  if (rows.length === 0) return;
  const ids = rows.map((r) => r.id);
  await prisma.notification.updateMany({ where: { id: { in: ids } }, data: { readAt: new Date() } });
  getIo().to(rooms.user(userId)).emit('notification:read', { ids, unreadCount: await unreadCount(userId) });
}
