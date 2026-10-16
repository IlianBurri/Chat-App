import clsx from 'clsx';
import { isSameDay, isSameMonth } from 'date-fns';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { MeetingDto } from '@/lib/types';
import { useMeetingsStore } from '@/stores/meetings';
import { colorIndex, meetingsOnDay } from './calendarMath';
import { formatDayHeading, formatTimeRange } from './meetingFormat';

const MAX_PER_DAY = 3;

interface MonthGridProps {
  days: Date[];
  anchor: Date;
  meetings: MeetingDto[];
  now: Date;
  onOpenDay: (day: Date) => void;
}

/** Month overview: up to three meetings per day, the rest behind "+n more" (opens the day). */
export function MonthGrid({ days, anchor, meetings, now, onOpenDay }: MonthGridProps) {
  const { t, i18n } = useTranslation();
  const openDetails = useMeetingsStore((s) => s.openDetails);
  const items = useMemo(
    () =>
      meetings.map((m) => ({
        id: m.id,
        start: new Date(m.start),
        end: new Date(m.end),
        meeting: m,
      })),
    [meetings],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid shrink-0 grid-cols-7 border-b border-line">
        {days.slice(0, 7).map((day) => (
          <div key={day.getTime()} className="px-2 py-1.5 text-xs font-semibold text-muted">
            {formatDayHeading(day, i18n.resolvedLanguage).weekday}
          </div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-7 overflow-y-auto">
        {days.map((day) => {
          const list = meetingsOnDay(items, day);
          const today = isSameDay(day, now);
          return (
            <div
              key={day.getTime()}
              data-testid="calendar-day"
              className={clsx('flex min-h-24 flex-col gap-0.5 border-r border-b border-line p-1', !isSameMonth(day, anchor) && 'bg-pane')}
            >
              <button
                type="button"
                onClick={() => onOpenDay(day)}
                aria-label={day.toLocaleDateString(i18n.resolvedLanguage)}
                className={clsx(
                  'flex size-6 items-center justify-center self-start rounded-full text-xs font-semibold hover:bg-hover',
                  today ? 'bg-accent text-accent-fg hover:bg-accent-hover' : !isSameMonth(day, anchor) && 'text-subtle',
                )}
              >
                {day.getDate()}
              </button>
              {list.slice(0, MAX_PER_DAY).map(({ meeting, start, end }) => (
                <button
                  key={meeting.id}
                  type="button"
                  data-testid="meeting-chip"
                  onClick={() => openDetails(meeting.id)}
                  className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[11px] hover:bg-hover"
                  title={`${meeting.title}, ${formatTimeRange(start, end, i18n.resolvedLanguage)}`}
                >
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{
                      backgroundColor: `var(--ui-meet-${colorIndex(meeting.id)})`,
                    }}
                  />
                  <span className="text-muted">
                    {start.toLocaleTimeString(i18n.resolvedLanguage, {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <span className="truncate font-medium">{meeting.title}</span>
                </button>
              ))}
              {list.length > MAX_PER_DAY && (
                <button type="button" onClick={() => onOpenDay(day)} className="px-1 text-left text-[11px] font-semibold text-accent hover:underline">
                  {t('meetings.more', { count: list.length - MAX_PER_DAY })}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
