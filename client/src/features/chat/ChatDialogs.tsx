import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toaster';
import { UserPicker } from '@/components/ui/UserPicker';
import type { ChatSummary, PublicUser } from '@/lib/types';
import { useChatsStore } from '@/stores/chats';

/** Adds people to a group chat; in a 1:1 chat it starts a new group with everyone. */
export function AddPeopleDialog({ chat, meId, open, onClose }: { chat: ChatSummary; meId: string; open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const showToast = useToast((s) => s.show);
  const [selected, setSelected] = useState<PublicUser[]>([]);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setSelected([]);
    onClose();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (selected.length === 0) return;
    setBusy(true);
    try {
      const ids = selected.map((u) => u.id);
      if (chat.type === 'group') {
        await useChatsStore.getState().addMembers(chat.id, ids);
      } else {
        const others = chat.members.filter((m) => m.id !== meId).map((m) => m.id);
        const group = await useChatsStore.getState().create({ memberIds: [...others, ...ids] });
        navigate(`/chat/${group.id}`);
      }
      close();
    } catch {
      showToast(t('auth.errors.generic'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={close} title={t('chat.addPeople')} width={480}>
      <form onSubmit={submit} className="space-y-4">
        {chat.type === 'direct' && <p className="text-sm text-muted">{t('chat.addPeopleDirectHint')}</p>}
        <UserPicker label={t('chat.addPeople')} selected={selected} onChange={setSelected} exclude={chat.members.map((m) => m.id)} autoFocus />
        <div className="flex justify-end gap-2">
          <Button onClick={close}>{t('common.cancel')}</Button>
          <Button type="submit" variant="primary" disabled={busy || selected.length === 0}>
            {t('chat.add')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function RenameChatDialog({ chat, open, onClose }: { chat: ChatSummary; open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const showToast = useToast((s) => s.show);
  const [name, setName] = useState(chat.name ?? '');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await useChatsStore.getState().rename(chat.id, name.trim());
      onClose();
    } catch {
      showToast(t('auth.errors.generic'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title={t('chat.actions.rename')} width={400}>
      <form onSubmit={submit} className="space-y-4">
        <input
          autoFocus
          aria-label={t('chat.groupName')}
          placeholder={t('chat.groupName')}
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-9 w-full rounded-md border border-line bg-input px-3 text-sm outline-none focus:border-accent"
        />
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
