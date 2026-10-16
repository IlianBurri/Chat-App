import clsx from 'clsx';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import type { MeetingDto } from '@/lib/types';
import { useMeetingsStore } from '@/stores/meetings';
import { canJoin, colorIndex, isPast } from './calendarMath';
import { joinMeeting } from './join';
import { formatTimeRange } from './meetingFormat';

/** Colours of a meeting: strong border, tinted background. */
export function meetingColorStyle(id: string): CSSProperties {
  const color = `var(--ui-meet-${colorIndex(id)})`;
  return {
    borderColor: color,
    backgroundColor: `color-mix(in srgb, ${color} 16%, var(--ui-bg-main))`,
  };
}

/** A meeting in the time grid; "Join" appears shortly before it starts. */
export function MeetingBlock({ meeting, now, style, heightPx }: { meeting: MeetingDto; now: Date; style: CSSProperties; heightPx: number }) {
  const { t, i18n } = useTranslation();
  const openDetails = useMeetingsStore((s) => s.openDetails);
  const start = new Date(meeting.start);
  const end = new Date(meeting.end);
  const joinable = canJoin({ start, end }, now);
  const time = formatTimeRange(start, end, i18n.resolvedLanguage);
  const tiny = heightPx < 30;

  return (
    <div
      data-testid="meeting-block"
      className={clsx('absolute overflow-hidden rounded-md border-l-[3px] text-xs shadow-sm', isPast({ end }, now) && 'opacity-60')}
      style={{ ...meetingColorStyle(meeting.id), ...style }}
    >
      <button
        type="button"
        onClick={() => openDetails(meeting.id)}
        aria-label={`${meeting.title}, ${time}`}
        className={clsx('absolute inset-0 block px-1.5 text-left outline-offset-[-2px]', tiny ? 'py-0' : 'py-1', joinable && 'pr-24')}
      >
        <span className={clsx('block truncate font-semibold text-fg', tiny && 'leading-4')}>
          {tiny ? `${meeting.title} · ${time}` : meeting.title}
        </span>
        {!tiny && <span className="block truncate text-muted">{time}</span>}
      </button>
      {joinable && (
        <button
          type="button"
          onClick={() => joinMeeting()}
          className={clsx(
            'absolute right-1 z-10 rounded bg-accent font-semibold text-accent-fg hover:bg-accent-hover',
            tiny ? 'top-0 h-4 px-1.5 text-[10px] leading-4' : 'top-1 h-6 px-2',
          )}
        >
          {t('meetings.join')}
        </button>
      )}
    </div>
  );
}
