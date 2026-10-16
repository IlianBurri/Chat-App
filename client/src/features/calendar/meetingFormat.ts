import { isSameDay } from 'date-fns';
import type { CalendarView } from './calendarMath';

/** Swiss German date style for German, British style for English. */
function intlLocale(language: string | undefined) {
  return language?.startsWith('de') ? 'de-CH' : 'en-GB';
}

const fmt = (language: string | undefined, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(intlLocale(language), options);

/** "10:00–10:30" */
export function formatTimeRange(start: Date, end: Date, language: string | undefined) {
  return fmt(language, { hour: '2-digit', minute: '2-digit' }).formatRange(start, end);
}

/** "Do., 15. Okt., 10:00–10:30" (the date repeats only for meetings spanning several days). */
export function formatMeetingWhen(start: Date, end: Date, language: string | undefined) {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  };
  if (start.getFullYear() !== new Date().getFullYear()) options.year = 'numeric';
  return fmt(language, options).formatRange(start, end);
}

/** Heading of the calendar toolbar, e.g. "12.–16. Oktober 2026" or "Oktober 2026". */
export function formatRangeLabel(view: CalendarView, days: Date[], anchor: Date, language: string | undefined) {
  if (view === 'month') return fmt(language, { month: 'long', year: 'numeric' }).format(anchor);
  const first = days[0];
  const last = days[days.length - 1];
  if (isSameDay(first, last))
    return fmt(language, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(first);
  return fmt(language, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).formatRange(first, last);
}

/** Column heading in the time grid: weekday and day number. */
export function formatDayHeading(day: Date, language: string | undefined) {
  return {
    weekday: fmt(language, { weekday: 'short' }).format(day),
    day: day.getDate(),
  };
}

export function formatHour(hour: number, language: string | undefined) {
  return fmt(language, { hour: '2-digit', minute: '2-digit' }).format(new Date(2000, 0, 1, hour));
}
