import { PaperPlaneRightIcon, UsersFourIcon } from '@phosphor-icons/react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { MobileBack } from '@/components/layout/MobileBack';
import { EmptyState } from '@/components/layout/PlaceholderView';
import { IconButton } from '@/components/ui/IconButton';
import { useToast } from '@/components/ui/Toaster';
import { UserPicker } from '@/components/ui/UserPicker';
import type { PublicUser } from '@/lib/types';
import { useAuthStore } from '@/stores/auth';
import { useChatsStore } from '@/stores/chats';

/** "To:" field plus first message; sending creates (or reuses) the chat. */
export function NewChatView() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const meId = useAuthStore((s) => s.user?.id);
  const showToast = useToast((s) => s.show);
  const [people, setPeople] = useState<PublicUser[]>([]);
  const [groupName, setGroupName] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const isGroup = people.length > 1;
  const canSend = people.length > 0 && message.trim().length > 0 && !busy;

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!canSend) return;
    setBusy(true);
    try {
      const chat = await useChatsStore.getState().create({
        memberIds: people.map((p) => p.id),
        name: isGroup && groupName.trim() ? groupName.trim() : undefined,
        message: message.trim(),
      });
      navigate(`/chat/${chat.id}`, { replace: true });
    } catch {
      showToast(t('composer.sendFailed'), 'error');
      setBusy(false);
    }
  };

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-main">
      <header className="space-y-2 border-b border-line px-4 py-3 md:px-5">
        <div className="flex items-center gap-2">
          <MobileBack to="/chat" />
          <h1 className="text-base font-semibold">{t('chat.newChat')}</h1>
        </div>
        <div className="flex items-start gap-2">
          <span className="pt-2 text-sm text-muted">{t('chat.to')}</span>
          <div className="flex-1">
            <UserPicker label={t('chat.to')} selected={people} onChange={setPeople} exclude={meId ? [meId] : []} autoFocus />
          </div>
        </div>
        {isGroup && (
          <input
            aria-label={t('chat.groupNameOptional')}
            placeholder={t('chat.groupNameOptional')}
            maxLength={80}
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="ml-9 h-8 w-[calc(100%-2.25rem)] rounded-md border border-line bg-input px-2.5 text-sm outline-none focus:border-accent"
          />
        )}
      </header>
      <EmptyState icon={UsersFourIcon} title={t('chat.newChat')} text={t('chat.newChatHint')} />
      <form onSubmit={submit} className="px-5 pb-4">
        <div className="flex items-end rounded-lg border border-line bg-input shadow-card focus-within:border-accent">
          <textarea
            rows={2}
            aria-label={t('composer.placeholder')}
            placeholder={t('composer.placeholder')}
            value={message}
            disabled={people.length === 0}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void submit();
              }
            }}
            className="block flex-1 resize-none bg-transparent px-3 py-2.5 text-sm outline-none focus-visible:outline-none disabled:opacity-50"
          />
          <IconButton type="submit" label={t('composer.send')} icon={PaperPlaneRightIcon} className="m-1.5" disabled={!canSend} />
        </div>
      </form>
    </main>
  );
}
