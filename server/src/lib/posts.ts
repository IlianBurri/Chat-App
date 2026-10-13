import type { Prisma } from '../generated/prisma/client';
import { prisma } from '../db';
import { getIo, rooms } from '../socket/realtime';
import { forbidden, notFound } from './http-error';
import { findMentions } from './mentions';
import { summarizeReactions } from './messages';
import { notify, type NewNotification } from './notifications';
import { plainExcerpt } from './text';
import { channelAudience, requireChannelAccess } from './workspaces';

/** Upper bound of replies sent with a post; threads are short in practice. */
export const MAX_REPLIES = 500;

const author = { select: { id: true, name: true, avatarUrl: true } };
const reactions = { select: { emoji: true, userId: true }, orderBy: { createdAt: 'asc' } } as const;

export const postInclude = {
  author,
  reactions,
  replies: { orderBy: { createdAt: 'asc' }, take: MAX_REPLIES, include: { author, reactions } },
} satisfies Prisma.PostInclude;

type PostRow = Prisma.PostGetPayload<{ include: typeof postInclude }>;
type ReplyRow = PostRow['replies'][number];

function toReplyDto(r: ReplyRow) {
  const deleted = r.deletedAt !== null;
  return {
    id: r.id,
    postId: r.postId,
    author: r.author,
    content: deleted ? '' : r.content,
    createdAt: r.createdAt,
    editedAt: r.editedAt,
    deleted,
    reactions: deleted ? [] : summarizeReactions(r.reactions),
  };
}

export function toPostDto(p: PostRow) {
  const deleted = p.deletedAt !== null;
  return {
    id: p.id,
    channelId: p.channelId,
    author: p.author,
    subject: deleted ? null : p.subject,
    content: deleted ? '' : p.content,
    createdAt: p.createdAt,
    editedAt: p.editedAt,
    lastActivityAt: p.lastActivityAt,
    deleted,
    reactions: deleted ? [] : summarizeReactions(p.reactions),
    replies: p.replies.map(toReplyDto),
  };
}

export type PostDto = ReturnType<typeof toPostDto>;

export async function loadPost(postId: string) {
  return toPostDto(await prisma.post.findUniqueOrThrow({ where: { id: postId }, include: postInclude }));
}

/**
 * Sends the whole thread to everyone in the channel. `kind` tells clients
 * whether this is new content (for unread markers) or just an edit.
 */
export async function emitPost(postId: string, kind: 'post' | 'reply' | 'edit', actorId: string) {
  const post = await loadPost(postId);
  getIo().to(rooms.channel(post.channelId)).emit('post:changed', { post, kind, actorId });
  return post;
}

/** Loads a post in a channel the user can see. */
export async function requirePostAccess(postId: string, userId: string) {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw notFound('Post');
  const access = await requireChannelAccess(post.channelId, userId);
  return { post, ...access };
}

export async function requireReplyAccess(replyId: string, userId: string) {
  const reply = await prisma.reply.findUnique({ where: { id: replyId } });
  if (!reply) throw notFound('Reply');
  const access = await requirePostAccess(reply.postId, userId);
  return { reply, ...access };
}

/** Authors may edit their own content; nobody may edit somebody else's. */
export function assertAuthor(item: { authorId: string; deletedAt: Date | null }, userId: string) {
  if (item.deletedAt) throw notFound('Post');
  if (item.authorId !== userId) throw forbidden();
}

/** Authors may delete their own content; owners may delete anyone's (moderation). */
export function assertCanDelete(item: { authorId: string; deletedAt: Date | null }, userId: string, canModerate: boolean) {
  if (item.deletedAt) throw notFound('Post');
  if (item.authorId !== userId && !canModerate) throw forbidden();
}

/**
 * Activity for new channel content: mentioned people (everyone for @channel)
 * and, for replies, the post author and everyone who already replied.
 */
export async function notifyChannelContent(input: {
  channel: { id: string; workspaceId: string; type: string };
  postId: string;
  replyId?: string;
  authorId: string;
  content: string;
}) {
  const { channel, postId, replyId, authorId, content } = input;
  const audience = await channelAudience(channel);
  const base = { actorId: authorId, channelId: channel.id, postId, replyId: replyId ?? null, preview: plainExcerpt(content) };
  const mentions = findMentions(content, audience, { channel: true });
  const mentioned = mentions.everyone ? audience.map((p) => p.id) : mentions.userIds;
  const items: NewNotification[] = mentioned.map((userId) => ({ ...base, userId, type: 'mention' }));

  if (replyId) {
    const thread = await prisma.post.findUniqueOrThrow({
      where: { id: postId },
      select: { authorId: true, replies: { where: { deletedAt: null }, select: { authorId: true } } },
    });
    const inAudience = new Set(audience.map((p) => p.id));
    for (const userId of new Set([thread.authorId, ...thread.replies.map((r) => r.authorId)])) {
      if (inAudience.has(userId)) items.push({ ...base, userId, type: 'reply' });
    }
  }
  await notify(items);
}
