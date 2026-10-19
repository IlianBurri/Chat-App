import clsx from 'clsx';
import { HandPalmIcon, MicrophoneSlashIcon, PushPinIcon, WarningIcon } from '@phosphor-icons/react';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { avatarColor, initials } from '@/lib/format';
import type { FloatingReaction } from '@/stores/call';
import { VideoView } from './media';

/** Large initials (or photo) for people without camera. */
export function BigAvatar({ user, size }: { user: { id: string; name: string; avatarUrl: string | null }; size: number }) {
  if (user.avatarUrl) return <img src={user.avatarUrl} alt="" className="rounded-full object-cover" style={{ width: size, height: size }} />;
  // Initials as generated content, like Avatar.
  return (
    <span
      aria-hidden="true"
      data-initials={initials(user.name)}
      className="flex items-center justify-center rounded-full font-semibold text-white before:content-[attr(data-initials)]"
      style={{ width: size, height: size, backgroundColor: avatarColor(user.id), fontSize: size * 0.36 }}
    />
  );
}

export interface TileData {
  /** Socket id (or "self") */
  id: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  stream: MediaStream | null;
  mic: boolean;
  camera: boolean;
  screen: boolean;
  hand: boolean;
  speaking: boolean;
  self: boolean;
  connection: 'connecting' | 'connected' | 'failed';
}

interface TileProps {
  tile: TileData;
  reactions: FloatingReaction[];
  pinned: boolean;
  onTogglePin?: () => void;
  style?: CSSProperties;
  compact?: boolean;
}

export function Tile({ tile, reactions, pinned, onTogglePin, style, compact }: TileProps) {
  const { t } = useTranslation();
  const hasVideo = (tile.camera || tile.screen) && (tile.stream?.getVideoTracks().length ?? 0) > 0;
  const label = tile.self ? t('calls.you', { name: tile.name }) : tile.name;

  return (
    <div
      data-testid="call-tile"
      data-speaking={tile.speaking ? 'true' : 'false'}
      aria-label={[label, !tile.mic && t('calls.muted'), tile.hand && t('calls.handRaised'), tile.speaking && t('calls.speaking')].filter(Boolean).join(', ')}
      role="group"
      className={clsx(
        'group relative overflow-hidden rounded-lg bg-[#2b2b33] ring-inset transition-shadow',
        tile.speaking ? 'ring-[3px] ring-accent' : 'ring-0',
      )}
      style={style}
    >
      {hasVideo ? (
        <VideoView stream={tile.stream} mirrored={tile.self && !tile.screen} contain={tile.screen} />
      ) : (
        <div className="flex size-full items-center justify-center">
          <BigAvatar user={{ id: tile.userId, name: tile.name, avatarUrl: tile.avatarUrl }} size={compact ? 48 : 96} />
        </div>
      )}

      {tile.connection === 'failed' && (
        <span className="absolute top-2 left-2 flex items-center gap-1 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
          <WarningIcon className="size-3.5 text-warning" aria-hidden="true" />
          {t('calls.connectionFailed')}
        </span>
      )}
      {tile.hand && (
        <span className="absolute top-2 right-2 flex size-8 items-center justify-center rounded-full bg-warning text-black" aria-hidden="true">
          <HandPalmIcon className="size-5" weight="fill" />
        </span>
      )}
      {onTogglePin && !compact && (
        <button
          type="button"
          onClick={onTogglePin}
          aria-label={pinned ? t('calls.unpin', { name: tile.name }) : t('calls.pin', { name: tile.name })}
          className={clsx(
            'absolute top-2 left-2 flex size-8 items-center justify-center rounded-full bg-black/55 text-white transition-opacity focus-visible:opacity-100',
            pinned ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
          )}
        >
          <PushPinIcon className="size-4" weight={pinned ? 'fill' : 'regular'} />
        </button>
      )}

      <span className="absolute bottom-2 left-2 flex max-w-[calc(100%-1rem)] items-center gap-1 truncate rounded bg-black/55 px-2 py-0.5 text-xs text-white">
        {!tile.mic && <MicrophoneSlashIcon className="size-3.5 shrink-0" aria-hidden="true" />}
        <span className="truncate">{tile.screen ? t('calls.presenting', { name: label }) : label}</span>
      </span>

      <div className="pointer-events-none absolute inset-x-0 bottom-8 flex justify-center" aria-hidden="true">
        {reactions.map((r) => (
          <span key={r.id} className="animate-float-up absolute text-4xl">
            {r.emoji}
          </span>
        ))}
      </div>
    </div>
  );
}
