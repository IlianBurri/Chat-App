import { describe, expect, it } from 'vitest';
import { codeFormat, insertMention, linkFormat, mentionQuery, prefixLines, wrapSelection } from './textFormat';

describe('wrapSelection', () => {
  it('wraps the selection and keeps it selected', () => {
    expect(wrapSelection('hallo welt', 6, 10, '**')).toEqual({ text: 'hallo **welt**', selectionStart: 8, selectionEnd: 12 });
  });
  it('inserts and selects a placeholder without selection', () => {
    expect(wrapSelection('a ', 2, 2, '_', '_', 'kursiv')).toEqual({ text: 'a _kursiv_', selectionStart: 3, selectionEnd: 9 });
  });
});

describe('prefixLines', () => {
  it('prefixes all selected lines', () => {
    expect(prefixLines('eins\nzwei\ndrei', 2, 7, (i) => `${i + 1}. `).text).toBe('1. eins\n2. zwei\ndrei');
    expect(prefixLines('x', 0, 0, () => '- ').text).toBe('- x');
  });
});

describe('codeFormat', () => {
  it('uses inline code for one line and a block for several', () => {
    expect(codeFormat('a b', 2, 3).text).toBe('a `b`');
    expect(codeFormat('x\ny', 0, 3).text).toBe('```\nx\ny\n```\n');
  });
});

describe('linkFormat', () => {
  it('selects the URL for typing', () => {
    const edit = linkFormat('Doku', 0, 4, 'Link');
    expect(edit.text).toBe('[Doku](https://)');
    expect(edit.text.slice(edit.selectionStart, edit.selectionEnd)).toBe('https://');
  });
});

describe('mentions', () => {
  it('detects an @query before the caret', () => {
    expect(mentionQuery('Hi @An', 6)).toEqual({ query: 'An', start: 3 });
    expect(mentionQuery('@Anna K', 7)).toEqual({ query: 'Anna K', start: 0 });
    expect(mentionQuery('mail@x', 6)).toBeNull();
    expect(mentionQuery('Hi @', 4)).toEqual({ query: '', start: 3 });
  });
  it('replaces the query with the full name', () => {
    expect(insertMention('Hi @An!', 3, 6, 'Anna Keller')).toEqual({ text: 'Hi @Anna Keller !', selectionStart: 16, selectionEnd: 16 });
  });
});
