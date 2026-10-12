import clsx from 'clsx';
import { Bell, Calendar, Cloud, Ellipsis, LayoutGrid, MessageCircle, Phone, Users, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';
import { Badge } from '@/components/ui/Badge';
import { useComingSoon } from '@/components/ui/ComingSoon';
import { Tooltip } from '@/components/ui/Tooltip';
import { isUnread, useChatsStore } from '@/stores/chats';

interface NavEntry {
  to: string;
  icon: LucideIcon;
  label: string;
  badge?: number;
}

/** Vertical app bar (desktop): outline icons, filled + accent bar when active. */
export function AppBar() {
  const { t } = useTranslation();
  const showComingSoon = useComingSoon((s) => s.show);
  const unreadChats = useChatsStore((s) => s.chats.filter((c) => !c.muted && isUnread(c)).length);

  const entries: NavEntry[] = [
    { to: '/activity', icon: Bell, label: t('nav.activity') },
    { to: '/chat', icon: MessageCircle, label: t('nav.chat'), badge: unreadChats },
    { to: '/teams', icon: Users, label: t('nav.teams') },
    { to: '/calendar', icon: Calendar, label: t('nav.calendar') },
    { to: '/calls', icon: Phone, label: t('nav.calls') },
    { to: '/files', icon: Cloud, label: t('nav.files') },
  ];

  return (
    <nav aria-label={t('nav.mainNavigation')} className="flex w-[68px] shrink-0 flex-col items-center bg-app pb-2">
      <ul className="flex w-full flex-col items-center gap-0.5">
        {entries.map((entry) => (
          <li key={entry.to} className="w-full">
            <NavLink
              to={entry.to}
              aria-label={entry.badge ? `${entry.label}, ${t('nav.unreadBadge', { count: entry.badge })}` : entry.label}
              className={({ isActive }) => clsx(itemClass, isActive ? 'text-accent' : 'text-muted hover:text-fg')}
            >
              {({ isActive }) => <BarItem {...entry} active={isActive} />}
            </NavLink>
          </li>
        ))}
        <li className="w-full">
          <button type="button" className={clsx(itemClass, 'text-muted hover:text-fg')} onClick={() => showComingSoon(t('placeholder.more'))}>
            <BarItem icon={Ellipsis} label={t('nav.more')} active={false} />
          </button>
        </li>
      </ul>
      <div className="mt-auto w-full">
        <Tooltip label={t('nav.apps')} side="right" className="w-full">
          <button type="button" className={clsx(itemClass, 'text-muted hover:text-fg')} onClick={() => showComingSoon(t('nav.apps'))}>
            <BarItem icon={LayoutGrid} label={t('nav.apps')} active={false} />
          </button>
        </Tooltip>
      </div>
    </nav>
  );
}

const itemClass = 'group relative flex h-14 w-full flex-col items-center justify-center gap-0.5 rounded-md outline-offset-[-2px]';

function BarItem({ icon: Icon, label, badge = 0, active }: Omit<NavEntry, 'to'> & { active: boolean }) {
  return (
    <>
      {active && <span aria-hidden="true" className="absolute top-2.5 bottom-2.5 left-0 w-[3px] rounded-r-full bg-accent" />}
      <span className="relative rounded-md p-1 group-hover:bg-hover">
        <Icon
          className="size-5"
          strokeWidth={active ? 2 : 1.6}
          fill={active ? 'currentColor' : 'none'}
          fillOpacity={active ? 0.9 : 0}
          aria-hidden="true"
        />
        <Badge count={badge} className="absolute -top-1 -right-2" />
      </span>
      <span className={clsx('text-[10px] leading-tight', active && 'font-semibold')}>{label}</span>
    </>
  );
}
