import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';
import { LogoMark } from '@/components/brand/Logo';
import { IconButton } from '@/components/ui/IconButton';
import type { Me } from '@/lib/types';
import { MoreMenu } from './MoreMenu';
import { ProfileMenu } from './ProfileMenu';
import { SearchBox } from './SearchBox';

export function TitleBar({ user }: { user: Me }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // Re-render on navigation so the back button state stays current.
  useLocation();
  const historyIndex = (window.history.state as { idx?: number } | null)?.idx ?? 0;

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 bg-app px-2">
      <div className="flex w-[260px] shrink-0 items-center gap-1">
        <LogoMark size={24} className="mx-2.5" />
        <IconButton label={t('nav.back')} icon={CaretLeftIcon} disabled={historyIndex === 0} onClick={() => navigate(-1)} />
        <IconButton label={t('nav.forward')} icon={CaretRightIcon} onClick={() => navigate(1)} />
      </div>
      <div className="flex flex-1 justify-center">
        <SearchBox />
      </div>
      <div className="flex w-[260px] shrink-0 items-center justify-end gap-2 pr-1">
        <MoreMenu />
        <ProfileMenu user={user} />
      </div>
    </header>
  );
}
