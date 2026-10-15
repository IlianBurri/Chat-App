import clsx from 'clsx';
import { BellIcon, BellSlashIcon, EnvelopeOpenIcon, EnvelopeSimpleIcon, EyeSlashIcon, PushPinIcon, PushPinSlashIcon, SignOutIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { NavLink, useMatch, useNavigate } from 'react-router';
import { Avatar, GroupAvatar } from '@/components/ui/Avatar';
import { ContextMenu, useContextMenu } from '@/components/ui/ContextMenu';
import { MenuItem, MenuSeparator } from '@/components/ui/Menu';
import { useToast } from '@/components/ui/Toaster';
import { formatListTimestamp, previewText } from '@/lib/format';
import type { ChatSummary } from '@/lib/types';
import { chatTitle, directPartner, isUnread, useChatsStore } from '@/stores/chats';
import { useTypingNames } from '@/stores/typing';

export function ChatListItem({ chat, meId, now }: { chat: ChatSummary; meId: string | undefined; now: Date }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const showToast = useToast((s) => s.show);
  const active = useMatch(`/chat/${chat.id}`) !== null;
  const typing = useTypingNames(chat.id);
  const menu = useContextMenu();
  const title = chatTitle(chat, meId);
  const partner = directPartner(chat, meId);
  const unread = isUnread(chat);
  const last = chat.lastMessage;

  let preview = '';
  if (last) {
    const text = last.deleted
      ? t('chat.deletedMessage')
      : last.type === 'system'
        ? t('chat.systemPreview')
        : last.type === 'poll'
          ? `📊 ${last.content ?? ''}`
          : last.content
            ? previewText(last.content)
            : last.fileName
              ? `📎 ${last.fileName}`
              : '';
    const author = last.author.id === meId ? t('common.you') : last.author.name.split(' ')[0];
    preview = last.type !== 'system' && (chat.type === 'group' || last.author.id === meId) ? `${author}: ${text}` : text;
  }

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch {
      showToast(t('auth.errors.generic'), 'error');
    }
  };
  const { updateFlags, markRead, leave } = useChatsStore.getState();

  return (
    <>
      <NavLink
        to={`/chat/${chat.id}`}
        {...menu.triggerProps}
        className={clsx(
          'mx-2 flex items-center gap-3 rounded-md px-2 py-2 outline-offset-[-2px]',
          active ? 'bg-selected shadow-card' : 'hover:bg-hover',
        )}
      >
        {partner ? <Avatar user={partner} showStatus /> : <GroupAvatar members={chat.members.filter((m) => m.id !== meId)} />}
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className={clsx('flex-1 truncate', unread ? 'font-bold' : 'font-medium')}>{title}</span>
            {last && (
              <time dateTime={last.createdAt} className={clsx('shrink-0 text-xs', unread ? 'font-semibold text-fg' : 'text-subtle')}>
                {formatListTimestamp(new Date(last.createdAt), now, i18n.resolvedLanguage, { yesterday: t('chat.yesterday') })}
              </time>
            )}
          </span>
          <span className="flex items-center gap-2">
            {typing.length > 0 ? (
              <span className="flex-1 truncate text-xs text-accent italic">{t('chat.typingShort')}</span>
            ) : (
              <span className={clsx('flex-1 truncate text-xs', unread ? 'font-semibold text-fg' : 'text-muted')}>{preview}</span>
            )}
            {chat.muted && <BellSlashIcon className="size-3.5 shrink-0 text-subtle" aria-label={t('chat.muted')} />}
            {unread && <span role="img" className="size-2 shrink-0 rounded-full bg-accent" aria-label={t('nav.unreadBadge', { count: chat.unreadCount || 1 })} />}
          </span>
        </span>
      </NavLink>

      <ContextMenu point={menu.point} label={t('chat.actions.menu', { name: title })} onClose={menu.close}>
        <MenuItem icon={chat.pinned ? PushPinSlashIcon : PushPinIcon} onSelect={() => void run(() => updateFlags(chat.id, { pinned: !chat.pinned }))}>
          {chat.pinned ? t('chat.actions.unpin') : t('chat.actions.pin')}
        </MenuItem>
        <MenuItem icon={chat.muted ? BellIcon : BellSlashIcon} onSelect={() => void run(() => updateFlags(chat.id, { muted: !chat.muted }))}>
          {chat.muted ? t('chat.actions.unmute') : t('chat.actions.mute')}
        </MenuItem>
        {unread ? (
          <MenuItem icon={EnvelopeOpenIcon} onSelect={() => void run(() => markRead(chat.id))}>
            {t('chat.actions.markRead')}
          </MenuItem>
        ) : (
          <MenuItem
            icon={EnvelopeSimpleIcon}
            onSelect={() =>
              void run(async () => {
                if (active) navigate('/chat');
                await updateFlags(chat.id, { markedUnread: true });
              })
            }
          >
            {t('chat.actions.markUnread')}
          </MenuItem>
        )}
        <MenuItem
          icon={EyeSlashIcon}
          onSelect={() =>
            void run(async () => {
              if (active) navigate('/chat');
              await updateFlags(chat.id, { hidden: true });
            })
          }
        >
          {t('chat.actions.hide')}
        </MenuItem>
        {chat.type === 'group' && (
          <>
            <MenuSeparator />
            <MenuItem
              icon={SignOutIcon}
              danger
              onSelect={() =>
                void run(async () => {
                  if (active) navigate('/chat');
                  await leave(chat.id);
                })
              }
            >
              {t('chat.actions.leave')}
            </MenuItem>
          </>
        )}
      </ContextMenu>
    </>
  );
}
