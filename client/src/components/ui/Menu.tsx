import clsx from 'clsx';
import { CheckIcon, type Icon as PhosphorIcon } from '@phosphor-icons/react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from 'react';

const MenuContext = createContext<{ close: () => void }>({ close: () => {} });

/** Lets MenuItems inside a standalone MenuList (e.g. a context menu) close it. */
export function MenuContextProvider({ close, children }: { close: () => void; children: ReactNode }) {
  return <MenuContext.Provider value={{ close }}>{children}</MenuContext.Provider>;
}

export interface MenuTriggerProps {
  ref: Ref<HTMLButtonElement>;
  onClick: () => void;
  'aria-haspopup': 'menu';
  'aria-expanded': boolean;
  'aria-controls': string | undefined;
}

interface MenuProps {
  label: string;
  trigger: (props: MenuTriggerProps) => ReactNode;
  children: ReactNode;
  align?: 'start' | 'end';
  width?: number;
  /** Opens above the trigger (e.g. in toolbars near the bottom of the screen). */
  placement?: 'bottom' | 'top';
  onOpenChange?: (open: boolean) => void;
}

/** Dropdown menu with keyboard navigation (arrows, Home/End, Escape). */
export function Menu({ label, trigger, children, align = 'end', width = 240, placement = 'bottom', onOpenChange }: MenuProps) {
  const [open, setOpenState] = useState(false);
  const setOpen = useCallback(
    (value: boolean) => {
      setOpenState(value);
      onOpenChange?.(value);
    },
    [onOpenChange],
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const close = useCallback(
    (restoreFocus = true) => {
      setOpen(false);
      if (restoreFocus) triggerRef.current?.focus();
    },
    [setOpen],
  );

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, close]);

  return (
    <div ref={rootRef} className="relative inline-flex">
      {trigger({
        ref: triggerRef,
        onClick: () => setOpen(!open),
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        'aria-controls': open ? menuId : undefined,
      })}
      {open && (
        <MenuContext.Provider value={{ close: () => close() }}>
          <MenuList
            id={menuId}
            label={label}
            onClose={() => close()}
            className={clsx('absolute z-50', placement === 'top' ? 'bottom-full mb-1' : 'top-full mt-1', align === 'end' ? 'right-0' : 'left-0')}
            style={{ width }}
          >
            {children}
          </MenuList>
        </MenuContext.Provider>
      )}
    </div>
  );
}

interface MenuListProps {
  id?: string;
  label: string;
  onClose: () => void;
  className?: string;
  style?: React.CSSProperties;
  children: ReactNode;
}

/** The menu surface; also usable on its own (e.g. for context menus). */
export function MenuList({ id, label, onClose, className, style, children }: MenuListProps) {
  const ref = useRef<HTMLDivElement>(null);

  const items = () =>
    Array.from(ref.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([aria-disabled="true"])') ?? []);

  useEffect(() => {
    items()[0]?.focus();
  }, []);

  const onKeyDown = (e: KeyboardEvent) => {
    const list = items();
    const index = list.indexOf(document.activeElement as HTMLElement);
    const focus = (i: number) => list[(i + list.length) % list.length]?.focus();
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        focus(index + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        focus(index - 1);
        break;
      case 'Home':
        e.preventDefault();
        focus(0);
        break;
      case 'End':
        e.preventDefault();
        focus(list.length - 1);
        break;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        onClose();
        break;
      case 'Tab':
        onClose();
        break;
    }
  };

  return (
    <div
      ref={ref}
      id={id}
      role="menu"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={clsx('rounded-lg border border-line bg-main py-1 shadow-pop', className)}
      style={style}
    >
      {children}
    </div>
  );
}

interface MenuItemProps {
  icon?: PhosphorIcon;
  leading?: ReactNode;
  onSelect: () => void;
  children: ReactNode;
  hint?: string;
  checked?: boolean;
  danger?: boolean;
  /** Keep the menu open after selecting (e.g. to show an inline editor). */
  keepOpen?: boolean;
}

export function MenuItem({ icon: Icon, leading, onSelect, children, hint, checked, danger, keepOpen }: MenuItemProps) {
  const { close } = useContext(MenuContext);
  const isRadio = checked !== undefined;
  return (
    <button
      type="button"
      role={isRadio ? 'menuitemradio' : 'menuitem'}
      aria-checked={isRadio ? checked : undefined}
      tabIndex={-1}
      onClick={() => {
        onSelect();
        if (!keepOpen) close();
      }}
      className={clsx(
        'flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm outline-none hover:bg-hover focus-visible:bg-hover focus-visible:outline-none',
        danger ? 'text-danger' : 'text-fg',
      )}
    >
      {leading ?? (Icon && <Icon className="size-4 shrink-0 text-muted" aria-hidden="true" />)}
      <span className="flex-1 truncate">{children}</span>
      {hint && <span className="text-xs text-subtle">{hint}</span>}
      {isRadio && <CheckIcon className={clsx('size-4 text-accent', !checked && 'invisible')} aria-hidden="true" />}
    </button>
  );
}

export function MenuSeparator() {
  return <div role="separator" className="my-1 border-t border-line" />;
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="px-3 pt-2 pb-1 text-xs font-semibold text-subtle uppercase">{children}</div>;
}
