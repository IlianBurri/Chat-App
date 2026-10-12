export const STATUSES = ['available', 'busy', 'dnd', 'away', 'offline'] as const;
export type Status = (typeof STATUSES)[number];

export interface PresenceState {
  online: boolean;
  idle: boolean;
  inCall: boolean;
  manual: Status | null;
}

/** A manual status wins; otherwise calls mean busy and inactivity means away. */
export function computeStatus(state: PresenceState): Status {
  if (!state.online) return 'offline';
  if (state.manual) return state.manual;
  if (state.inCall) return 'busy';
  if (state.idle) return 'away';
  return 'available';
}

interface Entry {
  sockets: Set<string>;
  idleSockets: Set<string>;
  inCall: boolean;
  manual: Status | null;
}

/** In-memory presence of connected users (single server process). */
class PresenceRegistry {
  private entries = new Map<string, Entry>();

  statusOf(userId: string, manual?: string | null): Status {
    const entry = this.entries.get(userId);
    if (!entry) return 'offline';
    return computeStatus({
      online: true,
      // A user is idle only when every open tab is idle.
      idle: entry.idleSockets.size === entry.sockets.size,
      inCall: entry.inCall,
      manual: manual === undefined ? entry.manual : toStatus(manual),
    });
  }

  connect(userId: string, socketId: string, manual: string | null) {
    const entry = this.entries.get(userId) ?? {
      sockets: new Set(),
      idleSockets: new Set(),
      inCall: false,
      manual: toStatus(manual),
    };
    entry.sockets.add(socketId);
    this.entries.set(userId, entry);
  }

  /** Returns true when the user has no remaining connections. */
  disconnect(userId: string, socketId: string): boolean {
    const entry = this.entries.get(userId);
    if (!entry) return true;
    entry.sockets.delete(socketId);
    entry.idleSockets.delete(socketId);
    if (entry.sockets.size === 0) {
      this.entries.delete(userId);
      return true;
    }
    return false;
  }

  setIdle(userId: string, socketId: string, idle: boolean) {
    const entry = this.entries.get(userId);
    if (!entry?.sockets.has(socketId)) return;
    if (idle) entry.idleSockets.add(socketId);
    else entry.idleSockets.delete(socketId);
  }

  setInCall(userId: string, inCall: boolean) {
    const entry = this.entries.get(userId);
    if (entry) entry.inCall = inCall;
  }

  setManual(userId: string, manual: string | null) {
    const entry = this.entries.get(userId);
    if (entry) entry.manual = toStatus(manual);
  }
}

function toStatus(value: string | null): Status | null {
  return value && (STATUSES as readonly string[]).includes(value) ? (value as Status) : null;
}

export const presence = new PresenceRegistry();
