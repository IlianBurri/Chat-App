import { describe, expect, it } from 'vitest';
import { pickNotifications } from './notifications';

describe('pickNotifications', () => {
  it('never notifies the actor', () => {
    expect(pickNotifications([{ type: 'mention', userId: 'a', actorId: 'a' }])).toEqual([]);
  });

  it('keeps one notification per person, a mention beating a reply', () => {
    const picked = pickNotifications([
      { type: 'reply', userId: 'b', actorId: 'a' },
      { type: 'mention', userId: 'b', actorId: 'a' },
      { type: 'reply', userId: 'c', actorId: 'a' },
      { type: 'reply', userId: 'c', actorId: 'a' },
    ]);
    expect(picked.map((n) => [n.userId, n.type])).toEqual([
      ['b', 'mention'],
      ['c', 'reply'],
    ]);
  });
});
