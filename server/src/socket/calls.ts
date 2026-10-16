import { randomUUID } from 'node:crypto';
import type { Server, Socket } from 'socket.io';
import { config } from '../config';
import { prisma } from '../db';
import { canJoinCall, createCallRecord, finishCallRecord, markParticipant, publicUser, recordMissed, resolveCallTarget, type CallContext } from '../lib/calls';
import { HttpError } from '../lib/http-error';
import { callRegistry, parseTarget, roomKey, sanitizeState, type ActiveCall, type CallMember } from '../services/calls';
import { presence } from '../services/presence';
import { broadcastPresence, rooms } from './realtime';

const REACTIONS = ['👍', '❤️', '😆', '😮', '👏', '🎉'];

const callRoom = (key: string) => `call:${key}`;

// Per running call: what it belongs to (resolved once when the call starts).
const contexts = new Map<string, CallContext>();
// Pending database records of new calls; participants are written only once the call row exists.
const records = new Map<string, Promise<unknown>>();
// Ring timers by "<call key>|<user id>".
const ringTimers = new Map<string, NodeJS.Timeout>();

type Ack = (response: Record<string, unknown>) => void;

function memberDto(m: CallMember) {
  const { socketId, userId, name, avatarUrl, mic, camera, screen, hand } = m;
  return { socketId, userId, name, avatarUrl, mic, camera, screen, hand };
}

export function activeCallDto(call: ActiveCall) {
  const context = contexts.get(call.key);
  return {
    key: call.key,
    target: call.target,
    callId: call.callId,
    media: call.media,
    startedAt: call.startedAt,
    title: context?.title ?? null,
    workspaceId: context?.workspaceId ?? null,
    userIds: [...new Set([...call.members.values()].map((m) => m.userId))],
  };
}

/** Running calls a user could join right now (for "Join" banners after a reload). */
export async function activeCallsFor(userId: string) {
  const result = [];
  for (const call of callRegistry.all()) if (call.guests.has(userId) || (await canJoinCall(call.target, userId))) result.push(activeCallDto(call));
  return result;
}

function emitActive(io: Server, call: ActiveCall) {
  const audience = contexts.get(call.key)?.audience ?? [];
  if (audience.length) io.to(audience).emit('call:active', activeCallDto(call));
}

async function updateBusy(userId: string) {
  presence.setInCall(userId, callRegistry.isUserInCall(userId));
  await broadcastPresence(userId);
}

function stopRinging(io: Server, call: ActiveCall, userId: string) {
  const timer = ringTimers.get(`${call.key}|${userId}`);
  if (timer) clearTimeout(timer);
  ringTimers.delete(`${call.key}|${userId}`);
  call.ringing.delete(userId);
  io.to(rooms.user(userId)).emit('call:ring-stopped', { key: call.key });
}

async function ring(io: Server, call: ActiveCall, userIds: string[], callerId: string) {
  const caller = await publicUser(callerId);
  const context = contexts.get(call.key);
  for (const userId of userIds) {
    if (call.ringing.has(userId) || [...call.members.values()].some((m) => m.userId === userId)) continue;
    call.ringing.add(userId);
    await markParticipant(call.callId, userId, { state: 'invited' });
    io.to(rooms.user(userId)).emit('call:incoming', {
      key: call.key,
      target: call.target,
      media: call.media,
      caller,
      title: context?.title ?? null,
      direct: context?.direct ?? false,
      workspaceId: context?.workspaceId ?? null,
    });
    ringTimers.set(
      `${call.key}|${userId}`,
      setTimeout(() => void ringTimedOut(io, call.key, userId), config.ringMs),
    );
  }
}

async function ringTimedOut(io: Server, key: string, userId: string) {
  ringTimers.delete(`${key}|${userId}`);
  const call = callRegistry.get(key);
  if (!call?.ringing.has(userId)) return;
  stopRinging(io, call, userId);
  await recordMissed(call, userId, call.guests.has(userId) ? null : (contexts.get(key)?.chatId ?? null));
  // A 1:1 call nobody picked up ends for the caller as well.
  if (contexts.get(key)?.direct && call.everJoined.size <= 1 && call.ringing.size === 0) {
    io.to(callRoom(key)).emit('call:unanswered', { key });
  }
}

async function endCall(io: Server, call: ActiveCall) {
  const context = contexts.get(call.key);
  for (const userId of [...call.ringing]) {
    stopRinging(io, call, userId);
    await recordMissed(call, userId, call.guests.has(userId) ? null : (context?.chatId ?? null));
  }
  contexts.delete(call.key);
  await records.get(call.key);
  records.delete(call.key);
  if (context?.audience.length) io.to(context.audience).emit('call:inactive', { key: call.key, target: call.target });
  await finishCallRecord(call, context?.chatId ?? null);
}

/** Removes a socket from its call and tells everyone; ends the call when it was the last one. */
async function leaveCall(io: Server, socket: Socket) {
  const result = callRegistry.removeSocket(socket.id);
  if (!result) return;
  const { call, member, ended } = result;
  await socket.leave(callRoom(call.key));
  if (member) {
    await markParticipant(call.callId, member.userId, { leftAt: new Date() });
    io.to(callRoom(call.key)).emit('call:member-left', { socketId: socket.id, userId: member.userId });
    await updateBusy(member.userId);
  }
  if (ended) await endCall(io, call);
  else emitActive(io, call);
}

/** Wraps a handler so errors become `{ ok: false, error }` acks instead of crashing the socket. */
function handle(fn: (payload: unknown) => Promise<Record<string, unknown> | void>) {
  return async (payload: unknown, ack?: unknown) => {
    const reply = typeof ack === 'function' ? (ack as Ack) : () => {};
    try {
      reply({ ok: true, ...((await fn(payload)) ?? {}) });
    } catch (error) {
      if (!(error instanceof HttpError)) console.error(error);
      reply({ ok: false, error: error instanceof HttpError ? error.code : 'internal' });
    }
  };
}

export function registerCallHandlers(io: Server, socket: Socket, userId: string) {
  const ownCall = () => {
    const call = callRegistry.callOfSocket(socket.id);
    if (!call) throw new HttpError(409, 'not_in_call', 'Not in a call');
    return call;
  };

  socket.on(
    'call:join',
    handle(async (payload) => {
      const { target: rawTarget, media: rawMedia, state: rawState } = (payload ?? {}) as Record<string, unknown>;
      const target = parseTarget(rawTarget);
      if (!target) throw new HttpError(400, 'validation', 'Invalid call target');
      const media = rawMedia === 'audio' ? 'audio' : 'video';
      // Guests rung into a running call may join it without access to its chat, channel or meeting.
      const running = callRegistry.get(roomKey(target));
      const guestContext = running?.guests.has(userId) ? contexts.get(running.key) : undefined;
      const context = guestContext ?? (await resolveCallTarget(target, userId));

      // One call per user: leave a previous call from this tab, and take over from other tabs.
      await leaveCall(io, socket);
      for (const { member } of callRegistry.membershipsOfUser(userId)) {
        const other = io.sockets.sockets.get(member.socketId);
        other?.emit('call:moved', {});
        if (other) await leaveCall(io, other);
      }

      const user = await publicUser(userId);
      const state = sanitizeState(rawState, { mic: true, camera: media === 'video', screen: false, hand: false });

      // Look up, create and join without awaiting in between, so two people starting at once share one call.
      const key = roomKey(target);
      let call = callRegistry.get(key);
      const created = !call;
      if (!call) {
        call = callRegistry.create({ target, callId: randomUUID(), initiatorId: userId, media });
        contexts.set(key, context);
        records.set(key, createCallRecord(call.callId, target, userId, media));
      }
      const wasRinging = call.ringing.has(userId);
      const others = [...call.members.values()];
      const member = callRegistry.addMember(key, { socketId: socket.id, userId, name: user.name, avatarUrl: user.avatarUrl, ...state });
      if (wasRinging) stopRinging(io, call, userId);
      await records.get(key);
      await socket.join(callRoom(key));
      await markParticipant(call.callId, userId, { state: 'joined', joinedAt: new Date() });
      socket.to(callRoom(key)).emit('call:member-joined', memberDto(member));
      await updateBusy(userId);
      if (created && context.ringUserIds.length) await ring(io, call, context.ringUserIds, userId);
      emitActive(io, call);

      return {
        call: activeCallDto(call),
        direct: context.direct,
        chatId: context.chatId,
        members: others.map(memberDto),
        chat: call.chat,
        iceServers: config.iceServers,
      };
    }),
  );

  socket.on(
    'call:leave',
    handle(async () => {
      await leaveCall(io, socket);
    }),
  );

  // WebRTC offers, answers and ICE candidates, relayed between two members of the same call.
  socket.on('call:signal', (payload: unknown) => {
    const { to, data } = (payload ?? {}) as { to?: unknown; data?: unknown };
    const call = callRegistry.callOfSocket(socket.id);
    if (!call || typeof to !== 'string' || !call.members.has(to)) return;
    io.to(to).emit('call:signal', { from: socket.id, data });
  });

  socket.on('call:state', (payload: unknown) => {
    const call = callRegistry.callOfSocket(socket.id);
    const member = call?.members.get(socket.id);
    if (!call || !member) return;
    Object.assign(member, sanitizeState(payload, member));
    io.to(callRoom(call.key)).emit('call:member-updated', memberDto(member));
  });

  socket.on('call:reaction', (payload: unknown) => {
    const call = callRegistry.callOfSocket(socket.id);
    const emoji = (payload as { emoji?: unknown } | null)?.emoji;
    if (!call || typeof emoji !== 'string' || !REACTIONS.includes(emoji)) return;
    io.to(callRoom(call.key)).emit('call:reaction', { socketId: socket.id, userId, emoji });
  });

  socket.on(
    'call:chat',
    handle(async (payload) => {
      const call = ownCall();
      const text = String((payload as { text?: unknown } | null)?.text ?? '').trim();
      if (!text || text.length > 2000) throw new HttpError(400, 'validation', 'Invalid message');
      const line = { id: `${Date.now()}-${socket.id}`, userId, text, at: Date.now() };
      callRegistry.addChat(call, line);
      io.to(callRoom(call.key)).emit('call:chat', line);
    }),
  );

  /** Rings more people into the running call; people outside its chat, channel or meeting join as guests of this call. */
  socket.on(
    'call:invite',
    handle(async (payload) => {
      const call = ownCall();
      const ids = (payload as { userIds?: unknown } | null)?.userIds;
      if (!Array.isArray(ids) || ids.length > 20 || ids.some((id) => typeof id !== 'string')) throw new HttpError(400, 'validation', 'Invalid users');
      const existing = await prisma.user.findMany({ where: { id: { in: ids as string[] } }, select: { id: true } });
      const invited = existing.map((u) => u.id).filter((id) => id !== userId);
      for (const id of invited) if (!(await canJoinCall(call.target, id))) call.guests.add(id);
      await ring(io, call, invited, userId);
      return { invited };
    }),
  );

  socket.on(
    'call:decline',
    handle(async (payload) => {
      const key = String((payload as { key?: unknown } | null)?.key ?? '');
      const call = callRegistry.get(key);
      if (!call?.ringing.has(userId)) return;
      stopRinging(io, call, userId);
      await markParticipant(call.callId, userId, { state: 'declined' });
      const user = await publicUser(userId);
      io.to(callRoom(key)).emit('call:declined', { userId, name: user.name, direct: contexts.get(key)?.direct ?? false });
    }),
  );

  socket.on('disconnect', () => void leaveCall(io, socket));
}

