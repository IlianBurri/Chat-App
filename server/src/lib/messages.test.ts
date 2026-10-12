import { describe, expect, it } from 'vitest';
import { summarizeReactions } from './messages';

describe('summarizeReactions', () => {
  it('groups by emoji in first-use order and ignores duplicate users', () => {
    expect(
      summarizeReactions([
        { emoji: '👍', userId: 'a' },
        { emoji: '❤️', userId: 'b' },
        { emoji: '👍', userId: 'c' },
        { emoji: '👍', userId: 'a' },
      ]),
    ).toEqual([
      { emoji: '👍', userIds: ['a', 'c'] },
      { emoji: '❤️', userIds: ['b'] },
    ]);
  });

  it('returns an empty list without reactions', () => {
    expect(summarizeReactions([])).toEqual([]);
  });
});
