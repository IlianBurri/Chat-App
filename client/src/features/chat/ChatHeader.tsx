import { BellIcon, BellSlashIcon, DotsThreeIcon, PencilSimpleIcon, PhoneIcon, PushPinIcon, PushPinSlashIcon, SignOutIcon, UserPlusIcon, UsersThreeIcon, VideoCameraIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Avatar, GroupAvatar, MeetingAvatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { useComingSoon } from '@/components/ui/ComingSoon';
import { IconButton } from '@/components/ui/IconButton';
import { Menu, MenuItem, MenuSeparator } from '@/components/ui/Menu';
import { Popover, usePopover } from '@/components/ui/Popover';
import { StatusIcon } from '@/components/ui/StatusIcon';
import { Tabs } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toaster';
import { ActiveCallButton, useActiveCall } from '@/features/calls/ActiveCallButton';
import { startChatCall } from '@/features/calls/startCall';
import type { ChatSummary, PublicUser, Status } from '@/lib/types';
import { chatTitle, directPartner, useChatsStore } from '@/stores/chats';
import { useStatus } from '@/stores/presence';
import { AddPeopleDialog, RenameChatDialog } from './ChatDialogs';

export type ChatTab = 'chat' | 'files';

interface ChatHeaderProps {
  chat: ChatSummary;
  meId: string;
  tab: ChatTab;
  onTabChange: (tab: ChatTab) => void;
}

export function ChatHeader({ chat, meId, tab, onTabChange }: ChatHeaderProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const showComingSoon = useComingSoon((s) => s.show);
  const showToast = useToast((s) => s.show);
  const { updateFlags, leave } = useChatsStore.getState();
  const [dialog, setDialog] = useState<'add' | 'rename' | null>(null);

  const partner = directPartner(chat, meId);
  const title = chatTitle(chat, meId);
  const isGroup = chat.type === 'group';
  const callTarget = { kind: 'chat' as const, id: chat.id };
  const running = useActiveCall(callTarget);

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch {
      showToast(t('auth.errors.generic'), 'error');
    }
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-4">
      {chat.meeting ? (
        <MeetingAvatar />
      ) : partner ? (
        <Avatar user={partner} showStatus />
      ) : (
        <GroupAvatar members={chat.members.filter((m) => m.id !== meId)} />
      )}
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
        active={tab}
        onChange={(id) => onTabChange(id as ChatTab)}
        tabs={[
          { id: 'chat', label: t('chat.tabs.chat') },
          { id: 'files', label: t('chat.tabs.files') },
        ]}
        onAdd={() => showComingSoon(t('chat.tabs.add'))}
        addLabel={t('chat.tabs.add')}
      />
      <div className="ml-auto flex items-center gap-1">
        <ActiveCallButton target={callTarget} title={title} />
        {!running && (
          <>
            <IconButton label={t('chat.videoCall')} icon={VideoCameraIcon} onClick={() => startChatCall(chat.id, title, 'video')} />
            <IconButton label={t('chat.audioCall')} icon={PhoneIcon} onClick={() => startChatCall(chat.id, title, 'audio')} />
          </>
        )}
        <Popover
          label={t('chat.participants')}
          placement="bottom-end"
          trigger={({ ref, ...props }) => <IconButton ref={ref} label={t('chat.participants')} icon={UsersThreeIcon} {...props} />}
        >
          <ParticipantsPanel chat={chat} meId={meId} onAdd={() => setDialog('add')} />
        </Popover>
        <Menu label={t('common.more')} trigger={({ ref, ...props }) => <IconButton ref={ref} label={t('common.more')} icon={DotsThreeIcon} {...props} />}>
          <MenuItem icon={chat.pinned ? PushPinSlashIcon : PushPinIcon} onSelect={() => void run(() => updateFlags(chat.id, { pinned: !chat.pinned }))}>
            {chat.pinned ? t('chat.actions.unpin') : t('chat.actions.pin')}
          </MenuItem>
          <MenuItem icon={chat.muted ? BellIcon : BellSlashIcon} onSelect={() => void run(() => updateFlags(chat.id, { muted: !chat.muted }))}>
            {chat.muted ? t('chat.actions.unmute') : t('chat.actions.mute')}
          </MenuItem>
          {isGroup && (
            <MenuItem icon={PencilSimpleIcon} onSelect={() => setDialog('rename')}>
              {t('chat.actions.rename')}
            </MenuItem>
          )}
          {isGroup && (
            <>
              <MenuSeparator />
              <MenuItem
                icon={SignOutIcon}
                danger
                onSelect={() =>
                  void run(async () => {
                    await leave(chat.id);
                    navigate('/chat');
                  })
                }
              >
                {t('chat.actions.leave')}
              </MenuItem>
            </>
          )}
        </Menu>
      </div>
      <AddPeopleDialog chat={chat} meId={meId} open={dialog === 'add'} onClose={() => setDialog(null)} />
      <RenameChatDialog key={String(dialog === 'rename')} chat={chat} open={dialog === 'rename'} onClose={() => setDialog(null)} />
    </header>
  );
}

function ParticipantsPanel({ chat, meId, onAdd }: { chat: ChatSummary; meId: string; onAdd: () => void }) {
  const { t } = useTranslation();
  const popover = usePopover();
  return (
    <div className="w-72 p-2">
      <p className="px-2 pt-1 pb-2 text-sm font-semibold">{t('chat.groupMembers', { count: chat.members.length })}</p>
      <ul className="max-h-72 overflow-y-auto">
        {chat.members.map((m) => (
          <MemberRow key={m.id} user={m} isMe={m.id === meId} />
        ))}
      </ul>
      <Button
        className="mt-2 w-full"
        icon={UserPlusIcon}
        onClick={() => {
          popover?.close();
          onAdd();
        }}
      >
        {t('chat.addPeople')}
      </Button>
    </div>
  );
}

function MemberRow({ user, isMe }: { user: PublicUser; isMe: boolean }) {
  const { t } = useTranslation();
  const status = useStatus(user.id, user.status);
  return (
    <li className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
      <Avatar user={user} size="sm" showStatus />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {user.name}
          {isMe && <span className="font-normal text-muted"> ({t('common.you')})</span>}
        </span>
        <span className="flex items-center gap-1 text-xs text-muted">
          <StatusIcon status={status} size={9} />
          {status === 'offline' ? t('status.offlineShort') : t(`status.${status}`)}
        </span>
      </span>
    </li>
  );
}

function PartnerStatus({ userId, fallback, message }: { userId: string; fallback: Status; message: string | null }) {
  const { t } = useTranslation();
  const status = useStatus(userId, fallback);
  return (
    <p className="truncate text-xs text-muted">
      {status === 'offline' ? t('status.offlineShort') : t(`status.${status}`)}
      {message && ` · ${message}`}
    </p>
  );
}
