import clsx from 'clsx';
import { differenceInMinutes, isSameDay, startOfDay } from 'date-fns';
import { useEffect, useMemo, useRef, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { MeetingDto } from '@/lib/types';
import { layoutDay, slotAt } from './calendarMath';
import { MeetingBlock } from './MeetingBlock';
import { formatDayHeading, formatHour } from './meetingFormat';

const HOUR_PX = 56;
const HOURS = Array.from({ length: 24 }, (_, h) => h);

interface TimeGridProps {
  days: Date[];
  meetings: MeetingDto[];
  now: Date;
  onSlot: (slot: { start: Date; end: Date }) => void;
}

/** Day / work week / week view: one column per day on a 24-hour grid. */
export function TimeGrid({ days, meetings, now, onSlot }: TimeGridProps) {
  const { t, i18n } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
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

  // Start the view around the working day (or an hour before now).
  const firstDay = days[0].getTime();
  useEffect(() => {
    const showsToday = days.some((d) => isSameDay(d, new Date()));
    const hour = showsToday ? Math.max(0, Math.min(new Date().getHours() - 1, 15)) : 8;
    scrollRef.current?.scrollTo({ top: hour * HOUR_PX });
    // Only when the visible period changes, not on every clock tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstDay, days.length]);

  const clickSlot = (day: Date) => (e: MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    onSlot(slotAt(day, ((e.clientY - rect.top) / HOUR_PX) * 60));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 overflow-y-hidden border-b border-line pl-14 [scrollbar-gutter:stable]">
        {days.map((day) => {
          const { weekday, day: number } = formatDayHeading(day, i18n.resolvedLanguage);
          const today = isSameDay(day, now);
          return (
            <div
              key={day.getTime()}
              className="flex flex-1 items-baseline gap-1.5 border-l border-line px-2 py-2"
              aria-current={today ? 'date' : undefined}
            >
              <span
                className={clsx(
                  'text-xl leading-none font-semibold',
                  today && 'flex size-8 items-center justify-center rounded-full bg-accent text-base text-accent-fg',
                )}
              >
                {number}
              </span>
              <span className={clsx('text-xs', today ? 'font-semibold text-accent' : 'text-muted')}>{weekday}</span>
            </div>
          );
        })}
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        <div className="relative flex" style={{ height: 24 * HOUR_PX }}>
          <div className="relative w-14 shrink-0" aria-hidden="true">
            {HOURS.slice(1).map((h) => (
              <span key={h} className="absolute right-2 -translate-y-1/2 text-[11px] text-subtle" style={{ top: h * HOUR_PX }}>
                {formatHour(h, i18n.resolvedLanguage)}
              </span>
            ))}
          </div>

          {days.map((day) => {
            const placed = layoutDay(items, day);
            const today = isSameDay(day, now);
            return (
              <div
                key={day.getTime()}
                data-testid="calendar-day"
                className="relative flex-1 cursor-pointer border-l border-line"
                style={{
                  backgroundImage: 'linear-gradient(to bottom, var(--color-line) 1px, transparent 1px)',
                  backgroundSize: `100% ${HOUR_PX}px`,
                }}
                title={t('meetings.clickToSchedule')}
                onClick={clickSlot(day)}
              >
                {placed.map((p) => {
                  const heightPx = (p.height / 60) * HOUR_PX - 2;
                  return (
                    <MeetingBlock
                      key={p.item.id}
                      meeting={p.item.meeting}
                      now={now}
                      heightPx={heightPx}
                      style={{
                        top: (p.top / 60) * HOUR_PX + 1,
                        height: heightPx,
                        left: `calc(${(p.column / p.columns) * 100}% + 2px)`,
                        width: `calc(${100 / p.columns}% - 4px)`,
                      }}
                    />
                  );
                })}
                {today && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-danger"
                    style={{
                      top: (differenceInMinutes(now, startOfDay(now)) / 60) * HOUR_PX,
                    }}
                    aria-hidden="true"
                  >
                    <span className="absolute -top-[5px] -left-[5px] size-2 rounded-full bg-danger" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
