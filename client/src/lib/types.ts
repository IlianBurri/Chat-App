export const STATUSES = ['available', 'busy', 'dnd', 'away', 'offline'] as const;
export type Status = (typeof STATUSES)[number];

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  jobTitle: string | null;
  status: Status;
  statusMessage: string | null;
}

export interface Me extends PublicUser {
  /** null when the status is set automatically */
  manualStatus: Status | null;
}

export interface ChatSummary {
  id: string;
  type: 'direct' | 'group';
  name: string | null;
  members: PublicUser[];
  lastMessage: {
    id: string;
    content: string | null;
    deleted: boolean;
    author: { id: string; name: string };
    createdAt: string;
  } | null;
  lastMessageAt: string;
  unreadCount: number;
  pinned: boolean;
  muted: boolean;
  hidden: boolean;
  markedUnread: boolean;
}

export type WorkspaceRole = 'owner' | 'member' | 'guest';

export interface ChannelSummary {
  id: string;
  name: string;
  description: string | null;
  type: 'standard' | 'private';
  isDefault: boolean;
  muted: boolean;
  hidden: boolean;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  color: string;
  visibility: 'public' | 'private';
  memberCount: number;
  role: WorkspaceRole;
  channels: ChannelSummary[];
}
