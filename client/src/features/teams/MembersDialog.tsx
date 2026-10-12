import { CaretDownIcon, UserMinusIcon } from '@phosphor-icons/react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { IconButton } from '@/components/ui/IconButton';
import { Menu, MenuItem } from '@/components/ui/Menu';
import { useToast } from '@/components/ui/Toaster';
import { UserPicker } from '@/components/ui/UserPicker';
import { api, ApiError } from '@/lib/api';
import type { ChannelSummary, PublicUser, WorkspaceMember, WorkspaceRole, WorkspaceSummary } from '@/lib/types';
import { useAuthStore } from '@/stores/auth';
import { usePresenceStore } from '@/stores/presence';
import { useWorkspacesStore } from '@/stores/workspaces';

const ROLES: WorkspaceRole[] = ['owner', 'member', 'guest'];

interface MembersDialogProps {
  workspace: WorkspaceSummary;
  /** For private channels the dialog manages the channel's own members. */
  channel?: ChannelSummary;
  onClose: () => void;
}

/** Lists the people in a workgroup or channel; owners can add, remove and change roles. */
export function MembersDialog({ workspace, channel, onClose }: MembersDialogProps) {
  const { t } = useTranslation();
  const showToast = useToast((s) => s.show);
  const meId = useAuthStore((s) => s.user?.id);
  const [members, setMembers] = useState<WorkspaceMember[] | null>(null);
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([]);
  const [toAdd, setToAdd] = useState<PublicUser[]>([]);
  const [addRole, setAddRole] = useState<'member' | 'guest'>('member');
  const [busy, setBusy] = useState(false);

  const privateChannel = channel?.type === 'private' ? channel : undefined;
  const canManage = privateChannel ? workspace.permissions.manageChannels : workspace.permissions.manageMembers;
  const title = channel ? t('teams.membersOf', { name: channel.isDefault ? t('teams.general') : channel.name }) : t('teams.membersOf', { name: workspace.name });

  // Bumped after every change to reload the list.
  const [version, setVersion] = useState(0);
  const fetchMembers = useCallback(async () => {
    const path = channel ? `/channels/${channel.id}/members` : `/workspaces/${workspace.id}/members`;
    const { members: list } = await api.get<{ members: WorkspaceMember[] }>(path);
    const all = privateChannel && canManage ? (await api.get<{ members: WorkspaceMember[] }>(`/workspaces/${workspace.id}/members`)).members : [];
    return { list, all };
  }, [channel, privateChannel, canManage, workspace.id]);

  useEffect(() => {
    let cancelled = false;
    fetchMembers()
      .then(({ list, all }) => {
        if (cancelled) return;
        usePresenceStore.getState().setFromUsers(list.map((m) => m.user));
        setMembers(list);
        setWorkspaceMembers(all);
      })
      .catch(() => !cancelled && setMembers([]));
    return () => {
      cancelled = true;
    };
  }, [fetchMembers, workspace.memberCount, version]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      setVersion((v) => v + 1);
    } catch (e) {
      const code = e instanceof ApiError ? e.code : '';
      showToast(code === 'last_owner' ? t('teams.errors.lastOwner') : code === 'last_member' ? t('teams.errors.lastMember') : t('auth.errors.generic'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const ws = useWorkspacesStore.getState();
  const remove = (userId: string) =>
    run(() => (privateChannel ? api.delete(`/channels/${privateChannel.id}/members/${userId}`) : ws.removeMember(workspace.id, userId)));
  const add = () =>
    run(async () => {
      const ids = toAdd.map((u) => u.id);
      if (privateChannel) await api.post(`/channels/${privateChannel.id}/members`, { userIds: ids });
      else await ws.addMembers(workspace.id, ids, addRole);
      setToAdd([]);
    });

  const memberIds = (members ?? []).map((m) => m.user.id);
  const addable = workspaceMembers.filter((m) => !memberIds.includes(m.user.id));

  return (
    <Dialog open onClose={onClose} title={title} width={520}>
      <div className="space-y-4">
        {canManage && !privateChannel && (
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <UserPicker label={t('teams.addPeople')} placeholder={t('teams.addPeople')} selected={toAdd} onChange={setToAdd} exclude={memberIds} />
            </div>
            <select
              aria-label={t('teams.roleForNew')}
              value={addRole}
              onChange={(e) => setAddRole(e.target.value as 'member' | 'guest')}
              className="h-9 rounded-md border border-line bg-input px-2 text-sm"
            >
              <option value="member">{t('teams.roles.member')}</option>
              <option value="guest">{t('teams.roles.guest')}</option>
            </select>
            <Button variant="primary" className="h-9" disabled={busy || toAdd.length === 0} onClick={() => void add()}>
              {t('chat.add')}
            </Button>
          </div>
        )}

        {canManage && privateChannel && addable.length > 0 && (
          <div className="flex items-center gap-2">
            <select
              aria-label={t('teams.addPeople')}
              value=""
              onChange={(e) => {
                const member = addable.find((m) => m.user.id === e.target.value);
                if (member) void run(() => api.post(`/channels/${privateChannel.id}/members`, { userIds: [member.user.id] }));
              }}
              className="h-9 flex-1 rounded-md border border-line bg-input px-2 text-sm"
            >
              <option value="">{t('teams.addFromWorkspace')}</option>
              {addable.map((m) => (
                <option key={m.user.id} value={m.user.id}>
                  {m.user.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {members === null ? (
          <p className="py-4 text-sm text-muted">{t('common.loading')}</p>
        ) : (
          <ul aria-label={title} className="max-h-[50vh] divide-y divide-line overflow-y-auto rounded-md border border-line">
            {members.map((m) => {
              const me = m.user.id === meId;
              return (
                <li key={m.user.id} className="flex items-center gap-3 px-3 py-2">
                  <Avatar user={m.user} size="md" showStatus />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {m.user.name}
                      {me && <span className="ml-1 font-normal text-muted">({t('common.you')})</span>}
                    </p>
                    <p className="truncate text-xs text-muted">{m.user.jobTitle ?? m.user.email}</p>
                  </div>
                  {canManage && !privateChannel ? (
                    <Menu
                      label={t('teams.changeRole', { name: m.user.name })}
                      width={180}
                      trigger={({ ref, ...props }) => (
                        <Button ref={ref} size="sm" variant="ghost" aria-label={t('teams.changeRole', { name: m.user.name })} {...props}>
                          {t(`teams.roles.${m.role}`)}
                          <CaretDownIcon className="size-3" aria-hidden="true" />
                        </Button>
                      )}
                    >
                      {ROLES.map((role) => (
                        <MenuItem key={role} checked={m.role === role} onSelect={() => void run(() => ws.setRole(workspace.id, m.user.id, role))}>
                          {t(`teams.roles.${role}`)}
                        </MenuItem>
                      ))}
                    </Menu>
                  ) : (
                    <span className="text-xs text-muted">{t(`teams.roles.${m.role}`)}</span>
                  )}
                  {canManage && !me && (
                    <IconButton
                      label={t('teams.removeMember', { name: m.user.name })}
                      icon={UserMinusIcon}
                      size="sm"
                      disabled={busy}
                      onClick={() => void remove(m.user.id)}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Dialog>
  );
}
