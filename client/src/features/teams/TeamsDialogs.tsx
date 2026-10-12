import clsx from 'clsx';
import { CheckIcon, GlobeHemisphereWestIcon, LockSimpleIcon } from '@phosphor-icons/react';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Dialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toaster';
import { api, ApiError } from '@/lib/api';
import type { ChannelSummary, WorkspaceMember, WorkspaceSummary } from '@/lib/types';
import { useAuthStore } from '@/stores/auth';
import { useWorkspacesStore } from '@/stores/workspaces';
import { MembersDialog } from './MembersDialog';
import { useTeamsDialogs } from './dialogStore';

/** Tile colours offered for new workgroups (same palette as the server). */
export const WORKSPACE_COLORS = ['#5B5FC7', '#0F7B6C', '#C4314B', '#CA5010', '#8764B8', '#038387', '#4F6BED', '#986F0B'];

const store = () => useWorkspacesStore.getState();

/** Renders whichever teams dialog is currently open. */
export function TeamsDialogs() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { dialog, close } = useTeamsDialogs();
  if (!dialog) return null;

  const isOpen = (workspaceId: string, channelId?: string) =>
    location.pathname.startsWith(`/teams/${workspaceId}/${channelId ?? ''}`);

  switch (dialog.kind) {
    case 'createWorkspace':
    case 'editWorkspace':
      return <WorkspaceFormDialog workspace={dialog.kind === 'editWorkspace' ? dialog.workspace : undefined} onClose={close} />;

    case 'leaveWorkspace':
      return (
        <ConfirmDialog
          open
          title={t('teams.leaveTitle', { name: dialog.workspace.name })}
          confirmLabel={t('teams.leave')}
          danger
          errors={{ last_owner: t('teams.errors.lastOwner') }}
          onClose={close}
          onConfirm={async () => {
            await store().leave(dialog.workspace.id);
            if (isOpen(dialog.workspace.id)) navigate('/teams', { replace: true });
          }}
        >
          {t('teams.leaveText')}
        </ConfirmDialog>
      );

    case 'deleteWorkspace':
      return (
        <ConfirmDialog
          open
          title={t('teams.deleteWorkspaceTitle', { name: dialog.workspace.name })}
          confirmLabel={t('message.delete')}
          danger
          onClose={close}
          onConfirm={async () => {
            await store().remove(dialog.workspace.id);
            if (isOpen(dialog.workspace.id)) navigate('/teams', { replace: true });
          }}
        >
          {t('teams.deleteWorkspaceText')}
        </ConfirmDialog>
      );

    case 'createChannel':
    case 'editChannel':
      return (
        <ChannelFormDialog
          workspace={dialog.workspace}
          channel={dialog.kind === 'editChannel' ? dialog.channel : undefined}
          onClose={close}
        />
      );

    case 'deleteChannel':
      return (
        <ConfirmDialog
          open
          title={t('teams.deleteChannelTitle', { name: dialog.channel.name })}
          confirmLabel={t('message.delete')}
          danger
          onClose={close}
          onConfirm={async () => {
            await store().deleteChannel(dialog.channel.id);
            if (isOpen(dialog.workspace.id, dialog.channel.id)) navigate(`/teams/${dialog.workspace.id}`, { replace: true });
          }}
        >
          {t('teams.deleteChannelText')}
        </ConfirmDialog>
      );

    case 'members':
      return <MembersDialog workspace={dialog.workspace} channel={dialog.channel} onClose={close} />;
  }
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold text-muted">{label}</span>
      {children}
      {hint && <span className="block text-xs text-subtle">{hint}</span>}
    </label>
  );
}

const inputClass = 'h-9 w-full rounded-md border border-line bg-input px-3 text-sm outline-none focus:border-accent';

function VisibilityChoice<T extends string>({
  name,
  value,
  onChange,
  options,
}: {
  name: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; icon: typeof LockSimpleIcon; title: string; text: string }[];
}) {
  return (
    <div role="radiogroup" aria-label={name} className="grid grid-cols-2 gap-2">
      {options.map((o) => (
        <label
          key={o.value}
          className={clsx(
            'flex cursor-pointer gap-2 rounded-md border p-2.5 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent',
            value === o.value ? 'border-accent bg-accent-soft' : 'border-line hover:bg-hover',
          )}
        >
          <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="sr-only" />
          <o.icon className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
          <span>
            <span className="block font-semibold">{o.title}</span>
            <span className="block text-xs text-muted">{o.text}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

function WorkspaceFormDialog({ workspace, onClose }: { workspace?: WorkspaceSummary; onClose: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const showToast = useToast((s) => s.show);
  const [name, setName] = useState(workspace?.name ?? '');
  const [description, setDescription] = useState(workspace?.description ?? '');
  const [visibility, setVisibility] = useState<'public' | 'private'>(workspace?.visibility ?? 'public');
  const [color, setColor] = useState(workspace?.color.toUpperCase() ?? WORKSPACE_COLORS[0]);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return;
    setBusy(true);
    try {
      const input = { name: name.trim(), description: description.trim(), visibility, color };
      if (workspace) {
        await store().update(workspace.id, input);
      } else {
        const created = await store().create(input);
        navigate(`/teams/${created.id}/${created.defaultChannelId}`);
      }
      onClose();
    } catch {
      showToast(t('auth.errors.generic'), 'error');
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose} title={workspace ? t('teams.editWorkspace') : t('teams.createWorkspace')} width={480}>
      <form onSubmit={submit} className="space-y-4">
        <Field label={t('teams.form.name')}>
          <input autoFocus required minLength={2} maxLength={60} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </Field>
        <Field label={t('teams.form.description')}>
          <textarea
            rows={2}
            maxLength={300}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full resize-none rounded-md border border-line bg-input px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </Field>
        <VisibilityChoice
          name={t('teams.form.visibility')}
          value={visibility}
          onChange={setVisibility}
          options={[
            { value: 'public', icon: GlobeHemisphereWestIcon, title: t('teams.form.public'), text: t('teams.form.publicHint') },
            { value: 'private', icon: LockSimpleIcon, title: t('teams.form.private'), text: t('teams.form.privateHint') },
          ]}
        />
        <div role="radiogroup" aria-label={t('teams.form.color')} className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-semibold text-muted">{t('teams.form.color')}</span>
          {WORKSPACE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              aria-label={c}
              onClick={() => setColor(c)}
              className="flex size-7 items-center justify-center rounded-md text-white"
              style={{ backgroundColor: c }}
            >
              {color === c && <CheckIcon className="size-4" weight="bold" aria-hidden="true" />}
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" variant="primary" disabled={busy || name.trim().length < 2}>
            {workspace ? t('common.save') : t('teams.create')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function ChannelFormDialog({ workspace, channel, onClose }: { workspace: WorkspaceSummary; channel?: ChannelSummary; onClose: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const showToast = useToast((s) => s.show);
  const meId = useAuthStore((s) => s.user?.id);
  const [name, setName] = useState(channel?.name ?? '');
  const [description, setDescription] = useState(channel?.description ?? '');
  const [type, setType] = useState<'standard' | 'private'>(channel?.type ?? 'standard');
  const [people, setPeople] = useState<WorkspaceMember[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (channel) return;
    api
      .get<{ members: WorkspaceMember[] }>(`/workspaces/${workspace.id}/members`)
      .then(({ members }) => setPeople(members.filter((m) => m.user.id !== meId)))
      .catch(() => setPeople([]));
  }, [workspace.id, channel, meId]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      if (channel) {
        await store().updateChannel(channel.id, { name: name.trim(), description: description.trim() || null });
      } else {
        const id = await store().createChannel(workspace.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          type,
          memberIds: type === 'private' ? selected : [],
        });
        navigate(`/teams/${workspace.id}/${id}`);
      }
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'name_taken') setError(t('teams.errors.nameTaken'));
      else showToast(t('auth.errors.generic'), 'error');
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose} title={channel ? t('teams.editChannel') : t('teams.addChannelTo', { name: workspace.name })} width={480}>
      <form onSubmit={submit} className="space-y-4">
        <Field label={t('teams.form.channelName')}>
          <input
            autoFocus
            required
            maxLength={50}
            value={name}
            aria-invalid={error !== null}
            aria-describedby={error ? 'channel-name-error' : undefined}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            className={clsx(inputClass, error && 'border-danger')}
          />
          {error && (
            <span id="channel-name-error" className="block text-xs text-danger">
              {error}
            </span>
          )}
        </Field>
        <Field label={t('teams.form.description')}>
          <input maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
        </Field>
        {!channel && (
          <>
            <VisibilityChoice
              name={t('teams.form.privacy')}
              value={type}
              onChange={setType}
              options={[
                { value: 'standard', icon: GlobeHemisphereWestIcon, title: t('teams.form.standard'), text: t('teams.form.standardHint') },
                { value: 'private', icon: LockSimpleIcon, title: t('teams.form.privateChannel'), text: t('teams.form.privateChannelHint') },
              ]}
            />
            {type === 'private' && (
              <fieldset className="space-y-1">
                <legend className="mb-1 text-xs font-semibold text-muted">{t('teams.form.channelMembers')}</legend>
                <ul className="max-h-48 overflow-y-auto rounded-md border border-line">
                  {people.map((m) => (
                    <li key={m.user.id}>
                      <label className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-sm hover:bg-hover">
                        <input
                          type="checkbox"
                          checked={selected.includes(m.user.id)}
                          onChange={(e) => setSelected((s) => (e.target.checked ? [...s, m.user.id] : s.filter((id) => id !== m.user.id)))}
                          className="accent-[var(--ui-accent)]"
                        />
                        <Avatar user={m.user} size="xs" />
                        <span className="flex-1 truncate">{m.user.name}</span>
                        <span className="text-xs text-subtle">{t(`teams.roles.${m.role}`)}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
            )}
          </>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" variant="primary" disabled={busy || !name.trim()}>
            {channel ? t('common.save') : t('teams.create')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
