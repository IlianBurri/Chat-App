import clsx from 'clsx';
import { ArrowBendUpLeftIcon, AtIcon, CalendarBlankIcon, EnvelopeOpenIcon, EnvelopeSimpleIcon, PhoneXIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Avatar } from '@/components/ui/Avatar';
import { ContextMenu, useContextMenu } from '@/components/ui/ContextMenu';
import { MenuItem } from '@/components/ui/Menu';
import { useToast } from '@/components/ui/Toaster';
import { formatListTimestamp } from '@/lib/format';
import { notificationPath } from '@/lib/links';
import type { NotificationDto } from '@/lib/types';
import { useActivityStore } from '@/stores/activity';
import { useAuthStore } from '@/stores/auth';
import { chatTitle, useChatsStore } from '@/stores/chats';
import { useWorkspacesStore } from '@/stores/workspaces';

const TYPE_ICONS = {
  mention: { icon: AtIcon, className: 'bg-accent text-white' },
  reply: { icon: ArrowBendUpLeftIcon, className: 'bg-success text-white' },
  missed_call: { icon: PhoneXIcon, className: 'bg-danger text-white' },
  meeting: { icon: CalendarBlankIcon, className: 'bg-accent text-white' },
} as const;

/** "Produktentwicklung › Design" for channels, the chat name for chats. */
function useContextLabel(n: NotificationDto) {
  const { t } = useTranslation();
  const meId = useAuthStore((s) => s.user?.id);
  const chat = useChatsStore((s) => (n.chatId ? s.chats.find((c) => c.id === n.chatId) : undefined));
  const workspace = useWorkspacesStore((s) => (n.workspaceId ? s.workspaces.find((w) => w.id === n.workspaceId) : undefined));
  if (n.chatId) return chat ? chatTitle(chat, meId) : t('activity.chat');
  const channel = workspace?.channels.find((c) => c.id === n.channelId);
  if (!workspace || !channel) return t('activity.channel');
  return `${workspace.name} › ${channel.isDefault ? t('teams.general') : channel.name}`;
}

export function ActivityItem({ notification: n, now }: { notification: NotificationDto; now: Date }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const showToast = useToast((s) => s.show);
  const menu = useContextMenu();
  const contextLabel = useContextLabel(n);
  const path = notificationPath(n);
  const name = n.actor?.name ?? t('activity.someone');
  const text = t(`activity.text.${n.type}`, { name, emoji: n.emoji ?? '', context: n.chatId ? 'chat' : 'channel' });
  const time = formatListTimestamp(new Date(n.createdAt), now, i18n.resolvedLanguage, { yesterday: t('chat.yesterday') });
  const { markRead, markUnread } = useActivityStore.getState();

  const run = (action: () => Promise<unknown>) =>
    void action().catch(() => showToast(t('auth.errors.generic'), 'error'));

  const open = () => {
    run(() => markRead([n.id]));
    if (path) navigate(path);
    else showToast(t('activity.gone'), 'error');
  };

  const typeIcon = n.type === 'reaction' ? null : TYPE_ICONS[n.type];

  return (
    <>
      <button
        type="button"
        onClick={open}
        {...menu.triggerProps}
        aria-label={`${n.read ? '' : `${t('activity.unread')}, `}${text}, ${contextLabel}, ${time}`}
        className="mx-2 flex w-[calc(100%-1rem)] items-start gap-3 rounded-md px-2 py-2.5 text-left outline-offset-[-2px] hover:bg-hover"
      >
        <span className="relative mt-0.5 shrink-0">
          {n.actor ? <Avatar user={n.actor} /> : <span className="block size-8 rounded-full bg-hover" />}
          <span
            aria-hidden="true"
            className={clsx(
              'absolute -right-1 -bottom-1 flex size-[18px] items-center justify-center rounded-full ring-2 ring-pane',
              typeIcon ? typeIcon.className : 'bg-main text-[11px] leading-none',
            )}
          >
            {typeIcon ? <typeIcon.icon className="size-2.5" weight="bold" /> : n.emoji}
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className={clsx('min-w-0 flex-1 text-sm', n.read ? 'text-fg' : 'font-semibold')}>{text}</span>
            <span className="shrink-0 text-xs text-muted">{time}</span>
          </span>
          <span className="block truncate text-xs text-muted">{contextLabel}</span>
          {n.preview && <span className="mt-0.5 line-clamp-2 text-xs text-muted">{n.preview}</span>}
        </span>
        {!n.read && <span aria-hidden="true" className="mt-2 size-2 shrink-0 rounded-full bg-accent" />}
      </button>
      <ContextMenu point={menu.point} label={t('activity.itemMenu')} onClose={menu.close}>
        {n.read ? (
          <MenuItem icon={EnvelopeSimpleIcon} onSelect={() => run(() => markUnread(n.id))}>
            {t('chat.actions.markUnread')}
          </MenuItem>
        ) : (
          <MenuItem icon={EnvelopeOpenIcon} onSelect={() => run(() => markRead([n.id]))}>
            {t('chat.actions.markRead')}
          </MenuItem>
        )}
      </ContextMenu>
    </>
  );
}
