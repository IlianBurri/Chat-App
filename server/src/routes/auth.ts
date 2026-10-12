import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { clearSessionCookie, setSessionCookie } from '../lib/auth';
import { HttpError } from '../lib/http-error';
import { publicUserSelect, toMe } from '../lib/users';
import { currentUserId, requireAuth } from '../middleware/auth';

export const authRouter = Router();

const credentials = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email().max(254)),
  password: z.string().min(8).max(128),
});

const registration = credentials.extend({
  name: z.string().trim().min(2).max(80),
});

// Hash of a random password; compared against for unknown emails so response
// timing does not reveal which addresses are registered.
const DUMMY_HASH = bcrypt.hashSync('worktalk-timing-guard', 12);

authRouter.post('/register', async (req, res) => {
  const input = registration.parse(req.body);
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new HttpError(409, 'email_taken', 'This email is already registered');

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: await bcrypt.hash(input.password, 12),
    },
    select: publicUserSelect,
  });
  setSessionCookie(res, user.id);
  res.status(201).json({ user: toMe(user) });
});

authRouter.post('/login', async (req, res) => {
  const input = credentials.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const valid = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) throw new HttpError(401, 'invalid_credentials', 'Invalid email or password');

  setSessionCookie(res, user.id);
  res.json({ user: toMe(user) });
});

authRouter.post('/logout', (_req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: currentUserId(req) }, select: publicUserSelect });
  if (!user) throw new HttpError(401, 'unauthenticated', 'Please sign in');
  res.json({ user: toMe(user) });
});
