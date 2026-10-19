import { format, parse } from 'date-fns';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toaster';
import { UserPicker } from '@/components/ui/UserPicker';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { useMeetingsStore, type MeetingDraft } from '@/stores/meetings';
import { keepDuration } from './calendarMath';

const inputClass = 'h-9 w-full rounded-md border border-line bg-input px-3 text-sm outline-none focus:border-accent';

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={className ?? 'block space-y-1'}>
      <span className="text-xs font-semibold text-muted">{label}</span>
      {children}
    </label>
  );
}

const day = (d: Date) => format(d, 'yyyy-MM-dd');
const time = (d: Date) => format(d, 'HH:mm');
const combine = (date: string, hhmm: string) => parse(`${date} ${hhmm}`, 'yyyy-MM-dd HH:mm', new Date());

/** Create or edit a meeting. Mounted once (see MeetingDialogs) and driven by the meetings store. */
export function MeetingEditor() {
  const editor = useMeetingsStore((s) => s.editor);
  const close = useMeetingsStore((s) => s.closeEditor);
  if (!editor) return null;
  const meeting = editor.mode === 'edit' ? editor.meeting : null;
  const initial: MeetingDraft =
    editor.mode === 'edit'
      ? {
          title: editor.meeting.title,
          description: editor.meeting.description ?? '',
          start: new Date(editor.meeting.start),
          end: new Date(editor.meeting.end),
          participants: editor.meeting.participants.map((p) => p.user).filter((u) => u.id !== editor.meeting.organizer.id),
        }
      : editor.draft;
  // A new key per opened meeting resets the form state.
  return <EditorForm key={meeting?.id ?? `new-${initial.start.getTime()}`} initial={initial} meetingId={meeting?.id} onClose={close} />;
}

function EditorForm({ initial, meetingId, onClose }: { initial: MeetingDraft; meetingId?: string; onClose: () => void }) {
  const { t } = useTranslation();
  const meId = useAuthStore((s) => s.user?.id);
  const save = useMeetingsStore((s) => s.save);
  const showToast = useToast((s) => s.show);
  const [title, setTitle] = useState(initial.title);
  const [participants, setParticipants] = useState(initial.participants);
  const [date, setDate] = useState(day(initial.start));
  const [startTime, setStartTime] = useState(time(initial.start));
  const [endTime, setEndTime] = useState(time(initial.end));
  const [endDate, setEndDate] = useState(day(initial.end));
  const [description, setDescription] = useState(initial.description);
  const [busy, setBusy] = useState(false);

  const start = combine(date, startTime);
  const end = combine(endDate, endTime);
  const invalidTimes = !(end > start);

  // Moving the start keeps the length, like in other calendar apps.
  const changeStart = (nextDate: string, nextTime: string) => {
    const nextStart = combine(nextDate, nextTime);
    if (Number.isNaN(nextStart.getTime()) || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setDate(nextDate);
      setStartTime(nextTime);
      return;
    }
    const nextEnd = keepDuration(start, end, nextStart);
    setDate(nextDate);
    setStartTime(nextTime);
    setEndDate(day(nextEnd));
    setEndTime(time(nextEnd));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (invalidTimes || !title.trim()) return;
    setBusy(true);
    try {
      await save({ ...initial, title, description, start, end, participants }, meetingId);
      showToast(meetingId ? t('meetings.saved') : t('meetings.scheduled'), 'success');
      onClose();
    } catch (err) {
      showToast(err instanceof ApiError && err.code === 'cancelled' ? t('meetings.alreadyCancelled') : t('auth.errors.generic'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      width={560}
      title={meetingId ? t('meetings.editTitle') : t('meetings.newTitle')}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" type="submit" form="meeting-form" disabled={busy || invalidTimes || !title.trim()}>
            {meetingId ? t('common.save') : t('meetings.send')}
          </Button>
        </>
      }
    >
      <form id="meeting-form" onSubmit={(e) => void submit(e)} className="space-y-3">
        <Field label={t('meetings.form.title')}>
          <input autoFocus required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        </Field>
        <div className="space-y-1">
          <span className="text-xs font-semibold text-muted">{t('meetings.form.participants')}</span>
          <UserPicker
            label={t('meetings.form.participants')}
            placeholder={t('meetings.form.participantsPlaceholder')}
            selected={participants}
            onChange={setParticipants}
            exclude={meId ? [meId] : []}
          />
        </div>
        {/* Narrow screens: date on its own row, start and end below. */}
        <div className="grid grid-cols-2 items-end gap-2 *:min-w-0 sm:grid-cols-[1fr_auto_auto]">
          <Field label={t('meetings.form.date')} className="col-span-2 block space-y-1 sm:col-span-1">
            <input type="date" required value={date} onChange={(e) => changeStart(e.target.value, startTime)} className={inputClass} />
          </Field>
          <Field label={t('meetings.form.start')}>
            <input type="time" required step={300} value={startTime} onChange={(e) => changeStart(date, e.target.value)} className={inputClass} />
          </Field>
          <Field label={t('meetings.form.end')}>
            <input type="time" required step={300} value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputClass} />
          </Field>
        </div>
        {endDate !== date && (
          <Field label={t('meetings.form.endDate')}>
            <input type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
          </Field>
        )}
        {invalidTimes && (
          <p role="alert" className="text-xs text-danger">
            {t('meetings.form.endBeforeStart')}
          </p>
        )}
        <Field label={t('meetings.form.description')}>
          <textarea
            rows={3}
            maxLength={5000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-md border border-line bg-input px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </Field>
        {!meetingId && <p className="text-xs text-muted">{initial.chatId ? t('meetings.form.postedInChat') : t('meetings.form.newChat')}</p>}
      </form>
    </Dialog>
  );
}
