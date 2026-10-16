import { HandPalmIcon, MicrophoneIcon, MicrophoneSlashIcon, PaperPlaneRightIcon, PhoneCallIcon, VideoCameraIcon, VideoCameraSlashIcon, XIcon } from '@phosphor-icons/react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { UserPicker } from '@/components/ui/UserPicker';
import type { PublicUser } from '@/lib/types';
import { useAuthStore } from '@/stores/auth';
import { useCallStore } from '@/stores/call';
import { inviteToCall, sendChat } from './session';
import { BigAvatar, type TileData } from './Tile';

function PanelHeader({ title }: { title: string }) {
  const { t } = useTranslation();
  const set = useCallStore((s) => s.set);
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-line px-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      <IconButton label={t('common.close')} icon={XIcon} size="sm" onClick={() => set({ panel: null })} />
    </header>
  );
}

export function PeoplePanel({ tiles }: { tiles: TileData[] }) {
  const { t } = useTranslation();
  const [invite, setInvite] = useState<PublicUser[]>([]);
  const [busy, setBusy] = useState(false);
  // Raised hands first, in the order they appear; then everyone else.
  const sorted = [...tiles].sort((a, b) => Number(b.hand) - Number(a.hand));

  const ring = async () => {
    setBusy(true);
    await inviteToCall(invite.map((u) => u.id));
    setInvite([]);
    setBusy(false);
  };

  return (
    <>
      <PanelHeader title={t('calls.peopleCount', { count: tiles.length })} />
      <div className="space-y-2 border-b border-line p-4">
        <UserPicker label={t('calls.invite')} placeholder={t('calls.invitePlaceholder')} selected={invite} onChange={setInvite} exclude={tiles.map((p) => p.userId)} />
        <Button size="sm" variant="primary" icon={PhoneCallIcon} disabled={invite.length === 0 || busy} onClick={() => void ring()}>
          {t('calls.ring')}
        </Button>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto py-2" aria-label={t('calls.inThisCall')}>
        {sorted.map((p) => (
          <li key={p.id} className="flex items-center gap-2 px-4 py-1.5 text-sm">
            <BigAvatar user={{ id: p.userId, name: p.name, avatarUrl: p.avatarUrl }} size={28} />
            <span className="min-w-0 flex-1 truncate">{p.self ? t('calls.you', { name: p.name }) : p.name}</span>
            {p.hand && <HandPalmIcon className="size-4 text-warning" weight="fill" aria-label={t('calls.handRaised')} />}
            {p.camera ? (
              <VideoCameraIcon className="size-4 text-muted" aria-label={t('calls.cameraOn')} />
            ) : (
              <VideoCameraSlashIcon className="size-4 text-subtle" aria-label={t('calls.cameraOff')} />
            )}
            {p.mic ? (
              <MicrophoneIcon className="size-4 text-muted" aria-label={t('calls.micOn')} />
            ) : (
              <MicrophoneSlashIcon className="size-4 text-danger" aria-label={t('calls.muted')} />
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

export function CallChatPanel({ tiles }: { tiles: TileData[] }) {
  const { t, i18n } = useTranslation();
  const meId = useAuthStore((s) => s.user?.id);
  const lines = useCallStore((s) => s.chat);
  const [text, setText] = useState('');
  const listRef = useRef<HTMLOListElement>(null);
  const nameOf = (userId: string) => (userId === meId ? t('common.you') : (tiles.find((p) => p.userId === userId)?.name ?? t('chat.someone')));

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [lines.length]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    setText('');
    void sendChat(value);
  };

  return (
    <>
      <PanelHeader title={t('calls.chat')} />
      <p className="border-b border-line px-4 py-2 text-xs text-muted">{t('calls.chatHint')}</p>
      <ol ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3" aria-live="polite" aria-label={t('calls.chat')}>
        {lines.length === 0 && <li className="text-sm text-muted">{t('calls.chatEmpty')}</li>}
        {lines.map((line) => (
          <li key={line.id} className="text-sm">
            <p className="text-xs text-muted">
              <span className="font-semibold text-fg">{nameOf(line.userId)}</span>{' '}
              {new Date(line.at).toLocaleTimeString(i18n.resolvedLanguage, { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="break-words whitespace-pre-wrap">{line.text}</p>
          </li>
        ))}
      </ol>
      <form onSubmit={submit} className="flex items-center gap-1 border-t border-line p-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={2000}
          placeholder={t('composer.placeholder')}
          aria-label={t('calls.chatInput')}
          className="h-9 min-w-0 flex-1 rounded-md border border-line bg-input px-3 text-sm outline-none focus:border-accent"
        />
        <IconButton label={t('composer.send')} icon={PaperPlaneRightIcon} type="submit" disabled={!text.trim()} />
      </form>
    </>
  );
}
