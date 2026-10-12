import clsx from 'clsx';
import { Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { avatarColor, initials } from '@/lib/format';
import type { PublicUser, Status } from '@/lib/types';
import { useStatus } from '@/stores/presence';
import { StatusIcon } from './StatusIcon';

const SIZES = { xs: 20, sm: 28, md: 32, lg: 40, xl: 72 } as const;
type Size = keyof typeof SIZES;

interface AvatarProps {
  user: Pick<PublicUser, 'id' | 'name' | 'avatarUrl'> & { status?: Status };
  size?: Size;
  showStatus?: boolean;
  className?: string;
}

/** Round avatar (photo or initials) with optional live status dot. */
export function Avatar({ user, size = 'md', showStatus = false, className }: AvatarProps) {
  const px = SIZES[size];
  return (
    <span className={clsx('relative inline-flex shrink-0', className)} style={{ width: px, height: px }}>
      {user.avatarUrl ? (
        <img src={user.avatarUrl} alt="" className="size-full rounded-full object-cover" />
      ) : (
        <span
          aria-hidden="true"
          className="flex size-full items-center justify-center rounded-full font-semibold text-white select-none"
          style={{ backgroundColor: avatarColor(user.id), fontSize: px * 0.38 }}
        >
          {initials(user.name)}
        </span>
      )}
      {showStatus && <PresenceDot userId={user.id} fallback={user.status} avatarSize={px} />}
    </span>
  );
}

function PresenceDot({ userId, fallback, avatarSize }: { userId: string; fallback?: Status; avatarSize: number }) {
  const { t } = useTranslation();
  const status = useStatus(userId, fallback);
  const dot = Math.max(10, Math.round(avatarSize * 0.32));
  return (
    <span
      className="absolute -right-0.5 -bottom-0.5 rounded-full bg-main p-[1.5px]"
      role="img"
      aria-label={status === 'offline' ? t('status.offlineShort') : t(`status.${status}`)}
    >
      <StatusIcon status={status} size={dot} />
    </span>
  );
}

/** Avatar for group chats: two overlapping member avatars. */
export function GroupAvatar({ members, size = 'md' }: { members: Pick<PublicUser, 'id' | 'name' | 'avatarUrl'>[]; size?: Size }) {
  const px = SIZES[size];
  if (members.length < 2) {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"
        style={{ width: px, height: px }}
        aria-hidden="true"
      >
        <Users className="size-1/2" />
      </span>
    );
  }
  const inner = Math.round(px * 0.68);
  return (
    <span className="relative shrink-0" style={{ width: px, height: px }} aria-hidden="true">
      {members.slice(0, 2).map((m, i) => (
        <span
          key={m.id}
          className={clsx('absolute flex items-center justify-center rounded-full font-semibold text-white ring-2 ring-pane', i === 0 ? 'top-0 left-0' : 'right-0 bottom-0')}
          style={{ width: inner, height: inner, backgroundColor: avatarColor(m.id), fontSize: inner * 0.4 }}
        >
          {initials(m.name)}
        </span>
      ))}
    </span>
  );
}
