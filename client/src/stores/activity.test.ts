import { beforeEach, describe, expect, it } from 'vitest';
import { notificationPath } from '@/lib/links';
import type { NotificationDto } from '@/lib/types';
import { matchesFilter, useActivityStore } from './activity';

const entry = (id: string, patch: Partial<NotificationDto> = {}): NotificationDto => ({
  id,
  type: 'mention',
  actor: { id: 'ben', name: 'Ben', avatarUrl: null },
  preview: null,
  emoji: null,
  chatId: 'chat1',
  channelId: null,
  workspaceId: null,
  messageId: 'm1',
  postId: null,
  replyId: null,
  meetingId: null,
  createdAt: '2026-01-01T10:00:00Z',
  read: false,
  ...patch,
});

describe('matchesFilter', () => {
  it('filters by unread state and type', () => {
    expect(matchesFilter(entry('a'), 'all')).toBe(true);
    expect(matchesFilter(entry('a', { read: true }), 'unread')).toBe(false);
    expect(matchesFilter(entry('a', { type: 'reaction' }), 'mention')).toBe(false);
    expect(matchesFilter(entry('a', { type: 'reaction' }), 'reaction')).toBe(true);
  });
});

describe('activity store', () => {
  beforeEach(() => useActivityStore.getState().reset());

  it('adds live entries on top, only when they match the filter, and takes the server count', () => {
    const store = useActivityStore.getState();
    store.added(entry('a'), 1);
    store.added(entry('b'), 2);
    store.added(entry('b'), 2);
    expect(useActivityStore.getState().items.map((n) => n.id)).toEqual(['b', 'a']);
    expect(useActivityStore.getState().unreadCount).toBe(2);

    useActivityStore.setState({ filter: 'reaction' });
    store.added(entry('c'), 3);
    expect(useActivityStore.getState().items.map((n) => n.id)).toEqual(['b', 'a']);
    expect(useActivityStore.getState().unreadCount).toBe(3);
  });

  it('marks entries read and unread, counting locally until the server answers', () => {
    const store = useActivityStore.getState();
    useActivityStore.setState({ items: [entry('a'), entry('b'), entry('c', { read: true })], unreadCount: 2 });
    store.readChanged(['a'], true);
    expect(useActivityStore.getState().unreadCount).toBe(1);
    store.readChanged(['c'], false);
    expect(useActivityStore.getState().unreadCount).toBe(2);
    store.readChanged('all', true, 0);
    expect(useActivityStore.getState().items.every((n) => n.read)).toBe(true);
    expect(useActivityStore.getState().unreadCount).toBe(0);
  });

  it('removes retracted entries', () => {
    useActivityStore.setState({ items: [entry('a'), entry('b')], unreadCount: 2 });
    useActivityStore.getState().removed(['a'], 1);
    expect(useActivityStore.getState().items.map((n) => n.id)).toEqual(['b']);
    expect(useActivityStore.getState().unreadCount).toBe(1);
  });
});

describe('notificationPath', () => {
  it('links chat entries to the message and channel entries to the post or reply', () => {
    expect(notificationPath(entry('a'))).toBe('/chat/chat1?message=m1');
    expect(
      notificationPath(entry('b', { chatId: null, messageId: null, workspaceId: 'w', channelId: 'c', postId: 'p', replyId: 'r' })),
    ).toBe('/teams/w/c?post=p&reply=r');
    expect(notificationPath(entry('c', { chatId: null, messageId: null }))).toBeNull();
  });
});
