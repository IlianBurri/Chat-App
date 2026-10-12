import { Router } from 'express';
import { prisma } from '../db';
import { publicUserSelect, toPublicUser } from '../lib/users';
import { currentUserId } from '../middleware/auth';

export const chatsRouter = Router();

/** Chat list of the current user with last message and unread count. */
chatsRouter.get('/', async (req, res) => {
  const userId = currentUserId(req);
  const memberships = await prisma.chatMember.findMany({
    where: { userId },
    include: {
      chat: {
        include: {
          members: { include: { user: { select: publicUserSelect } } },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { author: { select: { id: true, name: true } } },
          },
          readReceipts: { where: { userId } },
        },
      },
    },
  });

  const chats = await Promise.all(
    memberships.map(async ({ chat, ...membership }) => {
      const readAt = chat.readReceipts[0]?.readAt ?? membership.joinedAt;
      const unreadCount = await prisma.message.count({
        where: { chatId: chat.id, authorId: { not: userId }, deletedAt: null, createdAt: { gt: readAt } },
      });
      const last = chat.messages[0];
      return {
        id: chat.id,
        type: chat.type,
        name: chat.name,
        members: chat.members.map((m) => toPublicUser(m.user)),
        lastMessage: last
          ? {
              id: last.id,
              content: last.deletedAt ? null : last.content,
              deleted: last.deletedAt !== null,
              author: last.author,
              createdAt: last.createdAt,
            }
          : null,
        lastMessageAt: chat.lastMessageAt,
        unreadCount,
        pinned: membership.pinned,
        muted: membership.muted,
        hidden: membership.hidden,
        markedUnread: membership.markedUnread,
      };
    }),
  );

  chats.sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
  res.json({ chats });
});
