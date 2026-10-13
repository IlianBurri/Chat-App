import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { HttpError } from '../lib/http-error';
import { assertAuthor, assertCanDelete, emitPost, requirePostAccess, requireReplyAccess } from '../lib/posts';
import { currentUserId } from '../middleware/auth';

export const postsRouter = Router();
export const repliesRouter = Router();

const content = z.string().trim().min(1).max(10_000);
const reaction = z.object({ emoji: z.string().min(1).max(16) });

/** Adds the user's reaction with this emoji, or removes it if it is already there. */
async function toggleReaction(target: { postId: string } | { replyId: string }, userId: string, emoji: string) {
  const existing = await prisma.reaction.findFirst({ where: { ...target, userId, emoji } });
  if (existing) await prisma.reaction.delete({ where: { id: existing.id } });
  else await prisma.reaction.create({ data: { ...target, userId, emoji } });
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
  res.json({ post: await emitPost(post.id, 'edit', userId) });
});

postsRouter.post('/:postId/reactions', async (req, res) => {
  const userId = currentUserId(req);
  const { post } = await requirePostAccess(req.params.postId, userId);
  if (post.deletedAt) throw new HttpError(400, 'validation', 'Cannot react to a deleted post');
  const { emoji } = reaction.parse(req.body);
  await toggleReaction({ postId: post.id }, userId, emoji);
  res.json({ post: await emitPost(post.id, 'edit', userId) });
});

postsRouter.post('/:postId/replies', async (req, res) => {
  const userId = currentUserId(req);
  const { post } = await requirePostAccess(req.params.postId, userId);
  if (post.deletedAt) throw new HttpError(400, 'validation', 'Cannot reply to a deleted post');
  const input = z.object({ content }).parse(req.body);
  const now = new Date();
  await prisma.$transaction([
    prisma.reply.create({ data: { postId: post.id, authorId: userId, content: input.content, createdAt: now } }),
    // Replying moves the thread to the bottom of the channel.
    prisma.post.update({ where: { id: post.id }, data: { lastActivityAt: now } }),
  ]);
  res.status(201).json({ post: await emitPost(post.id, 'reply', userId) });
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
  const { reply, can } = await requireReplyAccess(req.params.replyId, userId);
  assertCanDelete(reply, userId, can.moderate);
  await prisma.$transaction([
    prisma.reply.update({ where: { id: reply.id }, data: { deletedAt: new Date() } }),
    prisma.reaction.deleteMany({ where: { replyId: reply.id } }),
  ]);
  res.json({ post: await emitPost(reply.postId, 'edit', userId) });
});

repliesRouter.post('/:replyId/reactions', async (req, res) => {
  const userId = currentUserId(req);
  const { reply } = await requireReplyAccess(req.params.replyId, userId);
  if (reply.deletedAt) throw new HttpError(400, 'validation', 'Cannot react to a deleted reply');
  const { emoji } = reaction.parse(req.body);
  await toggleReaction({ replyId: reply.id }, userId, emoji);
  res.json({ post: await emitPost(reply.postId, 'edit', userId) });
});
