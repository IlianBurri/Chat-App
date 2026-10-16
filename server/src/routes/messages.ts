import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import {
  createMessage,
  emitMessage,
  requireChatMember,
  requireMessageAccess,
  requireOwnMessage,
} from '../lib/chats';
import { deleteFiles, emitFilesChanged } from '../lib/files';
import { HttpError } from '../lib/http-error';
import { plainExcerpt } from '../lib/text';
import { summarizeReactions } from '../lib/messages';
import { retractNotifications, syncReactionNotification } from '../lib/notifications';
import { currentUserId } from '../middleware/auth';
import { getIo, rooms } from '../socket/realtime';

export const messagesRouter = Router();

const edit = z.object({
  content: z.string().trim().min(1).max(10_000),
  subject: z.string().trim().max(200).nullable().optional(),
});

messagesRouter.patch('/:messageId', async (req, res) => {
  const userId = currentUserId(req);
  const message = await requireOwnMessage(req.params.messageId, userId);
  if (message.type !== 'text') throw new HttpError(400, 'validation', 'This message cannot be edited');
  const data = edit.parse(req.body);
  await prisma.message.update({ where: { id: message.id }, data: { ...data, editedAt: new Date() } });
  res.json({ message: await emitMessage('message:updated', message.id) });
});

/** Soft delete: the message stays in the timeline as "deleted". */
messagesRouter.delete('/:messageId', async (req, res) => {
  const userId = currentUserId(req);
  const message = await requireOwnMessage(req.params.messageId, userId);
  if (message.type === 'system' || message.type === 'meeting') throw new HttpError(400, 'validation', 'This message cannot be deleted');
  await prisma.$transaction([
    prisma.message.update({ where: { id: message.id }, data: { deletedAt: new Date(), pinnedAt: null, pinnedById: null } }),
    prisma.reaction.deleteMany({ where: { messageId: message.id } }),
  ]);
  await retractNotifications({ messageId: message.id });
  await deleteFiles({ messageId: message.id });
  emitFilesChanged({ chatId: message.chatId });
  res.json({ message: await emitMessage('message:updated', message.id) });
});

const reaction = z.object({ emoji: z.string().min(1).max(16) });

/** Toggles the current user's reaction with this emoji. */
messagesRouter.post('/:messageId/reactions', async (req, res) => {
  const userId = currentUserId(req);
  const message = await requireMessageAccess(req.params.messageId, userId);
  if (message.deletedAt || message.type === 'system') throw new HttpError(400, 'validation', 'Cannot react to this message');
  const { emoji } = reaction.parse(req.body);

  const existing = await prisma.reaction.findFirst({ where: { messageId: message.id, userId, emoji } });
  if (existing) await prisma.reaction.delete({ where: { id: existing.id } });
  else await prisma.reaction.create({ data: { messageId: message.id, userId, emoji } });

  const all = await prisma.reaction.findMany({
    where: { messageId: message.id },
    orderBy: { createdAt: 'asc' },
    select: { emoji: true, userId: true },
  });
  const payload = { chatId: message.chatId, messageId: message.id, reactions: summarizeReactions(all) };
  getIo().to(rooms.chat(message.chatId)).emit('reaction:updated', payload);
  await syncReactionNotification({
    added: !existing,
    actorId: userId,
    authorId: message.authorId,
    emoji,
    preview: plainExcerpt(message.content),
    target: { chatId: message.chatId, messageId: message.id },
  });
  res.json(payload);
});

messagesRouter.post('/:messageId/pin', async (req, res) => {
  const userId = currentUserId(req);
  const message = await requireMessageAccess(req.params.messageId, userId);
  if (message.deletedAt) throw new HttpError(400, 'validation', 'Cannot pin a deleted message');
  const pinned = message.pinnedAt === null;
  await prisma.message.update({
    where: { id: message.id },
    data: pinned ? { pinnedAt: new Date(), pinnedById: userId } : { pinnedAt: null, pinnedById: null },
  });
  res.json({ message: await emitMessage('message:updated', message.id) });
});

messagesRouter.post('/:messageId/forward', async (req, res) => {
  const userId = currentUserId(req);
  const message = await requireMessageAccess(req.params.messageId, userId);
  if (message.deletedAt || message.type !== 'text') throw new HttpError(400, 'validation', 'This message cannot be forwarded');
  const { chatId } = z.object({ chatId: z.string().min(1).max(40) }).parse(req.body);
  await requireChatMember(chatId, userId);
  const forwarded = await createMessage({
    chatId,
    authorId: userId,
    content: message.content,
    subject: message.subject,
    forwardedFromId: message.id,
  });
  res.status(201).json({ message: forwarded });
});

/** "Mark as unread" from a message: flags the chat for the current user only. */
messagesRouter.post('/:messageId/unread', async (req, res) => {
  const userId = currentUserId(req);
  const message = await requireMessageAccess(req.params.messageId, userId);
  await prisma.chatMember.update({
    where: { chatId_userId: { chatId: message.chatId, userId } },
    data: { markedUnread: true },
  });
  getIo().to(rooms.user(userId)).emit('chat:flags', { chatId: message.chatId, markedUnread: true });
  res.status(204).end();
});
