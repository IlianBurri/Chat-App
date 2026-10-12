import { describe, expect, it } from 'vitest';
import { formatListTimestamp, initials, previewText } from './format';

describe('formatListTimestamp', () => {
  const now = new Date(2026, 9, 14, 15, 30); // Wednesday
  const labels = { yesterday: 'Gestern' };

  it('shows the time for today', () => {
    expect(formatListTimestamp(new Date(2026, 9, 14, 9, 5), now, 'de', labels)).toBe('09:05');
  });

  it('shows the yesterday label', () => {
    expect(formatListTimestamp(new Date(2026, 9, 13, 23, 59), now, 'de', labels)).toBe('Gestern');
  });

  it('shows the weekday within the last week', () => {
    expect(formatListTimestamp(new Date(2026, 9, 10, 12), now, 'de', labels)).toBe('Sa.');
    expect(formatListTimestamp(new Date(2026, 9, 10, 12), now, 'en', labels)).toBe('Sat');
  });

  it('shows a short date for older messages', () => {
    expect(formatListTimestamp(new Date(2026, 6, 3), now, 'de', labels)).toBe('3.7.');
    expect(formatListTimestamp(new Date(2025, 6, 3), now, 'de', labels)).toBe('3.7.25');
  });
});

describe('initials', () => {
  it('uses first and last name', () => {
    expect(initials('Anna Keller')).toBe('AK');
    expect(initials('Anna Maria von Keller')).toBe('AK');
    expect(initials('anna')).toBe('A');
    expect(initials('  ')).toBe('?');
  });
});

describe('previewText', () => {
  it('strips markdown for list previews', () => {
    expect(previewText('**Hallo** _du_, siehe [Link](https://x.y)')).toBe('Hallo du, siehe Link');
    expect(previewText('Code:\n```\nconst a = 1;\n```')).toBe('Code: [code]');
  });
});
