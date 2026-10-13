import { describe, expect, it } from 'vitest';
import { findMentions } from './mentions';

const people = [
  { id: 'anna', name: 'Anna Keller' },
  { id: 'ben', name: 'Ben Müller' },
  { id: 'a', name: 'Anna' },
];

describe('findMentions', () => {
  it('finds full names, case-insensitively, preferring the longest name', () => {
    expect(findMentions('Hallo @anna keller und @Ben Müller!', people)).toEqual({ userIds: ['anna', 'ben'], everyone: false });
    expect(findMentions('@Anna, kommst du?', people).userIds).toEqual(['a']);
  });

  it('ignores e-mail addresses, partial names and code', () => {
    expect(findMentions('mail@Anna Keller', people).userIds).toEqual([]);
    expect(findMentions('@Ben Müllerei', people).userIds).toEqual([]);
    expect(findMentions('`@Anna Keller` and\n```\n@Ben Müller\n```', people).userIds).toEqual([]);
  });

  it('recognises @channel only where it is allowed', () => {
    expect(findMentions('@Kanal bitte lesen', people, { channel: true }).everyone).toBe(true);
    expect(findMentions('@channel', people, { channel: true }).everyone).toBe(true);
    expect(findMentions('@Kanal bitte lesen', people).everyone).toBe(false);
    expect(findMentions('@Kanalarbeiten', people, { channel: true }).everyone).toBe(false);
  });
});
