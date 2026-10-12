import { CheckCircleIcon, WarningCircleIcon } from '@phosphor-icons/react';
import { create } from 'zustand';

interface Toast {
  id: number;
  text: string;
  tone: 'success' | 'error';
}

interface ToastState {
  toasts: Toast[];
  show: (text: string, tone?: Toast['tone']) => void;
}

let nextId = 1;

/** Short confirmations ("Link copied") and errors, announced to screen readers. */
export const useToast = create<ToastState>((set) => ({
  toasts: [],
  show: (text, tone = 'success') => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, text, tone }] }));
    window.setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3500);
  },
}));

export function Toaster() {
  const toasts = useToast((s) => s.toasts);
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <div key={t.id} role="status" className="flex items-center gap-2 rounded-lg bg-fg px-4 py-2 text-sm text-main shadow-pop">
          {t.tone === 'success' ? (
            <CheckCircleIcon className="size-4 text-success" aria-hidden="true" />
          ) : (
            <WarningCircleIcon className="size-4 text-danger" aria-hidden="true" />
          )}
          {t.text}
        </div>
      ))}
    </div>
  );
}
