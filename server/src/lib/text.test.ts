import { describe, expect, it } from 'vitest';
import { excerptAround, plainExcerpt } from './text';

describe('plainExcerpt', () => {
  it('drops markdown syntax and collapses whitespace', () => {
    expect(plainExcerpt('## Titel\n**fett** und [Link](https://x.y)\n- Punkt')).toBe('Titel fett und Link Punkt');
  });

  it('shortens long text with an ellipsis', () => {
    expect(plainExcerpt('a'.repeat(200), 10)).toBe(`${'a'.repeat(9)}…`);
  });
});

describe('excerptAround', () => {
  it('keeps short text as it is', () => {
    expect(excerptAround('Kurzer **Text**', 'text')).toBe('Kurzer Text');
  });

  it('centres long text on the match', () => {
    const text = `${'x '.repeat(100)}Treffer${' y'.repeat(100)}`;
    const result = excerptAround(text, 'treffer', 60);
    expect(result).toContain('Treffer');
    expect(result.startsWith('…')).toBe(true);
    expect(result.endsWith('…')).toBe(true);
  });
});
