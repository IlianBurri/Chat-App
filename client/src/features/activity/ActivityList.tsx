import clsx from 'clsx';
import { BellRingingIcon, ChecksIcon, XIcon } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { useToast } from '@/components/ui/Toaster';
import { notificationPermission } from '@/lib/desktopNotify';
import { useActivityStore, type ActivityFilter } from '@/stores/activity';
import { useUiStore } from '@/stores/ui';
import { ActivityItem } from './ActivityItem';

const FILTERS: Exclude<ActivityFilter, 'all'>[] = ['unread', 'mention', 'reply', 'reaction', 'missed_call'];

export function ActivityList() {
  const { t } = useTranslation();
  const showToast = useToast((s) => s.show);
  const { items, filter, loaded, error, hasMore, loadingMore, unreadCount, load, loadMore, markRead } = useActivityStore();

  // Fresh data whenever the feed is opened (the badge count stays live meanwhile).
  useEffect(() => {
    void useActivityStore.getState().load();
  }, []);

  const now = new Date();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center gap-1 px-4">
        <h1 className="flex-1 text-lg font-semibold">{t('activity.title')}</h1>
        <IconButton
          label={t('activity.markAllRead')}
          icon={ChecksIcon}
          disabled={unreadCount === 0}
          onClick={() => void markRead().catch(() => showToast(t('auth.errors.generic'), 'error'))}
        />
      </header>

      <div role="group" aria-label={t('activity.filter')} className="flex gap-1 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => void load(filter === f ? 'all' : f)}
            className={clsx(
              'h-7 shrink-0 rounded-full border px-2 text-xs font-medium whitespace-nowrap transition-colors',
              filter === f ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-main text-fg hover:bg-hover',
            )}
          >
            {t(`activity.filters.${f}`)}
          </button>
        ))}
      </div>

      <PermissionPrompt />

      <div className="min-h-0 flex-1 overflow-y-auto pb-3">
        {!loaded ? (
          <p className="px-4 py-6 text-sm text-muted">{t('common.loading')}</p>
        ) : error ? (
          <div className="px-4 py-6 text-sm">
            <p className="mb-2 text-muted">{t('auth.errors.generic')}</p>
            <Button size="sm" onClick={() => void load()}>
              {t('common.retry')}
            </Button>
          </div>
        ) : items.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">{t(filter === 'all' ? 'activity.empty' : 'activity.emptyFiltered')}</p>
        ) : (
          <>
            <ul aria-label={t('activity.title')} className="space-y-px">
              {items.map((n) => (
                <li key={n.id}>
                  <ActivityItem notification={n} now={now} />
                </li>
              ))}
            </ul>
            {hasMore && (
              <div className="px-4 pt-2">
                <Button size="sm" className="w-full" disabled={loadingMore} onClick={() => void loadMore()}>
                  {loadingMore ? t('common.loading') : t('activity.loadMore')}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Browsers only ask for the notification permission after a click, so we offer a button. */
function PermissionPrompt() {
  const { t } = useTranslation();
  const enabled = useUiStore((s) => s.desktopNotifications);
  const setEnabled = useUiStore((s) => s.setDesktopNotifications);
  const [permission, setPermission] = useState(notificationPermission);
  if (!enabled || permission !== 'default') return null;

  return (
    <div className="mx-4 mb-2 flex items-start gap-2 rounded-lg border border-line bg-main p-3 text-sm">
      <BellRingingIcon className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="mb-2">{t('activity.permissionText')}</p>
        <Button size="sm" variant="primary" onClick={() => void Notification.requestPermission().then(setPermission)}>
          {t('activity.permissionAllow')}
        </Button>
      </div>
      <IconButton label={t('activity.permissionDismiss')} icon={XIcon} size="sm" onClick={() => setEnabled(false)} />
    </div>
  );
}
