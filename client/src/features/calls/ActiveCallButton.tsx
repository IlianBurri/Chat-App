import { VideoCameraIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useNow } from '@/lib/useNow';
import { callKey, useCallStore } from '@/stores/call';
import { formatDuration } from './callMath';
import { joinActiveCall } from './startCall';
import type { CallTarget } from './types';

/** The running call of a chat, channel or meeting, if any (and if we are not in it already). */
export function useActiveCall(target: CallTarget | null) {
  const key = target ? callKey(target) : null;
  const call = useCallStore((s) => (key ? s.active[key] : undefined));
  const inThisCall = useCallStore((s) => s.phase !== 'idle' && s.target !== null && key !== null && callKey(s.target) === key);
  return inThisCall ? undefined : call;
}

/** Green "Join · 03:12" button shown in headers while a call runs there. */
export function ActiveCallButton({ target, title }: { target: CallTarget; title: string }) {
  const { t } = useTranslation();
  const call = useActiveCall(target);
  const now = useNow(1000);
  if (!call) return null;
  return (
    <button
      type="button"
      onClick={() => joinActiveCall(call, title)}
      aria-label={t('calls.joinRunning', { count: call.userIds.length })}
      data-testid="join-active-call"
      className="inline-flex h-8 items-center gap-1.5 rounded-md bg-success px-3 text-sm font-semibold text-white hover:opacity-90"
    >
      <VideoCameraIcon className="size-4" weight="fill" aria-hidden="true" />
      {t('meetings.join')}
      <span className="font-normal tabular-nums opacity-90">{formatDuration(now.getTime() - call.startedAt)}</span>
    </button>
  );
}
