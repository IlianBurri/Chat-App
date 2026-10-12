import { Router } from 'express';
import { prisma } from '../db';
import { currentUserId } from '../middleware/auth';

export const workspacesRouter = Router();

/** Workgroups of the current user with the channels they can see. */
workspacesRouter.get('/', async (req, res) => {
  const userId = currentUserId(req);
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    orderBy: { workspace: { name: 'asc' } },
    include: {
      workspace: {
        include: {
          _count: { select: { members: true } },
          channels: {
            orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
            include: { members: { where: { userId } } },
          },
        },
      },
    },
  });

  res.json({
    workspaces: memberships.map(({ workspace, role }) => ({
      id: workspace.id,
      name: workspace.name,
      description: workspace.description,
      logoUrl: workspace.logoUrl,
      color: workspace.color,
      visibility: workspace.visibility,
      memberCount: workspace._count.members,
      role,
      channels: workspace.channels
        .filter((c) => c.type === 'standard' || c.members.length > 0)
        .map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          type: c.type,
          isDefault: c.isDefault,
          muted: c.members[0]?.muted ?? false,
          hidden: c.members[0]?.hidden ?? false,
        })),
    })),
  });
});
