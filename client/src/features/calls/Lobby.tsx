import clsx from 'clsx';
import { MicrophoneIcon, MicrophoneSlashIcon, SparkleIcon, VideoCameraIcon, VideoCameraSlashIcon, WarningCircleIcon, type Icon as PhosphorIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/auth';
import { useCallStore } from '@/stores/call';
import { canPickSpeaker, useDevices, VideoView } from './media';
import { BigAvatar } from './Tile';
import { cancelLobby, joinCall, setBlur, setCamera, setDevice, setMic } from './session';

/** On/off switch with an icon for each state. */
export function Switch({
  label,
  checked,
  onChange,
  iconOn,
  iconOff,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (on: boolean) => void;
  iconOn: PhosphorIcon;
  iconOff: PhosphorIcon;
  disabled?: boolean;
}) {
  const Icon = checked ? iconOn : iconOff;
  return (
    <label className={clsx('flex cursor-pointer items-center gap-2 text-sm', disabled && 'cursor-not-allowed opacity-50')}>
      <Icon className="size-5 text-muted" aria-hidden="true" />
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={clsx('relative h-5 w-9 rounded-full transition-colors', checked ? 'bg-accent' : 'bg-line')}
      >
        <span className={clsx('absolute top-0.5 size-4 rounded-full bg-white shadow transition-all', checked ? 'left-[18px]' : 'left-0.5')} />
      </button>
      <span>{label}</span>
    </label>
  );
}

export function DeviceSelect({ label, devices, value, onChange }: { label: string; devices: MediaDeviceInfo[]; value?: string; onChange: (id: string) => void }) {
  const { t } = useTranslation();
  if (devices.length === 0) return null;
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold text-muted">{label}</span>
      <select
        value={value && devices.some((d) => d.deviceId === value) ? value : devices[0].deviceId}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-md border border-line bg-input px-2 text-sm outline-none focus:border-accent"
      >
        {devices.map((d, i) => (
          <option key={d.deviceId || i} value={d.deviceId}>
            {d.label || t('calls.devices.unnamed', { index: i + 1 })}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Device settings, shared by the lobby and the in-call "⋯" menu. */
export function DeviceSettings() {
  const { t } = useTranslation();
  const devicesChoice = useCallStore((s) => s.devices);
  const preview = useCallStore((s) => s.preview);
  // Labels only show once access was granted, so re-read the lists when the preview changes.
  const lists = useDevices(preview?.id);
  return (
    <div className="space-y-3">
      <DeviceSelect label={t('calls.devices.camera')} devices={lists.videoIn} value={devicesChoice.videoIn} onChange={(id) => void setDevice('videoIn', id)} />
      <DeviceSelect label={t('calls.devices.mic')} devices={lists.audioIn} value={devicesChoice.audioIn} onChange={(id) => void setDevice('audioIn', id)} />
      {canPickSpeaker && (
        <DeviceSelect label={t('calls.devices.speaker')} devices={lists.audioOut} value={devicesChoice.audioOut} onChange={(id) => void setDevice('audioOut', id)} />
      )}
    </div>
  );
}

export function Lobby() {
  const { t } = useTranslation();
  const me = useAuthStore((s) => s.user);
  const { phase, title, preview, mic, camera, blur, mediaError } = useCallStore();
  const joining = phase === 'joining';

  return (
    <div role="dialog" aria-modal="true" aria-label={t('calls.lobby.label', { title })} className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-app">
      <div className="m-auto w-full max-w-4xl p-6">
        <p className="text-sm text-muted">{t('calls.lobby.subtitle')}</p>
        <h1 className="mb-5 text-2xl font-semibold">{title}</h1>
        <div className="grid gap-5 md:grid-cols-[1fr_280px]">
          <div className="space-y-3">
            <div className="relative aspect-video overflow-hidden rounded-lg bg-[#1f1f26]" data-testid="lobby-preview">
              {camera && preview?.getVideoTracks().length ? (
                <VideoView stream={preview} mirrored />
              ) : (
                <div className="flex size-full items-center justify-center">{me && <BigAvatar user={me} size={112} />}</div>
              )}
              <span className="absolute bottom-2 left-2 rounded bg-black/55 px-2 py-0.5 text-xs text-white">{me?.name}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-line bg-main px-4 py-3">
              <Switch label={t('calls.camera')} checked={camera} onChange={(on) => void setCamera(on)} iconOn={VideoCameraIcon} iconOff={VideoCameraSlashIcon} />
              <Switch label={t('calls.mic')} checked={mic} onChange={(on) => void setMic(on)} iconOn={MicrophoneIcon} iconOff={MicrophoneSlashIcon} />
              <Switch label={t('calls.blur')} checked={blur} onChange={(on) => void setBlur(on)} iconOn={SparkleIcon} iconOff={SparkleIcon} disabled={!camera} />
            </div>
            {mediaError && (
              <p role="alert" className="flex items-start gap-2 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
                <WarningCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {t(`calls.mediaError.${mediaError}`)}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-4 rounded-lg border border-line bg-main p-4">
            <h2 className="text-sm font-semibold">{t('calls.devices.title')}</h2>
            <DeviceSettings />
            <div className="mt-auto flex justify-end gap-2 pt-2">
              <Button onClick={cancelLobby}>{t('common.cancel')}</Button>
              <Button variant="primary" disabled={joining} onClick={() => void joinCall()}>
                {joining ? t('calls.lobby.joining') : t('calls.lobby.join')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
