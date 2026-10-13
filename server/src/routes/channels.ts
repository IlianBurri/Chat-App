import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { forbidden, HttpError } from '../lib/http-error';
import { channelNameTaken } from '../lib/permissions';
import { markNotificationsRead } from '../lib/notifications';
import { emitPost, notifyChannelContent, postInclude, toPostDto } from '../lib/posts';
import { publicUserSelect, toPublicUser } from '../lib/users';
import { notifyWorkspacesChanged, requireChannelAccess, workspaceMemberIds } from '../lib/workspaces';
import { currentUserId } from '../middleware/auth';
import { getIo, rooms } from '../socket/realtime';

export const channelsRouter = Router();

const id = z.string().min(1).max(40);

channelsRouter.get('/:channelId', async (req, res) => {
  const userId = currentUserId(req);
  const { channel } = await requireChannelAccess(req.params.channelId, userId);
  res.json({
    channel: {
      id: channel.id,
      workspaceId: channel.workspaceId,
      name: channel.name,
      description: channel.description,
      type: channel.type,
      isDefault: channel.isDefault,
      notes: channel.notes,
    },
  });
});

const channelPatch = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  description: z.string().trim().max(300).nullable().optional(),
});

channelsRouter.patch('/:channelId', async (req, res) => {
  const userId = currentUserId(req);
  const { channel, can } = await requireChannelAccess(req.params.channelId, userId);
  if (!can.manageChannels) throw forbidden();
  const data = channelPatch.parse(req.body);
  if (data.name !== undefined) {
    if (channel.isDefault) throw new HttpError(400, 'validation', 'The default channel cannot be renamed');
    const existing = await prisma.channel.findMany({ where: { workspaceId: channel.workspaceId }, select: { id: true, name: true } });
    if (channelNameTaken(data.name, existing, channel.id)) throw new HttpError(409, 'name_taken', 'A channel with this name already exists');
  }
  await prisma.channel.update({
    where: { id: channel.id },
    data: { ...data, ...(data.description !== undefined ? { description: data.description || null } : {}) },
  });
  await notifyWorkspacesChanged(await workspaceMemberIds(channel.workspaceId));
  res.status(204).end();
});

channelsRouter.delete('/:channelId', async (req, res) => {
  const userId = currentUserId(req);
  const { channel, can } = await requireChannelAccess(req.params.channelId, userId);
  if (!can.manageChannels) throw forbidden();
  if (channel.isDefault) throw new HttpError(400, 'validation', 'The default channel cannot be deleted');
  await prisma.channel.delete({ where: { id: channel.id } });
  getIo().to(rooms.channel(channel.id)).emit('channel:removed', { channelId: channel.id });
  await notifyWorkspacesChanged(await workspaceMemberIds(channel.workspaceId));
  res.status(204).end();
});

/** People in the channel: the whole workgroup, or the members of a private channel. */
channelsRouter.get('/:channelId/members', async (req, res) => {
  const userId = currentUserId(req);
  const { channel } = await requireChannelAccess(req.params.channelId, userId);
  const members = await prisma.workspaceMember.findMany({
    where: {
      workspaceId: channel.workspaceId,
      ...(channel.type === 'private' ? { user: { channelMemberships: { some: { channelId: channel.id } } } } : {}),
    },
    include: { user: { select: publicUserSelect } },
    orderBy: { user: { name: 'asc' } },
  });
  res.json({ members: members.map((m) => ({ user: toPublicUser(m.user), role: m.role, joinedAt: m.joinedAt })) });
});

async function requirePrivateChannelManager(channelId: string, userId: string) {
  const access = await requireChannelAccess(channelId, userId);
  if (access.channel.type !== 'private') throw new HttpError(400, 'validation', 'Only private channels have their own members');
  if (!access.can.manageChannels) throw forbidden();
  return access;
}

channelsRouter.post('/:channelId/members', async (req, res) => {
  const userId = currentUserId(req);
  const { channel } = await requirePrivateChannelManager(req.params.channelId, userId);
  const { userIds } = z.object({ userIds: z.array(id).min(1).max(50) }).parse(req.body);
  const allowed = new Set(await workspaceMemberIds(channel.workspaceId));
  const toAdd = userIds.filter((u) => allowed.has(u));
  for (const memberId of toAdd) {
    await prisma.channelMember.upsert({
      where: { channelId_userId: { channelId: channel.id, userId: memberId } },
      create: { channelId: channel.id, userId: memberId },
      update: {},
    });
  }
  await notifyWorkspacesChanged(toAdd);
  res.status(204).end();
});

channelsRouter.delete('/:channelId/members/:userId', async (req, res) => {
  const userId = currentUserId(req);
  const { channel } = await requirePrivateChannelManager(req.params.channelId, userId);
  const remaining = await prisma.channelMember.count({ where: { channelId: channel.id } });
  if (remaining <= 1) throw new HttpError(400, 'last_member', 'A private channel needs at least one member');
  await prisma.channelMember.deleteMany({ where: { channelId: channel.id, userId: req.params.userId } });
  getIo().to(rooms.user(req.params.userId)).emit('channel:removed', { channelId: channel.id });
  await notifyWorkspacesChanged([req.params.userId]);
  res.status(204).end();
});

channelsRouter.patch('/:channelId/notes', async (req, res) => {
  const userId = currentUserId(req);
  const { channel, can } = await requireChannelAccess(req.params.channelId, userId);
  if (!can.editNotes) throw forbidden();
  const { notes } = z.object({ notes: z.string().max(20_000) }).parse(req.body);
  await prisma.channel.update({ where: { id: channel.id }, data: { notes } });
  getIo().to(rooms.channel(channel.id)).emit('channel:notes', { channelId: channel.id, notes, userId });
  res.status(204).end();
});

/** Personal channel settings. Rows of standard channels only hold these settings, never access. */
channelsRouter.patch('/:channelId/member', async (req, res) => {
  const userId = currentUserId(req);
  const { channel } = await requireChannelAccess(req.params.channelId, userId);
  const data = z.object({ muted: z.boolean().optional(), hidden: z.boolean().optional() }).parse(req.body);
  await prisma.channelMember.upsert({
    where: { channelId_userId: { channelId: channel.id, userId } },
    create: { channelId: channel.id, userId, ...data },
    update: data,
  });
  getIo().to(rooms.user(userId)).emit('workspaces:changed');
  res.status(204).end();
});

channelsRouter.post('/:channelId/read', async (req, res) => {
  const userId = currentUserId(req);
  const { channel } = await requireChannelAccess(req.params.channelId, userId);
  const now = new Date();
  await prisma.channelMember.upsert({
    where: { channelId_userId: { channelId: channel.id, userId } },
    create: { channelId: channel.id, userId, lastReadAt: now },
    update: { lastReadAt: now },
  });
  getIo().to(rooms.user(userId)).emit('channel:read', { channelId: channel.id });
  await markNotificationsRead(userId, { channelId: channel.id }, now);
  res.status(204).end();
});

const PAGE_SIZE = 20;

/** Threads ordered by last activity, oldest first (like a timeline); `before` pages backwards. */
channelsRouter.get('/:channelId/posts', async (req, res) => {
  const userId = currentUserId(req);
  const { channel } = await requireChannelAccess(req.params.channelId, userId);
  const before = id.optional().parse(req.query.before);
  const cursor = before ? await prisma.post.findFirst({ where: { id: before, channelId: channel.id } }) : null;

  const rows = await prisma.post.findMany({
    where: { channelId: channel.id, ...(cursor ? { lastActivityAt: { lt: cursor.lastActivityAt } } : {}) },
    orderBy: { lastActivityAt: 'desc' },
    take: PAGE_SIZE + 1,
    include: postInclude,
  });
  res.json({ posts: rows.slice(0, PAGE_SIZE).reverse().map(toPostDto), hasMore: rows.length > PAGE_SIZE });
});

const newPost = z.object({
  subject: z.string().trim().max(200).optional(),
  content: z.string().trim().min(1).max(10_000),
});

channelsRouter.post('/:channelId/posts', async (req, res) => {
  const userId = currentUserId(req);
  const { channel } = await requireChannelAccess(req.params.channelId, userId);
  const input = newPost.parse(req.body);
  const now = new Date();
  const post = await prisma.post.create({
    data: { channelId: channel.id, authorId: userId, subject: input.subject || null, content: input.content, createdAt: now, lastActivityAt: now },
  });
  const dto = await emitPost(post.id, 'post', userId);
  await notifyChannelContent({ channel, postId: post.id, authorId: userId, content: input.content });
  res.status(201).json({ post: dto });
});
