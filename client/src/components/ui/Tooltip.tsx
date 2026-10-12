import clsx from 'clsx';
import { useRef, useState, type ReactNode } from 'react';

type Side = 'top' | 'bottom' | 'right' | 'left';

const POSITION: Record<Side, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
  right: 'left-full top-1/2 -translate-y-1/2 ml-1.5',
  left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
};

/**
 * Visual tooltip on hover and keyboard focus. The wrapped control must carry its
 * own accessible name (aria-label), so the tooltip itself is hidden from AT.
 */
export function Tooltip({ label, side = 'bottom', children }: { label: string; side?: Side; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const show = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(true), 450);
  };
  const hide = () => {
    window.clearTimeout(timer.current);
    setOpen(false);
  };

  return (
    <span
      className="relative inline-flex"
      onPointerEnter={show}
      onPointerLeave={hide}
      onFocus={show}
      onBlur={hide}
      onPointerDown={hide}
      onKeyDown={(e) => e.key === 'Escape' && hide()}
    >
      {children}
      {open && (
        <span
          aria-hidden="true"
          className={clsx(
            'pointer-events-none absolute z-50 whitespace-nowrap rounded-md bg-fg px-2 py-1 text-xs font-medium text-main shadow-pop',
            POSITION[side],
          )}
        >
          {label}
        </span>
      )}
    </span>
  );
}
