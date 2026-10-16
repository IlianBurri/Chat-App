import { create } from 'zustand';
import type { ActiveCallDto, CallChatLine, CallMedia, CallMemberDto, CallTarget, IncomingCall } from '@/features/calls/types';

export type CallPhase = 'idle' | 'lobby' | 'joining' | 'in-call';

export interface RemoteMember extends CallMemberDto {
  /** Audio and video arriving from this person */
  stream: MediaStream | null;
  speaking: boolean;
  connection: 'connecting' | 'connected' | 'failed';
}

export interface DeviceChoice {
  audioIn?: string;
  videoIn?: string;
  audioOut?: string;
}

export interface FloatingReaction {
  id: number;
  socketId: string;
  emoji: string;
}

interface CallState {
  phase: CallPhase;
  target: CallTarget | null;
  media: CallMedia;
  /** Shown in the lobby and the call header */
  title: string;
  /** Chat that belongs to the call (for "open chat"), if any */
  chatId: string | null;
  direct: boolean;
  startedAt: number | null;
  mySocketId: string | null;

  // Local media
  preview: MediaStream | null;
  mic: boolean;
  camera: boolean;
  screen: boolean;
  hand: boolean;
  blur: boolean;
  devices: DeviceChoice;
  mediaError: 'denied' | 'unavailable' | null;
  localSpeaking: boolean;

  members: Record<string, RemoteMember>;
  lastSpeakerId: string | null;
  layout: 'gallery' | 'speaker';
  pinnedId: string | null;
  panel: 'chat' | 'people' | null;
  chat: CallChatLine[];
  unreadChat: number;
  reactions: FloatingReaction[];

  incoming: IncomingCall[];
  /** Running calls the user could join, by key */
  active: Record<string, ActiveCallDto>;

  set: (patch: Partial<CallState>) => void;
  patchMember: (socketId: string, patch: Partial<RemoteMember>) => void;
  removeMember: (socketId: string) => void;
  addChat: (line: CallChatLine) => void;
  addReaction: (socketId: string, emoji: string) => void;
  setActive: (call: ActiveCallDto) => void;
  removeActive: (key: string) => void;
  addIncoming: (call: IncomingCall) => void;
  removeIncoming: (key: string) => void;
  /** Back to "no call" (keeps incoming calls, active calls and device choices) */
  resetCall: () => void;
}

let reactionId = 0;

const DEVICES_KEY = 'call-devices';

function loadDevices(): DeviceChoice {
  try {
    return JSON.parse(localStorage.getItem(DEVICES_KEY) ?? '{}') as DeviceChoice;
  } catch {
    return {};
  }
}

export function saveDevices(devices: DeviceChoice) {
  try {
    localStorage.setItem(DEVICES_KEY, JSON.stringify(devices));
  } catch {
    // Private mode: the choice just isn't remembered.
  }
}

const callDefaults = {
  phase: 'idle' as CallPhase,
  target: null,
  media: 'video' as CallMedia,
  title: '',
  chatId: null,
  direct: false,
  startedAt: null,
  mySocketId: null,
  preview: null,
  mic: true,
  camera: true,
  screen: false,
  hand: false,
  mediaError: null,
  localSpeaking: false,
  members: {},
  lastSpeakerId: null,
  layout: 'gallery' as const,
  pinnedId: null,
  panel: null,
  chat: [],
  unreadChat: 0,
  reactions: [],
};

export const useCallStore = create<CallState>((set) => ({
  ...callDefaults,
  blur: false,
  devices: typeof localStorage === 'undefined' ? {} : loadDevices(),
  incoming: [],
  active: {},

  set: (patch) => set(patch),

  patchMember: (socketId, patch) =>
    set((s) => {
      const member = s.members[socketId];
      if (!member) return {};
      return { members: { ...s.members, [socketId]: { ...member, ...patch } } };
    }),

  removeMember: (socketId) =>
    set((s) => {
      const members = { ...s.members };
      delete members[socketId];
      return {
        members,
        pinnedId: s.pinnedId === socketId ? null : s.pinnedId,
        lastSpeakerId: s.lastSpeakerId === socketId ? null : s.lastSpeakerId,
      };
    }),

  addChat: (line) => set((s) => ({ chat: [...s.chat, line], unreadChat: s.panel === 'chat' ? 0 : s.unreadChat + 1 })),

  addReaction: (socketId, emoji) => {
    const id = ++reactionId;
    set((s) => ({ reactions: [...s.reactions, { id, socketId, emoji }] }));
    setTimeout(() => set((s) => ({ reactions: s.reactions.filter((r) => r.id !== id) })), 3000);
  },

  setActive: (call) => set((s) => ({ active: { ...s.active, [call.key]: call } })),

  removeActive: (key) =>
    set((s) => {
      const active = { ...s.active };
      delete active[key];
      return { active };
    }),

  addIncoming: (call) => set((s) => ({ incoming: [...s.incoming.filter((c) => c.key !== call.key), call] })),

  removeIncoming: (key) => set((s) => ({ incoming: s.incoming.filter((c) => c.key !== key) })),

  resetCall: () => set({ ...callDefaults }),
}));

export const callKey = (target: CallTarget) => `${target.kind}:${target.id}`;
