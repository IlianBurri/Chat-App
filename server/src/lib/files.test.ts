import { describe, expect, it } from 'vitest';
import { hasContentOrFiles, storedNameFor } from './files';

describe('storedNameFor', () => {
  it('uses a random name and keeps a short extension', () => {
    const a = storedNameFor('Bericht Q4.PDF');
    expect(a).toMatch(/^[0-9a-f-]{36}\.pdf$/);
    expect(storedNameFor('Bericht Q4.PDF')).not.toBe(a);
  });

  it('drops odd extensions and never keeps path parts', () => {
    expect(storedNameFor('../../etc/passwd')).toMatch(/^[0-9a-f-]{36}$/);
    expect(storedNameFor('bild.sehr-lange-endung')).toMatch(/^[0-9a-f-]{36}$/);
    expect(storedNameFor('ohne-endung')).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('hasContentOrFiles', () => {
  it('accepts text, files or both, but not neither', () => {
    expect(hasContentOrFiles({ content: 'Hallo' })).toBe(true);
    expect(hasContentOrFiles({ content: '', fileIds: ['f1'] })).toBe(true);
    expect(hasContentOrFiles({ content: '', fileIds: [] })).toBe(false);
    expect(hasContentOrFiles({ content: '' })).toBe(false);
  });
});
