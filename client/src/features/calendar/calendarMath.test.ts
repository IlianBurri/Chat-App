import { describe, expect, it } from 'vitest';
import {
  canJoin,
  colorIndex,
  keepDuration,
  layoutDay,
  MEETING_COLORS,
  nextSlot,
  shiftAnchor,
  slotAt,
  visibleDays,
  visibleRange,
} from './calendarMath';

// Thursday, 15 October 2026
const d = (day: number, h = 0, m = 0) => new Date(2026, 9, day, h, m);
const meeting = (id: string, start: Date, end: Date) => ({ id, start, end });

describe('visibleDays', () => {
  it('shows one day, Monday–Friday or Monday–Sunday', () => {
    expect(visibleDays('day', d(15, 14))).toEqual([d(15)]);
    expect(visibleDays('workweek', d(15)).map((x) => x.getDate())).toEqual([12, 13, 14, 15, 16]);
    expect(visibleDays('week', d(18)).map((x) => x.getDate())).toEqual([12, 13, 14, 15, 16, 17, 18]);
  });

  it('fills whole weeks around a month', () => {
    const days = visibleDays('month', d(15));
    expect(days).toHaveLength(35); // 28 Sep – 1 Nov
    expect(days[0]).toEqual(new Date(2026, 8, 28));
    expect(days[34]).toEqual(new Date(2026, 10, 1));
  });

  it('ends the range at midnight after the last day', () => {
    expect(visibleRange('workweek', d(15))).toEqual({ from: d(12), to: d(17) });
  });
});

describe('shiftAnchor', () => {
  it('pages by day, week or month', () => {
    expect(shiftAnchor('day', d(15), 1)).toEqual(d(16));
    expect(shiftAnchor('workweek', d(15), -1)).toEqual(d(8));
    expect(shiftAnchor('month', d(31), 1)).toEqual(new Date(2026, 10, 30));
  });
});

describe('layoutDay', () => {
  it('places separate meetings at full width', () => {
    const placed = layoutDay([meeting('a', d(15, 9), d(15, 10)), meeting('b', d(15, 10), d(15, 11))], d(15));
    expect(placed.map((p) => [p.item.id, p.top, p.height, p.column, p.columns])).toEqual([
      ['a', 540, 60, 0, 1],
      ['b', 600, 60, 0, 1],
    ]);
  });

  it('puts overlapping meetings side by side and reuses free columns', () => {
    const placed = layoutDay(
      [meeting('long', d(15, 9), d(15, 12)), meeting('x', d(15, 9, 30), d(15, 10)), meeting('y', d(15, 10, 30), d(15, 11))],
      d(15),
    );
    const byId = Object.fromEntries(placed.map((p) => [p.item.id, [p.column, p.columns]]));
    expect(byId).toEqual({ long: [0, 2], x: [1, 2], y: [1, 2] });
  });

  it('clips meetings that cross midnight and keeps short ones clickable', () => {
    const [night] = layoutDay([meeting('n', d(14, 23), d(15, 1))], d(15));
    expect([night.top, night.height]).toEqual([0, 60]);
    const [short] = layoutDay([meeting('s', d(15, 9), d(15, 9, 5))], d(15));
    expect(short.height).toBe(20);
    expect(layoutDay([meeting('other', d(16, 9), d(16, 10))], d(15))).toEqual([]);
  });
});

describe('canJoin', () => {
  const m = { start: d(15, 10), end: d(15, 10, 30) };
  it('opens five minutes before the start and closes at the end', () => {
    expect(canJoin(m, d(15, 9, 54))).toBe(false);
    expect(canJoin(m, d(15, 9, 55))).toBe(true);
    expect(canJoin(m, d(15, 10, 29))).toBe(true);
    expect(canJoin(m, d(15, 10, 30))).toBe(false);
    expect(canJoin({ ...m, cancelled: true }, d(15, 10))).toBe(false);
  });
});

describe('slots', () => {
  it('suggests the next half hour', () => {
    expect(nextSlot(d(15, 9, 10))).toEqual({
      start: d(15, 9, 30),
      end: d(15, 10),
    });
    expect(nextSlot(d(15, 9, 30))).toEqual({
      start: d(15, 10),
      end: d(15, 10, 30),
    });
  });

  it('snaps a click to its half hour', () => {
    expect(slotAt(d(15), 615)).toEqual({
      start: d(15, 10),
      end: d(15, 10, 30),
    });
    expect(slotAt(d(15), 5000).start).toEqual(d(15, 23, 30));
  });

  it('keeps the length when the start moves', () => {
    expect(keepDuration(d(15, 9), d(15, 10), d(15, 14))).toEqual(d(15, 15));
  });
});

describe('colorIndex', () => {
  it('is stable and in range', () => {
    expect(colorIndex('abc')).toBe(colorIndex('abc'));
    for (const id of ['a', 'clx1', 'meeting-42', '']) expect(colorIndex(id)).toBeLessThan(MEETING_COLORS);
  });
});
