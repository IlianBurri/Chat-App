import clsx from 'clsx';
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode, type Ref } from 'react';

export interface PopoverTriggerProps {
  ref: Ref<HTMLButtonElement>;
  onClick: () => void;
  'aria-haspopup': 'dialog';
  'aria-expanded': boolean;
  'aria-controls': string | undefined;
}

interface PopoverProps {
  label: string;
  trigger: (props: PopoverTriggerProps) => ReactNode;
  children: ReactNode;
  placement?: 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end';
  className?: string;
  onOpenChange?: (open: boolean) => void;
}

const PLACEMENT = {
  'top-start': 'bottom-full left-0 mb-1',
  'top-end': 'bottom-full right-0 mb-1',
  'bottom-start': 'top-full left-0 mt-1',
  'bottom-end': 'top-full right-0 mt-1',
};

const PopoverContext = createContext<{ close: () => void } | null>(null);

/** Lets content inside a popover close it (e.g. after picking an emoji). */
export function usePopover() {
  return useContext(PopoverContext);
}

/** Non-modal floating panel; closes on outside click and Escape, then returns focus. */
export function Popover({ label, trigger, children, placement = 'top-start', className, onOpenChange }: PopoverProps) {
  const [open, setOpenState] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const id = useId();

  const setOpen = useCallback(
    (value: boolean) => {
      setOpenState(value);
      onOpenChange?.(value);
    },
    [onOpenChange],
  );

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, [setOpen]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, setOpen]);

  return (
    <div ref={rootRef} className="relative inline-flex">
      {trigger({
        ref: triggerRef,
        onClick: () => setOpen(!open),
        'aria-haspopup': 'dialog',
        'aria-expanded': open,
        'aria-controls': open ? id : undefined,
      })}
      {open && (
        <div
          id={id}
          role="dialog"
          aria-label={label}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              close();
            }
          }}
          className={clsx('absolute z-50 rounded-lg border border-line bg-main shadow-pop', PLACEMENT[placement], className)}
        >
          <PopoverContext.Provider value={{ close }}>{children}</PopoverContext.Provider>
        </div>
      )}
    </div>
  );
}
