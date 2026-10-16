export type CallTargetKind = 'chat' | 'channel' | 'meeting';

/** What a call belongs to: one call room per chat, channel or meeting. */
export interface CallTarget {
  kind: CallTargetKind;
  id: string;
}

export type CallMedia = 'audio' | 'video';

export interface MemberState {
  mic: boolean;
  camera: boolean;
  screen: boolean;
  hand: boolean;
}

export interface CallMemberDto extends MemberState {
  socketId: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
}

/** A call that is running right now (for "Join" banners). */
export interface ActiveCallDto {
  key: string;
  target: CallTarget;
  callId: string;
  media: CallMedia;
  startedAt: number;
  title: string | null;
  workspaceId: string | null;
  userIds: string[];
}

export interface IncomingCall {
  key: string;
  target: CallTarget;
  media: CallMedia;
  caller: { id: string; name: string; avatarUrl: string | null };
  /** Group chat, channel or meeting name; null for 1:1 calls */
  title: string | null;
  direct: boolean;
  workspaceId: string | null;
}

export interface CallChatLine {
  id: string;
  userId: string;
  text: string;
  at: number;
}

export interface CallHistoryEntry {
  id: string;
  media: CallMedia;
  startedAt: string;
  endedAt: string | null;
  seconds: number | null;
  outgoing: boolean;
  outcome: 'invited' | 'joined' | 'missed' | 'declined';
  initiator: { id: string; name: string; avatarUrl: string | null };
  target: CallTarget | null;
  workspaceId: string | null;
  title: string | null;
  people: { id: string; name: string; avatarUrl: string | null }[];
  joinedCount: number;
}

export const CALL_REACTIONS = ['👍', '❤️', '😆', '😮', '👏', '🎉'] as const;
