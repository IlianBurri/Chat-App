import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { publicUserSelect, toMe, toPublicUser } from '../lib/users';
import { currentUserId } from '../middleware/auth';
import { presence, STATUSES } from '../services/presence';
import { broadcastPresence } from '../socket/realtime';

export const usersRouter = Router();

usersRouter.get('/', async (req, res) => {
  const q = z.string().trim().max(100).optional().parse(req.query.q);
  const users = await prisma.user.findMany({
    where: q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }] } : undefined,
    select: publicUserSelect,
    orderBy: { name: 'asc' },
    take: 50,
  });
  res.json({ users: users.map(toPublicUser) });
});

const profilePatch = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  jobTitle: z.string().trim().max(80).nullable().optional(),
  manualStatus: z.enum(STATUSES).nullable().optional(),
  statusMessage: z
    .string()
    .trim()
    .max(280)
    .nullable()
    .optional()
    .transform((v) => (v === '' ? null : v)),
});

usersRouter.patch('/me', async (req, res) => {
  const userId = currentUserId(req);
  const data = profilePatch.parse(req.body);
  const user = await prisma.user.update({ where: { id: userId }, data, select: publicUserSelect });

  if (data.manualStatus !== undefined) presence.setManual(userId, data.manualStatus);
  if (data.manualStatus !== undefined || data.statusMessage !== undefined) void broadcastPresence(userId);

  res.json({ user: toMe(user) });
});
