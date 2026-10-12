import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { HttpError } from '../lib/http-error';
import { channelNameTaken, wouldRemoveLastOwner } from '../lib/permissions';
import { publicUserSelect, toPublicUser } from '../lib/users';
import {
  notifyWorkspacesChanged,
  requirePermission,
  requireWorkspaceMember,
  workspaceMemberIds,
  workspaceSummaries,
} from '../lib/workspaces';
import { currentUserId } from '../middleware/auth';

export const workspacesRouter = Router();

const id = z.string().min(1).max(40);
/** Tile colours offered when creating a workgroup. */
export const WORKSPACE_COLORS = ['#5B5FC7', '#0F7B6C', '#C4314B', '#CA5010', '#8764B8', '#038387', '#4F6BED', '#986F0B'] as const;

workspacesRouter.get('/', async (req, res) => {
  res.json({ workspaces: await workspaceSummaries(currentUserId(req)) });
});

/** Public workgroups the user has not joined yet ("Join or create"). */
workspacesRouter.get('/discover', async (req, res) => {
  const userId = currentUserId(req);
  const q = z.string().trim().max(100).optional().parse(req.query.q);
  const workspaces = await prisma.workspace.findMany({
    where: {
      visibility: 'public',
      members: { none: { userId } },
      ...(q ? { OR: [{ name: { contains: q } }, { description: { contains: q } }] } : {}),
    },
    orderBy: { name: 'asc' },
    take: 50,
    include: { _count: { select: { members: true } } },
  });
  res.json({
    workspaces: workspaces.map((w) => ({
      id: w.id,
      name: w.name,
      description: w.description,
      logoUrl: w.logoUrl,
      color: w.color,
      memberCount: w._count.members,
    })),
  });
});

const workspaceInput = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300).optional(),
  visibility: z.enum(['public', 'private']).default('public'),
  color: z.enum(WORKSPACE_COLORS).optional(),
});

/** Creates a workgroup with its default channel; the creator becomes owner. */
workspacesRouter.post('/', async (req, res) => {
  const userId = currentUserId(req);
  const input = workspaceInput.parse(req.body);
  const workspace = await prisma.workspace.create({
    data: {
      name: input.name,
      description: input.description || null,
      visibility: input.visibility,
      color: input.color ?? WORKSPACE_COLORS[Math.floor(Math.random() * WORKSPACE_COLORS.length)],
      members: { create: { userId, role: 'owner' } },
      channels: { create: { name: 'General', isDefault: true } },
    },
    include: { channels: true },
  });
  await notifyWorkspacesChanged([userId]);
  res.status(201).json({ workspace: { id: workspace.id, defaultChannelId: workspace.channels[0].id } });
});

workspacesRouter.patch('/:workspaceId', async (req, res) => {
  const userId = currentUserId(req);
  const { workspace } = await requirePermission(req.params.workspaceId, userId, 'manageWorkspace');
  const data = workspaceInput.partial().parse(req.body);
  await prisma.workspace.update({
    where: { id: workspace.id },
    data: { ...data, ...(data.description !== undefined ? { description: data.description || null } : {}) },
  });
  await notifyWorkspacesChanged(await workspaceMemberIds(workspace.id));
  res.status(204).end();
});

workspacesRouter.delete('/:workspaceId', async (req, res) => {
  const userId = currentUserId(req);
  const { workspace } = await requirePermission(req.params.workspaceId, userId, 'manageWorkspace');
  const members = await workspaceMemberIds(workspace.id);
  await prisma.workspace.delete({ where: { id: workspace.id } });
  await notifyWorkspacesChanged(members);
  res.status(204).end();
});

workspacesRouter.post('/:workspaceId/join', async (req, res) => {
  const userId = currentUserId(req);
  const workspace = await prisma.workspace.findUnique({ where: { id: req.params.workspaceId } });
  // Private workgroups are invite-only and must not reveal that they exist.
  if (!workspace || workspace.visibility !== 'public') throw new HttpError(404, 'not_found', 'Workgroup not found');
  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId } },
    create: { workspaceId: workspace.id, userId, role: 'member' },
    update: {},
  });
  await notifyWorkspacesChanged(await workspaceMemberIds(workspace.id));
  res.status(204).end();
});

/** Removes a member and their private-channel memberships and channel settings. */
async function removeMember(workspaceId: string, userId: string) {
  await prisma.$transaction([
    prisma.channelMember.deleteMany({ where: { userId, channel: { workspaceId } } }),
    prisma.workspaceMember.delete({ where: { workspaceId_userId: { workspaceId, userId } } }),
  ]);
}

async function ownerCount(workspaceId: string) {
  return prisma.workspaceMember.count({ where: { workspaceId, role: 'owner' } });
}

const lastOwner = () => new HttpError(400, 'last_owner', 'A workgroup needs at least one owner');

workspacesRouter.delete('/:workspaceId/members/me', async (req, res) => {
  const userId = currentUserId(req);
  const { workspace, role } = await requireWorkspaceMember(req.params.workspaceId, userId);
  if (wouldRemoveLastOwner(role, await ownerCount(workspace.id), null)) throw lastOwner();
  const members = await workspaceMemberIds(workspace.id);
  await removeMember(workspace.id, userId);
  await notifyWorkspacesChanged(members);
  res.status(204).end();
});

workspacesRouter.get('/:workspaceId/members', async (req, res) => {
  const userId = currentUserId(req);
  const { workspace } = await requireWorkspaceMember(req.params.workspaceId, userId);
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId: workspace.id },
    include: { user: { select: publicUserSelect } },
    orderBy: { user: { name: 'asc' } },
  });
  res.json({ members: members.map((m) => ({ user: toPublicUser(m.user), role: m.role, joinedAt: m.joinedAt })) });
});

const addMembers = z.object({
  userIds: z.array(id).min(1).max(50),
  role: z.enum(['member', 'guest']).default('member'),
});

workspacesRouter.post('/:workspaceId/members', async (req, res) => {
  const userId = currentUserId(req);
  const { workspace } = await requirePermission(req.params.workspaceId, userId, 'manageMembers');
  const input = addMembers.parse(req.body);
  const existing = new Set(await workspaceMemberIds(workspace.id));
  const users = await prisma.user.findMany({
    where: { id: { in: input.userIds.filter((u) => !existing.has(u)) } },
    select: { id: true },
  });
  if (users.length > 0) {
    await prisma.workspaceMember.createMany({
      data: users.map((u) => ({ workspaceId: workspace.id, userId: u.id, role: input.role })),
    });
    await notifyWorkspacesChanged(await workspaceMemberIds(workspace.id));
  }
  res.status(204).end();
});

workspacesRouter.patch('/:workspaceId/members/:userId', async (req, res) => {
  const userId = currentUserId(req);
  const { workspace } = await requirePermission(req.params.workspaceId, userId, 'manageMembers');
  const { role } = z.object({ role: z.enum(['owner', 'member', 'guest']) }).parse(req.body);
  const target = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: req.params.userId } },
  });
  if (!target) throw new HttpError(404, 'not_found', 'Member not found');
  if (wouldRemoveLastOwner(target.role, await ownerCount(workspace.id), role)) throw lastOwner();
  await prisma.workspaceMember.update({ where: { id: target.id }, data: { role } });
  await notifyWorkspacesChanged(await workspaceMemberIds(workspace.id));
  res.status(204).end();
});

workspacesRouter.delete('/:workspaceId/members/:userId', async (req, res) => {
  const userId = currentUserId(req);
  const { workspace } = await requirePermission(req.params.workspaceId, userId, 'manageMembers');
  const target = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: req.params.userId } },
  });
  if (!target) throw new HttpError(404, 'not_found', 'Member not found');
  if (wouldRemoveLastOwner(target.role, await ownerCount(workspace.id), null)) throw lastOwner();
  const members = await workspaceMemberIds(workspace.id);
  await removeMember(workspace.id, target.userId);
  await notifyWorkspacesChanged(members);
  res.status(204).end();
});

const newChannel = z.object({
  name: z.string().trim().min(1).max(50),
  description: z.string().trim().max(300).optional(),
  type: z.enum(['standard', 'private']).default('standard'),
  /** Private channels only; the creator is always added. */
  memberIds: z.array(id).max(100).default([]),
});

workspacesRouter.post('/:workspaceId/channels', async (req, res) => {
  const userId = currentUserId(req);
  const { workspace } = await requirePermission(req.params.workspaceId, userId, 'manageChannels');
  const input = newChannel.parse(req.body);
  const existing = await prisma.channel.findMany({ where: { workspaceId: workspace.id }, select: { id: true, name: true } });
  if (channelNameTaken(input.name, existing)) throw new HttpError(409, 'name_taken', 'A channel with this name already exists');

  let memberIds: string[] = [];
  if (input.type === 'private') {
    const allowed = new Set(await workspaceMemberIds(workspace.id));
    memberIds = [...new Set([userId, ...input.memberIds])].filter((m) => allowed.has(m));
  }
  const channel = await prisma.channel.create({
    data: {
      workspaceId: workspace.id,
      name: input.name,
      description: input.description || null,
      type: input.type,
      members: memberIds.length ? { create: memberIds.map((m) => ({ userId: m })) } : undefined,
    },
  });
  await notifyWorkspacesChanged(await workspaceMemberIds(workspace.id));
  res.status(201).json({ channel: { id: channel.id } });
});
