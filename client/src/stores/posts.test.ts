import { describe, expect, it } from 'vitest';
import type { PostDto } from '@/lib/types';
import { upsertByActivity } from './posts';

const post = (id: string, lastActivityAt: string, content = id): PostDto => ({
  id,
  channelId: 'c',
  author: { id: 'u', name: 'U', avatarUrl: null },
  subject: null,
  content,
  createdAt: lastActivityAt,
  editedAt: null,
  lastActivityAt,
  deleted: false,
  reactions: [],
  replies: [],
});

describe('upsertByActivity', () => {
  const list = [post('a', '2026-01-01T10:00:00Z'), post('b', '2026-01-01T11:00:00Z')];

  it('appends new threads in activity order', () => {
    expect(upsertByActivity(list, post('c', '2026-01-01T12:00:00Z')).map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });

  it('moves a thread with new activity to the bottom', () => {
    expect(upsertByActivity(list, post('a', '2026-01-01T13:00:00Z')).map((p) => p.id)).toEqual(['b', 'a']);
  });

  it('replaces edits in place', () => {
    const next = upsertByActivity(list, post('a', '2026-01-01T10:00:00Z', 'edited'));
    expect(next.map((p) => p.id)).toEqual(['a', 'b']);
    expect(next[0].content).toBe('edited');
  });
});
