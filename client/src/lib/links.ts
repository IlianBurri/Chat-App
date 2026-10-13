import type { NotificationDto } from './types';

/** Opens a chat; with a message id it scrolls to and highlights that message. */
export function chatPath(chatId: string, messageId?: string | null) {
  return `/chat/${chatId}${messageId ? `?${new URLSearchParams({ message: messageId })}` : ''}`;
}

/** Opens a channel; with a post (and reply) id it scrolls to and highlights it. */
export function channelPath(workspaceId: string, channelId: string, postId?: string | null, replyId?: string | null) {
  const params = new URLSearchParams({ ...(postId ? { post: postId } : {}), ...(replyId ? { reply: replyId } : {}) });
  const query = params.toString();
  return `/teams/${workspaceId}/${channelId}${query ? `?${query}` : ''}`;
}

/** Where an activity entry leads to, or null if its target is gone. */
export function notificationPath(n: Pick<NotificationDto, 'chatId' | 'messageId' | 'workspaceId' | 'channelId' | 'postId' | 'replyId'>) {
  if (n.chatId) return chatPath(n.chatId, n.messageId);
  if (n.workspaceId && n.channelId) return channelPath(n.workspaceId, n.channelId, n.postId, n.replyId);
  return null;
}

// Lets non-React code (desktop notification clicks) navigate inside the app.
let navigateImpl: (path: string) => void = (path) => window.location.assign(path);

export function setNavigator(fn: (path: string) => void) {
  navigateImpl = fn;
}

export function navigateTo(path: string) {
  navigateImpl(path);
}
