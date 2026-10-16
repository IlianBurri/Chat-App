import { describe, expect, it } from 'vitest';
import { buildTimeline, dateSeparatorLabel, isSeen } from './timeline';
import type { MessageDto } from './types';

let seq = 0;
const msg = (author: string, createdAt: Date, type: MessageDto['type'] = 'text'): MessageDto => ({
  id: `m${++seq}`,
  chatId: 'c',
  type,
  author: { id: author, name: author, avatarUrl: null },
  subject: null,
  content: 'x',
  createdAt: createdAt.toISOString(),
  editedAt: null,
  deleted: false,
  pinned: false,
  replyTo: null,
  forwardedFrom: null,
  reactions: [],
  files: [],
  meeting: null,
  poll: null,
});

const at = (day: number, hour: number, minute: number) => new Date(2026, 9, day, hour, minute);

describe('buildTimeline', () => {
  it('adds a separator per day and groups consecutive messages', () => {
    const items = buildTimeline([
      msg('ann', at(10, 9, 0)),
      msg('ann', at(10, 9, 3)),
      msg('ann', at(10, 9, 20)), // gap > 5 min: new group
      msg('ben', at(10, 9, 21)),
      msg('ben', at(11, 8, 0)), // new day
    ]);
    expect(items.map((i) => (i.kind === 'date' ? 'D' : `${i.message.author.id}${i.groupStart ? '^' : ''}${i.groupEnd ? '$' : ''}`))).toEqual([
      'D',
      'ann^',
      'ann$',
      'ann^$',
      'ben^$',
      'D',
      'ben^$',
    ]);
  });

  it('never groups system messages', () => {
    const items = buildTimeline([msg('ann', at(10, 9, 0)), msg('ann', at(10, 9, 1), 'system'), msg('ann', at(10, 9, 2))]);
    expect(items.filter((i) => i.kind === 'message' && i.groupStart)).toHaveLength(3);
  });
});

describe('dateSeparatorLabel', () => {
  const labels = { today: 'Heute', yesterday: 'Gestern' };
  const now = at(14, 12, 0);
  it('uses relative labels for today and yesterday', () => {
    expect(dateSeparatorLabel(at(14, 1, 0), now, 'de', labels)).toBe('Heute');
    expect(dateSeparatorLabel(at(13, 23, 0), now, 'de', labels)).toBe('Gestern');
  });
  it('uses the full date otherwise', () => {
    expect(dateSeparatorLabel(at(5, 10, 0), now, 'de', labels)).toBe('Montag, 5. Oktober');
    expect(dateSeparatorLabel(new Date(2025, 0, 2), now, 'en', labels)).toBe('Thursday, 2 January 2025');
  });
});

describe('isSeen', () => {
  const m = msg('me', at(10, 9, 0));
  const read = (minute: number) => ({ userId: '', readAt: at(10, 9, minute).toISOString() });
  it('requires every other member to have read the message', () => {
    expect(isSeen(m, { a: read(1), b: read(0) }, ['me', 'a', 'b'], 'me')).toBe(true);
    expect(isSeen(m, { a: read(1) }, ['me', 'a', 'b'], 'me')).toBe(false);
    expect(isSeen(m, { a: { userId: 'a', readAt: at(10, 8, 59).toISOString() } }, ['me', 'a'], 'me')).toBe(false);
  });
  it('is never seen in a chat without other members', () => {
    expect(isSeen(m, {}, ['me'], 'me')).toBe(false);
  });
});
