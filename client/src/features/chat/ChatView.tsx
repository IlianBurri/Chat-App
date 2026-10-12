import { Ellipsis, MessageCircle, MessagesSquare, Phone, Users, Video } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Navigate, useParams } from 'react-router';
import { EmptyState } from '@/components/layout/PlaceholderView';
import { Avatar, GroupAvatar } from '@/components/ui/Avatar';
import { useComingSoon } from '@/components/ui/ComingSoon';
import { IconButton } from '@/components/ui/IconButton';
import { Tabs } from '@/components/ui/Tabs';
import { useAuthStore } from '@/stores/auth';
import { chatTitle, directPartner, useChatsStore } from '@/stores/chats';
import { useStatus } from '@/stores/presence';

export function ChatView() {
  const { t } = useTranslation();
  const { chatId } = useParams();
  const me = useAuthStore((s) => s.user);
  const { chats, loaded } = useChatsStore();
  const showComingSoon = useComingSoon((s) => s.show);
  const chat = chats.find((c) => c.id === chatId);

  if (!chat) return loaded ? <Navigate to="/chat" replace /> : <main className="flex-1 bg-main" />;

  const partner = directPartner(chat, me?.id);
  const title = chatTitle(chat, me?.id);

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-main">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-4">
        {partner ? <Avatar user={partner} showStatus /> : <GroupAvatar members={chat.members.filter((m) => m.id !== me?.id)} />}
        <div className="min-w-0">
          <h1 className="truncate text-base leading-tight font-semibold">{title}</h1>
          {partner ? (
            <PartnerStatus userId={partner.id} fallback={partner.status} message={partner.statusMessage} />
          ) : (
            <p className="text-xs text-muted">{t('chat.groupMembers', { count: chat.members.length })}</p>
          )}
        </div>
        <Tabs
          label={title}
          className="ml-3"
          active="chat"
          tabs={[
            { id: 'chat', label: t('chat.tabs.chat') },
            { id: 'files', label: t('chat.tabs.files'), onSelect: () => showComingSoon(t('chat.tabs.files')) },
          ]}
          onAdd={() => showComingSoon(t('chat.tabs.add'))}
          addLabel={t('chat.tabs.add')}
        />
        <div className="ml-auto flex items-center gap-1">
          <IconButton label={t('chat.videoCall')} icon={Video} onClick={() => showComingSoon(t('chat.videoCall'))} />
          <IconButton label={t('chat.audioCall')} icon={Phone} onClick={() => showComingSoon(t('chat.audioCall'))} />
          <IconButton label={t('chat.participants')} icon={Users} onClick={() => showComingSoon(t('chat.participants'))} />
          <IconButton label={t('common.more')} icon={Ellipsis} onClick={() => showComingSoon(t('common.more'))} />
        </div>
      </header>
      <EmptyState icon={MessagesSquare} title={title} text={t('chat.milestoneMessages')} />
    </main>
  );
}

function PartnerStatus({ userId, fallback, message }: { userId: string; fallback: Parameters<typeof useStatus>[1]; message: string | null }) {
  const { t } = useTranslation();
  const status = useStatus(userId, fallback);
  return (
    <p className="truncate text-xs text-muted">
      {status === 'offline' ? t('status.offlineShort') : t(`status.${status}`)}
      {message && ` · ${message}`}
    </p>
  );
}

export function ChatEmpty() {
  const { t } = useTranslation();
  return (
    <main className="flex flex-1 bg-main">
      <EmptyState icon={MessageCircle} title={t('chat.selectChat')} text={t('chat.selectChatHint')} />
    </main>
  );
}
