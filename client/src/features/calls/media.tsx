import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';

/** A <video> showing a MediaStream. Always muted: sound plays through <RemoteAudio>. */
export function VideoView({ stream, mirrored, contain, className }: { stream: MediaStream | null; mirrored?: boolean; contain?: boolean; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video || video.srcObject === stream) return;
    video.srcObject = stream;
    if (stream) void video.play().catch(() => {});
  }, [stream]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      className={clsx('size-full', contain ? 'object-contain' : 'object-cover', mirrored && '-scale-x-100', className)}
    />
  );
}

/** Plays a remote person's audio on the chosen speaker. */
export function RemoteAudio({ stream, sinkId }: { stream: MediaStream | null; sinkId?: string }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const audio = ref.current;
    if (!audio || audio.srcObject === stream) return;
    audio.srcObject = stream;
    if (stream) void audio.play().catch(() => {});
  }, [stream]);
  useEffect(() => {
    const audio = ref.current as (HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }) | null;
    if (audio?.setSinkId && sinkId) void audio.setSinkId(sinkId).catch(() => {});
  }, [sinkId]);
  return <audio ref={ref} autoPlay />;
}

export interface DeviceLists {
  audioIn: MediaDeviceInfo[];
  videoIn: MediaDeviceInfo[];
  audioOut: MediaDeviceInfo[];
}

/** Cameras, microphones and speakers; labels appear once the user allowed access. */
export function useDevices(refreshKey?: unknown): DeviceLists {
  const [lists, setLists] = useState<DeviceLists>({ audioIn: [], videoIn: [], audioOut: [] });
  useEffect(() => {
    const devices = navigator.mediaDevices;
    if (!devices?.enumerateDevices) return;
    const load = async () => {
      const all = await devices.enumerateDevices().catch(() => []);
      setLists({
        audioIn: all.filter((d) => d.kind === 'audioinput'),
        videoIn: all.filter((d) => d.kind === 'videoinput'),
        audioOut: all.filter((d) => d.kind === 'audiooutput'),
      });
    };
    void load();
    devices.addEventListener('devicechange', load);
    return () => devices.removeEventListener('devicechange', load);
  }, [refreshKey]);
  return lists;
}

/** Whether this browser can pick the speaker for audio elements. */
export const canPickSpeaker = typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;
