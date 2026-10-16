import clsx from 'clsx';
import { CalendarBlankIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toaster';
import type { MeetingCard as MeetingCardDto } from '@/lib/types';
import { useNow } from '@/lib/useNow';
import { useMeetingsStore } from '@/stores/meetings';
import { canJoin } from './calendarMath';
import { joinMeeting } from './join';
import { formatMeetingWhen } from './meetingFormat';

/** Invitation card posted into a chat when a meeting is scheduled. */
export function MeetingCard({ meeting }: { meeting: MeetingCardDto }) {
  const { t, i18n } = useTranslation();
  const now = useNow();
  const showToast = useToast((s) => s.show);
  const start = new Date(meeting.start);
  const end = new Date(meeting.end);

  const showDetails = async () => {
    const store = useMeetingsStore.getState();
    try {
      if (!store.byId[meeting.id]) await store.fetchOne(meeting.id);
      store.openDetails(meeting.id);
    } catch {
      showToast(t('meetings.notFound'), 'error');
    }
  };

  return (
    <div className="min-w-[260px] space-y-2" data-testid="meeting-card">
      <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted uppercase">
        <CalendarBlankIcon className="size-3.5" aria-hidden="true" />
        {t('meetings.card')}
      </p>
      <div>
        <p className={clsx('font-semibold', meeting.cancelled && 'line-through')}>{meeting.title}</p>
        <p className="text-sm text-muted">{formatMeetingWhen(start, end, i18n.resolvedLanguage)}</p>
        {meeting.cancelled && <p className="mt-0.5 text-xs font-semibold text-danger">{t('meetings.cancelled')}</p>}
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => void showDetails()}>
          {t('meetings.details')}
        </Button>
        {canJoin({ start, end, cancelled: meeting.cancelled }, now) && (
          <Button size="sm" variant="primary" onClick={() => joinMeeting()}>
            {t('meetings.join')}
          </Button>
        )}
      </div>
    </div>
  );
}
