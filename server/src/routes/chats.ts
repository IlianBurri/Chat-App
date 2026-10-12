import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import {
  chatSummaries,
  chatSummary,
  createMessage,
  emitChatToMembers,
  requireChatMember,
} from '../lib/chats';
import { HttpError } from '../lib/http-error';
import { messageInclude, toMessageDto } from '../lib/messages';
import { currentUserId } from '../middleware/auth';
import { getIo, rooms } from '../socket/realtime';

export const chatsRouter = Router();

const id = z.string().min(1).max(40);
const content = z.string().trim().min(1).max(10_000);

chatsRouter.get('/', async (req, res) => {
  res.json({ chats: await chatSummaries(currentUserId(req)) });
});

const newChat = z.object({
  memberIds: z.array(id).min(1).max(50),
  name: z.string().trim().max(80).optional(),
  message: content.optional(),
});

/** Starts a chat. With one other person an existing 1:1 chat is reused. */
chatsRouter.post('/', async (req, res) => {
  const userId = currentUserId(req);
  const input = newChat.parse(req.body);
  const others = [...new Set(input.memberIds)].filter((m) => m !== userId);
  if (others.length === 0) throw new HttpError(400, 'validation', 'Pick at least one other person');
  const found = await prisma.user.count({ where: { id: { in: others } } });
  if (found !== others.length) throw new HttpError(400, 'validation', 'Unknown user');

  let chatId: string | undefined;
  if (others.length === 1 && !input.name) {
    const existing = await prisma.chat.findFirst({
      where: {
        type: 'direct',
        AND: [{ members: { some: { userId } } }, { members: { some: { userId: others[0] } } }],
      },
    });
    chatId = existing?.id;
    if (chatId) {
      await prisma.chatMember.update({
        where: { chatId_userId: { chatId, userId } },
        data: { hidden: false },
      });
    }
  }

  const created = !chatId;
  if (!chatId) {
    const chat = await prisma.chat.create({
      data: {
        type: others.length === 1 && !input.name ? 'direct' : 'group',
        name: input.name || null,
        members: { create: [userId, ...others].map((m) => ({ userId: m })) },
      },
    });
    chatId = chat.id;
  }

  if (input.message) await createMessage({ chatId, authorId: userId, content: input.message });
  if (created) await emitChatToMembers(chatId, 'chat:new');
  res.status(created ? 201 : 200).json({ chat: await chatSummary(chatId, userId) });
});

chatsRouter.get('/:chatId', async (req, res) => {
  const userId = currentUserId(req);
  await requireChatMember(req.params.chatId, userId);
  res.json({ chat: await chatSummary(req.params.chatId, userId) });
});

chatsRouter.patch('/:chatId', async (req, res) => {
  const userId = currentUserId(req);
  const { chat } = await requireChatMember(req.params.chatId, userId);
  if (chat.type !== 'group') throw new HttpError(400, 'validation', 'Only group chats have a name');
  const { name } = z.object({ name: z.string().trim().max(80) }).parse(req.body);
  await prisma.chat.update({ where: { id: chat.id }, data: { name: name || null } });
  await createMessage({ chatId: chat.id, authorId: userId, type: 'system', content: JSON.stringify({ event: 'renamed', name }) });
  await emitChatToMembers(chat.id, 'chat:updated');
  res.json({ chat: await chatSummary(chat.id, userId) });
});

const PAGE_SIZE = 40;

chatsRouter.get('/:chatId/messages', async (req, res) => {
  const userId = currentUserId(req);
  const { chat } = await requireChatMember(req.params.chatId, userId);
  const before = id.optional().parse(req.query.before);
  const cursor = before ? await prisma.message.findFirst({ where: { id: before, chatId: chat.id } }) : null;

  const rows = await prisma.message.findMany({
    where: { chatId: chat.id, ...(cursor ? { createdAt: { lt: cursor.createdAt } } : {}) },
    orderBy: { createdAt: 'desc' },
    take: PAGE_SIZE + 1,
    include: messageInclude,
  });
  const receipts = await prisma.readReceipt.findMany({
    where: { chatId: chat.id },
    select: { userId: true, readAt: true, lastReadMessageId: true },
  });

  res.json({
    messages: rows.slice(0, PAGE_SIZE).reverse().map(toMessageDto),
    hasMore: rows.length > PAGE_SIZE,
    receipts,
  });
});

const newMessage = z.object({
  content,
  subject: z.string().trim().max(200).optional(),
  replyToId: id.optional(),
});

chatsRouter.post('/:chatId/messages', async (req, res) => {
  const userId = currentUserId(req);
  const { chat } = await requireChatMember(req.params.chatId, userId);
  const input = newMessage.parse(req.body);
  if (input.replyToId) {
    const original = await prisma.message.findFirst({ where: { id: input.replyToId, chatId: chat.id } });
    if (!original) throw new HttpError(400, 'validation', 'Reply target not found');
  }
  const message = await createMessage({ chatId: chat.id, authorId: userId, ...input });
  res.status(201).json({ message });
});

const newPoll = z.object({
  question: z.string().trim().min(1).max(300),
  options: z.array(z.string().trim().min(1).max(200)).min(2).max(10),
  multiple: z.boolean().default(false),
});

chatsRouter.post('/:chatId/polls', async (req, res) => {
  const userId = currentUserId(req);
  const { chat } = await requireChatMember(req.params.chatId, userId);
  const poll = newPoll.parse(req.body);
  const message = await createMessage({ chatId: chat.id, authorId: userId, type: 'poll', content: poll.question, poll });
  res.status(201).json({ message });
});

/** Marks the chat as read up to a message (default: everything). */
chatsRouter.post('/:chatId/read', async (req, res) => {
  const userId = currentUserId(req);
  const { chat } = await requireChatMember(req.params.chatId, userId);
  const { messageId } = z.object({ messageId: id.optional() }).parse(req.body);
  const last = messageId
    ? await prisma.message.findFirst({ where: { id: messageId, chatId: chat.id } })
    : await prisma.message.findFirst({ where: { chatId: chat.id }, orderBy: { createdAt: 'desc' } });
  const readAt = last?.createdAt ?? new Date();

  const existing = await prisma.readReceipt.findUnique({ where: { chatId_userId: { chatId: chat.id, userId } } });
  // Never move the read marker backwards (e.g. an older tab catching up).
  if (!existing || existing.readAt < readAt) {
    await prisma.readReceipt.upsert({
      where: { chatId_userId: { chatId: chat.id, userId } },
      create: { chatId: chat.id, userId, readAt, lastReadMessageId: last?.id ?? null },
      update: { readAt, lastReadMessageId: last?.id ?? null },
    });
  }
  await prisma.chatMember.update({ where: { chatId_userId: { chatId: chat.id, userId } }, data: { markedUnread: false } });

  const receipt = { chatId: chat.id, userId, readAt: existing && existing.readAt > readAt ? existing.readAt : readAt };
  getIo().to(rooms.chat(chat.id)).emit('read:updated', receipt);
  res.json({ receipt });
});

const memberPatch = z.object({
  pinned: z.boolean().optional(),
  muted: z.boolean().optional(),
  hidden: z.boolean().optional(),
  markedUnread: z.boolean().optional(),
});

/** Personal chat settings: pin, mute, hide, mark as unread. */
chatsRouter.patch('/:chatId/member', async (req, res) => {
  const userId = currentUserId(req);
  const { chat } = await requireChatMember(req.params.chatId, userId);
  const data = memberPatch.parse(req.body);
  await prisma.chatMember.update({ where: { chatId_userId: { chatId: chat.id, userId } }, data });
  const summary = await chatSummary(chat.id, userId);
  getIo().to(rooms.user(userId)).emit('chat:updated', summary);
  res.json({ chat: summary });
});

chatsRouter.post('/:chatId/members', async (req, res) => {
  const userId = currentUserId(req);
  const { chat } = await requireChatMember(req.params.chatId, userId);
  if (chat.type !== 'group') throw new HttpError(400, 'validation', 'People can only be added to group chats');
  const { userIds } = z.object({ userIds: z.array(id).min(1).max(50) }).parse(req.body);

  const existing = await prisma.chatMember.findMany({ where: { chatId: chat.id }, select: { userId: true } });
  const known = new Set(existing.map((m) => m.userId));
  const users = await prisma.user.findMany({ where: { id: { in: userIds.filter((u) => !known.has(u)) } }, select: { id: true } });
  if (users.length > 0) {
    await prisma.chatMember.createMany({ data: users.map((u) => ({ chatId: chat.id, userId: u.id })) });
    await createMessage({
      chatId: chat.id,
      authorId: userId,
      type: 'system',
      content: JSON.stringify({ event: 'added', userIds: users.map((u) => u.id) }),
    });
    await emitChatToMembers(chat.id, 'chat:updated');
  }
  res.json({ chat: await chatSummary(chat.id, userId) });
});

/** Leave a group chat. */
chatsRouter.delete('/:chatId/member', async (req, res) => {
  const userId = currentUserId(req);
  const { chat } = await requireChatMember(req.params.chatId, userId);
  if (chat.type !== 'group') throw new HttpError(400, 'validation', 'You can only leave group chats');

  await createMessage({ chatId: chat.id, authorId: userId, type: 'system', content: JSON.stringify({ event: 'left' }) });
  await prisma.chatMember.delete({ where: { chatId_userId: { chatId: chat.id, userId } } });
  await prisma.readReceipt.deleteMany({ where: { chatId: chat.id, userId } });

  const io = getIo();
  io.to(rooms.user(userId)).emit('chat:removed', { chatId: chat.id });
  io.in(rooms.user(userId)).socketsLeave(rooms.chat(chat.id));
  await emitChatToMembers(chat.id, 'chat:updated');
  res.status(204).end();
});
