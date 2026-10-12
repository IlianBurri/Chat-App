import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemePreference = 'system' | 'light' | 'dark';

export const LIST_WIDTH = { min: 240, max: 480, default: 320 } as const;

interface UiState {
  theme: ThemePreference;
  listWidth: number;
  setTheme: (theme: ThemePreference) => void;
  setListWidth: (width: number) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: 'system',
      listWidth: LIST_WIDTH.default,
      setTheme: (theme) => set({ theme }),
      setListWidth: (width) =>
        set({ listWidth: Math.round(Math.min(LIST_WIDTH.max, Math.max(LIST_WIDTH.min, width))) }),
    }),
    // The key is also read by the inline script in index.html.
    { name: 'tl-ui' },
  ),
);
