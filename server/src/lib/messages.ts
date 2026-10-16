import type { Prisma } from '../generated/prisma/client';
import { attachmentInclude, toFileDto } from './files';

export const messageInclude = {
  author: { select: { id: true, name: true, avatarUrl: true } },
  reactions: { select: { emoji: true, userId: true }, orderBy: { createdAt: 'asc' } },
  replyTo: {
    select: { id: true, content: true, deletedAt: true, author: { select: { id: true, name: true } } },
  },
  forwardedFrom: { select: { author: { select: { id: true, name: true } } } },
  files: attachmentInclude,
  meeting: { select: { id: true, title: true, start: true, end: true, organizerId: true, cancelledAt: true } },
  poll: {
    include: {
      options: { orderBy: { position: 'asc' }, include: { votes: { select: { userId: true } } } },
    },
  },
} satisfies Prisma.MessageInclude;

export type MessageRow = Prisma.MessageGetPayload<{ include: typeof messageInclude }>;

export interface ReactionSummary {
  emoji: string;
  userIds: string[];
}

/** Groups reactions by emoji, keeping the order in which each emoji was first used. */
export function summarizeReactions(reactions: { emoji: string; userId: string }[]): ReactionSummary[] {
  const byEmoji = new Map<string, string[]>();
  for (const r of reactions) {
    const users = byEmoji.get(r.emoji) ?? [];
    if (!users.includes(r.userId)) users.push(r.userId);
    byEmoji.set(r.emoji, users);
  }
  return [...byEmoji].map(([emoji, userIds]) => ({ emoji, userIds }));
}

const QUOTE_LENGTH = 200;

export function toMessageDto(m: MessageRow) {
  const deleted = m.deletedAt !== null;
  return {
    id: m.id,
    chatId: m.chatId,
    type: m.type,
    author: m.author,
    subject: deleted ? null : m.subject,
    content: deleted ? '' : m.content,
    createdAt: m.createdAt,
    editedAt: m.editedAt,
    deleted,
    pinned: m.pinnedAt !== null,
    replyTo: m.replyTo
      ? {
          id: m.replyTo.id,
          author: m.replyTo.author,
          content: m.replyTo.deletedAt ? null : m.replyTo.content.slice(0, QUOTE_LENGTH),
          deleted: m.replyTo.deletedAt !== null,
        }
      : null,
    forwardedFrom: m.forwardedFrom ? { author: m.forwardedFrom.author } : null,
    reactions: deleted ? [] : summarizeReactions(m.reactions),
    files: deleted ? [] : m.files.map(toFileDto),
    meeting:
      m.meeting && !deleted
        ? {
            id: m.meeting.id,
            title: m.meeting.title,
            start: m.meeting.start,
            end: m.meeting.end,
            organizerId: m.meeting.organizerId,
            cancelled: m.meeting.cancelledAt !== null,
          }
        : null,
    poll:
      m.poll && !deleted
        ? {
            id: m.poll.id,
            question: m.poll.question,
            multiple: m.poll.multiple,
            options: m.poll.options.map((o) => ({ id: o.id, text: o.text, userIds: o.votes.map((v) => v.userId) })),
          }
        : null,
  };
}

export type MessageDto = ReturnType<typeof toMessageDto>;
