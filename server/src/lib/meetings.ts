import type { Prisma } from '../generated/prisma/client';
import { prisma } from '../db';
import { getIo, rooms } from '../socket/realtime';
import { createMessage, emitChatToMembers, emitMessage, requireChatMember } from './chats';
import { forbidden, HttpError, notFound } from './http-error';
import { notify } from './notifications';
import { publicUserSelect, toPublicUser } from './users';

export const RESPONSES = ['none', 'accepted', 'tentative', 'declined'] as const;
export type MeetingResponse = (typeof RESPONSES)[number];

/** Longest meeting we accept; also the widest range the calendar may ask for. */
export const MAX_MEETING_MS = 7 * 24 * 60 * 60 * 1000;

/** Throws a 400 unless the meeting ends after it starts and lasts at most a week. */
export function assertValidTimes(start: Date, end: Date) {
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new HttpError(400, 'validation', 'Invalid date');
  if (end <= start) throw new HttpError(400, 'validation', 'The meeting must end after it starts');
  if (end.getTime() - start.getTime() > MAX_MEETING_MS) throw new HttpError(400, 'validation', 'Meetings can last at most 7 days');
}

/** Who joins and who leaves when the attendee list changes. */
export function diffParticipants(before: string[], after: string[]) {
  const old = new Set(before);
  const next = new Set(after);
  return { added: [...next].filter((id) => !old.has(id)), removed: [...old].filter((id) => !next.has(id)) };
}

const meetingInclude = {
  organizer: { select: publicUserSelect },
  participants: { include: { user: { select: publicUserSelect } } },
} satisfies Prisma.MeetingInclude;

type MeetingRow = Prisma.MeetingGetPayload<{ include: typeof meetingInclude }>;

export function toMeetingDto(m: MeetingRow) {
  return {
    id: m.id,
    title: m.title,
    description: m.description,
    start: m.start,
    end: m.end,
    chatId: m.chatId,
    roomId: m.roomId,
    isInstant: m.isInstant,
    cancelled: m.cancelledAt !== null,
    organizer: toPublicUser(m.organizer),
    participants: m.participants
      .map((p) => ({ user: toPublicUser(p.user), response: p.response as MeetingResponse }))
      .sort((a, b) => a.user.name.localeCompare(b.user.name)),
  };
}

export type MeetingDto = ReturnType<typeof toMeetingDto>;

async function loadMeeting(meetingId: string) {
  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId }, include: meetingInclude });
  if (!meeting) throw notFound('Meeting');
  return meeting;
}

/** Attendees and members of the meeting's chat may see a meeting; everyone else gets a 404. */
export async function requireMeetingAccess(meetingId: string, userId: string) {
  const meeting = await loadMeeting(meetingId);
  if (meeting.organizerId === userId || meeting.participants.some((p) => p.userId === userId)) return meeting;
  if (meeting.chatId) {
    const member = await prisma.chatMember.findUnique({ where: { chatId_userId: { chatId: meeting.chatId, userId } } });
    if (member) return meeting;
  }
  throw notFound('Meeting');
}

export async function requireOrganizer(meetingId: string, userId: string) {
  const meeting = await requireMeetingAccess(meetingId, userId);
  if (meeting.organizerId !== userId) throw forbidden();
  if (meeting.cancelledAt) throw new HttpError(409, 'cancelled', 'The meeting was cancelled');
  return meeting;
}

/** Meetings in a user's calendar that overlap [from, to). Cancelled ones disappear. */
export async function listMeetings(userId: string, from: Date, to: Date) {
  const rows = await prisma.meeting.findMany({
    where: { cancelledAt: null, start: { lt: to }, end: { gt: from }, participants: { some: { userId } } },
    include: meetingInclude,
    orderBy: { start: 'asc' },
  });
  return rows.map(toMeetingDto);
}

async function assertUsersExist(ids: string[]) {
  const found = await prisma.user.count({ where: { id: { in: ids } } });
  if (found !== ids.length) throw new HttpError(400, 'validation', 'Unknown user');
}

/** Pushes the current meeting to every attendee and refreshes its invitation cards in chats. */
export async function emitMeeting(meetingId: string, removedUserIds: string[] = []) {
  const meeting = toMeetingDto(await loadMeeting(meetingId));
  const io = getIo();
  for (const p of meeting.participants) io.to(rooms.user(p.user.id)).emit('meeting:upsert', meeting);
  for (const userId of removedUserIds) io.to(rooms.user(userId)).emit('meeting:removed', { id: meetingId });
  const cards = await prisma.message.findMany({ where: { meetingId, deletedAt: null }, select: { id: true } });
  for (const card of cards) await emitMessage('message:updated', card.id);
  return meeting;
}

export interface MeetingInput {
  title: string;
  description?: string | null;
  start: Date;
  end: Date;
  participantIds: string[];
}

/**
 * Schedules a meeting. Planned from a chat, the invitation card goes into that
 * chat; otherwise the meeting gets its own group chat (like a meeting chat).
 */
export async function createMeeting(organizerId: string, input: MeetingInput & { chatId?: string; isInstant?: boolean }) {
  assertValidTimes(input.start, input.end);
  const others = [...new Set(input.participantIds)].filter((id) => id !== organizerId);
  await assertUsersExist(others);
  if (input.chatId) await requireChatMember(input.chatId, organizerId);

  let chatId = input.chatId;
  if (!chatId) {
    const chat = await prisma.chat.create({
      data: {
        type: 'group',
        name: input.title,
        members: { create: [organizerId, ...others].map((userId) => ({ userId })) },
      },
    });
    chatId = chat.id;
  }

  const meeting = await prisma.meeting.create({
    data: {
      title: input.title,
      description: input.description || null,
      start: input.start,
      end: input.end,
      organizerId,
      chatId,
      ownsChat: !input.chatId,
      isInstant: input.isInstant ?? false,
      participants: {
        create: [
          { userId: organizerId, response: 'accepted' },
          ...others.map((userId) => ({ userId })),
        ],
      },
    },
  });

  if (!input.chatId) await emitChatToMembers(chatId, 'chat:new');
  await createMessage({ chatId, authorId: organizerId, type: 'meeting', content: input.title, meetingId: meeting.id });
  await notify(
    others.map((userId) => ({ userId, actorId: organizerId, type: 'meeting', meetingId: meeting.id, chatId, preview: input.title })),
  );
  return emitMeeting(meeting.id);
}

/** Changes title, time or attendees. New attendees are invited (and join the meeting chat). */
export async function updateMeeting(meetingId: string, organizerId: string, input: MeetingInput) {
  const meeting = await requireOrganizer(meetingId, organizerId);
  assertValidTimes(input.start, input.end);
  const wanted = [...new Set([organizerId, ...input.participantIds])];
  await assertUsersExist(wanted);
  const { added, removed } = diffParticipants(
    meeting.participants.map((p) => p.userId),
    wanted,
  );

  await prisma.$transaction([
    prisma.meeting.update({
      where: { id: meetingId },
      data: { title: input.title, description: input.description || null, start: input.start, end: input.end },
    }),
    prisma.meetingParticipant.deleteMany({ where: { meetingId, userId: { in: removed } } }),
    prisma.meetingParticipant.createMany({ data: added.map((userId) => ({ meetingId, userId })) }),
  ]);

  if (meeting.ownsChat && meeting.chatId) {
    const chatId = meeting.chatId;
    const members = await prisma.chatMember.findMany({ where: { chatId }, select: { userId: true } });
    const newMembers = added.filter((id) => !members.some((m) => m.userId === id));
    await prisma.chat.update({
      where: { id: chatId },
      data: { name: input.title, members: { create: newMembers.map((userId) => ({ userId })) } },
    });
    await emitChatToMembers(chatId, 'chat:updated');
  }

  await notify(
    added.map((userId) => ({ userId, actorId: organizerId, type: 'meeting', meetingId, chatId: meeting.chatId, preview: input.title })),
  );
  return emitMeeting(meetingId, removed);
}

/** Cancelling keeps the meeting (the chat card shows "cancelled") but takes it out of every calendar. */
export async function cancelMeeting(meetingId: string, organizerId: string) {
  await requireOrganizer(meetingId, organizerId);
  await prisma.meeting.update({ where: { id: meetingId }, data: { cancelledAt: new Date() } });
  return emitMeeting(meetingId);
}

export async function respondToMeeting(meetingId: string, userId: string, response: MeetingResponse) {
  const meeting = await requireMeetingAccess(meetingId, userId);
  if (meeting.cancelledAt) throw new HttpError(409, 'cancelled', 'The meeting was cancelled');
  if (!meeting.participants.some((p) => p.userId === userId)) throw forbidden();
  await prisma.meetingParticipant.update({ where: { meetingId_userId: { meetingId, userId } }, data: { response } });
  return emitMeeting(meetingId);
}
