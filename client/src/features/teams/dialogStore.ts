import { create } from 'zustand';
import type { ChannelSummary, WorkspaceSummary } from '@/lib/types';

export type TeamsDialog =
  | { kind: 'createWorkspace' }
  | { kind: 'editWorkspace'; workspace: WorkspaceSummary }
  | { kind: 'deleteWorkspace'; workspace: WorkspaceSummary }
  | { kind: 'leaveWorkspace'; workspace: WorkspaceSummary }
  | { kind: 'members'; workspace: WorkspaceSummary; channel?: ChannelSummary }
  | { kind: 'createChannel'; workspace: WorkspaceSummary }
  | { kind: 'editChannel'; workspace: WorkspaceSummary; channel: ChannelSummary }
  | { kind: 'deleteChannel'; workspace: WorkspaceSummary; channel: ChannelSummary };

/** One dialog at a time, opened from list menus, channel headers or the discover page. */
export const useTeamsDialogs = create<{ dialog: TeamsDialog | null; open: (dialog: TeamsDialog) => void; close: () => void }>((set) => ({
  dialog: null,
  open: (dialog) => set({ dialog }),
  close: () => set({ dialog: null }),
}));
