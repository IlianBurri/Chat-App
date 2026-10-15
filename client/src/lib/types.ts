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
    /** First attachment, for previews of messages without text */
    fileName: string | null;
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
  files: FileDto[];
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
  /** Attachments of the post itself (replies carry their own) */
  files: FileDto[];
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
  files: FileDto[];
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

export type NotificationType = 'mention' | 'reply' | 'reaction' | 'missed_call' | 'meeting';

/** An entry of the activity feed. */
export interface NotificationDto {
  id: string;
  type: NotificationType;
  actor: (UserRef & { avatarUrl: string | null }) | null;
  preview: string | null;
  emoji: string | null;
  chatId: string | null;
  channelId: string | null;
  workspaceId: string | null;
  messageId: string | null;
  postId: string | null;
  replyId: string | null;
  createdAt: string;
  read: boolean;
}

export interface SearchConversationHit {
  kind: 'message' | 'post' | 'reply';
  id: string;
  author: UserRef & { avatarUrl: string | null };
  subject: string | null;
  excerpt: string;
  createdAt: string;
  chatId?: string;
  workspaceId?: string;
  channelId?: string;
  postId?: string;
}

type WorkspaceRef = Pick<WorkspaceSummary, 'id' | 'name' | 'color' | 'logoUrl'>;

export type SearchGroupHit =
  | ({ kind: 'workspace' } & WorkspaceRef)
  | { kind: 'channel'; id: string; name: string; type: 'standard' | 'private'; isDefault: boolean; workspace: WorkspaceRef }
  | { kind: 'chat'; id: string; name: string };

/** An uploaded file and where it was shared. */
export interface FileDto {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: string;
  uploader: UserRef;
  chatId: string | null;
  channelId: string | null;
  workspaceId: string | null;
  messageId: string | null;
  postId: string | null;
  replyId: string | null;
}

export interface SearchResults {
  people: PublicUser[];
  groups: SearchGroupHit[];
  messages: SearchConversationHit[];
  files: FileDto[];
}
