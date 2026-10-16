import { PhoneIcon, PhoneXIcon, VideoCameraIcon } from '@phosphor-icons/react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useCallStore } from '@/stores/call';
import { InCall } from './InCall';
import { Lobby } from './Lobby';
import { startRingtone, stopRingtone } from './ringtone';
import { answerCall, declineCall, incomingTitle } from './startCall';
import { BigAvatar } from './Tile';
import type { IncomingCall as IncomingCallDto } from './types';

function IncomingCallCard({ call }: { call: IncomingCallDto }) {
  const { t } = useTranslation();
  const heading = t('calls.incoming.title', { name: call.caller.name });
  return (
    <section
      role="alertdialog"
      aria-label={heading}
      data-testid="incoming-call"
      className="pointer-events-auto w-80 rounded-lg border border-line bg-main p-4 text-fg shadow-pop"
    >
      <div className="flex items-center gap-3">
        <BigAvatar user={call.caller} size={48} />
        <div className="min-w-0">
          <p className="truncate font-semibold">{heading}</p>
          <p className="truncate text-sm text-muted">
            {!call.direct && call.title ? `${incomingTitle(call)} · ` : ''}
            {t(call.media === 'video' ? 'calls.incoming.video' : 'calls.incoming.audio')}
          </p>
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => declineCall(call)}
          aria-label={t('calls.incoming.decline')}
          className="flex size-10 items-center justify-center rounded-full bg-[#c4314b] text-white hover:bg-[#a72a40]"
        >
          <PhoneXIcon className="size-5" weight="fill" />
        </button>
        <button
          type="button"
          onClick={() => void answerCall(call, 'audio')}
          aria-label={t('calls.incoming.acceptAudio')}
          className="flex size-10 items-center justify-center rounded-full bg-success text-white hover:opacity-90"
        >
          <PhoneIcon className="size-5" weight="fill" />
        </button>
        <button
          type="button"
          onClick={() => void answerCall(call, 'video')}
          aria-label={t('calls.incoming.acceptVideo')}
          className="flex size-10 items-center justify-center rounded-full bg-success text-white hover:opacity-90"
        >
          <VideoCameraIcon className="size-5" weight="fill" />
        </button>
      </div>
    </section>
  );
}

/** Lobby, running call and incoming-call cards; mounted once in the app shell. */
export function CallOverlay() {
  const phase = useCallStore((s) => s.phase);
  const incoming = useCallStore((s) => s.incoming);
  const ringing = incoming.length > 0;

  useEffect(() => {
    if (ringing) startRingtone();
    else stopRingtone();
    return stopRingtone;
  }, [ringing]);

  return (
    <>
      {(phase === 'lobby' || phase === 'joining') && <Lobby />}
      {phase === 'in-call' && <InCall />}
      {ringing && (
        <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex flex-col gap-2">
          {incoming.map((call) => (
            <IncomingCallCard key={call.key} call={call} />
          ))}
        </div>
      )}
    </>
  );
}
