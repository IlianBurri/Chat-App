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
    type: MessageType;
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
  /** Someone else wrote here since you last looked */
  unread: boolean;
}

export interface WorkspacePermissions {
  manageWorkspace: boolean;
  manageMembers: boolean;
  manageChannels: boolean;
  moderate: boolean;
  editNotes: boolean;
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
  permissions: WorkspacePermissions;
  channels: ChannelSummary[];
}

/** A public workgroup you can join. */
export interface DiscoverWorkspace {
  id: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  color: string;
  memberCount: number;
}

export interface WorkspaceMember {
  user: PublicUser;
  role: WorkspaceRole;
  joinedAt: string;
}

export interface ChannelDetail {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  type: 'standard' | 'private';
  isDefault: boolean;
  notes: string;
}

export interface ReplyDto {
  id: string;
  postId: string;
  author: UserRef & { avatarUrl: string | null };
  content: string;
  createdAt: string;
  editedAt: string | null;
  deleted: boolean;
  reactions: ReactionSummary[];
}

export interface PostDto {
  id: string;
  channelId: string;
  author: UserRef & { avatarUrl: string | null };
  subject: string | null;
  content: string;
  createdAt: string;
  editedAt: string | null;
  lastActivityAt: string;
  deleted: boolean;
  reactions: ReactionSummary[];
  replies: ReplyDto[];
}

export type MessageType = 'text' | 'poll' | 'meeting' | 'system';

export interface UserRef {
  id: string;
  name: string;
}

export interface ReactionSummary {
  emoji: string;
  userIds: string[];
}

export interface PollDto {
  id: string;
  question: string;
  multiple: boolean;
  options: { id: string; text: string; userIds: string[] }[];
}

export interface MessageDto {
  id: string;
  chatId: string;
  type: MessageType;
  author: UserRef & { avatarUrl: string | null };
  subject: string | null;
  content: string;
  createdAt: string;
  editedAt: string | null;
  deleted: boolean;
  pinned: boolean;
  replyTo: { id: string; author: UserRef; content: string | null; deleted: boolean } | null;
  forwardedFrom: { author: UserRef } | null;
  reactions: ReactionSummary[];
  poll: PollDto | null;
}

export interface ReadReceipt {
  userId: string;
  readAt: string;
}

/** Content of system messages (type 'system'), stored as JSON. */
export type SystemEvent =
  | { event: 'added'; userIds: string[] }
  | { event: 'left' }
  | { event: 'renamed'; name: string };
