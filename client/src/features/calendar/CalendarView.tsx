import { CalendarBlankIcon, CaretDownIcon, CaretLeftIcon, CaretRightIcon, PlusIcon, VideoCameraIcon } from '@phosphor-icons/react';
import { format, isValid, parse } from 'date-fns';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Menu, MenuItem } from '@/components/ui/Menu';
import { useToast } from '@/components/ui/Toaster';
import { useNow } from '@/lib/useNow';
import { meetingsInRange, useMeetingsStore } from '@/stores/meetings';
import { CALENDAR_VIEWS, nextSlot, shiftAnchor, visibleDays, visibleRange, type CalendarView as View } from './calendarMath';
import { joinMeeting } from './join';
import { formatRangeLabel } from './meetingFormat';
import { MonthGrid } from './MonthGrid';
import { TimeGrid } from './TimeGrid';

const DATE_PARAM = 'yyyy-MM-dd';

/** Reads view and date from the URL so back/forward and reloads keep the place. */
function useCalendarParams() {
  const [params, setParams] = useSearchParams();
  const rawView = params.get('view');
  const view: View = CALENDAR_VIEWS.includes(rawView as View) ? (rawView as View) : 'workweek';
  const parsed = parse(params.get('date') ?? '', DATE_PARAM, new Date());
  const anchorKey = isValid(parsed) ? format(parsed, DATE_PARAM) : format(new Date(), DATE_PARAM);
  const anchor = useMemo(() => parse(anchorKey, DATE_PARAM, new Date()), [anchorKey]);

  const go = (next: { view?: View; date?: Date }) =>
    setParams((p) => {
      const out = new URLSearchParams(p);
      out.set('view', next.view ?? view);
      out.set('date', format(next.date ?? anchor, DATE_PARAM));
      out.delete('meeting');
      return out;
    });
  return { view, anchor, go, meetingParam: params.get('meeting'), setParams };
}

export function CalendarView() {
  const { t, i18n } = useTranslation();
  const now = useNow();
  const showToast = useToast((s) => s.show);
  const { view, anchor, go, meetingParam, setParams } = useCalendarParams();
  const { byId, loading, error, loadRange, openEditor, openDetails, fetchOne } = useMeetingsStore();

  const days = useMemo(() => visibleDays(view, anchor), [view, anchor]);
  const { from, to } = useMemo(() => visibleRange(view, anchor), [view, anchor]);
  const meetings = useMemo(() => meetingsInRange(byId, from, to), [byId, from, to]);

  useEffect(() => {
    void loadRange(from, to);
  }, [from, to, loadRange]);

  // Links from the activity feed open a meeting: jump to its week and show the details.
  useEffect(() => {
    if (!meetingParam) return;
    fetchOne(meetingParam)
      .then((m) => {
        setParams({ view, date: format(new Date(m.start), DATE_PARAM) }, { replace: true });
        openDetails(m.id);
      })
      .catch(() => {
        setParams({ view }, { replace: true });
        showToast(t('meetings.notFound'), 'error');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingParam]);

  const newMeeting = (slot = nextSlot(new Date())) =>
    openEditor({
      mode: 'create',
      draft: { title: '', description: '', participants: [], ...slot },
    });

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-tl-lg bg-main">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-5">
        <CalendarBlankIcon className="size-5 text-accent" weight="fill" aria-hidden="true" />
        <h1 className="text-lg font-semibold">{t('calendar.title')}</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button icon={VideoCameraIcon} onClick={() => joinMeeting()}>
            {t('calendar.meetNow')}
          </Button>
          <Button variant="primary" icon={PlusIcon} onClick={() => newMeeting()}>
            {t('calendar.newMeeting')}
          </Button>
        </div>
      </header>

      <div className="flex shrink-0 items-center gap-1 border-b border-line px-5 py-2">
        <Button size="sm" onClick={() => go({ date: new Date() })}>
          {t('calendar.today')}
        </Button>
        <IconButton label={t('calendar.previous')} icon={CaretLeftIcon} onClick={() => go({ date: shiftAnchor(view, anchor, -1) })} />
        <IconButton label={t('calendar.next')} icon={CaretRightIcon} onClick={() => go({ date: shiftAnchor(view, anchor, 1) })} />
        <h2 className="ml-1 text-base font-semibold" aria-live="polite" data-testid="calendar-range">
          {formatRangeLabel(view, days, anchor, i18n.resolvedLanguage)}
        </h2>
        {loading && <span className="ml-2 text-xs text-subtle">{t('common.loading')}</span>}
        {error && (
          <button type="button" className="ml-2 text-xs font-semibold text-danger hover:underline" onClick={() => void loadRange(from, to)}>
            {t('calendar.loadError')}
          </button>
        )}
        <div className="ml-auto">
          <Menu
            label={t('calendar.view')}
            width={200}
            trigger={(props) => (
              <Button size="sm" {...props}>
                {t(`calendar.views.${view}`)}
                <CaretDownIcon className="size-3.5" aria-hidden="true" />
              </Button>
            )}
          >
            {CALENDAR_VIEWS.map((v) => (
              <MenuItem key={v} checked={v === view} onSelect={() => go({ view: v })}>
                {t(`calendar.views.${v}`)}
              </MenuItem>
            ))}
          </Menu>
        </div>
      </div>

      {view === 'month' ? (
        <MonthGrid days={days} anchor={anchor} meetings={meetings} now={now} onOpenDay={(day) => go({ view: 'day', date: day })} />
      ) : (
        <TimeGrid days={days} meetings={meetings} now={now} onSlot={newMeeting} />
      )}
    </main>
  );
}
