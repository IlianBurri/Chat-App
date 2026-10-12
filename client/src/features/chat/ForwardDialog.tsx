import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar, GroupAvatar } from '@/components/ui/Avatar';
import { Dialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toaster';
import { previewText } from '@/lib/format';
import type { MessageDto } from '@/lib/types';
import { useAuthStore } from '@/stores/auth';
import { chatTitle, directPartner, useChatsStore } from '@/stores/chats';
import { useMessagesStore } from '@/stores/messages';

/** Pick a chat to forward a message to. */
export function ForwardDialog({ message, onClose }: { message: MessageDto | null; onClose: () => void }) {
  const { t } = useTranslation();
  const meId = useAuthStore((s) => s.user?.id);
  const chats = useChatsStore((s) => s.chats);
  const forward = useMessagesStore((s) => s.forward);
  const showToast = useToast((s) => s.show);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  const close = () => {
    setQuery('');
    onClose();
  };

  const targets = chats.filter((c) => c.id !== message?.chatId && chatTitle(c, meId).toLowerCase().includes(query.trim().toLowerCase()));

  const send = async (chatId: string, title: string) => {
    if (!message) return;
    setBusy(true);
    try {
      await forward(message.id, chatId);
      showToast(t('message.forwardedTo', { name: title }));
      close();
    } catch {
      showToast(t('auth.errors.generic'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={message !== null} onClose={close} title={t('message.forward')} width={440}>
      {message && (
        <div className="space-y-3">
          <p className="line-clamp-2 rounded-md bg-bubble px-3 py-2 text-sm text-muted">{previewText(message.content)}</p>
          <input
            autoFocus
            type="search"
            aria-label={t('chat.filterByName')}
            placeholder={t('chat.filterByName')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 w-full rounded-md border border-line bg-input px-2.5 text-sm outline-none focus:border-accent"
          />
          <ul className="max-h-72 space-y-px overflow-y-auto">
            {targets.map((c) => {
              const partner = directPartner(c, meId);
              const title = chatTitle(c, meId);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void send(c.id, title)}
                    className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-hover"
                  >
                    {partner ? <Avatar user={partner} size="sm" /> : <GroupAvatar members={c.members.filter((m) => m.id !== meId)} size="sm" />}
                    <span className="truncate">{title}</span>
                  </button>
                </li>
              );
            })}
            {targets.length === 0 && <li className="px-2 py-4 text-sm text-muted">{t('chat.empty')}</li>}
          </ul>
        </div>
      )}
    </Dialog>
  );
}
