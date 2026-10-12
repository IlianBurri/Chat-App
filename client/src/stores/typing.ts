import { create } from 'zustand';

/** A typing signal expires if no refresh arrives (sender refreshes every few seconds). */
const EXPIRY_MS = 6000;

interface Typer {
  name: string;
  until: number;
}

interface TypingState {
  byChat: Record<string, Record<string, Typer>>;
  set: (chatId: string, userId: string, name: string, typing: boolean) => void;
  clearUser: (chatId: string, userId: string) => void;
}

const timers = new Map<string, number>();

export const useTypingStore = create<TypingState>((set, get) => ({
  byChat: {},
  set: (chatId, userId, name, typing) => {
    const key = `${chatId}:${userId}`;
    window.clearTimeout(timers.get(key));
    if (!typing) {
      get().clearUser(chatId, userId);
      return;
    }
    set((s) => ({ byChat: { ...s.byChat, [chatId]: { ...s.byChat[chatId], [userId]: { name, until: Date.now() + EXPIRY_MS } } } }));
    timers.set(key, window.setTimeout(() => get().clearUser(chatId, userId), EXPIRY_MS));
  },
  clearUser: (chatId, userId) =>
    set((s) => {
      if (!s.byChat[chatId]?.[userId]) return {};
      const rest = { ...s.byChat[chatId] };
      delete rest[userId];
      return { byChat: { ...s.byChat, [chatId]: rest } };
    }),
}));

const NO_TYPERS: string[] = [];

/** First names of the people currently typing in a chat. */
export function useTypingNames(chatId: string | undefined): string[] {
  const typers = useTypingStore((s) => (chatId ? s.byChat[chatId] : undefined));
  if (!typers) return NO_TYPERS;
  return Object.values(typers).map((t) => t.name.split(' ')[0]);
}
