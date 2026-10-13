import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { canSeeChannel, RESERVED_CHANNEL_NAMES } from '../lib/permissions';
import { excerptAround } from '../lib/text';
import { publicUserSelect, toPublicUser } from '../lib/users';
import { visibleChannelIds } from '../lib/workspaces';
import { currentUserId } from '../middleware/auth';

export const searchRouter = Router();

const LIMIT = { people: 5, groups: 6, messages: 8, files: 5 };

/**
 * Substring match. SQLite's LIKE ignores case for ASCII letters; on
 * PostgreSQL add `mode: 'insensitive'` here.
 */
const textMatch = (q: string) => ({ contains: q });

const author = { select: { id: true, name: true, avatarUrl: true } };

/** Global search over people, chat messages, channel posts, workgroups/channels and files the user can see. */
searchRouter.get('/', async (req, res) => {
  const userId = currentUserId(req);
  const q = z.string().trim().min(1).max(100).parse(req.query.q);
  const match = textMatch(q);
  const channelIds = await visibleChannelIds(userId);
  const myChats = { members: { some: { userId } } };
  // Default channels are stored as "General" but shown under their translated name.
  const lower = q.toLocaleLowerCase();
  const findsDefault = RESERVED_CHANNEL_NAMES.some((name) => name.includes(lower));

  const [people, workspaces, channels, groupChats, messages, posts, replies, files] = await Promise.all([
    prisma.user.findMany({
      where: { OR: [{ name: match }, { email: match }, { jobTitle: match }] },
      select: publicUserSelect,
      orderBy: { name: 'asc' },
      take: LIMIT.people,
    }),
    prisma.workspace.findMany({
      where: { name: match, members: { some: { userId } } },
      select: { id: true, name: true, color: true, logoUrl: true },
      orderBy: { name: 'asc' },
      take: LIMIT.groups,
    }),
    prisma.channel.findMany({
      where: { id: { in: channelIds }, OR: [{ name: match }, ...(findsDefault ? [{ isDefault: true }] : [])] },
      select: {
        id: true,
        name: true,
        type: true,
        isDefault: true,
        workspace: { select: { id: true, name: true, color: true, logoUrl: true } },
        members: { where: { userId }, select: { id: true } },
      },
      orderBy: { name: 'asc' },
      take: LIMIT.groups,
    }),
    prisma.chat.findMany({
      where: { type: 'group', name: match, ...myChats },
      select: { id: true, name: true },
      orderBy: { lastMessageAt: 'desc' },
      take: LIMIT.groups,
    }),
    prisma.message.findMany({
      where: { type: 'text', deletedAt: null, chat: myChats, OR: [{ content: match }, { subject: match }] },
      select: { id: true, chatId: true, content: true, subject: true, createdAt: true, author },
      orderBy: { createdAt: 'desc' },
      take: LIMIT.messages,
    }),
    prisma.post.findMany({
      where: { deletedAt: null, channelId: { in: channelIds }, OR: [{ content: match }, { subject: match }] },
      select: { id: true, channelId: true, content: true, subject: true, createdAt: true, author, channel: { select: { workspaceId: true } } },
      orderBy: { createdAt: 'desc' },
      take: LIMIT.messages,
    }),
    prisma.reply.findMany({
      where: { deletedAt: null, content: match, post: { deletedAt: null, channelId: { in: channelIds } } },
      select: { id: true, postId: true, content: true, createdAt: true, author, post: { select: { channelId: true, subject: true, channel: { select: { workspaceId: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: LIMIT.messages,
    }),
    prisma.file.findMany({
      where: { originalName: match, OR: [{ chat: myChats }, { channelId: { in: channelIds } }] },
      select: { id: true, originalName: true, mimeType: true, size: true, createdAt: true, chatId: true, channelId: true, channel: { select: { workspaceId: true } } },
      orderBy: { createdAt: 'desc' },
      take: LIMIT.files,
    }),
  ]);

  // Chat messages and channel posts/replies are shown together, newest first.
  const conversation = [
    ...messages.map((m) => ({
      kind: 'message' as const,
      id: m.id,
      author: m.author,
      subject: m.subject,
      excerpt: excerptAround(m.content, q),
      createdAt: m.createdAt,
      chatId: m.chatId,
    })),
    ...posts.map((p) => ({
      kind: 'post' as const,
      id: p.id,
      author: p.author,
      subject: p.subject,
      excerpt: excerptAround(p.content, q),
      createdAt: p.createdAt,
      workspaceId: p.channel.workspaceId,
      channelId: p.channelId,
      postId: p.id,
    })),
    ...replies.map((r) => ({
      kind: 'reply' as const,
      id: r.id,
      author: r.author,
      subject: r.post.subject,
      excerpt: excerptAround(r.content, q),
      createdAt: r.createdAt,
      workspaceId: r.post.channel.workspaceId,
      channelId: r.post.channelId,
      postId: r.postId,
    })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, LIMIT.messages);

  res.json({
    people: people.map(toPublicUser),
    groups: [
      ...workspaces.map((w) => ({ kind: 'workspace' as const, ...w })),
      ...channels
        .filter((c) => canSeeChannel(c.type, c.members.length > 0))
        .map((c) => ({ kind: 'channel' as const, id: c.id, name: c.name, type: c.type, isDefault: c.isDefault, workspace: c.workspace })),
      ...groupChats.map((c) => ({ kind: 'chat' as const, id: c.id, name: c.name ?? '' })),
    ].slice(0, LIMIT.groups),
    messages: conversation,
    files: files.map((f) => ({
      id: f.id,
      name: f.originalName,
      mimeType: f.mimeType,
      size: f.size,
      createdAt: f.createdAt,
      chatId: f.chatId,
      channelId: f.channelId,
      workspaceId: f.channel?.workspaceId ?? null,
    })),
  });
});
