import i18n from '@/i18n';
import { useAuthStore } from '@/stores/auth';
import { chatTitle, useChatsStore } from '@/stores/chats';
import { usePresenceStore } from '@/stores/presence';
import { useUiStore } from '@/stores/ui';
import { useWorkspacesStore } from '@/stores/workspaces';
import { isWatching, mentionsName, notificationPermission, shouldAlert, showDesktopNotification } from './desktopNotify';
import { channelPath, chatPath, notificationPath } from './links';
import type { MessageDto, NotificationDto, PostDto } from './types';

/** Shared part of the alert decision: settings, permission and own status. */
function baseContext() {
  const me = useAuthStore.getState().user;
  const status = me ? (usePresenceStore.getState().byUser[me.id]?.status ?? me.status) : 'offline';
  return {
    me,
    enabled: useUiStore.getState().desktopNotifications,
    permission: notificationPermission(),
    doNotDisturb: status === 'dnd',
  };
}

/** A new chat message from someone else. */
export function alertForMessage(message: MessageDto) {
  const { me, ...base } = baseContext();
  if (!me || message.author.id === me.id || message.type === 'system') return;
  const chat = useChatsStore.getState().chats.find((c) => c.id === message.chatId);
  if (!chat) return;
  const path = chatPath(chat.id, message.id);
  const alert = shouldAlert({
    ...base,
    muted: chat.muted,
    mentioned: mentionsName(message.content, me.name),
    watching: isWatching(chatPath(chat.id)),
  });
  if (!alert) return;
  const title = chat.type === 'direct' ? message.author.name : i18n.t('alerts.inChat', { name: message.author.name, chat: chatTitle(chat, me.id) });
  const body = message.type === 'poll' ? `📊 ${message.poll?.question ?? message.content}` : message.content;
  showDesktopNotification({ title, body, tag: `message-${message.id}`, path });
}

/** A new post or reply in a channel, written by someone else. */
export function alertForPost(post: PostDto, kind: 'post' | 'reply', actorId: string) {
  const { me, ...base } = baseContext();
  if (!me || actorId === me.id) return;
  const workspace = useWorkspacesStore.getState().workspaces.find((w) => w.channels.some((c) => c.id === post.channelId));
  const channel = workspace?.channels.find((c) => c.id === post.channelId);
  if (!workspace || !channel) return;
  const reply = kind === 'reply' ? post.replies.findLast((r) => r.author.id === actorId) : undefined;
  const item = reply ?? post;
  const alert = shouldAlert({
    ...base,
    muted: channel.muted,
    mentioned: mentionsName(item.content, me.name),
    watching: isWatching(channelPath(workspace.id, channel.id)),
  });
  if (!alert) return;
  const channelName = channel.isDefault ? i18n.t('teams.general') : channel.name;
  showDesktopNotification({
    title: i18n.t('alerts.inChannel', { name: item.author.name, channel: channelName, workspace: workspace.name }),
    body: kind === 'post' && post.subject ? `${post.subject}\n${post.content}` : item.content,
    tag: `post-${item.id}`,
    path: channelPath(workspace.id, channel.id, post.id, reply?.id),
  });
}

/**
 * Activity entries that no message event announces already (reactions,
 * later missed calls); mentions and replies pop up with their message.
 */
export function alertForNotification(n: NotificationDto) {
  const { me, ...base } = baseContext();
  const path = notificationPath(n);
  if (!me || !path || n.type === 'mention' || n.type === 'reply') return;
  const muted = n.chatId
    ? (useChatsStore.getState().chats.find((c) => c.id === n.chatId)?.muted ?? false)
    : (useWorkspacesStore.getState().workspaces.flatMap((w) => w.channels).find((c) => c.id === n.channelId)?.muted ?? false);
  if (!shouldAlert({ ...base, muted, mentioned: false, watching: false })) return;
  const name = n.actor?.name ?? i18n.t('activity.someone');
  showDesktopNotification({
    title: i18n.t(`activity.text.${n.type}`, { name, emoji: n.emoji ?? '', context: n.chatId ? 'chat' : 'channel' }),
    body: n.preview ?? '',
    tag: `notification-${n.id}`,
    path,
  });
}
