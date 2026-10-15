import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { assertPendingFiles, attachFiles, deleteFiles, emitFilesChanged, fileIdsSchema, hasContentOrFiles } from '../lib/files';
import { HttpError } from '../lib/http-error';
import { plainExcerpt } from '../lib/text';
import { retractNotifications, syncReactionNotification } from '../lib/notifications';
import { assertAuthor, assertCanDelete, emitPost, notifyChannelContent, requirePostAccess, requireReplyAccess } from '../lib/posts';
import { currentUserId } from '../middleware/auth';

export const postsRouter = Router();
export const repliesRouter = Router();

const content = z.string().trim().min(1).max(10_000);
const reaction = z.object({ emoji: z.string().min(1).max(16) });

/** Adds the user's reaction with this emoji, or removes it if it is already there, and tells the author. */
async function toggleReaction(
  target: { postId: string; replyId?: string },
  item: { authorId: string; content: string; channelId: string },
  userId: string,
  emoji: string,
) {
  const where = target.replyId ? { replyId: target.replyId } : { postId: target.postId };
  const existing = await prisma.reaction.findFirst({ where: { ...where, userId, emoji } });
  if (existing) await prisma.reaction.delete({ where: { id: existing.id } });
  else await prisma.reaction.create({ data: { ...where, userId, emoji } });
  await syncReactionNotification({
    added: !existing,
    actorId: userId,
    authorId: item.authorId,
    emoji,
    preview: plainExcerpt(item.content),
    target: { channelId: item.channelId, postId: target.postId, replyId: target.replyId ?? null },
  });
}

// ----------------------------------------------------------------- posts

postsRouter.patch('/:postId', async (req, res) => {
  const userId = currentUserId(req);
  const { post } = await requirePostAccess(req.params.postId, userId);
  assertAuthor(post, userId);
  const data = z.object({ subject: z.string().trim().max(200).nullable().optional(), content }).parse(req.body);
  await prisma.post.update({
    where: { id: post.id },
    data: { content: data.content, ...(data.subject !== undefined ? { subject: data.subject || null } : {}), editedAt: new Date() },
  });
  res.json({ post: await emitPost(post.id, 'edit', userId) });
});

/** Soft delete, so the replies stay readable under a "deleted" placeholder. */
postsRouter.delete('/:postId', async (req, res) => {
  const userId = currentUserId(req);
  const { post, can } = await requirePostAccess(req.params.postId, userId);
  assertCanDelete(post, userId, can.moderate);
  await prisma.$transaction([
    prisma.post.update({ where: { id: post.id }, data: { deletedAt: new Date() } }),
    prisma.reaction.deleteMany({ where: { postId: post.id } }),
  ]);
  await retractNotifications({ postId: post.id, replyId: null });
  await deleteFiles({ postId: post.id, replyId: null });
  emitFilesChanged({ channelId: post.channelId });
  res.json({ post: await emitPost(post.id, 'edit', userId) });
});

postsRouter.post('/:postId/reactions', async (req, res) => {
  const userId = currentUserId(req);
  const { post } = await requirePostAccess(req.params.postId, userId);
  if (post.deletedAt) throw new HttpError(400, 'validation', 'Cannot react to a deleted post');
  const { emoji } = reaction.parse(req.body);
  await toggleReaction({ postId: post.id }, post, userId, emoji);
  res.json({ post: await emitPost(post.id, 'edit', userId) });
});

postsRouter.post('/:postId/replies', async (req, res) => {
  const userId = currentUserId(req);
  const { post, channel } = await requirePostAccess(req.params.postId, userId);
  if (post.deletedAt) throw new HttpError(400, 'validation', 'Cannot reply to a deleted post');
  const input = z
    .object({ content: z.string().trim().max(10_000), fileIds: fileIdsSchema })
    .refine(hasContentOrFiles, 'Write a reply or attach a file')
    .parse(req.body);
  await assertPendingFiles(input.fileIds, userId, { channelId: channel.id });
  const now = new Date();
  const [reply] = await prisma.$transaction([
    prisma.reply.create({ data: { postId: post.id, authorId: userId, content: input.content, createdAt: now } }),
    // Replying moves the thread to the bottom of the channel.
    prisma.post.update({ where: { id: post.id }, data: { lastActivityAt: now } }),
  ]);
  if (input.fileIds?.length) {
    await attachFiles(input.fileIds, userId, { channelId: channel.id, postId: post.id, replyId: reply.id });
    emitFilesChanged({ channelId: channel.id });
  }
  const dto = await emitPost(post.id, 'reply', userId);
  await notifyChannelContent({ channel, postId: post.id, replyId: reply.id, authorId: userId, content: input.content });
  res.status(201).json({ post: dto });
});

// --------------------------------------------------------------- replies

repliesRouter.patch('/:replyId', async (req, res) => {
  const userId = currentUserId(req);
  const { reply } = await requireReplyAccess(req.params.replyId, userId);
  assertAuthor(reply, userId);
  const input = z.object({ content }).parse(req.body);
  await prisma.reply.update({ where: { id: reply.id }, data: { content: input.content, editedAt: new Date() } });
  res.json({ post: await emitPost(reply.postId, 'edit', userId) });
});

repliesRouter.delete('/:replyId', async (req, res) => {
  const userId = currentUserId(req);
  const { reply, can, channel } = await requireReplyAccess(req.params.replyId, userId);
  assertCanDelete(reply, userId, can.moderate);
  await prisma.$transaction([
    prisma.reply.update({ where: { id: reply.id }, data: { deletedAt: new Date() } }),
    prisma.reaction.deleteMany({ where: { replyId: reply.id } }),
  ]);
  await retractNotifications({ replyId: reply.id });
  await deleteFiles({ replyId: reply.id });
  emitFilesChanged({ channelId: channel.id });
  res.json({ post: await emitPost(reply.postId, 'edit', userId) });
});

repliesRouter.post('/:replyId/reactions', async (req, res) => {
  const userId = currentUserId(req);
  const { reply, channel } = await requireReplyAccess(req.params.replyId, userId);
  if (reply.deletedAt) throw new HttpError(400, 'validation', 'Cannot react to a deleted reply');
  const { emoji } = reaction.parse(req.body);
  await toggleReaction({ postId: reply.postId, replyId: reply.id }, { ...reply, channelId: channel.id }, userId, emoji);
  res.json({ post: await emitPost(reply.postId, 'edit', userId) });
});
