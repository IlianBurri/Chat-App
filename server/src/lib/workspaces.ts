import { prisma } from '../db';
import { getIo, rooms } from '../socket/realtime';
import { forbidden, notFound } from './http-error';
import { canSeeChannel, isRole, permissionsFor, type Permissions, type Role } from './permissions';

/** Throws 404 when the workgroup does not exist or the user is not a member. */
export async function requireWorkspaceMember(workspaceId: string, userId: string) {
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    include: { workspace: true },
  });
  if (!member) throw notFound('Workgroup');
  const role: Role = isRole(member.role) ? member.role : 'guest';
  return { workspace: member.workspace, role, can: permissionsFor(role) };
}

/** Like requireWorkspaceMember, but also requires a permission (403 otherwise). */
export async function requirePermission(workspaceId: string, userId: string, permission: keyof Permissions) {
  const access = await requireWorkspaceMember(workspaceId, userId);
  if (!access.can[permission]) throw forbidden();
  return access;
}

/** Loads a channel the user may see (404 for private channels they are not in). */
export async function requireChannelAccess(channelId: string, userId: string) {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: { members: { where: { userId } } },
  });
  if (!channel) throw notFound('Channel');
  const access = await requireWorkspaceMember(channel.workspaceId, userId);
  if (!canSeeChannel(channel.type, channel.members.length > 0)) throw notFound('Channel');
  return { channel, membership: channel.members[0] ?? null, ...access };
}

/** Ids of every channel the user can see, across all their workgroups. */
export async function visibleChannelIds(userId: string, workspaceId?: string) {
  const channels = await prisma.channel.findMany({
    where: {
      workspace: { members: { some: { userId } } },
      ...(workspaceId ? { workspaceId } : {}),
    },
    select: { id: true, type: true, members: { where: { userId }, select: { id: true } } },
  });
  return channels.filter((c) => canSeeChannel(c.type, c.members.length > 0)).map((c) => c.id);
}

/**
 * Makes the user's open sockets listen to exactly the channels they can see.
 * Called after anything that changes membership, so private posts never reach
 * people outside the channel.
 */
export async function syncChannelRooms(userId: string) {
  const visible = new Set((await visibleChannelIds(userId)).map(rooms.channel));
  const sockets = await getIo().in(rooms.user(userId)).fetchSockets();
  for (const socket of sockets) {
    for (const room of socket.rooms) {
      if (room.startsWith('channel:') && !visible.has(room)) socket.leave(room);
    }
    socket.join([...visible]);
  }
}

/** Tells these users to reload their workgroup list (and fixes their channel rooms first). */
export async function notifyWorkspacesChanged(userIds: string[]) {
  const unique = [...new Set(userIds)];
  await Promise.all(unique.map(syncChannelRooms));
  const io = getIo();
  for (const id of unique) io.to(rooms.user(id)).emit('workspaces:changed');
}

/** Everyone who can see a channel: its members if private, otherwise the whole workgroup. */
export async function channelAudience(channel: { id: string; workspaceId: string; type: string }) {
  const user = { select: { id: true, name: true } };
  const rows =
    channel.type === 'private'
      ? await prisma.channelMember.findMany({
          // Private channel members must still belong to the workgroup.
          where: { channelId: channel.id, user: { workspaceMemberships: { some: { workspaceId: channel.workspaceId } } } },
          select: { user },
        })
      : await prisma.workspaceMember.findMany({ where: { workspaceId: channel.workspaceId }, select: { user } });
  return rows.map((r) => r.user);
}

export async function workspaceMemberIds(workspaceId: string) {
  const members = await prisma.workspaceMember.findMany({ where: { workspaceId }, select: { userId: true } });
  return members.map((m) => m.userId);
}

/** Whether someone else wrote in the channel since the user last read it. */
async function hasUnread(channelId: string, userId: string, since: Date) {
  const others = { authorId: { not: userId }, deletedAt: null, createdAt: { gt: since } };
  const post = await prisma.post.findFirst({ where: { channelId, ...others }, select: { id: true } });
  if (post) return true;
  const reply = await prisma.reply.findFirst({ where: { post: { channelId }, ...others }, select: { id: true } });
  return reply !== null;
}

/** Workgroups of a user with the channels they can see and their personal channel state. */
export async function workspaceSummaries(userId: string) {
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

  return Promise.all(
    memberships.map(async ({ workspace, role, joinedAt }) => {
      const safeRole: Role = isRole(role) ? role : 'guest';
      const channels = workspace.channels.filter((c) => canSeeChannel(c.type, c.members.length > 0));
      return {
        id: workspace.id,
        name: workspace.name,
        description: workspace.description,
        logoUrl: workspace.logoUrl,
        color: workspace.color,
        visibility: workspace.visibility,
        memberCount: workspace._count.members,
        role: safeRole,
        permissions: permissionsFor(safeRole),
        channels: await Promise.all(
          channels.map(async (c) => {
            const prefs = c.members[0];
            // Without a read marker, everything before joining counts as read.
            const readSince = prefs?.lastReadAt ?? (joinedAt > c.createdAt ? joinedAt : c.createdAt);
            return {
              id: c.id,
              name: c.name,
              description: c.description,
              type: c.type,
              isDefault: c.isDefault,
              muted: prefs?.muted ?? false,
              hidden: prefs?.hidden ?? false,
              unread: await hasUnread(c.id, userId, readSince),
            };
          }),
        ),
      };
    }),
  );
}
