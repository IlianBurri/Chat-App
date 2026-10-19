import clsx from 'clsx';
import { VideoCameraIcon } from '@phosphor-icons/react';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { joinMeeting } from '@/features/calls/startCall';
import type { MeetingDto } from '@/lib/types';
import { useMeetingsStore } from '@/stores/meetings';
import { canJoin, colorIndex, isPast } from './calendarMath';
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
    // Title and "Join" share the width; in narrow blocks (overlapping meetings, phones) "Join" becomes an icon.
    <div
      data-testid="meeting-block"
      className={clsx('@container absolute flex items-start overflow-hidden rounded-md border-l-[3px] text-xs shadow-sm', isPast({ end }, now) && 'opacity-60')}
      style={{ ...meetingColorStyle(meeting.id), ...style }}
    >
      <button
        type="button"
        onClick={() => openDetails(meeting.id)}
        className={clsx('min-w-0 flex-1 self-stretch px-1.5 text-left outline-offset-[-2px]', tiny ? 'py-0' : 'py-1')}
      >
        <span className={clsx('block truncate font-semibold text-fg', tiny && 'leading-4')}>
          {tiny ? `${meeting.title} · ${time}` : meeting.title}
        </span>
        {!tiny && (
          <span className="block truncate text-muted">
            <span className="sr-only">, </span>
            {time}
          </span>
        )}
      </button>
      {joinable && (
        <button
          type="button"
          onClick={() => joinMeeting(meeting)}
          aria-label={`${t('meetings.join')}: ${meeting.title}`}
          className={clsx(
            'inline-flex shrink-0 items-center gap-1 rounded bg-accent font-semibold text-accent-fg hover:bg-accent-hover',
            tiny ? 'mr-0.5 h-4 px-1 text-[10px]' : 'mt-1 mr-1 h-6 px-1.5',
          )}
        >
          <VideoCameraIcon className={tiny ? 'size-3' : 'size-3.5'} weight="fill" aria-hidden="true" />
          <span className="hidden @[10rem]:inline">{t('meetings.join')}</span>
        </button>
      )}
    </div>
  );
}
