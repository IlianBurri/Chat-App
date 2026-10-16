import { useToast } from '@/components/ui/Toaster';
import i18n from '@/i18n';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/auth';
import { useCallStore } from '@/stores/call';
import { useMeetingsStore } from '@/stores/meetings';
import { joinCall, openLobby } from './session';
import type { ActiveCallDto, CallMedia, IncomingCall } from './types';

/** Audio or video call in a chat (rings the other members once the caller joins). */
export function startChatCall(chatId: string, title: string, media: CallMedia) {
  void openLobby({ kind: 'chat', id: chatId }, media, title);
}

/** "Meet" in a channel: a call everyone who can see the channel may join. */
export function startChannelCall(channelId: string, title: string) {
  void openLobby({ kind: 'channel', id: channelId }, 'video', title);
}

export function joinMeeting(meeting: { id: string; title: string }) {
  void openLobby({ kind: 'meeting', id: meeting.id }, 'video', meeting.title);
}

export function joinActiveCall(call: ActiveCallDto, title: string) {
  void openLobby(call.target, call.media, title);
}

/** "Meet now": an ad-hoc meeting starting now; others can be rung in from the call. */
export async function meetNow() {
  const me = useAuthStore.getState().user;
  const start = new Date();
  try {
    const meeting = await useMeetingsStore.getState().save({
      title: i18n.t('calls.meetNowTitle', { name: me?.name ?? '' }),
      description: '',
      start,
      end: new Date(start.getTime() + 60 * 60_000),
      participants: [],
      instant: true,
    });
    joinMeeting(meeting);
  } catch {
    useToast.getState().show(i18n.t('auth.errors.generic'), 'error');
  }
}

export function incomingTitle(call: IncomingCall) {
  return call.direct || !call.title ? call.caller.name : call.title;
}

/** Answering skips the lobby: devices open and the call starts right away. */
export async function answerCall(call: IncomingCall, media: CallMedia) {
  useCallStore.getState().removeIncoming(call.key);
  await openLobby(call.target, media, incomingTitle(call));
  if (useCallStore.getState().phase === 'lobby') await joinCall();
}

export function declineCall(call: IncomingCall) {
  useCallStore.getState().removeIncoming(call.key);
  getSocket()?.emit('call:decline', { key: call.key });
}
