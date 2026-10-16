import clsx from 'clsx';
import { PhoneIcon, PhoneIncomingIcon, PhoneOutgoingIcon, PhoneXIcon, VideoCameraIcon } from '@phosphor-icons/react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { useToast } from '@/components/ui/Toaster';
import { UserPicker } from '@/components/ui/UserPicker';
import { api } from '@/lib/api';
import { formatListTimestamp } from '@/lib/format';
import { channelPath, chatPath, meetingPath } from '@/lib/links';
import type { PublicUser } from '@/lib/types';
import { useAuthStore } from '@/stores/auth';
import { useCallStore } from '@/stores/call';
import { chatTitle, useChatsStore } from '@/stores/chats';
import { formatDuration } from './callMath';
import { startChatCall } from './startCall';
import { BigAvatar } from './Tile';
import type { CallHistoryEntry, CallMedia } from './types';

/** Recent calls, refreshed whenever a call ends. */
function useCallHistory() {
  const [state, setState] = useState<{ calls: CallHistoryEntry[]; loaded: boolean; error: boolean }>({ calls: [], loaded: false, error: false });
  const phase = useCallStore((s) => s.phase);
  const activeCount = useCallStore((s) => Object.keys(s.active).length);

  const load = useCallback(async () => {
    try {
      const { calls } = await api.get<{ calls: CallHistoryEntry[] }>('/calls');
      setState({ calls, loaded: true, error: false });
    } catch {
      setState((s) => ({ ...s, loaded: true, error: true }));
    }
  }, []);

  useEffect(() => {
    // A short delay lets the server finish writing the call that just ended.
    const timer = window.setTimeout(() => void load(), 300);
    return () => window.clearTimeout(timer);
  }, [load, phase, activeCount]);

  return { ...state, reload: load };
}

function entryTitle(entry: CallHistoryEntry, t: (key: string) => string) {
  if (entry.title) return entry.target?.kind === 'channel' ? `# ${entry.title}` : entry.title;
  return entry.people.map((p) => p.name).join(', ') || t('chat.someone');
}

function HistoryItem({ entry, onCall }: { entry: CallHistoryEntry; onCall: (entry: CallHistoryEntry, media: CallMedia) => void }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const missed = entry.outcome === 'missed' || entry.outcome === 'declined' || (entry.outgoing && entry.joinedCount <= 1 && entry.target?.kind === 'chat');
  const Icon = missed ? PhoneXIcon : entry.outgoing ? PhoneOutgoingIcon : PhoneIncomingIcon;
  const title = entryTitle(entry, t);
  const person = entry.people.length === 1 ? entry.people[0] : null;
  const kind = missed ? (entry.outgoing ? 'unanswered' : entry.outcome === 'declined' ? 'declined' : 'missed') : entry.outgoing ? 'outgoing' : 'incoming';

  const open = () => {
    const target = entry.target;
    if (!target) return;
    if (target.kind === 'chat') void navigate(chatPath(target.id));
    else if (target.kind === 'channel' && entry.workspaceId) void navigate(channelPath(entry.workspaceId, target.id));
    else if (target.kind === 'meeting') void navigate(meetingPath(target.id));
  };

  return (
    <li className="group mx-2 flex items-center gap-3 rounded-md px-2 py-2 hover:bg-hover" data-testid="call-history-item">
      <button type="button" onClick={open} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        {person ? <BigAvatar user={person} size={32} /> : <BigAvatar user={{ id: entry.id, name: title, avatarUrl: null }} size={32} />}
        <span className="min-w-0 flex-1">
          <span className={clsx('block truncate text-sm font-medium', missed && 'text-danger')}>{title}</span>
          <span className="flex items-center gap-1 text-xs text-muted">
            <Icon className={clsx('size-3.5 shrink-0', missed && 'text-danger')} aria-hidden="true" />
            <span className="truncate">
              {t(`calls.history.${kind}`)} · {t(entry.media === 'video' ? 'calls.videoShort' : 'calls.audioShort')}
              {!missed && entry.seconds !== null ? ` · ${formatDuration(entry.seconds * 1000)}` : ''}
            </span>
          </span>
        </span>
        <time dateTime={entry.startedAt} className="shrink-0 text-xs text-subtle">
          {formatListTimestamp(new Date(entry.startedAt), new Date(), i18n.resolvedLanguage, { yesterday: t('chat.yesterday') })}
        </time>
      </button>
      {entry.target?.kind === 'chat' && (
        <span className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          <IconButton size="sm" label={t('calls.callBackAudio', { name: title })} icon={PhoneIcon} onClick={() => onCall(entry, 'audio')} />
          <IconButton size="sm" label={t('calls.callBackVideo', { name: title })} icon={VideoCameraIcon} onClick={() => onCall(entry, 'video')} />
        </span>
      )}
    </li>
  );
}

/** List pane of the Calls app: call history. */
export function CallsList() {
  const { t } = useTranslation();
  const { calls, loaded, error, reload } = useCallHistory();
  const callBack = (entry: CallHistoryEntry, media: CallMedia) => {
    if (entry.target?.kind === 'chat') startChatCall(entry.target.id, entryTitle(entry, t), media);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center px-4">
        <h1 className="text-lg font-semibold">{t('calls.title')}</h1>
      </header>
      <h2 className="px-4 pb-1 text-xs font-semibold text-muted">{t('calls.history.title')}</h2>
      <div className="min-h-0 flex-1 overflow-y-auto pb-3">
        {!loaded ? (
          <p className="px-4 py-6 text-sm text-muted">{t('common.loading')}</p>
        ) : error ? (
          <div className="px-4 py-6 text-sm">
            <p className="mb-2 text-muted">{t('auth.errors.generic')}</p>
            <Button size="sm" onClick={() => void reload()}>
              {t('common.retry')}
            </Button>
          </div>
        ) : calls.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">{t('calls.history.empty')}</p>
        ) : (
          <ul aria-label={t('calls.history.title')}>
            {calls.map((entry) => (
              <HistoryItem key={entry.id} entry={entry} onCall={callBack} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Main area of the Calls app: call one or more people directly. */
export function CallsView() {
  const { t } = useTranslation();
  const meId = useAuthStore((s) => s.user?.id);
  const createChat = useChatsStore((s) => s.create);
  const showToast = useToast((s) => s.show);
  const [people, setPeople] = useState<PublicUser[]>([]);
  const [busy, setBusy] = useState(false);

  // Calling people reuses (or creates) the chat with exactly them, so history and chat stay together.
  const call = async (media: CallMedia) => {
    setBusy(true);
    try {
      const chat = await createChat({ memberIds: people.map((p) => p.id) });
      startChatCall(chat.id, chatTitle(chat, meId), media);
      setPeople([]);
    } catch {
      showToast(t('auth.errors.generic'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex flex-1 flex-col overflow-hidden rounded-tl-lg bg-main">
      <header className="flex h-14 shrink-0 items-center border-b border-line px-5">
        <h1 className="text-lg font-semibold">{t('calls.dial.title')}</h1>
      </header>
      <div className="mx-auto mt-10 w-full max-w-md space-y-3 px-5">
        <p className="text-sm text-muted">{t('calls.dial.text')}</p>
        <UserPicker label={t('calls.dial.people')} placeholder={t('calls.invitePlaceholder')} selected={people} onChange={setPeople} exclude={meId ? [meId] : []} />
        <div className="flex gap-2">
          <Button variant="primary" icon={VideoCameraIcon} disabled={people.length === 0 || busy} onClick={() => void call('video')}>
            {t('calls.dial.video')}
          </Button>
          <Button icon={PhoneIcon} disabled={people.length === 0 || busy} onClick={() => void call('audio')}>
            {t('calls.dial.audio')}
          </Button>
        </div>
      </div>
    </main>
  );
}
