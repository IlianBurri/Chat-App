import { prisma } from '../db';
import { roomKey, type ActiveCall, type CallMedia, type CallTarget } from '../services/calls';
import { rooms } from '../socket/realtime';
import { createMessage, requireChatMember } from './chats';
import { requireMeetingAccess } from './meetings';
import { notify } from './notifications';
import { requireChannelAccess } from './workspaces';

/** What the server needs to know about the thing a call belongs to. */
export interface CallContext {
  /** Chat that gets the "call ended" note (the chat itself, or the meeting chat) */
  chatId: string | null;
  /** Name for incoming-call popups (group chat name, channel or meeting title); null for 1:1 chats */
  title: string | null;
  workspaceId: string | null;
  direct: boolean;
  /** People to ring when the call starts (only for chats) */
  ringUserIds: string[];
  /** Socket.IO rooms that see "a call is running here" */
  audience: string[];
}

/** Checks that the user may join the call and describes its target; throws 404 otherwise. */
export async function resolveCallTarget(target: CallTarget, userId: string): Promise<CallContext> {
  switch (target.kind) {
    case 'chat': {
      const { chat } = await requireChatMember(target.id, userId);
      const members = await prisma.chatMember.findMany({ where: { chatId: chat.id }, select: { userId: true } });
      return {
        chatId: chat.id,
        title: chat.type === 'direct' ? null : chat.name,
        workspaceId: null,
        direct: chat.type === 'direct',
        ringUserIds: members.map((m) => m.userId).filter((id) => id !== userId),
        audience: [rooms.chat(chat.id)],
      };
    }
    case 'channel': {
      const { channel } = await requireChannelAccess(target.id, userId);
      return {
        chatId: null,
        title: channel.name,
        workspaceId: channel.workspaceId,
        direct: false,
        ringUserIds: [],
        audience: [rooms.channel(channel.id)],
      };
    }
    case 'meeting': {
      const meeting = await requireMeetingAccess(target.id, userId);
      return {
        chatId: meeting.chatId,
        title: meeting.title,
        workspaceId: null,
        direct: false,
        ringUserIds: [],
        audience: [
          ...meeting.participants.map((p) => rooms.user(p.userId)),
          ...(meeting.chatId ? [rooms.chat(meeting.chatId)] : []),
        ],
      };
    }
  }
}

/** Whether a user may be rung into / see a call (same rules as joining). */
export async function canJoinCall(target: CallTarget, userId: string) {
  try {
    await resolveCallTarget(target, userId);
    return true;
  } catch {
    return false;
  }
}

export async function createCallRecord(id: string, target: CallTarget, initiatorId: string, media: CallMedia) {
  return prisma.call.create({
    data: {
      id,
      roomId: roomKey(target),
      initiatorId,
      media,
      chatId: target.kind === 'chat' ? target.id : null,
      channelId: target.kind === 'channel' ? target.id : null,
      meetingId: target.kind === 'meeting' ? target.id : null,
    },
  });
}

type ParticipantState = 'invited' | 'joined' | 'missed' | 'declined';

/** Records what happened to one person in a call. "joined" is final; later states never overwrite it. */
export async function markParticipant(callId: string, userId: string, change: { state?: ParticipantState; joinedAt?: Date; leftAt?: Date }) {
  const existing = await prisma.callParticipant.findUnique({ where: { callId_userId: { callId, userId } } });
  const state = existing?.state === 'joined' && change.state !== 'joined' ? 'joined' : (change.state ?? existing?.state ?? 'invited');
  await prisma.callParticipant.upsert({
    where: { callId_userId: { callId, userId } },
    create: { callId, userId, state, joinedAt: change.joinedAt ?? null, leftAt: change.leftAt ?? null },
    update: {
      state,
      ...(change.joinedAt && !existing?.joinedAt ? { joinedAt: change.joinedAt } : {}),
      ...(change.leftAt ? { leftAt: change.leftAt } : {}),
    },
  });
}

/** Someone was rung but never picked up: activity entry "missed call". */
export async function recordMissed(call: ActiveCall, userId: string, chatId: string | null) {
  await markParticipant(call.callId, userId, { state: 'missed' });
  await notify([{ type: 'missed_call', userId, actorId: call.initiatorId, chatId }]);
}

/** Closes the call record and leaves a note in the chat ("call ended · 12:03" or "missed call"). */
export async function finishCallRecord(call: ActiveCall, chatId: string | null) {
  const endedAt = new Date();
  await prisma.call.update({ where: { id: call.callId }, data: { endedAt } });
  if (!chatId) return;
  const seconds = Math.round((endedAt.getTime() - call.startedAt) / 1000);
  // Nobody but the caller ever joined a chat call: that is a missed call, not a conversation.
  const missed = call.target.kind === 'chat' && call.everJoined.size <= 1;
  await createMessage({
    chatId,
    authorId: call.initiatorId,
    type: 'system',
    content: JSON.stringify(missed ? { event: 'call_missed', media: call.media } : { event: 'call_ended', media: call.media, seconds }),
  });
}

export async function publicUser(userId: string) {
  return prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, name: true, avatarUrl: true } });
}

/** Recent calls a user started, joined, missed or declined (for the Calls app). */
export async function callHistory(userId: string, take = 50) {
  const calls = await prisma.call.findMany({
    where: { OR: [{ initiatorId: userId }, { participants: { some: { userId } } }] },
    orderBy: { startedAt: 'desc' },
    take,
    include: {
      initiator: { select: { id: true, name: true, avatarUrl: true } },
      chat: { select: { id: true, type: true, name: true, members: { select: { user: { select: { id: true, name: true, avatarUrl: true } } } } } },
      channel: { select: { id: true, name: true, workspaceId: true } },
      meeting: { select: { id: true, title: true } },
      participants: { select: { userId: true, state: true } },
    },
  });

  return calls.map((c) => {
    const mine = c.participants.find((p) => p.userId === userId);
    const others = c.chat?.members.map((m) => m.user).filter((u) => u.id !== userId) ?? [];
    const target: CallTarget | null = c.chatId
      ? { kind: 'chat', id: c.chatId }
      : c.channelId
        ? { kind: 'channel', id: c.channelId }
        : c.meetingId
          ? { kind: 'meeting', id: c.meetingId }
          : null;
    return {
      id: c.id,
      media: c.media as CallMedia,
      startedAt: c.startedAt,
      endedAt: c.endedAt,
      seconds: c.endedAt ? Math.round((c.endedAt.getTime() - c.startedAt.getTime()) / 1000) : null,
      outgoing: c.initiatorId === userId,
      outcome: (c.initiatorId === userId ? 'joined' : (mine?.state ?? 'invited')) as ParticipantState,
      initiator: c.initiator,
      target,
      workspaceId: c.channel?.workspaceId ?? null,
      /** Group chat name, channel or meeting title; null for 1:1 chats (shown as the other person) */
      title: c.chat ? (c.chat.type === 'direct' ? null : c.chat.name) : (c.channel?.name ?? c.meeting?.title ?? null),
      people: others,
      joinedCount: c.participants.filter((p) => p.state === 'joined').length,
    };
  });
}
