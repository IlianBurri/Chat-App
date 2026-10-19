import clsx from 'clsx';
import { DotsThreeIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation, useNavigate } from 'react-router';
import { Badge } from '@/components/ui/Badge';
import { useComingSoon } from '@/components/ui/ComingSoon';
import { Menu, MenuItem } from '@/components/ui/Menu';
import { NavText, useNavEntries, useUnreadText, type NavEntry } from './AppBar';

/** Sections with their own tab; the others sit in the "More" menu. */
const TABS = ['/activity', '/chat', '/teams', '/calendar'];

/** Bottom tab bar below 768px, in place of the app bar. */
export function TabBar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const showComingSoon = useComingSoon((s) => s.show);
  const entries = useNavEntries();
  const unreadText = useUnreadText();
  const tabs = entries.filter((e) => TABS.includes(e.to));
  const more = entries.filter((e) => !TABS.includes(e.to));
  const moreActive = more.some((e) => pathname.startsWith(e.to));

  return (
    <nav aria-label={t('nav.mainNavigation')} className="shrink-0 border-t border-line bg-pane pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="flex">
        {tabs.map((entry) => (
          <li key={entry.to} className="flex-1">
            <NavLink to={entry.to} className={({ isActive }) => clsx(tabClass, isActive ? 'text-accent' : 'text-muted')}>
              {({ isActive }) => <TabItem entry={entry} unread={unreadText(entry)} active={isActive} />}
            </NavLink>
          </li>
        ))}
        <li className="flex-1">
          <Menu
            label={t('nav.more')}
            placement="top"
            width={200}
            trigger={({ ref, ...props }) => (
              <button ref={ref} type="button" className={clsx(tabClass, moreActive ? 'text-accent' : 'text-muted')} {...props}>
                <TabItem entry={{ to: '', icon: DotsThreeIcon, label: t('nav.more') }} active={moreActive} />
              </button>
            )}
          >
            {more.map((entry) => (
              <MenuItem key={entry.to} icon={entry.icon} checked={pathname.startsWith(entry.to)} onSelect={() => navigate(entry.to)}>
                {entry.label}
              </MenuItem>
            ))}
            <MenuItem onSelect={() => showComingSoon(t('nav.apps'))}>{t('nav.apps')}</MenuItem>
          </Menu>
        </li>
      </ul>
    </nav>
  );
}

const tabClass = 'flex h-14 w-full flex-col items-center justify-center gap-0.5 outline-offset-[-2px]';

function TabItem({ entry: { icon: Icon, label, badge = 0 }, unread, active }: { entry: NavEntry; unread?: string; active: boolean }) {
  return (
    <>
      <span aria-hidden="true" className="relative">
        <Icon className="size-6" weight={active ? 'fill' : 'regular'} />
        <Badge count={badge} className="absolute -top-1 -right-2.5" />
      </span>
      <span className={clsx('text-[11px] leading-tight', active && 'font-semibold')}>
        <NavText label={label} unread={unread} />
      </span>
    </>
  );
}
