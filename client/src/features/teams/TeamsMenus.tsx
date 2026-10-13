import { BellIcon, BellSlashIcon, EyeIcon, EyeSlashIcon, GearSixIcon, PlusIcon, SignOutIcon, TrashIcon, UsersThreeIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { MenuItem, MenuSeparator } from '@/components/ui/Menu';
import { useToast } from '@/components/ui/Toaster';
import type { ChannelSummary, WorkspaceSummary } from '@/lib/types';
import { useWorkspacesStore } from '@/stores/workspaces';
import { useTeamsDialogs } from './dialogStore';

/** Entries of a workgroup's ⋯ menu; owner-only actions are left out for everyone else. */
export function WorkspaceMenuItems({ workspace }: { workspace: WorkspaceSummary }) {
  const { t } = useTranslation();
  const open = useTeamsDialogs((s) => s.open);
  const can = workspace.permissions;
  return (
    <>
      {can.manageChannels && (
        <MenuItem icon={PlusIcon} onSelect={() => open({ kind: 'createChannel', workspace })}>
          {t('teams.addChannel')}
        </MenuItem>
      )}
      <MenuItem icon={UsersThreeIcon} onSelect={() => open({ kind: 'members', workspace })}>
        {can.manageMembers ? t('teams.manageMembers') : t('teams.showMembers')}
      </MenuItem>
      {can.manageWorkspace && (
        <MenuItem icon={GearSixIcon} onSelect={() => open({ kind: 'editWorkspace', workspace })}>
          {t('teams.editWorkspace')}
        </MenuItem>
      )}
      <MenuSeparator />
      <MenuItem icon={SignOutIcon} onSelect={() => open({ kind: 'leaveWorkspace', workspace })}>
        {t('teams.leaveWorkspace')}
      </MenuItem>
      {can.manageWorkspace && (
        <MenuItem icon={TrashIcon} danger onSelect={() => open({ kind: 'deleteWorkspace', workspace })}>
          {t('teams.deleteWorkspace')}
        </MenuItem>
      )}
    </>
  );
}

/** Entries of a channel's ⋯ / right-click menu: personal settings plus owner actions. */
export function ChannelMenuItems({ workspace, channel }: { workspace: WorkspaceSummary; channel: ChannelSummary }) {
  const { t } = useTranslation();
  const open = useTeamsDialogs((s) => s.open);
  const showToast = useToast((s) => s.show);
  const can = workspace.permissions;
  const update = (flags: { muted?: boolean; hidden?: boolean }) =>
    useWorkspacesStore.getState().updateFlags(channel.id, flags).catch(() => showToast(t('auth.errors.generic'), 'error'));

  return (
    <>
      <MenuItem icon={channel.muted ? BellIcon : BellSlashIcon} onSelect={() => void update({ muted: !channel.muted })}>
        {channel.muted ? t('chat.actions.unmute') : t('chat.actions.mute')}
      </MenuItem>
      {!channel.isDefault && (
        <MenuItem icon={channel.hidden ? EyeIcon : EyeSlashIcon} onSelect={() => void update({ hidden: !channel.hidden })}>
          {channel.hidden ? t('teams.showChannel') : t('teams.hideChannel')}
        </MenuItem>
      )}
      <MenuItem icon={UsersThreeIcon} onSelect={() => open({ kind: 'members', workspace, channel })}>
        {t('chat.participants')}
      </MenuItem>
      {can.manageChannels && !channel.isDefault && (
        <>
          <MenuSeparator />
          <MenuItem icon={GearSixIcon} onSelect={() => open({ kind: 'editChannel', workspace, channel })}>
            {t('teams.editChannel')}
          </MenuItem>
          <MenuItem icon={TrashIcon} danger onSelect={() => open({ kind: 'deleteChannel', workspace, channel })}>
            {t('teams.deleteChannel')}
          </MenuItem>
        </>
      )}
    </>
  );
}
