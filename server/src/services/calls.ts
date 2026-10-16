export const CALL_TARGET_KINDS = ['chat', 'channel', 'meeting'] as const;
export type CallTargetKind = (typeof CALL_TARGET_KINDS)[number];

/** What a call belongs to: one call room per chat, channel or meeting. */
export interface CallTarget {
  kind: CallTargetKind;
  id: string;
}

export type CallMedia = 'audio' | 'video';

export const roomKey = (target: CallTarget) => `${target.kind}:${target.id}`;

export function parseTarget(value: unknown): CallTarget | null {
  if (!value || typeof value !== 'object') return null;
  const { kind, id } = value as { kind?: unknown; id?: unknown };
  if (typeof kind !== 'string' || !(CALL_TARGET_KINDS as readonly string[]).includes(kind)) return null;
  if (typeof id !== 'string' || id.length === 0 || id.length > 40) return null;
  return { kind: kind as CallTargetKind, id };
}

export interface MemberState {
  mic: boolean;
  camera: boolean;
  screen: boolean;
  hand: boolean;
}

export interface CallMember extends MemberState {
  socketId: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  joinedAt: number;
}

export interface CallChatLine {
  id: string;
  userId: string;
  text: string;
  at: number;
}

export interface ActiveCall {
  key: string;
  target: CallTarget;
  callId: string;
  initiatorId: string;
  media: CallMedia;
  startedAt: number;
  /** By socket id: one entry per connected tab in the call */
  members: Map<string, CallMember>;
  /** Users being rung right now */
  ringing: Set<string>;
  /** People rung in from the call who are not members of its chat/channel/meeting: they may join this call only */
  guests: Set<string>;
  /** Everyone who was in the call at some point (for "missed" and history) */
  everJoined: Set<string>;
  /** In-call chat, kept while the call lasts so late joiners see it */
  chat: CallChatLine[];
}

const CHAT_LIMIT = 200;

/** Keeps only known, boolean state flags. */
export function sanitizeState(input: unknown, current: MemberState): MemberState {
  const next = { ...current };
  if (input && typeof input === 'object') {
    for (const key of ['mic', 'camera', 'screen', 'hand'] as const) {
      const value = (input as Record<string, unknown>)[key];
      if (typeof value === 'boolean') next[key] = value;
    }
  }
  return next;
}

/** In-memory registry of running calls (single server process, like presence). */
export class CallRegistry {
  private calls = new Map<string, ActiveCall>();
  private socketToKey = new Map<string, string>();

  get(key: string) {
    return this.calls.get(key);
  }

  all() {
    return [...this.calls.values()];
  }

  create(input: { target: CallTarget; callId: string; initiatorId: string; media: CallMedia; now?: number }): ActiveCall {
    const call: ActiveCall = {
      key: roomKey(input.target),
      target: input.target,
      callId: input.callId,
      initiatorId: input.initiatorId,
      media: input.media,
      startedAt: input.now ?? Date.now(),
      members: new Map(),
      ringing: new Set(),
      guests: new Set(),
      everJoined: new Set(),
      chat: [],
    };
    this.calls.set(call.key, call);
    return call;
  }

  /** The call a socket is in, if any. */
  callOfSocket(socketId: string) {
    const key = this.socketToKey.get(socketId);
    return key ? this.calls.get(key) : undefined;
  }

  /** Sockets of a user that are in any call (a user is in at most one call at a time). */
  membershipsOfUser(userId: string) {
    const result: { call: ActiveCall; member: CallMember }[] = [];
    for (const call of this.calls.values()) {
      for (const member of call.members.values()) if (member.userId === userId) result.push({ call, member });
    }
    return result;
  }

  addMember(key: string, member: Omit<CallMember, 'joinedAt'> & { joinedAt?: number }) {
    const call = this.calls.get(key);
    if (!call) throw new Error('No such call: ' + key);
    const full: CallMember = { ...member, joinedAt: member.joinedAt ?? Date.now() };
    call.members.set(member.socketId, full);
    call.everJoined.add(member.userId);
    call.ringing.delete(member.userId);
    this.socketToKey.set(member.socketId, key);
    return full;
  }

  /** Removes a socket from its call. `ended` means the call is now empty and was dropped. */
  removeSocket(socketId: string) {
    const key = this.socketToKey.get(socketId);
    if (!key) return null;
    this.socketToKey.delete(socketId);
    const call = this.calls.get(key);
    if (!call) return null;
    const member = call.members.get(socketId);
    call.members.delete(socketId);
    const ended = call.members.size === 0;
    if (ended) this.calls.delete(key);
    return { call, member, ended };
  }

  addChat(call: ActiveCall, line: CallChatLine) {
    call.chat.push(line);
    if (call.chat.length > CHAT_LIMIT) call.chat.splice(0, call.chat.length - CHAT_LIMIT);
  }

  /** True while the user is in a call from any tab (drives the automatic "busy" status). */
  isUserInCall(userId: string) {
    return this.membershipsOfUser(userId).length > 0;
  }
}

export const callRegistry = new CallRegistry();
