import {
  addDays,
  addMinutes,
  addMonths,
  differenceInCalendarDays,
  differenceInMinutes,
  endOfMonth,
  endOfWeek,
  isAfter,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';

export const CALENDAR_VIEWS = ['day', 'workweek', 'week', 'month'] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

const WEEK = { weekStartsOn: 1 } as const;

/** "Join" shows up this long before a meeting starts. */
export const JOIN_EARLY_MS = 5 * 60_000;

/** The days a view shows around `anchor` (month views fill whole weeks). */
export function visibleDays(view: CalendarView, anchor: Date): Date[] {
  const count = (from: Date, days: number) => Array.from({ length: days }, (_, i) => addDays(from, i));
  switch (view) {
    case 'day':
      return [startOfDay(anchor)];
    case 'workweek':
      return count(startOfWeek(anchor, WEEK), 5);
    case 'week':
      return count(startOfWeek(anchor, WEEK), 7);
    case 'month': {
      const first = startOfWeek(startOfMonth(anchor), WEEK);
      const last = endOfWeek(endOfMonth(anchor), WEEK);
      return count(first, differenceInCalendarDays(last, first) + 1);
    }
  }
}

/** Half-open time range [from, to) covered by a view, for loading meetings. */
export function visibleRange(view: CalendarView, anchor: Date) {
  const days = visibleDays(view, anchor);
  return { from: days[0], to: addDays(days[days.length - 1], 1) };
}

/** Moves the anchor one page back (-1) or forward (+1). */
export function shiftAnchor(view: CalendarView, anchor: Date, direction: -1 | 1): Date {
  if (view === 'month') return addMonths(anchor, direction);
  return addDays(anchor, view === 'day' ? direction : 7 * direction);
}

export interface TimedItem {
  id: string;
  start: Date;
  end: Date;
}

export interface PlacedItem<T extends TimedItem> {
  item: T;
  /** Minutes from the start of the day */
  top: number;
  /** Duration in minutes, at least `minMinutes` so short meetings stay clickable */
  height: number;
  column: number;
  columns: number;
}

/**
 * Lays out one day of a time grid: meetings are clipped to the day, and
 * overlapping meetings share the width side by side (each cluster of
 * overlaps gets as many columns as it needs at its busiest).
 */
export function layoutDay<T extends TimedItem>(items: T[], day: Date, minMinutes = 20): PlacedItem<T>[] {
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);
  const inDay = items
    .filter((m) => m.start < dayEnd && m.end > dayStart)
    .map((item) => {
      const start = item.start < dayStart ? dayStart : item.start;
      const end = item.end > dayEnd ? dayEnd : item.end;
      const top = differenceInMinutes(start, dayStart);
      return {
        item,
        top,
        height: Math.max(differenceInMinutes(end, start), minMinutes),
      };
    })
    .sort((a, b) => a.top - b.top || b.height - a.height);

  const placed: PlacedItem<T>[] = [];
  let cluster: PlacedItem<T>[] = [];
  let columnEnds: number[] = [];
  let clusterEnd = -1;

  const closeCluster = () => {
    for (const p of cluster) p.columns = columnEnds.length;
    cluster = [];
    columnEnds = [];
  };

  for (const entry of inDay) {
    if (entry.top >= clusterEnd) closeCluster();
    let column = columnEnds.findIndex((end) => end <= entry.top);
    if (column === -1) column = columnEnds.push(0) - 1;
    columnEnds[column] = entry.top + entry.height;
    clusterEnd = Math.max(clusterEnd, entry.top + entry.height);
    const p = { ...entry, column, columns: 1 };
    cluster.push(p);
    placed.push(p);
  }
  closeCluster();
  return placed;
}

/** Meetings that touch a given day, earliest first (for the month grid). */
export function meetingsOnDay<T extends TimedItem>(items: T[], day: Date): T[] {
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);
  return items.filter((m) => m.start < dayEnd && m.end > dayStart).sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** True from shortly before the start until the end of a meeting. */
export function canJoin(meeting: { start: Date; end: Date; cancelled?: boolean }, now: Date): boolean {
  if (meeting.cancelled) return false;
  return now.getTime() >= meeting.start.getTime() - JOIN_EARLY_MS && now < meeting.end;
}

/** Default slot for a new meeting: the next half hour, 30 minutes long. */
export function nextSlot(now: Date, minutes = 30) {
  const start = startOfDay(now);
  const passed = differenceInMinutes(now, start);
  const from = addMinutes(start, Math.ceil((passed + 1) / 30) * 30);
  return { start: from, end: addMinutes(from, minutes) };
}

/** The half-hour slot that was clicked at `minutes` into a day. */
export function slotAt(day: Date, minutes: number, length = 30) {
  const from = addMinutes(startOfDay(day), Math.floor(Math.max(0, Math.min(minutes, 1439)) / 30) * 30);
  return { start: from, end: addMinutes(from, length) };
}

/** Same meeting length, new start (used when the start time is edited). */
export function keepDuration(oldStart: Date, oldEnd: Date, newStart: Date): Date {
  const length = Math.max(differenceInMinutes(oldEnd, oldStart), 15);
  return addMinutes(newStart, length);
}

export const MEETING_COLORS = 5;

/** Stable colour slot per meeting so a meeting keeps its colour across views. */
export function colorIndex(id: string): number {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(hash) % MEETING_COLORS;
}

export function isPast(meeting: { end: Date }, now: Date) {
  return !isAfter(meeting.end, now);
}
