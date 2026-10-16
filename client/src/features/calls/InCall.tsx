import clsx from 'clsx';
import {
  ChatTextIcon,
  CornersInIcon,
  CornersOutIcon,
  DotsThreeIcon,
  GearIcon,
  HandPalmIcon,
  MicrophoneIcon,
  MicrophoneSlashIcon,
  PhoneDisconnectIcon,
  ScreencastIcon,
  SmileyIcon,
  SparkleIcon,
  SquaresFourIcon,
  UserFocusIcon,
  UsersThreeIcon,
  VideoCameraIcon,
  VideoCameraSlashIcon,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react';
import { forwardRef, useEffect, useLayoutEffect, useMemo, useRef, useState, type ButtonHTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '@/components/ui/Dialog';
import { Menu, MenuItem, MenuSeparator } from '@/components/ui/Menu';
import { useNow } from '@/lib/useNow';
import { useAuthStore } from '@/stores/auth';
import { useCallStore } from '@/stores/call';
import { formatDuration, gridShape, pickSpotlight } from './callMath';
import { RemoteAudio } from './media';
import { CallChatPanel, PeoplePanel } from './Panels';
import { DeviceSettings, Switch } from './Lobby';
import { leaveCall, sendReaction, setBlur, setCamera, setHand, setMic, toggleScreenShare } from './session';
import { Tile, type TileData } from './Tile';
import { CALL_REACTIONS } from './types';

type CallButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: PhosphorIcon;
  label: string;
  /** Highlighted (e.g. a panel is open, the hand is raised) */
  active?: boolean;
  badge?: number;
  danger?: boolean;
};

/** Control-bar button: icon with a small label underneath. */
const CallButton = forwardRef<HTMLButtonElement, CallButtonProps>(function CallButton(
  { icon: Icon, label, active, badge, danger, className, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      className={clsx(
        'relative flex min-w-14 flex-col items-center gap-0.5 rounded-md px-2 py-1 text-[11px] outline-offset-2 transition-colors',
        danger ? 'bg-[#c4314b] px-3 text-white hover:bg-[#a72a40]' : active ? 'bg-white/15 text-white' : 'text-white/85 hover:bg-white/10',
        className,
      )}
      {...props}
    >
      <Icon className="size-5" weight={active ? 'fill' : 'regular'} aria-hidden="true" />
      <span aria-hidden="true">{label}</span>
      {badge ? (
        <span className="absolute top-0 right-1 min-w-4 rounded-full bg-[#c4314b] px-1 text-[10px] leading-4 font-semibold text-white">{badge}</span>
      ) : null}
    </button>
  );
});

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, ...size };
}

function ControlBar({ tiles, onOpenSettings }: { tiles: TileData[]; onOpenSettings: () => void }) {
  const { t } = useTranslation();
  const now = useNow(1000);
  const { title, startedAt, mic, camera, screen, hand, layout, panel, unreadChat, set } = useCallStore();
  const [fullscreen, setFullscreen] = useState(Boolean(document.fullscreenElement));

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const togglePanel = (which: 'chat' | 'people') => set({ panel: panel === which ? null : which, ...(which === 'chat' ? { unreadChat: 0 } : {}) });

  return (
    <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-white/10 bg-[#26262e] px-4 py-1.5 text-white">
      <div className="mr-auto min-w-0">
        <h1 className="truncate text-sm font-semibold">{title}</h1>
        <p className="text-xs text-white/70 tabular-nums" aria-label={t('calls.duration')} data-testid="call-duration">
          {formatDuration(startedAt ? now.getTime() - startedAt : 0)}
        </p>
      </div>

      <nav aria-label={t('calls.controls')} className="flex flex-wrap items-center gap-1">
        <CallButton icon={ChatTextIcon} label={t('calls.chat')} active={panel === 'chat'} aria-pressed={panel === 'chat'} badge={unreadChat} onClick={() => togglePanel('chat')} />
        <CallButton icon={UsersThreeIcon} label={t('calls.people')} active={panel === 'people'} aria-pressed={panel === 'people'} badge={tiles.length} onClick={() => togglePanel('people')} />
        <Menu
          label={t('calls.react')}
          width={220}
          trigger={(props) => <CallButton {...props} icon={hand ? HandPalmIcon : SmileyIcon} label={t('calls.react')} active={hand} />}
        >
          <MenuItem icon={HandPalmIcon} onSelect={() => setHand(!hand)}>
            {hand ? t('calls.lowerHand') : t('calls.raiseHand')}
          </MenuItem>
          <MenuSeparator />
          <div role="group" aria-label={t('calls.reactions')} className="flex justify-between px-2 py-1">
            {CALL_REACTIONS.map((emoji) => (
              <MenuReaction key={emoji} emoji={emoji} />
            ))}
          </div>
        </Menu>
        <Menu label={t('calls.view')} width={200} trigger={(props) => <CallButton {...props} icon={layout === 'gallery' ? SquaresFourIcon : UserFocusIcon} label={t('calls.view')} />}>
          <MenuItem icon={SquaresFourIcon} checked={layout === 'gallery'} onSelect={() => set({ layout: 'gallery', pinnedId: null })}>
            {t('calls.gallery')}
          </MenuItem>
          <MenuItem icon={UserFocusIcon} checked={layout === 'speaker'} onSelect={() => set({ layout: 'speaker' })}>
            {t('calls.speakerView')}
          </MenuItem>
        </Menu>
        <Menu label={t('calls.more')} width={230} trigger={(props) => <CallButton {...props} icon={DotsThreeIcon} label={t('calls.more')} />}>
          <MenuItem icon={GearIcon} onSelect={onOpenSettings}>
            {t('calls.deviceSettings')}
          </MenuItem>
          <MenuItem
            icon={fullscreen ? CornersInIcon : CornersOutIcon}
            onSelect={() => void (fullscreen ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {})}
          >
            {fullscreen ? t('calls.exitFullscreen') : t('calls.fullscreen')}
          </MenuItem>
        </Menu>

        <span className="mx-1 h-8 w-px bg-white/15" aria-hidden="true" />

        <CallButton
          icon={camera ? VideoCameraIcon : VideoCameraSlashIcon}
          label={t('calls.camera')}
          aria-pressed={camera}
          onClick={() => void setCamera(!camera)}
        />
        <CallButton icon={mic ? MicrophoneIcon : MicrophoneSlashIcon} label={t('calls.mic')} aria-pressed={mic} onClick={() => void setMic(!mic)} />
        <CallButton icon={ScreencastIcon} label={screen ? t('calls.stopSharing') : t('calls.share')} active={screen} aria-pressed={screen} onClick={() => void toggleScreenShare()} />
        <CallButton icon={PhoneDisconnectIcon} label={t('calls.leave')} danger onClick={() => void leaveCall()} />
      </nav>
    </header>
  );
}

function MenuReaction({ emoji }: { emoji: string }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={() => sendReaction(emoji)}
      aria-label={t('calls.sendReaction', { emoji })}
      className="flex size-8 items-center justify-center rounded-md text-xl hover:bg-hover"
    >
      {emoji}
    </button>
  );
}

function Stage({ tiles }: { tiles: TileData[] }) {
  const { layout, pinnedId, lastSpeakerId, reactions, mySocketId, set } = useCallStore();
  const { ref, width, height } = useSize<HTMLDivElement>();
  const reactionsOf = (tile: TileData) => reactions.filter((r) => r.socketId === (tile.self ? mySocketId : tile.id));
  const togglePin = (tile: TileData) => () =>
    set(pinnedId === tile.id ? { pinnedId: null } : { pinnedId: tile.id, layout: 'speaker' });

  const spotlight = layout === 'speaker' ? pickSpotlight(tiles, pinnedId, lastSpeakerId === mySocketId ? 'self' : lastSpeakerId) : undefined;
  const strip = spotlight ? tiles.filter((t) => t.id !== spotlight.id) : [];
  const stripHeight = strip.length ? 112 : 0;
  const main = spotlight ? [spotlight] : tiles;
  const shape = gridShape(main.length, width, height - stripHeight - (strip.length ? 8 : 0));

  return (
    <div ref={ref} className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-2 p-3" data-testid="call-stage" data-layout={layout}>
      <div className="grid justify-center gap-2" style={{ gridTemplateColumns: `repeat(${shape.cols}, ${Math.floor(shape.tileWidth)}px)` }}>
        {main.map((tile) => (
          <Tile
            key={tile.id}
            tile={tile}
            reactions={reactionsOf(tile)}
            pinned={pinnedId === tile.id}
            onTogglePin={togglePin(tile)}
            style={{ width: Math.floor(shape.tileWidth), height: Math.floor(shape.tileHeight) }}
          />
        ))}
      </div>
      {strip.length > 0 && (
        <div className="flex max-w-full shrink-0 gap-2 overflow-x-auto" style={{ height: stripHeight }}>
          {strip.map((tile) => (
            <Tile key={tile.id} tile={tile} reactions={reactionsOf(tile)} pinned={false} compact style={{ width: (stripHeight * 16) / 9, height: stripHeight }} />
          ))}
        </div>
      )}
    </div>
  );
}

export function InCall() {
  const { t } = useTranslation();
  const me = useAuthStore((s) => s.user);
  const { title, members, preview, mic, camera, screen, hand, localSpeaking, panel, devices, blur } = useCallStore();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const tiles = useMemo<TileData[]>(() => {
    const self: TileData = {
      id: 'self',
      userId: me?.id ?? '',
      name: me?.name ?? '',
      avatarUrl: me?.avatarUrl ?? null,
      stream: preview,
      mic,
      camera,
      screen,
      hand,
      speaking: localSpeaking && mic,
      self: true,
      connection: 'connected',
    };
    const others = Object.values(members).map<TileData>((m) => ({
      id: m.socketId,
      userId: m.userId,
      name: m.name,
      avatarUrl: m.avatarUrl,
      stream: m.stream,
      mic: m.mic,
      camera: m.camera,
      screen: m.screen,
      hand: m.hand,
      speaking: m.speaking && m.mic,
      self: false,
      connection: m.connection,
    }));
    return [self, ...others];
  }, [me, members, preview, mic, camera, screen, hand, localSpeaking]);

  // Teams-style shortcuts: Ctrl+Shift+M (microphone) and Ctrl+Shift+O (camera).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || !e.shiftKey) return;
      const state = useCallStore.getState();
      if (e.key.toLowerCase() === 'm') {
        e.preventDefault();
        void setMic(!state.mic);
      } else if (e.key.toLowerCase() === 'o') {
        e.preventDefault();
        void setCamera(!state.camera);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div role="dialog" aria-modal="true" aria-label={t('calls.inCallLabel', { title })} className="fixed inset-0 z-40 flex flex-col bg-[#1b1b21]">
      <ControlBar tiles={tiles} onOpenSettings={() => setSettingsOpen(true)} />
      <div className="flex min-h-0 flex-1">
        <Stage tiles={tiles} />
        {panel && (
          <aside className="flex w-80 shrink-0 flex-col border-l border-line bg-main text-fg" aria-label={panel === 'chat' ? t('calls.chat') : t('calls.people')}>
            {panel === 'chat' ? <CallChatPanel tiles={tiles} /> : <PeoplePanel tiles={tiles} />}
          </aside>
        )}
      </div>
      {Object.values(members).map((m) => (
        <RemoteAudio key={m.socketId} stream={m.stream} sinkId={devices.audioOut} />
      ))}
      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} title={t('calls.deviceSettings')}>
        <div className="space-y-4">
          <DeviceSettings />
          <Switch label={t('calls.blur')} checked={blur} onChange={(on) => void setBlur(on)} iconOn={SparkleIcon} iconOff={SparkleIcon} disabled={!camera} />
        </div>
      </Dialog>
    </div>
  );
}
