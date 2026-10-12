import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { emitMessage, requireMessageAccess } from '../lib/chats';
import { HttpError, notFound } from '../lib/http-error';
import { currentUserId } from '../middleware/auth';

export const pollsRouter = Router();

const vote = z.object({ optionIds: z.array(z.string().min(1).max(40)).max(10) });

/** Replaces the current user's votes; an empty list withdraws the vote. */
pollsRouter.post('/:pollId/vote', async (req, res) => {
  const userId = currentUserId(req);
  const poll = await prisma.poll.findUnique({ where: { id: req.params.pollId }, include: { options: true } });
  if (!poll) throw notFound('Poll');
  const message = await requireMessageAccess(poll.messageId, userId);
  if (message.deletedAt) throw notFound('Poll');

  const optionIds = [...new Set(vote.parse(req.body).optionIds)];
  const valid = new Set(poll.options.map((o) => o.id));
  if (optionIds.some((o) => !valid.has(o))) throw new HttpError(400, 'validation', 'Unknown option');
  if (!poll.multiple && optionIds.length > 1) throw new HttpError(400, 'validation', 'Only one option allowed');

  await prisma.$transaction([
    prisma.pollVote.deleteMany({ where: { userId, optionId: { in: [...valid] } } }),
    prisma.pollVote.createMany({ data: optionIds.map((optionId) => ({ optionId, userId })) }),
  ]);
  res.json({ message: await emitMessage('message:updated', poll.messageId) });
});
