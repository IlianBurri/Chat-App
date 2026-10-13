import { describe, expect, it } from 'vitest';
import { mentionedUserIds, parseInline, parseMarkdown } from './markdown';

const people = [
  { id: 'a', name: 'Anna Keller' },
  { id: 'b', name: 'Ben' },
];

describe('parseInline', () => {
  it('parses emphasis, code and strike', () => {
    expect(parseInline('**fett** und *kursiv* und _auch_ ~~weg~~ `x*y`')).toEqual([
      { type: 'bold', children: [{ type: 'text', text: 'fett' }] },
      { type: 'text', text: ' und ' },
      { type: 'italic', children: [{ type: 'text', text: 'kursiv' }] },
      { type: 'text', text: ' und ' },
      { type: 'italic', children: [{ type: 'text', text: 'auch' }] },
      { type: 'text', text: ' ' },
      { type: 'strike', children: [{ type: 'text', text: 'weg' }] },
      { type: 'text', text: ' ' },
      { type: 'code', text: 'x*y' },
    ]);
  });

  it('keeps underscores inside words and lone asterisks as text', () => {
    expect(parseInline('snake_case_name and 2 * 3')).toEqual([{ type: 'text', text: 'snake_case_name and 2 * 3' }]);
  });

  it('only links http(s) and mailto targets', () => {
    expect(parseInline('[Doku](https://example.com/a) [böse](javascript:alert(1))')).toEqual([
      { type: 'link', href: 'https://example.com/a', children: [{ type: 'text', text: 'Doku' }] },
      { type: 'text', text: ' [böse](javascript:alert(1))' },
    ]);
  });

  it('autolinks bare URLs without trailing punctuation', () => {
    expect(parseInline('Siehe https://example.com/x.')).toEqual([
      { type: 'text', text: 'Siehe ' },
      { type: 'link', href: 'https://example.com/x', children: [{ type: 'text', text: 'https://example.com/x' }] },
      { type: 'text', text: '.' },
    ]);
  });

  it('recognises mentions of known people, longest name first', () => {
    expect(parseInline('Hi @Anna Keller und @ben!', people)).toEqual([
      { type: 'text', text: 'Hi ' },
      { type: 'mention', userId: 'a', name: 'Anna Keller' },
      { type: 'text', text: ' und ' },
      { type: 'mention', userId: 'b', name: 'Ben' },
      { type: 'text', text: '!' },
    ]);
    expect(parseInline('mail@Ben.ch @Benjamin', people)).toEqual([{ type: 'text', text: 'mail@Ben.ch @Benjamin' }]);
  });
});

describe('parseMarkdown', () => {
  it('builds paragraphs with line breaks, lists, quotes and code blocks', () => {
    const blocks = parseMarkdown('Zeile 1\nZeile 2\n\n- a\n- b\n1. eins\n> zitat\n```\nconst x = 1;\n```');
    expect(blocks.map((b) => b.type)).toEqual(['paragraph', 'list', 'list', 'quote', 'codeblock']);
    expect(blocks[0]).toEqual({
      type: 'paragraph',
      children: [{ type: 'text', text: 'Zeile 1' }, { type: 'br' }, { type: 'text', text: 'Zeile 2' }],
    });
    expect(blocks[1]).toMatchObject({ ordered: false, items: [[{ text: 'a' }], [{ text: 'b' }]] });
    expect(blocks[2]).toMatchObject({ ordered: true });
    expect(blocks[4]).toEqual({ type: 'codeblock', text: 'const x = 1;' });
  });

  it('parses headings up to level 3 and ends paragraphs before them', () => {
    const blocks = parseMarkdown('Intro\n## Release **2.0**\n#### zu tief\n#kein Abstand');
    expect(blocks.map((b) => b.type)).toEqual(['paragraph', 'heading', 'paragraph']);
    expect(blocks[1]).toEqual({
      type: 'heading',
      level: 2,
      children: [{ type: 'text', text: 'Release ' }, { type: 'bold', children: [{ type: 'text', text: '2.0' }] }],
    });
  });

  it('collects mentioned user ids', () => {
    expect(mentionedUserIds('- @Ben bitte\n> @Anna Keller', people).sort()).toEqual(['a', 'b']);
  });
});
