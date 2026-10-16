import { describe, expect, it } from 'vitest';
import type { ChatSummary, PublicUser } from '@/lib/types';
import { groupChats } from './chatFilters';

const user = (id: string, name: string): PublicUser => ({
  id,
  name,
  email: `${id}@x.y`,
  avatarUrl: null,
  jobTitle: null,
  status: 'offline',
  statusMessage: null,
});

const me = user('me', 'Me Myself');

const chat = (id: string, partner: string, overrides: Partial<ChatSummary> = {}): ChatSummary => ({
  id,
  type: 'direct',
  name: null,
  members: [me, user(`u-${id}`, partner)],
  lastMessage: null,
  lastMessageAt: new Date(2026, 0, 1).toISOString(),
  meeting: null,
  unreadCount: 0,
  pinned: false,
  muted: false,
  hidden: false,
  markedUnread: false,
  ...overrides,
});

const chats = [
  chat('a', 'Anna', { pinned: true }),
  chat('b', 'Ben', { unreadCount: 2 }),
  chat('c', 'Clara', { hidden: true }),
  chat('d', 'David', { hidden: true, markedUnread: true }),
];

const ids = (list: ChatSummary[]) => list.map((c) => c.id);

describe('groupChats', () => {
  it('splits pinned and recent and hides hidden chats without news', () => {
    const groups = groupChats(chats, 'all', '', 'me');
    expect(ids(groups.pinned)).toEqual(['a']);
    expect(ids(groups.recent)).toEqual(['b', 'd']);
  });

  it('filters unread chats, including ones marked as unread', () => {
    const groups = groupChats(chats, 'unread', '', 'me');
    expect([...ids(groups.pinned), ...ids(groups.recent)]).toEqual(['b', 'd']);
  });

  it('shows only meeting chats under "Meetings"', () => {
    const withMeeting = [...chats, chat('m', 'Review', { meeting: { id: 'mt', start: '', end: '', cancelled: false } })];
    const groups = groupChats(withMeeting, 'meetings', '', 'me');
    expect([...ids(groups.pinned), ...ids(groups.recent)]).toEqual(['m']);
  });

  it('filters by the other person’s name, case-insensitively', () => {
    const groups = groupChats(chats, 'all', 'be', 'me');
    expect(ids(groups.recent)).toEqual(['b']);
    expect(groups.pinned).toEqual([]);
  });
});
