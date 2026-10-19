import { useToast } from '@/components/ui/Toaster';
import i18n from '@/i18n';
import { getSocket } from '@/lib/socket';
import { callKey, saveDevices, useCallStore, type DeviceChoice, type RemoteMember } from '@/stores/call';
import type { ProcessedTrack } from './blur';
import { SpeakingMonitor } from './speaking';
import type { CallChatLine, CallMedia, CallMemberDto, CallTarget } from './types';

/**
 * One call at a time, as a full mesh: every member has a direct
 * RTCPeerConnection to every other member. Each connection has exactly one
 * audio and one video transceiver from the start, so muting, turning the
 * camera on/off and screen sharing only swap tracks (no renegotiation).
 * Whoever joins sends the offers, so two sides never offer at once.
 */

interface Peer {
  pc: RTCPeerConnection;
  audio: RTCRtpSender | null;
  video: RTCRtpSender | null;
  pending: RTCIceCandidateInit[];
  stream: MediaStream;
}

type SignalData = { description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };

const peers = new Map<string, Peer>();
// Candidates that arrive before their peer connection exists.
const earlyCandidates = new Map<string, RTCIceCandidateInit[]>();
let iceServers: RTCIceServer[] = [];
let micTrack: MediaStreamTrack | null = null;
let cameraTrack: MediaStreamTrack | null = null;
let blurred: ProcessedTrack | null = null;
let screenTrack: MediaStreamTrack | null = null;
let monitor: SpeakingMonitor | null = null;
// The lobby opens camera and microphone in the background. Joining waits for that, so a quick "Join now"
// still sends both; closing the lobby (or opening another one) bumps the run and drops what was opened.
let lobbyRun = 0;
let lobbyDevices: Promise<void> = Promise.resolve();

const store = () => useCallStore.getState();
const toast = (key: string, options?: Record<string, unknown>, tone: 'success' | 'error' = 'error') =>
  useToast.getState().show(i18n.t(key, options) as string, tone);

function socketOrThrow() {
  const socket = getSocket();
  if (!socket) throw new Error('No socket');
  return socket;
}

function emitWithAck<T extends Record<string, unknown>>(event: string, payload: unknown, timeoutMs = 10_000) {
  return new Promise<T & { ok: boolean; error?: string }>((resolve) => {
    socketOrThrow()
      .timeout(timeoutMs)
      .emit(event, payload, (err: Error | null, response: T & { ok: boolean; error?: string }) =>
        resolve(err ? ({ ok: false, error: 'timeout' } as T & { ok: boolean; error?: string }) : response),
      );
  });
}

// ---------------------------------------------------------------- local media

function mediaErrorOf(error: unknown): 'denied' | 'unavailable' {
  const name = (error as { name?: string } | null)?.name;
  return name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable';
}

async function openMic(deviceId?: string) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { deviceId: deviceId ? { exact: deviceId } : undefined, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  return stream.getAudioTracks()[0];
}

async function openCamera(deviceId?: string) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { deviceId: deviceId ? { exact: deviceId } : undefined, width: { ideal: 1280 }, height: { ideal: 720 } },
  });
  return stream.getVideoTracks()[0];
}

/** The video everybody else sees: the shared screen, else the (possibly blurred) camera, else nothing. */
function outgoingVideo(): MediaStreamTrack | null {
  if (screenTrack) return screenTrack;
  if (!store().camera || !cameraTrack) return null;
  return blurred?.track ?? cameraTrack;
}

function updatePreview() {
  const tracks = [micTrack, outgoingVideo()].filter((t): t is MediaStreamTrack => t !== null);
  store().set({ preview: tracks.length ? new MediaStream(tracks) : null });
}

async function pushVideo() {
  const track = outgoingVideo();
  await Promise.all([...peers.values()].map((p) => p.video?.replaceTrack(track).catch(() => {})));
  updatePreview();
}

async function pushAudio() {
  await Promise.all([...peers.values()].map((p) => p.audio?.replaceTrack(micTrack).catch(() => {})));
  if (micTrack) monitor?.watch('local', new MediaStream([micTrack]));
  updatePreview();
}

async function stopBlur() {
  blurred?.stop();
  blurred = null;
}

async function applyBlur() {
  await stopBlur();
  if (!store().blur || !cameraTrack) return;
  try {
    // Loaded on demand: the segmentation model is only needed with blur switched on.
    const { createBlurredTrack } = await import('./blur');
    blurred = await createBlurredTrack(cameraTrack);
  } catch (error) {
    console.warn('Background blur unavailable', error);
    store().set({ blur: false });
    toast('calls.blurFailed');
  }
}

function stopLocalMedia() {
  void stopBlur();
  for (const track of [micTrack, cameraTrack, screenTrack]) track?.stop();
  micTrack = cameraTrack = screenTrack = null;
}

function sendState() {
  const { phase, mic, camera, screen, hand } = store();
  if (phase === 'in-call') getSocket()?.emit('call:state', { mic, camera, screen, hand });
}

// ---------------------------------------------------------------- peers

function sendSignal(to: string, data: SignalData) {
  getSocket()?.emit('call:signal', { to, data });
}

function createPeer(socketId: string): Peer {
  const pc = new RTCPeerConnection({ iceServers });
  const peer: Peer = { pc, audio: null, video: null, pending: earlyCandidates.get(socketId) ?? [], stream: new MediaStream() };
  earlyCandidates.delete(socketId);
  peers.set(socketId, peer);

  pc.onicecandidate = (e) => {
    if (e.candidate) sendSignal(socketId, { candidate: e.candidate.toJSON() });
  };
  pc.ontrack = (e) => {
    // A fresh stream object per track makes <video>/<audio> elements pick up the change.
    peer.stream = new MediaStream([...peer.stream.getTracks().filter((t) => t.kind !== e.track.kind), e.track]);
    store().patchMember(socketId, { stream: peer.stream });
    if (e.track.kind === 'audio') monitor?.watch(socketId, peer.stream);
  };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'connected') store().patchMember(socketId, { connection: 'connected' });
    if (pc.connectionState === 'failed') store().patchMember(socketId, { connection: 'failed' });
  };
  return peer;
}

async function flushCandidates(peer: Peer) {
  for (const candidate of peer.pending.splice(0)) await peer.pc.addIceCandidate(candidate).catch(() => {});
}

/** We just joined: offer a connection to someone who was already there. */
async function callPeer(socketId: string) {
  const peer = createPeer(socketId);
  peer.audio = peer.pc.addTransceiver(micTrack ?? 'audio', { direction: 'sendrecv' }).sender;
  peer.video = peer.pc.addTransceiver(outgoingVideo() ?? 'video', { direction: 'sendrecv' }).sender;
  await peer.pc.setLocalDescription(await peer.pc.createOffer());
  sendSignal(socketId, { description: peer.pc.localDescription!.toJSON() });
}

/** Offer, answer or ICE candidate from another member. */
export async function handleSignal({ from, data }: { from: string; data: SignalData }) {
  if (store().phase !== 'in-call') return;
  let peer = peers.get(from);
  try {
    if (data.description?.type === 'offer') {
      peer ??= createPeer(from);
      await peer.pc.setRemoteDescription(data.description);
      for (const transceiver of peer.pc.getTransceivers()) {
        transceiver.direction = 'sendrecv';
        if (transceiver.receiver.track.kind === 'audio') {
          peer.audio = transceiver.sender;
          await transceiver.sender.replaceTrack(micTrack);
        } else {
          peer.video = transceiver.sender;
          await transceiver.sender.replaceTrack(outgoingVideo());
        }
      }
      await peer.pc.setLocalDescription(await peer.pc.createAnswer());
      sendSignal(from, { description: peer.pc.localDescription!.toJSON() });
      await flushCandidates(peer);
    } else if (data.description && peer) {
      await peer.pc.setRemoteDescription(data.description);
      await flushCandidates(peer);
    } else if (data.candidate) {
      if (!peer) earlyCandidates.set(from, [...(earlyCandidates.get(from) ?? []), data.candidate]);
      else if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(data.candidate).catch(() => {});
      else peer.pending.push(data.candidate);
    }
  } catch (error) {
    console.warn('Call signalling failed', error);
    store().patchMember(from, { connection: 'failed' });
  }
}

function closePeer(socketId: string) {
  peers.get(socketId)?.pc.close();
  peers.delete(socketId);
  earlyCandidates.delete(socketId);
  monitor?.unwatch(socketId);
}

function toMember(dto: CallMemberDto): RemoteMember {
  return { ...dto, stream: null, speaking: false, connection: 'connecting' };
}

// ---------------------------------------------------------------- lifecycle

/** Opens the lobby (camera preview and device choice) for a call. */
export async function openLobby(target: CallTarget, media: CallMedia, title: string) {
  const current = store();
  if (current.phase === 'in-call' && current.target && callKey(current.target) === callKey(target)) return;
  if (current.phase !== 'idle') await leaveCall();
  store().set({ phase: 'lobby', target, media, title, camera: media === 'video', mic: true, screen: false, hand: false, mediaError: null });
  lobbyDevices = openLobbyDevices(++lobbyRun);
  await lobbyDevices;
}

async function openLobbyDevices(run: number) {
  let mic: MediaStreamTrack | null = null;
  let camera: MediaStreamTrack | null = null;
  try {
    mic = await openMic(store().devices.audioIn);
  } catch (error) {
    if (run === lobbyRun) store().set({ mic: false, mediaError: mediaErrorOf(error) });
  }
  if (run === lobbyRun && store().camera) {
    try {
      camera = await openCamera(store().devices.videoIn);
    } catch (error) {
      if (run === lobbyRun) store().set({ camera: false, mediaError: store().mediaError ?? mediaErrorOf(error) });
    }
  }
  // Closed, or replaced by another lobby, while the devices were opening.
  if (run !== lobbyRun) {
    mic?.stop();
    camera?.stop();
    return;
  }
  micTrack = mic;
  cameraTrack = camera;
  if (cameraTrack) await applyBlur();
  updatePreview();
}

export function cancelLobby() {
  lobbyRun++;
  stopLocalMedia();
  store().resetCall();
}

export async function joinCall() {
  const { target, media } = store();
  if (!target) return;
  store().set({ phase: 'joining' });
  await lobbyDevices;
  if (store().phase !== 'joining') return;
  // Opening a device may have failed meanwhile, which switches it off.
  const { mic, camera } = store();
  if (micTrack) micTrack.enabled = mic;

  const res = await emitWithAck<{
    call: { startedAt: number };
    direct: boolean;
    chatId: string | null;
    members: CallMemberDto[];
    chat: CallChatLine[];
    iceServers: RTCIceServer[];
  }>('call:join', { target, media, state: { mic, camera, screen: false, hand: false } });

  if (!res.ok) {
    toast(res.error === 'not_found' ? 'calls.errors.notAllowed' : 'calls.errors.join');
    store().set({ phase: 'lobby' });
    return;
  }
  iceServers = res.iceServers ?? [];
  monitor = new SpeakingMonitor((id, speaking) => {
    if (id === 'local') store().set({ localSpeaking: speaking });
    else store().patchMember(id, { speaking });
    if (speaking) store().set({ lastSpeakerId: id === 'local' ? store().mySocketId : id });
  });
  if (micTrack) monitor.watch('local', new MediaStream([micTrack]));
  store().set({
    phase: 'in-call',
    startedAt: res.call.startedAt,
    chatId: res.chatId,
    direct: res.direct,
    mySocketId: getSocket()?.id ?? null,
    chat: res.chat,
    members: Object.fromEntries(res.members.map((m) => [m.socketId, toMember(m)])),
  });
  for (const member of res.members) void callPeer(member.socketId).catch(() => store().patchMember(member.socketId, { connection: 'failed' }));
}

/** Tears everything down locally. `notify` tells the server (not needed when the server ended it). */
export async function leaveCall(notify = true) {
  lobbyRun++;
  if (notify && store().phase === 'in-call') await emitWithAck('call:leave', {}, 3000);
  for (const id of [...peers.keys()]) closePeer(id);
  earlyCandidates.clear();
  monitor?.stop();
  monitor = null;
  stopLocalMedia();
  store().resetCall();
}

/** After a reconnect the server has forgotten our old socket: join again with fresh connections. */
export async function rejoinAfterReconnect() {
  if (store().phase !== 'in-call') return;
  for (const id of [...peers.keys()]) closePeer(id);
  store().set({ members: {} });
  await joinCall();
}

// ---------------------------------------------------------------- controls

export async function setMic(on: boolean) {
  if (on && !micTrack) {
    try {
      micTrack = await openMic(store().devices.audioIn);
      await pushAudio();
    } catch (error) {
      store().set({ mediaError: mediaErrorOf(error) });
      toast('calls.errors.mic');
      return;
    }
  }
  if (micTrack) micTrack.enabled = on;
  store().set({ mic: on });
  sendState();
}

export async function setCamera(on: boolean) {
  if (on) {
    try {
      cameraTrack ??= await openCamera(store().devices.videoIn);
      store().set({ camera: true });
      await applyBlur();
    } catch (error) {
      store().set({ mediaError: mediaErrorOf(error) });
      toast('calls.errors.camera');
      return;
    }
  } else {
    await stopBlur();
    cameraTrack?.stop();
    cameraTrack = null;
    store().set({ camera: false });
  }
  await pushVideo();
  sendState();
}

export async function setBlur(on: boolean) {
  store().set({ blur: on });
  await applyBlur();
  await pushVideo();
}

export async function toggleScreenShare() {
  if (screenTrack) return stopScreenShare();
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    screenTrack = stream.getVideoTracks()[0];
    screenTrack.addEventListener('ended', () => void stopScreenShare());
  } catch (error) {
    if ((error as { name?: string }).name !== 'NotAllowedError') toast('calls.errors.screen');
    return;
  }
  store().set({ screen: true });
  await pushVideo();
  sendState();
}

export async function stopScreenShare() {
  screenTrack?.stop();
  screenTrack = null;
  store().set({ screen: false });
  await pushVideo();
  sendState();
}

export function setHand(raised: boolean) {
  store().set({ hand: raised });
  sendState();
}

export function sendReaction(emoji: string) {
  getSocket()?.emit('call:reaction', { emoji });
}

export async function sendChat(text: string) {
  const res = await emitWithAck('call:chat', { text });
  if (!res.ok) toast('calls.errors.chat');
}

export async function inviteToCall(userIds: string[]) {
  const res = await emitWithAck<{ invited: string[] }>('call:invite', { userIds });
  if (!res.ok || res.invited.length === 0) toast('calls.errors.invite');
  else toast('calls.invited', { count: res.invited.length }, 'success');
}

/** Switches microphone, camera or speaker; the choice is remembered for next time. */
export async function setDevice(kind: keyof DeviceChoice, deviceId: string) {
  const devices = { ...store().devices, [kind]: deviceId };
  store().set({ devices });
  saveDevices(devices);
  try {
    if (kind === 'audioIn' && micTrack) {
      const enabled = micTrack.enabled;
      micTrack.stop();
      micTrack = await openMic(deviceId);
      micTrack.enabled = enabled;
      await pushAudio();
    }
    if (kind === 'videoIn' && cameraTrack) {
      cameraTrack.stop();
      cameraTrack = await openCamera(deviceId);
      await applyBlur();
      await pushVideo();
    }
  } catch {
    toast(kind === 'audioIn' ? 'calls.errors.mic' : 'calls.errors.camera');
  }
}

// ---------------------------------------------------------------- server events

export function onMemberJoined(member: CallMemberDto) {
  if (store().phase !== 'in-call') return;
  store().set({ members: { ...store().members, [member.socketId]: toMember(member) } });
}

export function onMemberLeft({ socketId }: { socketId: string }) {
  closePeer(socketId);
  store().removeMember(socketId);
}

export function onMemberUpdated(member: CallMemberDto) {
  if (member.socketId === store().mySocketId) return;
  const { mic, camera, screen, hand } = member;
  store().patchMember(member.socketId, { mic, camera, screen, hand });
}

export function onCallEndedForMe(reason: 'moved' | 'unanswered' | 'declined', name?: string) {
  if (store().phase !== 'in-call') return;
  toast(`calls.ended.${reason}`, { name }, reason === 'moved' ? 'success' : 'error');
  void leaveCall(reason !== 'moved');
}
