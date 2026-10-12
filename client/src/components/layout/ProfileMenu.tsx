import { ArrowCounterClockwiseIcon, ChatTextIcon, SignOutIcon } from '@phosphor-icons/react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Menu, MenuItem, MenuLabel, MenuSeparator } from '@/components/ui/Menu';
import { StatusIcon } from '@/components/ui/StatusIcon';
import { Tooltip } from '@/components/ui/Tooltip';
import { STATUSES, type Me } from '@/lib/types';
import { useAuthStore } from '@/stores/auth';
import { useStatus } from '@/stores/presence';

export function ProfileMenu({ user }: { user: Me }) {
  const { t } = useTranslation();
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const logout = useAuthStore((s) => s.logout);
  const status = useStatus(user.id, user.status);
  const [messageOpen, setMessageOpen] = useState(false);

  return (
    <>
      <Menu
        label={t('status.profileMenu')}
        width={280}
        trigger={({ ref, ...props }) => (
          <Tooltip label={user.name}>
            <button ref={ref} type="button" aria-label={t('status.profileMenu')} className="rounded-full" {...props}>
              <Avatar user={{ ...user, status }} size="sm" showStatus />
            </button>
          </Tooltip>
        )}
      >
        <div className="flex items-center gap-3 px-3 pt-2 pb-3">
          <Avatar user={{ ...user, status }} size="lg" showStatus />
          <div className="min-w-0">
            <p className="truncate font-semibold">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
            {user.statusMessage && <p className="mt-0.5 truncate text-xs text-fg">{user.statusMessage}</p>}
          </div>
        </div>
        <MenuSeparator />
        <MenuLabel>{t('status.setStatus')}</MenuLabel>
        {STATUSES.map((s) => (
          <MenuItem
            key={s}
            leading={<StatusIcon status={s} size={12} />}
            checked={user.manualStatus === s}
            onSelect={() => void updateProfile({ manualStatus: s })}
          >
            {t(`status.${s}`)}
          </MenuItem>
        ))}
        <MenuItem icon={ArrowCounterClockwiseIcon} checked={user.manualStatus === null} onSelect={() => void updateProfile({ manualStatus: null })}>
          {t('status.automatic')}
        </MenuItem>
        <MenuSeparator />
        <MenuItem icon={ChatTextIcon} onSelect={() => setMessageOpen(true)}>
          {t('status.message')}
        </MenuItem>
        <MenuSeparator />
        <MenuItem icon={SignOutIcon} onSelect={() => void logout()}>
          {t('auth.signOut')}
        </MenuItem>
      </Menu>
      <StatusMessageDialog
        key={String(messageOpen)}
        open={messageOpen}
        initial={user.statusMessage ?? ''}
        onClose={() => setMessageOpen(false)}
        onSave={(statusMessage) => updateProfile({ statusMessage })}
      />
    </>
  );
}

interface StatusMessageDialogProps {
  open: boolean;
  initial: string;
  onClose: () => void;
  onSave: (message: string | null) => Promise<void>;
}

function StatusMessageDialog({ open, initial, onClose, onSave }: StatusMessageDialogProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);

  const save = async (message: string | null) => {
    setSaving(true);
    try {
      await onSave(message);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void save(value.trim() || null);
  };

  return (
    <Dialog open={open} onClose={onClose} title={t('status.message')}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <textarea
            aria-label={t('status.message')}
            placeholder={t('status.messagePlaceholder')}
            value={value}
            maxLength={280}
            rows={3}
            autoFocus
            onChange={(e) => setValue(e.target.value)}
            className="w-full resize-none rounded-md border border-line bg-input p-2 text-sm outline-none focus:border-accent"
          />
          <p className="text-right text-xs text-subtle">{value.length}/280</p>
        </div>
        <div className="flex justify-between gap-2">
          <Button variant="ghost" disabled={saving || !initial} onClick={() => void save(null)}>
            {t('status.messageClear')}
          </Button>
          <div className="flex gap-2">
            <Button onClick={onClose}>{t('common.cancel')}</Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {t('common.save')}
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
