import { createContext, useContext } from 'react';
import type { MentionCandidate } from '@/components/editor/useTextEditor';
import { channelPath } from '@/lib/links';
import type { MentionTarget } from '@/lib/markdown';
import type { ChannelSummary, PostDto, ReplyDto, WorkspaceSummary } from '@/lib/types';

/** "@channel" mentions everyone in the channel; both spellings are recognised in any language. */
export const CHANNEL_MENTION_ID = '@channel';
export const CHANNEL_MENTION_NAMES = ['channel', 'Kanal'];

export interface ChannelContextValue {
  workspace: WorkspaceSummary;
  channel: ChannelSummary;
  meId: string;
  /** Names highlighted as mentions when rendering */
  mentionTargets: MentionTarget[];
  /** People (and the channel) offered by the @ autocomplete */
  candidates: MentionCandidate[];
  /** Asks for confirmation before deleting a post or reply */
  confirmDelete: (target: { post: PostDto } | { reply: ReplyDto }) => void;
}

export const ChannelContext = createContext<ChannelContextValue | null>(null);

export function useChannelContext() {
  const value = useContext(ChannelContext);
  if (!value) throw new Error('useChannelContext outside ChannelContext');
  return value;
}

/** Permalink to a post (and optionally a reply) that opens the channel and highlights it. */
export function postLink(workspaceId: string, channelId: string, postId: string, replyId?: string) {
  return window.location.origin + channelPath(workspaceId, channelId, postId, replyId);
}
