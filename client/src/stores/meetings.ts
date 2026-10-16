import { create } from 'zustand';
import { api } from '@/lib/api';
import type { MeetingDto, MeetingResponse, PublicUser } from '@/lib/types';

export interface MeetingDraft {
  title: string;
  description: string;
  start: Date;
  end: Date;
  participants: PublicUser[];
  /** Planned from this chat: the invitation goes there instead of a new meeting chat */
  chatId?: string;
  /** "Meet now": an ad-hoc meeting */
  instant?: boolean;
}

type Editor = { mode: 'create'; draft: MeetingDraft } | { mode: 'edit'; meeting: MeetingDto };

interface MeetingsState {
  byId: Record<string, MeetingDto>;
  /** Key of the range the calendar loaded last ("from|to") */
  loadedRange: string | null;
  loading: boolean;
  error: boolean;
  editor: Editor | null;
  detailsId: string | null;

  loadRange: (from: Date, to: Date) => Promise<void>;
  fetchOne: (id: string) => Promise<MeetingDto>;
  upsert: (meeting: MeetingDto) => void;
  remove: (id: string) => void;
  save: (draft: MeetingDraft, meetingId?: string) => Promise<MeetingDto>;
  cancel: (id: string) => Promise<void>;
  respond: (id: string, response: MeetingResponse) => Promise<void>;

  openEditor: (editor: Editor) => void;
  closeEditor: () => void;
  openDetails: (id: string) => void;
  closeDetails: () => void;
  reset: () => void;
}

export const useMeetingsStore = create<MeetingsState>((set, get) => ({
  byId: {},
  loadedRange: null,
  loading: false,
  error: false,
  editor: null,
  detailsId: null,

  loadRange: async (from, to) => {
    const key = `${from.toISOString()}|${to.toISOString()}`;
    set({ loading: true, error: false, loadedRange: key });
    try {
      const { meetings } = await api.get<{ meetings: MeetingDto[] }>(
        `/meetings?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
      );
      // A newer range may have been requested meanwhile; its result wins.
      if (get().loadedRange !== key) return;
      set((s) => ({
        byId: {
          ...s.byId,
          ...Object.fromEntries(meetings.map((m) => [m.id, m])),
        },
        loading: false,
      }));
    } catch {
      if (get().loadedRange === key) set({ loading: false, error: true });
    }
  },

  fetchOne: async (id) => {
    const { meeting } = await api.get<{ meeting: MeetingDto }>(`/meetings/${id}`);
    get().upsert(meeting);
    return meeting;
  },

  upsert: (meeting) => set((s) => ({ byId: { ...s.byId, [meeting.id]: meeting } })),

  remove: (id) =>
    set((s) => {
      const byId = { ...s.byId };
      delete byId[id];
      return { byId, detailsId: s.detailsId === id ? null : s.detailsId };
    }),

  save: async (draft, meetingId) => {
    const body = {
      title: draft.title.trim(),
      description: draft.description.trim() || undefined,
      start: draft.start.toISOString(),
      end: draft.end.toISOString(),
      participantIds: draft.participants.map((p) => p.id),
    };
    const { meeting } = meetingId
      ? await api.patch<{ meeting: MeetingDto }>(`/meetings/${meetingId}`, body)
      : await api.post<{ meeting: MeetingDto }>('/meetings', {
          ...body,
          chatId: draft.chatId,
          isInstant: draft.instant,
        });
    get().upsert(meeting);
    return meeting;
  },

  cancel: async (id) => {
    const { meeting } = await api.post<{ meeting: MeetingDto }>(`/meetings/${id}/cancel`);
    get().upsert(meeting);
  },

  respond: async (id, response) => {
    const { meeting } = await api.post<{ meeting: MeetingDto }>(`/meetings/${id}/respond`, { response });
    get().upsert(meeting);
  },

  openEditor: (editor) => set({ editor, detailsId: null }),
  closeEditor: () => set({ editor: null }),
  openDetails: (id) => set({ detailsId: id }),
  closeDetails: () => set({ detailsId: null }),
  reset: () =>
    set({
      byId: {},
      loadedRange: null,
      loading: false,
      error: false,
      editor: null,
      detailsId: null,
    }),
}));

/** Meetings to draw in the calendar: not cancelled, overlapping [from, to). */
export function meetingsInRange(byId: Record<string, MeetingDto>, from: Date, to: Date) {
  return Object.values(byId).filter((m) => !m.cancelled && new Date(m.start) < to && new Date(m.end) > from);
}
