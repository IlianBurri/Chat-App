import clsx from 'clsx';
import {
  CalendarXIcon,
  ChatsCircleIcon,
  CheckCircleIcon,
  ClockIcon,
  PencilSimpleIcon,
  QuestionIcon,
  VideoCameraIcon,
  XCircleIcon,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Dialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toaster';
import { joinMeeting } from '@/features/calls/startCall';
import type { MeetingDto, MeetingResponse } from '@/lib/types';
import { useNow } from '@/lib/useNow';
import { useAuthStore } from '@/stores/auth';
import { useMeetingsStore } from '@/stores/meetings';
import { canJoin } from './calendarMath';
import { meetingColorStyle } from './MeetingBlock';
import { formatMeetingWhen } from './meetingFormat';

const RESPONSE_ICON: Record<MeetingResponse, { icon: PhosphorIcon; className: string }> = {
  accepted: { icon: CheckCircleIcon, className: 'text-success' },
  tentative: { icon: QuestionIcon, className: 'text-warning' },
  declined: { icon: XCircleIcon, className: 'text-danger' },
  none: { icon: ClockIcon, className: 'text-subtle' },
};

const ANSWERS: Exclude<MeetingResponse, 'none'>[] = ['accepted', 'tentative', 'declined'];

/** Details of one meeting: time, attendees with their answers, and the actions that fit the viewer. */
export function MeetingDetails() {
  const detailsId = useMeetingsStore((s) => s.detailsId);
  const meeting = useMeetingsStore((s) => (s.detailsId ? s.byId[s.detailsId] : undefined));
  const close = useMeetingsStore((s) => s.closeDetails);
  if (!detailsId || !meeting) return null;
  return <DetailsDialog meeting={meeting} onClose={close} />;
}

function DetailsDialog({ meeting, onClose }: { meeting: MeetingDto; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const now = useNow();
  const meId = useAuthStore((s) => s.user?.id);
  const { respond, cancel, openEditor } = useMeetingsStore.getState();
  const showToast = useToast((s) => s.show);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const start = new Date(meeting.start);
  const end = new Date(meeting.end);
  const isOrganizer = meeting.organizer.id === meId;
  const mine = meeting.participants.find((p) => p.user.id === meId);
  const answered = meeting.participants.filter((p) => p.response === 'accepted').length;

  const answer = async (response: MeetingResponse) => {
    try {
      await respond(meeting.id, response);
    } catch {
      showToast(t('auth.errors.generic'), 'error');
    }
  };

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        width={520}
        title={meeting.title}
        footer={
          <>
            {meeting.chatId && (
              <Button
                icon={ChatsCircleIcon}
                onClick={() => {
                  onClose();
                  void navigate(`/chat/${meeting.chatId}`);
                }}
              >
                {t('meetings.openChat')}
              </Button>
            )}
            {!meeting.cancelled && (
              <Button variant="primary" icon={VideoCameraIcon} onClick={() => {
                  onClose();
                  joinMeeting(meeting);
                }}>
                {t('meetings.join')}
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-md border-l-[3px] px-3 py-2" style={meetingColorStyle(meeting.id)}>
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold" data-testid="meeting-when">
                {formatMeetingWhen(start, end, i18n.resolvedLanguage)}
              </p>
              <p className="text-muted">
                {isOrganizer ? t('meetings.organizedByYou') : t('meetings.organizedBy', { name: meeting.organizer.name })}
              </p>
            </div>
            {meeting.cancelled ? (
              <span className="rounded-full bg-danger px-2 py-0.5 text-xs font-semibold text-white">{t('meetings.cancelled')}</span>
            ) : (
              canJoin({ start, end }, now) && (
                <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-fg">{t('meetings.startingNow')}</span>
              )
            )}
          </div>

          {meeting.description && <p className="text-sm whitespace-pre-wrap">{meeting.description}</p>}

          {!meeting.cancelled && (isOrganizer || mine) && (
            <div className="flex flex-wrap items-center gap-2">
              {isOrganizer ? (
                <>
                  <Button size="sm" icon={PencilSimpleIcon} onClick={() => openEditor({ mode: 'edit', meeting })}>
                    {t('meetings.edit')}
                  </Button>
                  <Button size="sm" icon={CalendarXIcon} className="text-danger" onClick={() => setConfirmCancel(true)}>
                    {t('meetings.cancelMeeting')}
                  </Button>
                </>
              ) : (
                <div role="group" aria-label={t('meetings.yourAnswer')} className="flex gap-1.5">
                  {ANSWERS.map((r) => {
                    const { icon: Icon, className } = RESPONSE_ICON[r];
                    const active = mine?.response === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        aria-pressed={active}
                        onClick={() => void answer(active ? 'none' : r)}
                        className={clsx(
                          'inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-semibold',
                          active ? 'border-accent bg-accent-soft text-fg' : 'border-line hover:bg-hover',
                        )}
                      >
                        <Icon className={clsx('size-4', className)} weight={active ? 'fill' : 'regular'} aria-hidden="true" />
                        {t(`meetings.answer.${r}`)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <section>
            <h3 className="mb-1.5 text-xs font-semibold text-muted">
              {t('meetings.participants', {
                count: meeting.participants.length,
                accepted: answered,
              })}
            </h3>
            <ul className="max-h-56 space-y-1 overflow-y-auto">
              {meeting.participants.map(({ user, response }) => {
                const { icon: Icon, className } = RESPONSE_ICON[response];
                return (
                  <li key={user.id} className="flex items-center gap-2 text-sm">
                    <Avatar user={user} size="sm" showStatus />
                    <span className="min-w-0 flex-1 truncate">
                      {user.name}
                      {user.id === meeting.organizer.id && <span className="text-xs text-muted"> · {t('meetings.organizer')}</span>}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-muted">
                      <Icon className={clsx('size-4', className)} weight="fill" aria-hidden="true" />
                      {t(`meetings.response.${response}`)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </Dialog>

      <ConfirmDialog
        open={confirmCancel}
        title={t('meetings.cancelTitle')}
        confirmLabel={t('meetings.cancelMeeting')}
        danger
        onClose={() => setConfirmCancel(false)}
        onConfirm={async () => {
          await cancel(meeting.id);
          showToast(t('meetings.cancelledToast'), 'success');
          onClose();
        }}
      >
        {t('meetings.cancelText', { title: meeting.title })}
      </ConfirmDialog>
    </>
  );
}
