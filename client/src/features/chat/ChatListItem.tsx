import clsx from 'clsx';
import { BellOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';
import { Avatar, GroupAvatar } from '@/components/ui/Avatar';
import { formatListTimestamp, previewText } from '@/lib/format';
import type { ChatSummary } from '@/lib/types';
import { chatTitle, directPartner, isUnread } from '@/stores/chats';

export function ChatListItem({ chat, meId, now }: { chat: ChatSummary; meId: string | undefined; now: Date }) {
  const { t, i18n } = useTranslation();
  const title = chatTitle(chat, meId);
  const partner = directPartner(chat, meId);
  const unread = isUnread(chat);
  const last = chat.lastMessage;

  let preview = '';
  if (last) {
    const text = last.deleted ? t('chat.deletedMessage') : previewText(last.content ?? '');
    const author = last.author.id === meId ? t('common.you') : last.author.name.split(' ')[0];
    preview = chat.type === 'group' || last.author.id === meId ? `${author}: ${text}` : text;
  }

  return (
    <NavLink
      to={`/chat/${chat.id}`}
      className={({ isActive }) =>
        clsx(
          'mx-2 flex items-center gap-3 rounded-md px-2 py-2 outline-offset-[-2px]',
          isActive ? 'bg-selected shadow-card' : 'hover:bg-hover',
        )
      }
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
          <span className={clsx('flex-1 truncate text-xs', unread ? 'font-semibold text-fg' : 'text-muted')}>{preview}</span>
          {chat.muted && <BellOff className="size-3.5 shrink-0 text-subtle" aria-label={t('chat.muted')} />}
          {unread && <span className="size-2 shrink-0 rounded-full bg-accent" aria-label={t('nav.unreadBadge', { count: chat.unreadCount || 1 })} />}
        </span>
      </span>
    </NavLink>
  );
}
