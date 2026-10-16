import { describe, expect, it } from 'vitest';
import { assertValidTimes, diffParticipants } from './meetings';

const at = (h: number, m = 0) => new Date(2026, 9, 15, h, m);

describe('assertValidTimes', () => {
  it('accepts a meeting that ends after it starts', () => {
    expect(() => assertValidTimes(at(9), at(9, 30))).not.toThrow();
  });

  it('rejects zero-length and backwards meetings', () => {
    expect(() => assertValidTimes(at(9), at(9))).toThrow(/end after/);
    expect(() => assertValidTimes(at(10), at(9))).toThrow(/end after/);
  });

  it('rejects meetings longer than a week and invalid dates', () => {
    expect(() => assertValidTimes(at(9), new Date(2026, 9, 23, 9))).toThrow(/7 days/);
    expect(() => assertValidTimes(new Date('nope'), at(9))).toThrow(/Invalid date/);
  });
});

describe('diffParticipants', () => {
  it('lists who joins and who leaves', () => {
    expect(diffParticipants(['a', 'b', 'c'], ['b', 'c', 'd'])).toEqual({ added: ['d'], removed: ['a'] });
  });

  it('ignores duplicates and unchanged lists', () => {
    expect(diffParticipants(['a', 'b'], ['b', 'a', 'a'])).toEqual({ added: [], removed: [] });
  });
});
