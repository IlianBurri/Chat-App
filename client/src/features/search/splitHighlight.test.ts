import { describe, expect, it } from 'vitest';
import { splitHighlight } from './splitHighlight';

describe('splitHighlight', () => {
  it('marks every occurrence, ignoring case', () => {
    expect(splitHighlight('Design-Review im Design-Team', 'design')).toEqual([
      { text: 'Design', match: true },
      { text: '-Review im ', match: false },
      { text: 'Design', match: true },
      { text: '-Team', match: false },
    ]);
  });

  it('returns the text unchanged without a query or match', () => {
    expect(splitHighlight('Hallo', ' ')).toEqual([{ text: 'Hallo', match: false }]);
    expect(splitHighlight('Hallo', 'xyz')).toEqual([{ text: 'Hallo', match: false }]);
  });
});
