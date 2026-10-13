import clsx from 'clsx';
import { BellSlashIcon, CaretRightIcon, DotsThreeIcon, LockSimpleIcon, PlusIcon, UserPlusIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { ContextMenu, useContextMenu } from '@/components/ui/ContextMenu';
import { IconButton } from '@/components/ui/IconButton';
import { Menu } from '@/components/ui/Menu';
import type { ChannelSummary, WorkspaceSummary } from '@/lib/types';
import { useWorkspacesStore } from '@/stores/workspaces';
import { ChannelMenuItems, WorkspaceMenuItems } from './TeamsMenus';
import { useTeamsDialogs } from './dialogStore';
import { WorkspaceTile } from './WorkspaceTile';

export function TeamsList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { workspaces, loaded, error, load } = useWorkspacesStore();
  const openDialog = useTeamsDialogs((s) => s.open);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 px-4">
        <h1 className="flex-1 truncate text-lg font-semibold">{t('teams.title')}</h1>
        <IconButton label={t('teams.createWorkspace')} icon={PlusIcon} onClick={() => openDialog({ kind: 'createWorkspace' })} />
      </header>
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
        ) : workspaces.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">{t('teams.empty')}</p>
        ) : (
          <ul>
            {workspaces.map((w) => (
              <WorkspaceGroup key={w.id} workspace={w} />
            ))}
          </ul>
        )}
      </div>
      <div className="border-t border-line p-3">
        <Button icon={UserPlusIcon} className="w-full" onClick={() => navigate('/teams/discover')}>
          {t('teams.joinOrCreate')}
        </Button>
      </div>
    </div>
  );
}

function WorkspaceGroup({ workspace }: { workspace: WorkspaceSummary }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);
  const [showHidden, setShowHidden] = useState(false);
  const channelsId = `ws-${workspace.id}-channels`;
  const visible = workspace.channels.filter((c) => !c.hidden);
  const hidden = workspace.channels.filter((c) => c.hidden);
  const hasUnread = !open && workspace.channels.some((c) => c.unread && !c.muted);

  return (
    <li className="mb-1">
      <div className="group/ws relative mx-2 flex items-center rounded-md hover:bg-hover">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={channelsId}
          aria-label={open ? t('teams.collapse', { name: workspace.name }) : t('teams.expand', { name: workspace.name })}
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left"
        >
          <CaretRightIcon className={clsx('size-3.5 shrink-0 text-muted transition-transform', open && 'rotate-90')} aria-hidden="true" />
          <WorkspaceTile workspace={workspace} size={28} />
          <span className="min-w-0 flex-1">
            <span className={clsx('block truncate', hasUnread ? 'font-bold' : 'font-semibold')}>{workspace.name}</span>
            <span className="block truncate text-xs text-muted">
              {t(`teams.roles.${workspace.role}`)} · {t('teams.members', { count: workspace.memberCount })}
            </span>
          </span>
        </button>
        <div className="mr-1 opacity-0 group-focus-within/ws:opacity-100 group-hover/ws:opacity-100 has-[[aria-expanded=true]]:opacity-100">
          <Menu
            label={t('teams.workspaceOptions', { name: workspace.name })}
            width={240}
            trigger={({ ref, ...props }) => (
              <IconButton ref={ref} label={t('teams.workspaceOptions', { name: workspace.name })} icon={DotsThreeIcon} size="sm" {...props} />
            )}
          >
            <WorkspaceMenuItems workspace={workspace} />
          </Menu>
        </div>
      </div>
      {open && (
        <ul id={channelsId} className="mt-0.5 space-y-px">
          {visible.map((c) => (
            <ChannelLink key={c.id} workspace={workspace} channel={c} />
          ))}
          {hidden.length > 0 && (
            <li>
              <button
                type="button"
                aria-expanded={showHidden}
                onClick={() => setShowHidden((v) => !v)}
                className="mx-2 w-[calc(100%-1rem)] rounded-md py-1 pr-2 pl-[3.75rem] text-left text-xs text-muted hover:bg-hover"
              >
                {showHidden ? t('teams.hideHidden') : t('teams.hiddenChannels', { count: hidden.length })}
              </button>
            </li>
          )}
          {showHidden && hidden.map((c) => <ChannelLink key={c.id} workspace={workspace} channel={c} />)}
        </ul>
      )}
    </li>
  );
}

function ChannelLink({ workspace, channel }: { workspace: WorkspaceSummary; channel: ChannelSummary }) {
  const { t } = useTranslation();
  const menu = useContextMenu();
  const name = channel.isDefault ? t('teams.general') : channel.name;
  const unread = channel.unread && !channel.muted;

  return (
    <li>
      <NavLink
        to={`/teams/${workspace.id}/${channel.id}`}
        {...menu.triggerProps}
        aria-label={unread ? t('teams.channelUnread', { name }) : undefined}
        className={({ isActive }) =>
          clsx(
            'mx-2 flex items-center gap-2 rounded-md py-1.5 pr-2 pl-[3.75rem] text-sm outline-offset-[-2px]',
            isActive ? 'bg-selected font-semibold shadow-card' : 'hover:bg-hover',
            unread && 'font-bold text-fg',
            channel.hidden && 'text-muted',
          )
        }
      >
        <span className="truncate">{name}</span>
        {channel.type === 'private' && <LockSimpleIcon className="size-3.5 shrink-0 text-subtle" aria-label={t('teams.privateChannel')} />}
        {channel.muted && <BellSlashIcon className="ml-auto size-3.5 shrink-0 text-subtle" aria-label={t('chat.muted')} />}
        {unread && <span role="img" aria-label={t('teams.unread')} className="ml-auto size-2 shrink-0 rounded-full bg-accent" />}
      </NavLink>
      <ContextMenu point={menu.point} label={t('teams.channelOptions')} onClose={menu.close}>
        <ChannelMenuItems workspace={workspace} channel={channel} />
      </ContextMenu>
    </li>
  );
}
