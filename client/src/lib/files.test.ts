import { describe, expect, it } from 'vitest';
import { fileKind, formatFileSize, isImage } from './files';

describe('formatFileSize', () => {
  it('picks a unit and rounds sensibly', () => {
    expect(formatFileSize(820, 'de')).toBe('820 B');
    expect(formatFileSize(12_700, 'de')).toBe('12,4 KB');
    expect(formatFileSize(3.25 * 1024 * 1024, 'en')).toBe('3.3 MB');
    expect(formatFileSize(150 * 1024, 'en')).toBe('150 KB');
  });
});

describe('fileKind', () => {
  it('uses the MIME type first, then the extension', () => {
    expect(fileKind('image/png', 'a.png')).toBe('image');
    expect(fileKind('application/octet-stream', 'Bericht.PDF')).toBe('pdf');
    expect(fileKind('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Zahlen.xlsx')).toBe('spreadsheet');
    expect(fileKind('text/markdown', 'Ziele')).toBe('text');
    expect(fileKind('application/octet-stream', 'ohne-endung')).toBe('other');
  });

  it('only previews real image types', () => {
    expect(isImage('image/svg+xml')).toBe(true);
    expect(isImage('image/x-icon')).toBe(false);
    expect(isImage('text/html')).toBe(false);
  });
});
