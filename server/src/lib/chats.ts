import { prisma } from '../db';
import { getIo, rooms } from '../socket/realtime';
import { forbidden, notFound } from './http-error';
import { assertPendingFiles, attachFiles, emitFilesChanged } from './files';
import { findMentions } from './mentions';
import { messageInclude, toMessageDto } from './messages';
import { notify, type NewNotification } from './notifications';
import { plainExcerpt } from './text';
import { publicUserSelect, toPublicUser } from './users';

/** Throws 404 when the chat does not exist or the user is not a member. */
export async function requireChatMember(chatId: string, userId: string) {
  const member = await prisma.chatMember.findUnique({
    where: { chatId_userId: { chatId, userId } },
    include: { chat: true },
  });
  if (!member) throw notFound('Chat');
  return member;
}

/** Loads a message and checks that the user may see it. */
export async function requireMessageAccess(messageId: string, userId: string) {
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message) throw notFound('Message');
  await requireChatMember(message.chatId, userId);
  return message;
}

export async function requireOwnMessage(messageId: string, userId: string) {
  const message = await requireMessageAccess(messageId, userId);
  if (message.authorId !== userId) throw forbidden();
  if (message.deletedAt) throw notFound('Message');
  return message;
}

/** Chat list entries as seen by one user (unread count and flags are per user). */
export async function chatSummaries(userId: string, chatIds?: string[]) {
  const memberships = await prisma.chatMember.findMany({
    where: { userId, ...(chatIds ? { chatId: { in: chatIds } } : {}) },
    include: {
      chat: {
        include: {
          members: { include: { user: { select: publicUserSelect } }, orderBy: { joinedAt: 'asc' } },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              author: { select: { id: true, name: true } },
              files: { where: { pending: false }, select: { originalName: true }, take: 1 },
            },
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
              type: last.type,
              content: last.deletedAt ? null : last.content,
              fileName: last.deletedAt ? null : (last.files[0]?.originalName ?? null),
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

  return chats.sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
}

export async function chatSummary(chatId: string, userId: string) {
  const [summary] = await chatSummaries(userId, [chatId]);
  if (!summary) throw notFound('Chat');
  return summary;
}

/** Sends every member their own view of a chat (after creation or membership changes). */
export async function emitChatToMembers(chatId: string, event: 'chat:new' | 'chat:updated') {
  const members = await prisma.chatMember.findMany({ where: { chatId }, select: { userId: true } });
  const io = getIo();
  await Promise.all(
    members.map(async ({ userId }) => {
      io.in(rooms.user(userId)).socketsJoin(rooms.chat(chatId));
      io.to(rooms.user(userId)).emit(event, await chatSummary(chatId, userId));
    }),
  );
}

export async function loadMessage(messageId: string) {
  const message = await prisma.message.findUniqueOrThrow({ where: { id: messageId }, include: messageInclude });
  return toMessageDto(message);
}

export async function emitMessage(event: 'message:new' | 'message:updated', messageId: string) {
  const message = await loadMessage(messageId);
  getIo().to(rooms.chat(message.chatId)).emit(event, message);
  return message;
}

/** Creates a message, bumps the chat and un-hides it for everyone. */
export async function createMessage(data: {
  chatId: string;
  authorId: string;
  content: string;
  subject?: string | null;
  type?: string;
  replyToId?: string | null;
  forwardedFromId?: string | null;
  /** The author's pending uploads for this chat */
  fileIds?: string[];
  poll?: { question: string; multiple: boolean; options: string[] };
}) {
  await assertPendingFiles(data.fileIds, data.authorId, { chatId: data.chatId });
  const now = new Date();
  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.message.create({
      data: {
        chatId: data.chatId,
        authorId: data.authorId,
        content: data.content,
        subject: data.subject ?? null,
        type: data.type ?? 'text',
        replyToId: data.replyToId ?? null,
        forwardedFromId: data.forwardedFromId ?? null,
        createdAt: now,
        poll: data.poll
          ? {
              create: {
                question: data.poll.question,
                multiple: data.poll.multiple,
                options: { create: data.poll.options.map((text, position) => ({ text, position })) },
              },
            }
          : undefined,
      },
    });
    await tx.chat.update({ where: { id: data.chatId }, data: { lastMessageAt: now } });
    await tx.chatMember.updateMany({ where: { chatId: data.chatId, hidden: true }, data: { hidden: false } });
    // Writing a message means the author has read everything up to it.
    await tx.readReceipt.upsert({
      where: { chatId_userId: { chatId: data.chatId, userId: data.authorId } },
      create: { chatId: data.chatId, userId: data.authorId, lastReadMessageId: created.id, readAt: now },
      update: { lastReadMessageId: created.id, readAt: now },
    });
    return created;
  });

  if (data.fileIds?.length) {
    await attachFiles(data.fileIds, data.authorId, { chatId: data.chatId, messageId: message.id });
    emitFilesChanged({ chatId: data.chatId });
  }
  const dto = await emitMessage('message:new', message.id);
  getIo().to(rooms.chat(data.chatId)).emit('read:updated', {
    chatId: data.chatId,
    userId: data.authorId,
    readAt: now,
    lastReadMessageId: message.id,
  });
  if (message.type === 'text' && !message.forwardedFromId) await notifyChatMessage(message);
  return dto;
}

/** Mentions and replies in a chat end up in the activity feed of the people concerned. */
async function notifyChatMessage(message: { id: string; chatId: string; authorId: string; content: string; replyToId: string | null }) {
  const members = await prisma.chatMember.findMany({
    where: { chatId: message.chatId },
    select: { user: { select: { id: true, name: true } } },
  });
  const base = { actorId: message.authorId, chatId: message.chatId, messageId: message.id, preview: plainExcerpt(message.content) };
  const items: NewNotification[] = findMentions(
    message.content,
    members.map((m) => m.user),
  ).userIds.map((userId) => ({ ...base, userId, type: 'mention' }));

  if (message.replyToId) {
    const original = await prisma.message.findUnique({ where: { id: message.replyToId }, select: { authorId: true, deletedAt: true } });
    const stillMember = members.some((m) => m.user.id === original?.authorId);
    if (original && !original.deletedAt && stillMember) items.push({ ...base, userId: original.authorId, type: 'reply' });
  }
  await notify(items);
}
