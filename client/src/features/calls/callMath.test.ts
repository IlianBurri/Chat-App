import { describe, expect, it } from 'vitest';
import { formatDuration, gridShape, nextSpeaking, pickSpotlight, rmsLevel } from './callMath';

describe('formatDuration', () => {
  it('shows minutes and seconds, hours only when needed', () => {
    expect(formatDuration(5_400)).toBe('0:05');
    expect(formatDuration(723_000)).toBe('12:03');
    expect(formatDuration(3_723_000)).toBe('1:02:03');
    expect(formatDuration(-10)).toBe('0:00');
  });
});

describe('gridShape', () => {
  it('fills a wide area with tiles side by side', () => {
    expect(gridShape(2, 1600, 600, 0)).toMatchObject({ cols: 2, rows: 1 });
  });

  it('stacks tiles in a tall area', () => {
    expect(gridShape(2, 600, 1000, 0)).toMatchObject({ cols: 1, rows: 2 });
  });

  it('uses a near-square grid for many people', () => {
    expect(gridShape(9, 1600, 900, 0)).toMatchObject({ cols: 3, rows: 3 });
    expect(gridShape(5, 1600, 900, 0)).toMatchObject({ cols: 3, rows: 2 });
  });

  it('keeps the 16:9 aspect ratio', () => {
    const shape = gridShape(1, 1600, 900, 0);
    expect(shape.tileWidth).toBe(1600);
    expect(shape.tileHeight).toBe(900);
    expect(gridShape(0, 100, 100).tileWidth).toBe(0);
  });
});

describe('rmsLevel', () => {
  it('is 0 for silence and grows with amplitude', () => {
    expect(rmsLevel(new Uint8Array([128, 128, 128]))).toBe(0);
    expect(rmsLevel(new Uint8Array([255, 1, 255, 1]))).toBeGreaterThan(0.9);
    expect(rmsLevel(new Uint8Array([]))).toBe(0);
  });
});

describe('nextSpeaking', () => {
  it('starts on loud input and holds briefly through pauses', () => {
    let s = { speaking: false, lastLoudAt: 0 };
    s = nextSpeaking(s, 0.2, 1000);
    expect(s.speaking).toBe(true);
    s = nextSpeaking(s, 0.0, 1500);
    expect(s.speaking).toBe(true);
    s = nextSpeaking(s, 0.0, 1800);
    expect(s.speaking).toBe(false);
    expect(nextSpeaking({ speaking: false, lastLoudAt: 0 }, 0.01, 10).speaking).toBe(false);
  });
});

describe('pickSpotlight', () => {
  const tiles = [
    { id: 'me', screen: false, self: true },
    { id: 'ben', screen: false, self: false },
    { id: 'clara', screen: false, self: false },
  ];

  it('prefers a screen share, then the pinned person, then the last speaker', () => {
    expect(pickSpotlight([...tiles.slice(0, 2), { ...tiles[2], screen: true }], 'ben', 'ben')?.id).toBe('clara');
    expect(pickSpotlight(tiles, 'clara', 'ben')?.id).toBe('clara');
    expect(pickSpotlight(tiles, null, 'clara')?.id).toBe('clara');
  });

  it('never spotlights yourself as the speaker while others are there', () => {
    expect(pickSpotlight(tiles, null, 'me')?.id).toBe('ben');
    expect(pickSpotlight([tiles[0]], null, null)?.id).toBe('me');
  });
});
